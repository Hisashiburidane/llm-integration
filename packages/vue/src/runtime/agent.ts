import { createLlmClient, parseLlmJson, type LlmClientOptions, type LlmFunctionTool, type LlmToolCall } from './llm-client';
import type {
  EnchantMetadataNode,
  EnchantMetadataTreeNode,
  EnchantExecutionResult,
  EnchantPlan,
  EnchantPlanCall,
  EnchantSnapshot
} from './enchantment';
import type { LlmMessage } from './llm-client';

export interface EnchantConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface EnchantAgentRequest {
  input: string;
  snapshot: EnchantSnapshot;
  instruction?: string;
  history?: readonly EnchantConversationMessage[];
  signal?: AbortSignal;
}

export interface EnchantAgent {
  plan(request: EnchantAgentRequest): Promise<EnchantPlan>;
  planNext?(request: EnchantAgentContinuationRequest): Promise<EnchantAgentContinuation | undefined>;
  respond?(request: EnchantAgentResponseRequest): Promise<string>;
}

export interface EnchantAgentContinuationRequest {
  input: string;
  snapshot: EnchantSnapshot;
  plans: readonly EnchantPlan[];
  results: readonly EnchantExecutionResult[];
  instruction?: string;
  history?: readonly EnchantConversationMessage[];
  signal?: AbortSignal;
}

export interface EnchantAgentContinuation {
  plan?: EnchantPlan;
  message?: string;
}

export interface EnchantAgentResponseRequest {
  input: string;
  snapshot: EnchantSnapshot;
  plan: EnchantPlan;
  results: EnchantExecutionResult[];
  instruction?: string;
  history?: readonly EnchantConversationMessage[];
  signal?: AbortSignal;
}

export interface EnchantLlmContext {
  pageId: string;
  app?: string;
  route?: string;
  tab?: string;
  tags?: string[];
  structure: EnchantMetadataTreeNode;
}

function projectMetadataTreeNode(node: EnchantMetadataNode): EnchantMetadataTreeNode {
  const title = 'title' in node && typeof node.title === 'string' ? node.title : undefined;
  const text = 'text' in node && typeof node.text === 'string' ? node.text : undefined;
  const result: EnchantMetadataTreeNode = {
    id: node.id,
    label: node.label ?? title ?? text ?? node.id,
    type: 'metadata',
    kind: node.kind
  };
  if ('children' in node) result.children = node.children.map(projectMetadataTreeNode);
  return result;
}

export function buildEnchantLlmContext(snapshot: EnchantSnapshot): EnchantLlmContext {
  return {
    pageId: snapshot.pageId,
    app: snapshot.app,
    route: snapshot.route,
    tab: snapshot.tab,
    tags: snapshot.tags,
    structure: {
      id: snapshot.pageId,
      label: snapshot.pageId,
      type: 'page',
      children: snapshot.enchantments.map((enchantment) => ({
        id: enchantment.id,
        label: enchantment.name ?? enchantment.id,
        type: 'enchantment' as const,
        kind: enchantment.kind,
        children: enchantment.metadata.map(projectMetadataTreeNode)
      }))
    }
  };
}

interface ToolBinding {
  capabilityId: string;
  definition: LlmFunctionTool;
}

function buildToolBindings(snapshot: EnchantSnapshot): ToolBinding[] {
  return snapshot.tools.map((tool, index) => {
    const scope = snapshot.enchantments.find((item) => item.id === tool.enchantmentId);
    const description = [
      tool.label,
      tool.description,
      tool.target ? `目标：${tool.target}` : undefined,
      `效果：${tool.effect}`,
      scope?.instruction ? `局部规则：${scope.instruction}` : undefined
    ].filter(Boolean).join('。');
    return {
      capabilityId: tool.capabilityId,
      definition: {
        type: 'function',
        function: {
          name: `enchant_tool_${index}`,
          description,
          parameters: tool.inputSchema ?? { type: 'object', properties: {} }
        }
      }
    };
  });
}

