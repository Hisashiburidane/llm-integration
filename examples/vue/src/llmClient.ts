import type { FieldId, ShippingFormState } from '@llm-ui/vue';

const fieldIds: FieldId[] = [
  'receiverName', 'receiverPhone', 'province', 'city', 'district',
  'receiverAddress', 'itemType', 'remark'
];

type ExtractionResult = {
  values: ShippingFormState;
  uncertainFields: FieldId[];
};

export type ScenarioStep = {
  action: string;
  target: string;
  value: string;
  reason: string;
};

export type ScenarioPlan = {
  summary: string;
  steps: ScenarioStep[];
};

export type FocusAction = {
  type: 'highlight' | 'open' | 'compose' | 'clear';
  panelIds: string[];
};

export type FocusPlan = {
  message: string;
  actions: FocusAction[];
};

function parseJsonContent(content: unknown): unknown {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM 没有返回文本内容。');
  }
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('LLM 返回的内容不是合法 JSON。');
  }
}

function validateResult(value: unknown): ExtractionResult {
  if (!value || typeof value !== 'object') throw new Error('LLM 返回结果缺少 JSON 对象。');
  const candidate = value as Record<string, unknown>;
  const rawValues = candidate.values;
  if (!rawValues || typeof rawValues !== 'object') throw new Error('LLM 返回结果缺少 values。');

  const values = Object.fromEntries(fieldIds.map((id) => {
    const fieldValue = (rawValues as Record<string, unknown>)[id];
    if (fieldValue != null && typeof fieldValue !== 'string') {
      throw new Error(`LLM 返回字段 ${id} 不是字符串。`);
    }
    return [id, fieldValue ?? ''];
  })) as ShippingFormState;

  const uncertainFields = Array.isArray(candidate.uncertainFields)
    ? candidate.uncertainFields.filter((id): id is FieldId => fieldIds.includes(id as FieldId))
    : [];

  return { values, uncertainFields };
}

export async function extractShippingForm(input: string): Promise<ExtractionResult> {
  if (__LLM_CONFIG_ERROR__) {
    throw new Error(`${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。`);
  }
  const response = await fetch('/api/llm/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: __LLM_MODEL__,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `从用户文本提取快递收件信息。只返回 JSON，不要返回 Markdown。格式：
{"values":{"receiverName":"","receiverPhone":"","province":"","city":"","district":"","receiverAddress":"","itemType":"","remark":""},"uncertainFields":[]}
itemType 只能是 Document、Clothing、Digital device、Food 或空字符串。无法确定的值留空；有合理推断但不确定时填写并把字段名加入 uncertainFields。不要编造信息。`
        },
        { role: 'user', content: input }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM 请求失败 (${response.status})：${detail.slice(0, 300) || response.statusText}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  return validateResult(parseJsonContent(payload.choices?.[0]?.message?.content));
}

export async function createScenarioPlan(options: {
  instruction: string;
  input: string;
  metadata: string[];
  actions: string[];
}): Promise<ScenarioPlan> {
  if (__LLM_CONFIG_ERROR__) {
    throw new Error(`${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。`);
  }
  const response = await fetch('/api/llm/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: __LLM_MODEL__,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `${options.instruction}\n只返回 JSON，不要返回 Markdown。格式：{"summary":"","steps":[{"action":"","target":"","value":"","reason":""}]}。action 只能从 ${JSON.stringify(options.actions)} 中选择，target 必须引用给定 metadata；不要编造页面能力。`
        },
        {
          role: 'user',
          content: `页面 metadata：${JSON.stringify(options.metadata)}\n用户输入：${options.input}`
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM 请求失败 (${response.status})：${detail.slice(0, 300) || response.statusText}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const parsed = parseJsonContent(payload.choices?.[0]?.message?.content) as Partial<ScenarioPlan>;
  if (typeof parsed?.summary !== 'string' || !Array.isArray(parsed.steps)) {
    throw new Error('LLM 返回的场景计划结构无效。');
  }
  const steps = parsed.steps.map((step, index) => {
    if (!step || typeof step !== 'object') throw new Error(`LLM 返回的第 ${index + 1} 个步骤无效。`);
    const item = step as Partial<ScenarioStep>;
    if (!item.action || !options.actions.includes(item.action)) {
      throw new Error(`LLM 返回了不允许的动作：${item.action ?? 'empty'}。`);
    }
    return {
      action: item.action,
      target: typeof item.target === 'string' ? item.target : '',
      value: typeof item.value === 'string' ? item.value : '',
      reason: typeof item.reason === 'string' ? item.reason : ''
    };
  });
  return { summary: parsed.summary, steps };
}

export async function createFocusPlan(question: string, scopes: Array<{
  id: string;
  prompt: string;
  metadata: unknown[];
}>): Promise<FocusPlan> {
  if (__LLM_CONFIG_ERROR__) throw new Error(`${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。`);
  const panelIds = scopes.map((scope) => scope.id);
  const response = await fetch('/api/llm/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: __LLM_MODEL__,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `你是 Kubernetes 运维大屏助手。根据 panel scope metadata 选择相关面板并控制 Focus View。只返回 JSON：{"message":"简短结论","actions":[{"type":"highlight|open|compose|clear","panelIds":["panel-id"]}]}。highlight 用于高亮相关面板；open 仅打开最相关的一个面板；compose 将 2-6 个相关面板组合成子 dashboard；clear 清除当前 Focus View。只能使用上下文中存在的 panel id，不得编造。`
        },
        { role: 'user', content: `Panel scopes:\n${JSON.stringify(scopes)}\n\nRequest:\n${question}` }
      ]
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM 请求失败 (${response.status})：${detail.slice(0, 300) || response.statusText}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const parsed = parseJsonContent(payload.choices?.[0]?.message?.content) as Partial<FocusPlan>;
  if (typeof parsed.message !== 'string' || !Array.isArray(parsed.actions)) throw new Error('LLM 返回的 Focus View 计划结构无效。');
  const allowedTypes = ['highlight', 'open', 'compose', 'clear'] as const;
  const actions = parsed.actions.map((raw) => {
    if (!raw || !allowedTypes.includes(raw.type as FocusAction['type'])) throw new Error(`LLM 返回了不允许的 Focus View 动作：${raw?.type ?? 'empty'}。`);
    if (!Array.isArray(raw.panelIds)) throw new Error('LLM action 缺少 panelIds。');
    const invalidIds = raw.panelIds.filter((id) => !panelIds.includes(id));
    if (invalidIds.length) throw new Error(`LLM 引用了未注册的 panel：${invalidIds.join(', ')}。`);
    return { type: raw.type as FocusAction['type'], panelIds: raw.panelIds };
  });
  return { message: parsed.message, actions };
}
