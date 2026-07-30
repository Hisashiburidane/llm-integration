import type {
  EnchantMetadataNode,
  EnchantSnapshot,
  EnchantTool,
  LlmClient
} from '@enchantforge/vue';
import type { PanelAttentionSnapshot } from './panel-attention';

export interface PetCapability {
  name: string;
  label: string;
  description: string;
  effect: EnchantTool['effect'];
}

export interface PetContextNode {
  id: string;
  label: string;
  kind: string;
  description?: string;
  children?: PetContextNode[];
}

export interface PetPageContext {
  pageId: string;
  app?: string;
  route?: string;
  tab?: string;
  tags?: string[];
  areas: Array<{
    id: string;
    name: string;
    kind: string;
    description?: string;
    metadata: PetContextNode[];
  }>;
}

export interface PetTip {
  id: string;
  title: string;
  body: string;
  category: 'guide' | 'suggestion' | 'help';
  relatedPanelIds: string[];
  relatedTools: string[];
}

const PET_PROMPT = [
  '你是可视化数据平台中的页面向导。',
  '根据页面与能力摘要生成 3-4 条简短、具体的使用提示。',
  '不要声称已经执行操作，不要编造数据结论。',
  '只引用摘要中存在的 Tool name 和 Panel ID。',
  '返回 JSON：{"tips":[{"id":"","title":"","body":"","category":"guide","relatedPanelIds":[],"relatedTools":[]}]}'
].join('\n');

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function shortText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function projectMetadata(node: EnchantMetadataNode): PetContextNode | undefined {
  // Panel enchantments already carry their own id, title and description.
  if (node.kind === 'panel') return undefined;
  const title = 'title' in node && typeof node.title === 'string' ? node.title : undefined;
  const text = 'text' in node && typeof node.text === 'string' ? node.text : undefined;
  const children = 'children' in node
    ? node.children.flatMap((child): PetContextNode[] => {
      const projected = projectMetadata(child);
      return projected ? [projected] : [];
    })
    : [];
  return {
    id: node.id,
    label: shortText(node.label ?? title ?? text ?? node.id, 80),
    kind: node.kind,
    ...(shortText(node.description, 160) ? { description: shortText(node.description, 160) } : {}),
    ...(children.length ? { children } : {})
  };
}

function collectPanelIds(context: PetPageContext) {
  const ids = new Set<string>();
  const visit = (node: PetContextNode) => {
    if (node.kind === 'panel-reference') ids.add(node.id);
    node.children?.forEach(visit);
  };
  context.areas.forEach((area) => {
    if (area.kind === 'panel') ids.add(area.id);
    area.metadata.forEach(visit);
  });
  return ids;
}

export function buildPetPageContext(snapshot: EnchantSnapshot): PetPageContext {
  return {
    pageId: snapshot.pageId,
    app: snapshot.app,
    route: snapshot.route,
    tab: snapshot.tab,
    tags: snapshot.tags,
    areas: snapshot.enchantments.map((enchantment) => {
      const panel = enchantment.metadata.find((node) => node.kind === 'panel');
      return {
        id: enchantment.id,
        name: shortText(enchantment.name ?? enchantment.id, 80),
        kind: enchantment.kind,
        ...(shortText(panel?.description, 160) ? { description: shortText(panel?.description, 160) } : {}),
        metadata: enchantment.metadata.flatMap((node): PetContextNode[] => {
          const projected = projectMetadata(node);
          return projected ? [projected] : [];
        })
      };
    })
  };
}

export function buildPetCapabilityCatalog(snapshot: EnchantSnapshot): PetCapability[] {
  const capabilities = new Map<string, PetCapability>();
  snapshot.tools.forEach((tool) => {
    if (capabilities.has(tool.name)) return;
    capabilities.set(tool.name, {
      name: tool.name,
      label: shortText(tool.label, 80),
      description: shortText(tool.description, 180),
      effect: tool.effect
    });
  });
  return [...capabilities.values()];
}

function projectAttention(attention: PanelAttentionSnapshot) {
  return {
    panels: attention.panels.slice(0, 6).map((panel) => ({
      panelId: panel.panelId,
      title: panel.title,
      visits: panel.visits,
      selections: panel.selections,
      dwellMs: panel.dwellMs
    })),
    trail: attention.trail.slice(-6).map(({ panelId, title }) => ({ panelId, title }))
  };
}

export function petContextSignature(
  context: PetPageContext,
  capabilities: PetCapability[]
) {
  const input = JSON.stringify({
    pageId: context.pageId,
    route: context.route,
    areas: context.areas,
    capabilities
  });
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export async function generatePetTips(options: {
  client: LlmClient;
  context: PetPageContext;
  capabilities: PetCapability[];
  attention: PanelAttentionSnapshot;
  signal?: AbortSignal;
}) {
  const payload = await options.client.runJson<unknown>({
    prompt: PET_PROMPT,
    input: '为当前页面生成使用提示。',
    context: {
      page: options.context,
      capabilities: options.capabilities,
      attention: projectAttention(options.attention)
    },
    toolChoice: 'none',
    temperature: 0.25,
    maxTokens: 700,
    signal: options.signal
  });
  const rawTips = payload && typeof payload === 'object' && Array.isArray((payload as { tips?: unknown }).tips)
    ? (payload as { tips: unknown[] }).tips
    : [];
  const knownTools = new Set(options.capabilities.map((capability) => capability.name));
  const knownPanels = collectPanelIds(options.context);
  const tips = rawTips.slice(0, 4).flatMap((value, index): PetTip[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const title = shortText(item.title, 32);
    const body = shortText(item.body, 160);
    if (!title || !body) return [];
    const category = ['guide', 'suggestion', 'help'].includes(String(item.category))
      ? item.category as PetTip['category']
      : 'guide';
    return [{
      id: shortText(item.id, 64) || `tip-${index + 1}`,
      title,
      body,
      category,
      relatedPanelIds: [...new Set(stringArray(item.relatedPanelIds).filter((id) => knownPanels.has(id)))],
      relatedTools: [...new Set(stringArray(item.relatedTools).filter((name) => knownTools.has(name)))]
    }];
  });
  if (!tips.length) throw new Error('模型没有生成有效的页面提示。');
  return tips;
}