const DEFAULT_AGENT_PROMPT = [
  '你负责把用户意图转换为当前界面的 capability 调用计划。',
  '页面 structure 只用于解析用户提到的区域、字段、图表或面板；它不是可执行工具。',
  '只能调用请求中提供的 function tools，不得假设其他页面、权限或业务事实。',
  '优先使用 function tool 完成请求；没有匹配工具时不要猜测执行动作。',
  '如果用户要求分析、比较、解释或查找数据，必须调用能返回实际数据的 read capability；读取页面上下文只能发现结构，不能作为数据答案。',
  '多个 capability 都能满足请求时，选择效果范围最小且调用次数最少的方案。',
  '使用最少调用完成任务。不要提交、审批、支付、删除或调用未授权动作。',
  '无法完成时 calls 返回空数组并说明原因。',
  '如果服务端未执行 function tool calling，才使用 JSON 格式：{"message":"","calls":[{"capabilityId":"","input":{},"reason":""}]}。'
].join('\n');

function buildInstructions(snapshot: EnchantSnapshot) {
  return snapshot.enchantments
    .filter((enchantment) => enchantment.instruction)
    .map((enchantment) => `区域 ${enchantment.name ?? enchantment.id} 的规则：${enchantment.instruction}`);
}

function buildConversationMessages(
  prompt: string,
  history: readonly EnchantConversationMessage[],
  input: string,
  context: unknown
): LlmMessage[] {
  return [
    { role: 'system', content: prompt },
    ...history.map((message) => ({ role: message.role, content: message.content })),
    { role: 'user', content: `Context:\n${JSON.stringify(context)}\n\nInput:\n${input}` }
  ];
}

function buildExecutionResultContext(snapshot: EnchantSnapshot, results: readonly EnchantExecutionResult[]) {
  return results.map((result) => {
    const tool = snapshot.tools.find((item) => item.capabilityId === result.capabilityId);
    return {
      capabilityId: result.capabilityId,
      name: tool?.name,
      label: tool?.label,
      effect: tool?.effect,
      ok: result.ok,
      status: result.status,
      summary: result.summary,
      error: result.error,
      value: result.value
    };
  });
}

function planFromToolCalls(value: unknown, snapshot: EnchantSnapshot, bindings: ToolBinding[]): EnchantPlan | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const response = value as { content?: unknown; toolCalls?: LlmToolCall[] };
  if (!Array.isArray(response.toolCalls)) return undefined;
  const byName = new Map(bindings.map((binding) => [binding.definition.function.name, binding.capabilityId]));
  const calls = response.toolCalls.map((toolCall, index) => {
    const capabilityId = byName.get(toolCall.name);
    if (!capabilityId) throw new Error(`LLM 返回了未注册的 function tool：${toolCall.name}。`);
    let input: unknown;
    try {
      input = parseLlmJson(toolCall.arguments);
    } catch {
      throw new Error(`function tool ${toolCall.name} 的参数不是合法 JSON（第 ${index + 1} 个调用）。`);
    }
    return { capabilityId, input };
  });
  return validatePlan({
    message: typeof response.content === 'string' ? response.content : '',
    calls
  }, snapshot);
}

function validatePlan(value: unknown, snapshot: EnchantSnapshot): EnchantPlan {
  if (!value || typeof value !== 'object') throw new Error('LLM 返回的执行计划无效。');
  const candidate = value as Partial<EnchantPlan>;
  if (typeof candidate.message !== 'string' || !Array.isArray(candidate.calls)) {
    throw new Error('LLM 返回的执行计划结构无效。');
  }
  const allowed = new Set(snapshot.tools.map((tool) => tool.capabilityId));
  const calls = candidate.calls.map((call, index): EnchantPlanCall => {
    if (!call || typeof call !== 'object') throw new Error(`第 ${index + 1} 个 capability 调用无效。`);
    const item = call as Partial<EnchantPlanCall>;
    if (!item.capabilityId || !allowed.has(item.capabilityId)) {
      throw new Error(`LLM 返回了未注册的 capability：${item.capabilityId ?? 'empty'}。`);
    }
    return {
      capabilityId: item.capabilityId,
      input: item.input,
      reason: typeof item.reason === 'string' ? item.reason : undefined
    };
  });

  return {
    message: candidate.message,
    calls
  };
}

