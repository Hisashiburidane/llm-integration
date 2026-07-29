export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LlmFunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface LlmToolCall {
  id?: string;
  name: string;
  arguments: string;
}

export interface LlmClientOptions {
  endpoint?: string;
  model?: string;
  apiKey?: string;
  headers?: HeadersInit;
  configError?: string;
  timeout?: number;
  maxTokens?: number;
  fetcher?: typeof fetch;
  onDebug?: (event: LlmClientDebugEvent) => void;
}

export interface LlmRunOptions {
  prompt?: string;
  input?: string;
  context?: unknown;
  messages?: LlmMessage[];
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
  timeout?: number;
  maxTokens?: number;
  tools?: LlmFunctionTool[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  body?: Record<string, unknown>;
}

export interface LlmRunJsonOptions extends LlmRunOptions {
  prompt: string;
}

export interface LlmResponse {
  content: string;
  payload: unknown;
  toolCalls?: LlmToolCall[];
}

export interface LlmClientDebugEvent {
  requestId: string;
  phase: 'request' | 'response' | 'error';
  endpoint: string;
  durationMs?: number;
  detail: unknown;
}

export interface LlmClient {
  run(request: LlmRunOptions): Promise<LlmResponse>;
  runJson<T = unknown>(request: LlmRunJsonOptions): Promise<T>;
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

export function createLlmClient(options: LlmClientOptions = {}): LlmClient {
  const endpoint = options.endpoint ?? '/api/llm/chat/completions';
  const fetcher = options.fetcher ?? globalThis.fetch?.bind(globalThis);

  function emitDebug(event: LlmClientDebugEvent) {
    try {
      options.onDebug?.(event);
    } catch {
      // Debug observers must never affect the transport.
    }
  }

  async function run(request: LlmRunOptions): Promise<LlmResponse> {
    if (options.configError) throw new Error(options.configError);
    if (!fetcher) throw new Error('当前环境没有可用的 fetch 实现。');

    const model = request.model ?? options.model;
    if (!model) throw new Error('缺少 LLM model 配置。');

    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (options.apiKey && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${options.apiKey}`);

    const timeout = request.timeout ?? options.timeout;
    const maxTokens = request.maxTokens ?? options.maxTokens;
    const requestId = `llm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const startedAt = Date.now();
    const controller = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const abortFromCaller = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (request.signal?.aborted) abortFromCaller();
    if (typeof timeout === 'number' && timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error(`LLM 请求超过 ${timeout}ms 未完成。`));
      }, timeout);
    }

    try {
      const body = {
        model,
        temperature: request.temperature ?? 0,
        messages: buildMessages(request),
        ...(request.tools?.length ? { tools: request.tools, tool_choice: request.toolChoice ?? 'auto' } : {}),
        ...(typeof maxTokens === 'number' && maxTokens > 0 ? { max_tokens: Math.floor(maxTokens) } : {}),
        ...request.body
      };
      emitDebug({
        requestId,
        phase: 'request',
        endpoint,
        detail: {
          method: 'POST',
          body
        }
      });
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const detail = await response.text();
        emitDebug({
          requestId,
          phase: 'response',
          endpoint,
          durationMs: Date.now() - startedAt,
          detail: {
            status: response.status,
            statusText: response.statusText,
            body: detail
          }
        });
        throw new Error(`LLM 请求失败 (${response.status})：${detail.slice(0, 300) || response.statusText}`);
      }

      const payload = await response.json() as {
        choices?: Array<{
          finish_reason?: unknown;
          message?: {
            content?: unknown;
            tool_calls?: Array<{ id?: string; function?: { name?: unknown; arguments?: unknown } }>;
          };
        }>;
        usage?: unknown;
      };
      emitDebug({
        requestId,
        phase: 'response',
        endpoint,
        durationMs: Date.now() - startedAt,
        detail: {
          status: response.status,
          finishReason: payload.choices?.[0]?.finish_reason,
          usage: payload.usage,
          payload
        }
      });
      const message = payload.choices?.[0]?.message;
      const content = typeof message?.content === 'string' ? message.content : '';
      const toolCalls = message?.tool_calls?.flatMap((call) => {
        const name = call.function?.name;
        const args = call.function?.arguments;
        return typeof name === 'string' && typeof args === 'string'
          ? [{ id: call.id, name, arguments: args }]
          : [];
      });
      if (!content && !toolCalls?.length) throw new Error('LLM 响应中缺少 message.content 或 tool_calls。');
      return { content, payload, toolCalls };
    } catch (error) {
      const normalized = timedOut
        ? new Error(`LLM 请求超时（${timeout}ms）。`)
        : request.signal?.aborted || controller.signal.aborted
          ? new Error('LLM 请求已取消。')
          : error;
      emitDebug({
        requestId,
        phase: 'error',
        endpoint,
        durationMs: Date.now() - startedAt,
        detail: normalized instanceof Error ? normalized.message : normalized
      });
      if (normalized !== error) throw normalized;
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      request.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  async function runJson<T = unknown>(request: LlmRunJsonOptions): Promise<T> {
    const result = await run({
      ...request,
      messages: request.messages?.length ? request.messages : buildMessages(request, !request.tools?.length)
    });
    if (result.toolCalls?.length) return { content: result.content, toolCalls: result.toolCalls } as T;
    return parseLlmJson(result.content) as T;
  }

  return { run, runJson };
}
