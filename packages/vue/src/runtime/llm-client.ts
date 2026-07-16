export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LlmClientOptions {
  endpoint?: string;
  model?: string;
  apiKey?: string;
  headers?: HeadersInit;
  configError?: string;
  fetcher?: typeof fetch;
}

export interface LlmRunOptions {
  prompt?: string;
  input?: string;
  context?: unknown;
  messages?: LlmMessage[];
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
  body?: Record<string, unknown>;
}

export interface LlmRunJsonOptions extends LlmRunOptions {
  prompt: string;
}

export interface LlmResponse {
  content: string;
  payload: unknown;
}

export function parseLlmJson(content: unknown): unknown {
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

function buildMessages(options: LlmRunOptions, jsonOnly = false): LlmMessage[] {
  if (options.messages?.length) return options.messages;

  const userParts: string[] = [];
  if (options.context !== undefined) userParts.push(`Context:\n${JSON.stringify(options.context)}`);
  if (options.input !== undefined) userParts.push(`Input:\n${options.input}`);
  const prompt = [options.prompt, jsonOnly ? '只返回 JSON，不要返回 Markdown。' : ''].filter(Boolean).join('\n');

  return [
    ...(prompt ? [{ role: 'system' as const, content: prompt }] : []),
    { role: 'user', content: userParts.join('\n\n') }
  ];
}

export function createLlmClient(options: LlmClientOptions = {}) {
  const endpoint = options.endpoint ?? '/api/llm/chat/completions';
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);

  async function run(request: LlmRunOptions): Promise<LlmResponse> {
    if (options.configError) throw new Error(options.configError);
    if (!fetcher) throw new Error('当前环境没有可用的 fetch 实现。');

    const model = request.model ?? options.model;
    if (!model) throw new Error('缺少 LLM model 配置。');

    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (options.apiKey && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${options.apiKey}`);

    const response = await fetcher(endpoint, {
      method: 'POST',
      headers,
      signal: request.signal,
      body: JSON.stringify({
        model,
        temperature: request.temperature ?? 0,
        messages: buildMessages(request),
        ...request.body
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM 请求失败 (${response.status})：${detail.slice(0, 300) || response.statusText}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('LLM 响应中缺少 message.content。');
    return { content, payload };
  }

  async function runJson<T = unknown>(request: LlmRunJsonOptions): Promise<T> {
    const result = await run({
      ...request,
      messages: request.messages?.length ? request.messages : buildMessages(request, true)
    });
    return parseLlmJson(result.content) as T;
  }

  return { run, runJson };
}
