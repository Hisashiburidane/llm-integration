import type {
  Enchantment,
  EnchantMetadataNode,
  EnchantSnapshot,
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
