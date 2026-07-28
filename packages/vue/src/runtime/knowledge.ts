export type EnchantKnowledgeFilterValue = string | number | boolean | readonly string[];

export interface EnchantKnowledgeQuery {
  query: string;
  topK?: number;
  filters?: Record<string, EnchantKnowledgeFilterValue>;
  page?: string;
  enchantmentId?: string;
  signal?: AbortSignal;
}

export interface EnchantKnowledgeChunk {
  id: string;
  content: string;
  title?: string;
  source?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface EnchantKnowledgeResult {
  providerId: string;
  query: string;
  chunks: EnchantKnowledgeChunk[];
}

export interface EnchantKnowledgeProvider {
  id: string;
  retrieve(query: EnchantKnowledgeQuery): Promise<EnchantKnowledgeResult>;
}

export interface EnchantKnowledgeDocument extends Omit<EnchantKnowledgeChunk, 'score'> {}

export interface StaticKnowledgeProviderOptions {
  id?: string;
  documents: readonly EnchantKnowledgeDocument[];
}

export interface HttpKnowledgeProviderOptions {
  id?: string;
  endpoint: string;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  fetch?: typeof globalThis.fetch;
}

function normalizedTokens(value: string) {
  const normalized = value.toLocaleLowerCase().normalize('NFKC');
  const words = normalized.match(/[a-z0-9][a-z0-9._-]*/g) ?? [];
  const chinese = normalized.match(/[\u3400-\u9fff]/g) ?? [];
  return Array.from(new Set([...words, ...chinese]));
}

function matchesFilters(document: EnchantKnowledgeDocument, filters: EnchantKnowledgeQuery['filters']) {
  if (!filters) return true;
  return Object.entries(filters).every(([key, expected]) => {
    const actual = document.metadata?.[key];
    if (Array.isArray(expected)) {
      if (Array.isArray(actual)) return expected.some((value) => actual.includes(value));
      return expected.includes(String(actual));
    }
    return actual === expected;
  });
}

function scoreDocument(document: EnchantKnowledgeDocument, query: string, tokens: string[]) {
  const title = document.title?.toLocaleLowerCase().normalize('NFKC') ?? '';
  const content = document.content.toLocaleLowerCase().normalize('NFKC');
  const source = document.source?.toLocaleLowerCase().normalize('NFKC') ?? '';
  const normalizedQuery = query.toLocaleLowerCase().normalize('NFKC').trim();
  let score = normalizedQuery && `${title}\n${content}`.includes(normalizedQuery) ? 8 : 0;
  tokens.forEach((token) => {
    if (title.includes(token)) score += 3;
    if (content.includes(token)) score += 1;
    if (source.includes(token)) score += 0.5;
  });
  return score;
}

export function createStaticKnowledgeProvider(
  options: StaticKnowledgeProviderOptions
): EnchantKnowledgeProvider {
  const providerId = options.id?.trim() || 'static';
  const documents = [...options.documents];
  return {
    id: providerId,
    async retrieve(query) {
      if (query.signal?.aborted) throw query.signal.reason ?? new Error('知识检索已取消。');
      const tokens = normalizedTokens(query.query);
      const limit = Math.max(1, query.topK ?? 5);
      const chunks = documents
        .filter((document) => matchesFilters(document, query.filters))
        .map((document) => ({ ...document, score: scoreDocument(document, query.query, tokens) }))
        .filter((document) => document.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
      return { providerId, query: query.query, chunks };
    }
  };
}

export function createHttpKnowledgeProvider(
  options: HttpKnowledgeProviderOptions
): EnchantKnowledgeProvider {
  const providerId = options.id?.trim() || 'http';
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error('当前环境不支持 fetch，请为 HTTP Knowledge Provider 提供 fetch。');

  return {
    id: providerId,
    async retrieve(query) {
      const headers = typeof options.headers === 'function'
        ? await options.headers()
        : options.headers;
      const requestHeaders = new Headers(headers);
      if (!requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
      const response = await fetcher(options.endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          query: query.query,
          topK: query.topK,
          filters: query.filters,
          page: query.page,
          enchantmentId: query.enchantmentId
        }),
        signal: query.signal
      });
      if (!response.ok) {
        throw new Error(`Knowledge Provider 请求失败：HTTP ${response.status}。`);
      }
      const result = await response.json() as Partial<EnchantKnowledgeResult>;
      if (!Array.isArray(result.chunks)) throw new Error('Knowledge Provider 返回结果缺少 chunks。');
      return {
        providerId: result.providerId || providerId,
        query: result.query || query.query,
        chunks: result.chunks
      };
    }
  };
}
