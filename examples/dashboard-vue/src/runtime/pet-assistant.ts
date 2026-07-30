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
  target?: string;
  inputSchema?: Record<string, unknown>;
  scopeId: string;
  scopeName: string;
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
  '根据页面结构、能力目录和用户关注记录，生成 4-6 条简短、具体、可以立即理解的使用提示。',
  '能力目录用于说明页面支持什么，不是可调用的 function tools。不要声称已经执行任何操作。',
  '不要编造数据结论。没有读取真实数据时，只能建议用户可以查看、询问或操作什么。',
  '优先覆盖页面主要区域和不同类型的能力；如果存在 Panel，提示应尽量关联明确的 Panel ID。',
  'relatedTools 只能填写能力目录中存在的 name，relatedPanelIds 只能填写页面结构中存在的 Panel ID。',
  'category 只能是 guide、suggestion 或 help。',
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

function projectMetadata(node: EnchantMetadataNode): PetContextNode {
  const title = 'title' in node && typeof node.title === 'string' ? node.title : undefined;
  const text = 'text' in node && typeof node.text === 'string' ? node.text : undefined;
  return {
    id: node.id,
    label: node.label ?? title ?? text ?? node.id,
    kind: node.kind,
    description: node.description,
    ...('children' in node ? { children: node.children.map(projectMetadata) } : {})
  };
}

function collectPanelIds(context: PetPageContext) {
  const ids = new Set<string>();
  const visit = (node: PetContextNode) => {
    if (node.kind === 'panel') ids.add(node.id);
    node.children?.forEach(visit);
  };
  context.areas.forEach((area) => area.metadata.forEach(visit));
  return ids;
}

export function buildPetPageContext(snapshot: EnchantSnapshot): PetPageContext {
  return {
    pageId: snapshot.pageId,
    app: snapshot.app,
    route: snapshot.route,
    tab: snapshot.tab,
    tags: snapshot.tags,
    areas: snapshot.enchantments.map((enchantment) => ({
      id: enchantment.id,
      name: enchantment.name ?? enchantment.id,
      kind: enchantment.kind,
      metadata: enchantment.metadata.map(projectMetadata)
    }))
  };
}

export function buildPetCapabilityCatalog(snapshot: EnchantSnapshot): PetCapability[] {
  const scopes = new Map(snapshot.enchantments.map((enchantment) => [
    enchantment.id,
    enchantment.name ?? enchantment.id
  ]));
  return snapshot.tools.map((tool) => ({
    name: tool.name,
    label: tool.label,
    description: tool.description,
    effect: tool.effect,
    target: tool.target,
    inputSchema: tool.inputSchema,
    scopeId: tool.enchantmentId,
    scopeName: scopes.get(tool.enchantmentId) ?? tool.enchantmentId
  }));
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
      attention: options.attention
    },
    toolChoice: 'none',
    temperature: 0.35,
    maxTokens: 1400,
    signal: options.signal
  });
  const rawTips = payload && typeof payload === 'object' && Array.isArray((payload as { tips?: unknown }).tips)
    ? (payload as { tips: unknown[] }).tips
    : [];
  const knownTools = new Set(options.capabilities.map((capability) => capability.name));
  const knownPanels = collectPanelIds(options.context);
  const tips = rawTips.slice(0, 6).flatMap((value, index): PetTip[] => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    const title = shortText(item.title, 42);
    const body = shortText(item.body, 220);
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