export function createDefaultEnchantAgent(options: LlmClientOptions = {}, client = createLlmClient(options)): EnchantAgent {
  return {
    async plan(request) {
      const bindings = buildToolBindings(request.snapshot);
      const prompt = [
        DEFAULT_AGENT_PROMPT,
        ...buildInstructions(request.snapshot),
        request.instruction,
        bindings.length ? undefined : '只返回 JSON，不要返回 Markdown。'
      ].filter(Boolean).join('\n\n');
      const context = buildEnchantLlmContext(request.snapshot);
      const plan = await client.runJson<unknown>({
        prompt,
        input: request.input,
        context,
        ...(request.history?.length
          ? { messages: buildConversationMessages(prompt, request.history, request.input, context) }
          : {}),
        tools: bindings.map((binding) => binding.definition),
        signal: request.signal
      });
      return planFromToolCalls(plan, request.snapshot, bindings) ?? validatePlan(plan, request.snapshot);
    },
    async planNext(request) {
      const bindings = buildToolBindings(request.snapshot);
      const prompt = [
        '你负责根据已经执行的 capability 结果决定是否还需要调用其他 capability。',
        '只能调用请求中提供的 function tools，不得重复完全相同的已完成调用。',
        '应用 instruction 描述了本次任务的完成条件；如果仍缺少明确要求的界面操作，继续调用对应 capability。',
        'executionResults 是业务事实来源。不得根据页面 structure 或先前回答编造数据。',
        '如果任务已经完成，直接生成最终回答，不再调用工具。',
        '如果服务端未执行 function tool calling，但仍需调用工具，返回 JSON：{"message":"","calls":[{"capabilityId":"","input":{},"reason":""}]}。',
        request.instruction
      ].filter(Boolean).join('\n\n');
      const context = {
        page: buildEnchantLlmContext(request.snapshot),
        completedPlans: request.plans,
        executionResults: buildExecutionResultContext(request.snapshot, request.results)
      };
      const response = await client.run({
        prompt,
        input: request.input,
        context,
        ...(request.history?.length
          ? { messages: buildConversationMessages(prompt, request.history, request.input, context) }
          : {}),
        tools: bindings.map((binding) => binding.definition),
        signal: request.signal
      });
      const nativePlan = planFromToolCalls(response, request.snapshot, bindings);
      if (nativePlan?.calls.length) return { plan: nativePlan };

      const content = response.content.trim();
      if (content.startsWith('{')) {
        try {
          const fallbackPlan = validatePlan(parseLlmJson(content), request.snapshot);
          if (fallbackPlan.calls.length) return { plan: fallbackPlan };
          return { message: fallbackPlan.message };
        } catch {
          // A JSON-looking final answer remains ordinary assistant content.
        }
      }
      return content ? { message: content } : undefined;
    },
    async respond(request) {
      const resultContext = buildExecutionResultContext(request.snapshot, request.results);
      const prompt = [
        '你负责根据用户问题和已执行 capability 结果生成最终回答。',
        '只能引用 executionResults 中实际返回的数据，不得编造数值、原因或未读取的面板结果。',
        '如果结果不足以回答问题，明确说明缺少什么数据。只有 executionResults 中 effect 为 visual 且 ok 为 true 的结果，才可以声称界面发生了变化；没有成功执行 highlight capability 时，不得声称面板已高亮。',
        '直接回答用户问题，使用简洁的中文，可列出关键指标和证据。',
        request.instruction
      ].filter(Boolean).join('\n');
      const context = {
        page: buildEnchantLlmContext(request.snapshot),
        plan: request.plan,
        executionResults: resultContext
      };
      const response = await client.run({
        prompt,
        input: request.input,
        context,
        ...(request.history?.length
          ? { messages: buildConversationMessages(prompt, request.history, request.input, context) }
          : {}),
        signal: request.signal,
        toolChoice: 'none'
      });
      if (!response.content.trim()) throw new Error('LLM 没有生成最终分析回答。');
      return response.content.trim();
    }
  };
}
