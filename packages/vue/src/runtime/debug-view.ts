import type {
  Enchantment,
  EnchantMetadataNode,
  EnchantSnapshot,
  EnchantTraceEvent,
  EnchantTool
} from './enchantment';

export interface EnchantDebugScopeNode {
  enchantment: Enchantment;
  tools: EnchantTool[];
  children: EnchantDebugScopeNode[];
}

export interface EnchantDebugMetadataRow {
  key: string;
  id: string;
  scopeId: string;
  scopeName: string;
  component: string;
  path: string;
  kind: string;
  label: string;
  source: string;
  visible: boolean;
  enabled: boolean;
  value?: unknown;
}

export interface EnchantLlmDebugRow {
  requestId: string;
  timestamp: string;
  endpoint: string;
  model?: string;
  messageCount: number;
  toolCount: number;
  toolChoice?: string;
  status: 'pending' | 'completed' | 'failed';
  httpStatus?: number;
  finishReason?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  toolCallCount: number;
  contentLength: number;
  request?: unknown;
  response?: unknown;
  error?: unknown;
}

function record(value: unknown): Record<string, any> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : undefined;
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function text(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function buildEnchantLlmDebugRows(events: readonly EnchantTraceEvent[]): EnchantLlmDebugRow[] {
  const rows = new Map<string, EnchantLlmDebugRow>();

  events.filter((event) => event.kind === 'llm').forEach((event) => {
    const envelope = record(event.detail);
    const requestId = text(envelope?.requestId) ?? event.source;
    const phase = text(envelope?.phase);
    const detail = record(envelope?.detail);
    const row = rows.get(requestId) ?? {
      requestId,
      timestamp: event.timestamp,
      endpoint: text(envelope?.endpoint) ?? '-',
      messageCount: 0,
      toolCount: 0,
      status: 'pending',
      toolCallCount: 0,
      contentLength: 0
    };

    if (phase === 'request') {
      const body = record(detail?.body);
      row.timestamp = event.timestamp;
      row.endpoint = text(envelope?.endpoint) ?? row.endpoint;
      row.model = text(body?.model);
      row.messageCount = Array.isArray(body?.messages) ? body.messages.length : 0;
      row.toolCount = Array.isArray(body?.tools) ? body.tools.length : 0;
      row.toolChoice = text(body?.tool_choice);
      row.request = body ?? detail;
    } else if (phase === 'response') {
      const payload = record(detail?.payload);
      const choice = record(Array.isArray(payload?.choices) ? payload.choices[0] : undefined);
      const message = record(choice?.message);
      const content = text(message?.content) ?? '';
      const usage = record(detail?.usage) ?? record(payload?.usage);
      row.durationMs = number(envelope?.durationMs);
      row.httpStatus = number(detail?.status);
      row.finishReason = text(detail?.finishReason) ?? text(choice?.finish_reason);
      row.inputTokens = number(usage?.prompt_tokens) ?? number(usage?.input_tokens);
      row.outputTokens = number(usage?.completion_tokens) ?? number(usage?.output_tokens);
      row.totalTokens = number(usage?.total_tokens);
      row.toolCallCount = Array.isArray(message?.tool_calls) ? message.tool_calls.length : 0;
      row.contentLength = content.length;
      row.status = row.httpStatus !== undefined && row.httpStatus >= 400 ? 'failed' : 'completed';
      row.response = payload ?? detail?.body ?? detail;
    } else if (phase === 'error') {
      row.durationMs = number(envelope?.durationMs);
      row.status = 'failed';
      row.error = envelope?.detail;
    }

    rows.set(requestId, row);
  });

  return Array.from(rows.values()).sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp));
}

export function buildEnchantDebugScopeTree(snapshot: EnchantSnapshot): EnchantDebugScopeNode[] {
  const toolsByScope = new Map<string, EnchantTool[]>();
  snapshot.tools.forEach((tool) => {
    const tools = toolsByScope.get(tool.enchantmentId) ?? [];
    tools.push(tool);
    toolsByScope.set(tool.enchantmentId, tools);
  });
  const nodes = new Map<string, EnchantDebugScopeNode>(snapshot.enchantments.map((enchantment) => [
    enchantment.id,
    {
      enchantment,
      tools: toolsByScope.get(enchantment.id) ?? [],
      children: []
    }
  ]));
  const roots: EnchantDebugScopeNode[] = [];
  snapshot.enchantments.forEach((enchantment) => {
    const node = nodes.get(enchantment.id);
    if (!node) return;
    const parentId = enchantment.source.parentEnchantmentId;
    const parent = parentId && parentId !== enchantment.id ? nodes.get(parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

export function flattenEnchantDebugMetadata(snapshot: EnchantSnapshot): EnchantDebugMetadataRow[] {
  const rows: EnchantDebugMetadataRow[] = [];

  function visit(
    enchantment: Enchantment,
    nodes: EnchantMetadataNode[],
    ancestors: string[],
    keyPrefix: string
  ) {
    nodes.forEach((node, index) => {
      const label = node.label
        ?? ('title' in node && typeof node.title === 'string' ? node.title : undefined)
        ?? ('text' in node && typeof node.text === 'string' ? node.text : undefined)
        ?? node.id;
      const path = [...ancestors, label];
      rows.push({
        key: `${keyPrefix}:${index}:${node.id}`,
        id: node.id,
        scopeId: enchantment.id,
        scopeName: enchantment.name ?? enchantment.id,
        component: node.component ?? enchantment.source.component ?? '-',
        path: path.join(' / '),
        kind: node.kind,
        label,
        source: node.source,
        visible: node.visible,
        enabled: node.enabled,
        ...('value' in node ? { value: node.value } : {})
      });
      if ('children' in node) visit(enchantment, node.children, path, `${keyPrefix}:${index}`);
    });
  }

  snapshot.enchantments.forEach((enchantment, index) => {
    visit(enchantment, enchantment.metadata, [], `${index}:${enchantment.id}`);
  });
  return rows;
}
