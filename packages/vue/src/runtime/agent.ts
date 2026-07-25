import { createLlmClient, parseLlmJson, type LlmClientOptions, type LlmFunctionTool, type LlmToolCall } from './llm-client';
import type {
  EnchantMetadataNode,
  EnchantMetadataTreeNode,
  EnchantPlan,
  EnchantPlanCall,
  EnchantSnapshot
} from './enchantment';

export interface EnchantAgentRequest {
  input: string;
  snapshot: EnchantSnapshot;
  instruction?: string;
  signal?: AbortSignal;
}

export interface EnchantAgent {
  plan(request: EnchantAgentRequest): Promise<EnchantPlan>;
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
  const rawSnapshotVersion = (value as Record<string, unknown>).snapshotVersion;
  if (rawSnapshotVersion !== undefined) {
    const snapshotVersion = typeof rawSnapshotVersion === 'string'
      ? Number(rawSnapshotVersion)
      : rawSnapshotVersion;
    if (!Number.isInteger(snapshotVersion) || snapshotVersion !== snapshot.version) {
      throw new Error(`LLM 计划的 snapshot version 无效（收到 ${String(rawSnapshotVersion)}），应为 ${snapshot.version}。`);
    }
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
    snapshotVersion: snapshot.version,
    calls
  };
}

export function createDefaultEnchantAgent(options: LlmClientOptions = {}, client = createLlmClient(options)): EnchantAgent {
  return {
    async plan(request) {
      const bindings = buildToolBindings(request.snapshot);
      const plan = await client.runJson<unknown>({
        prompt: [
          DEFAULT_AGENT_PROMPT,
          ...buildInstructions(request.snapshot),
          request.instruction
        ].filter(Boolean).join('\n\n'),
        input: request.input,
        context: buildEnchantLlmContext(request.snapshot),
        tools: bindings.map((binding) => binding.definition),
        signal: request.signal
      });
      return planFromToolCalls(plan, request.snapshot, bindings) ?? validatePlan(plan, request.snapshot);
    }
  };
}
