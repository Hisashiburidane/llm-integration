import { createLlmClient, type LlmClientOptions } from './llm-client';
import type { EnchantPlan, EnchantPlanCall, EnchantSnapshot } from './enchantment';

export interface EnchantAgentRequest {
  input: string;
  snapshot: EnchantSnapshot;
  instruction?: string;
  signal?: AbortSignal;
}

export interface EnchantAgent {
  plan(request: EnchantAgentRequest): Promise<EnchantPlan>;
}

const DEFAULT_AGENT_PROMPT = [
  '你负责把用户意图转换为当前界面的 capability 调用计划。',
  '只能调用 snapshot.tools 中存在的 capabilityId，不得假设其他页面、权限或业务事实。',
  'Enchantment.instruction 是对应局部界面的补充约束，规划该区域的调用时必须遵守。',
  '字段是 metadata，不是独立工具；填写多个字段时合并为一次 field.fill 调用。',
  '根据 capability 的 description、effect 和 inputSchema 选择调用，不得从 metadata 推断未注册的操作。',
  '多个 capability 都能满足请求时，选择效果范围最小且调用次数最少的方案。',
  '使用最少调用完成任务。不要提交、审批、支付、删除或调用未授权动作。',
  '无法完成时 calls 返回空数组并说明原因。',
  '返回格式：{"message":"","snapshotVersion":0,"calls":[{"capabilityId":"","input":{},"reason":""}]}。'
].join('\n');

function validatePlan(value: unknown, snapshot: EnchantSnapshot): EnchantPlan {
  if (!value || typeof value !== 'object') throw new Error('LLM 返回的执行计划无效。');
  const candidate = value as Partial<EnchantPlan>;
  if (typeof candidate.message !== 'string' || !Array.isArray(candidate.calls)) {
    throw new Error('LLM 返回的执行计划结构无效。');
  }
  if (candidate.snapshotVersion !== snapshot.version) {
    throw new Error(`LLM 计划的 snapshot version 无效，应为 ${snapshot.version}。`);
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
    snapshotVersion: candidate.snapshotVersion,
    calls
  };
}

export function createDefaultEnchantAgent(options: LlmClientOptions = {}): EnchantAgent {
  const client = createLlmClient(options);
  return {
    async plan(request) {
      const plan = await client.runJson<unknown>({
        prompt: [DEFAULT_AGENT_PROMPT, request.instruction].filter(Boolean).join('\n\n'),
        input: request.input,
        context: request.snapshot,
        signal: request.signal
      });
      return validatePlan(plan, request.snapshot);
    }
  };
}
