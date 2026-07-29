<script setup lang="ts">
import { computed, ref, type DeepReadonly } from 'vue';
import type { EnchantSnapshot } from '../runtime/enchantment';
import {
  buildEnchantDebugScopeTree,
  flattenEnchantDebugMetadata
} from '../runtime/debug-view';
import DebugScopeNode from './debug-scope-node.vue';

const props = defineProps<{
  snapshot?: EnchantSnapshot | DeepReadonly<EnchantSnapshot>;
}>();

const activeTab = ref<'tools' | 'metadata' | 'scopes' | 'raw'>('tools');
const mutableSnapshot = computed(() => props.snapshot as EnchantSnapshot | undefined);
const scopeTree = computed(() => mutableSnapshot.value ? buildEnchantDebugScopeTree(mutableSnapshot.value) : []);
const metadataRows = computed(() => mutableSnapshot.value ? flattenEnchantDebugMetadata(mutableSnapshot.value) : []);
const scopeById = computed(() => new Map(
  (props.snapshot?.enchantments ?? []).map((enchantment) => [enchantment.id, enchantment])
));

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? '';
  } catch {
    return String(value);
  }
}

function valueSummary(value: unknown): string {
  if (value === undefined) return '-';
  if (value === null) return 'null';
  if (typeof value === 'string') return value || '空字符串';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return '空数组';
    const preview = value.slice(0, 3).map((item) => valueSummary(item)).join(', ');
    return value.length > 3 ? `${value.length} 项：${preview}…` : `${value.length} 项：${preview}`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (!entries.length) return '空对象';
    const preview = entries.slice(0, 3).map(([key, item]) => (
      typeof item === 'object' && item !== null ? key : `${key}=${valueSummary(item)}`
    )).join(', ');
    return entries.length > 3 ? `${entries.length} 个字段：${preview}…` : preview;
  }
  return String(value);
}

function toolComponent(enchantmentId: string, component?: string) {
  return component ?? scopeById.value.get(enchantmentId)?.source.component ?? '-';
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function schemaType(schema: Record<string, unknown>): string {
  if (Array.isArray(schema.enum)) return `enum(${schema.enum.map(String).join(' | ')})`;
  if (schema.type === 'array') {
    const items = record(schema.items);
    return `array<${items ? schemaType(items) : 'unknown'}>`;
  }
  return typeof schema.type === 'string' ? schema.type : 'unknown';
}

function schemaParameters(schema: Record<string, unknown> | undefined) {
  const result: Array<{ name: string; type: string; required: boolean; description?: string }> = [];

  function visit(current: Record<string, unknown>, prefix = '', parentRequired = true, depth = 0) {
    const properties = record(current.properties);
    if (!properties) return;
    const required = new Set(Array.isArray(current.required) ? current.required.map(String) : []);
    Object.entries(properties).forEach(([name, value]) => {
      const property = record(value);
      if (!property) return;
      const path = prefix ? `${prefix}.${name}` : name;
      const isRequired = parentRequired && required.has(name);
      if (property.type === 'object' && record(property.properties) && depth < 1) {
        visit(property, path, isRequired, depth + 1);
        return;
      }
      result.push({
        name: path,
        type: schemaType(property),
        required: isRequired,
        description: typeof property.description === 'string' ? property.description : undefined
      });
    });
  }

  if (schema) visit(schema);
  return result;
}
</script>

<template>
  <div class="snapshot-inspector">
    <p v-if="!snapshot" class="inspector-empty">暂无 snapshot。</p>
    <template v-else>
      <div class="inspector-summary">
        <div><span>page</span><strong>{{ snapshot.pageId }}</strong></div>
        <div><span>scopes</span><strong>{{ snapshot.enchantments.length }}</strong></div>
        <div><span>metadata</span><strong>{{ metadataRows.length }}</strong></div>
        <div><span>tools</span><strong>{{ snapshot.tools.length }}</strong></div>
      </div>

      <nav class="inspector-tabs" aria-label="Snapshot sections">
        <button type="button" :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">Capabilities</button>
        <button type="button" :class="{ active: activeTab === 'metadata' }" @click="activeTab = 'metadata'">Collected Data</button>
        <button type="button" :class="{ active: activeTab === 'scopes' }" @click="activeTab = 'scopes'">Sources</button>
        <button type="button" :class="{ active: activeTab === 'raw' }" @click="activeTab = 'raw'">Raw</button>
      </nav>

      <section v-if="activeTab === 'tools'" class="table-view">
        <div class="view-heading">
          <div><strong>当前页面 EnchantForge 能力</strong><span>{{ snapshot.tools.length }} 个可执行 tool</span></div>
          <span>名称、用途、参数、执行边界和来源组件</span>
        </div>
        <p v-if="!snapshot.tools.length" class="inspector-empty">当前页面没有暴露可执行能力。</p>
        <div v-else class="inspector-table-wrap">
          <table class="inspector-table tool-table">
            <thead><tr><th>Tool / 用途</th><th>来源组件 / Scope</th><th>效果</th><th>参数</th></tr></thead>
            <tbody>
              <tr v-for="tool in snapshot.tools" :key="tool.capabilityId">
                <td><strong>{{ tool.label }}</strong><small class="tool-name">{{ tool.name }}</small><p>{{ tool.description }}</p></td>
                <td><strong>{{ toolComponent(tool.enchantmentId, tool.source?.component) }}</strong><small>scope: {{ scopeById.get(tool.enchantmentId)?.name ?? tool.enchantmentId }}</small><small>{{ tool.owner }} · {{ tool.provider }}</small><small v-if="tool.target">target: {{ tool.target }}</small></td>
                <td><span class="effect-chip" :data-effect="tool.effect">{{ tool.effect }}</span></td>
                <td>
                  <span v-if="!schemaParameters(tool.inputSchema).length" class="no-parameters">无参数</span>
                  <div v-else class="parameter-list">
                    <span
                      v-for="parameter in schemaParameters(tool.inputSchema)"
                      :key="parameter.name"
                      class="parameter-chip"
                      :title="parameter.description"
                    >
                      <b>{{ parameter.name }}{{ parameter.required ? ' *' : '' }}</b>
                      <em>{{ parameter.type }}</em>
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="activeTab === 'metadata'" class="table-view">
        <div class="view-heading">
          <div><strong>当前页面采集数据</strong><span>{{ metadataRows.length }} 个 metadata 节点</span></div>
          <span>显式贡献和 DOM adapter 采集结果</span>
        </div>
        <p v-if="!metadataRows.length" class="inspector-empty">当前页面没有采集数据。</p>
        <div v-else class="inspector-table-wrap">
          <table class="inspector-table">
            <thead><tr><th>数据 / 层级路径</th><th>类型</th><th>来源组件</th><th>采集方式</th><th>状态</th><th>值</th></tr></thead>
            <tbody>
              <tr v-for="row in metadataRows" :key="row.key">
                <td><strong>{{ row.label }}</strong><small>{{ row.scopeName }} / {{ row.path }}</small></td>
                <td><span class="type-chip">{{ row.kind }}</span></td>
                <td>{{ row.component }}</td>
                <td>{{ row.source }}</td>
                <td>{{ row.visible && row.enabled ? 'active' : row.visible ? 'disabled' : 'hidden' }}</td>
                <td class="value-cell" :title="stringify(row.value)">{{ valueSummary(row.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="activeTab === 'scopes'" class="scope-view">
        <div class="view-heading">
          <div><strong>能力来源</strong><span>用于排查 tool 和 metadata 的注册位置</span></div>
          <span>按 parentEnchantmentId 还原包装器嵌套关系</span>
        </div>
        <p v-if="!scopeTree.length" class="inspector-empty">当前页面没有可见 Enchant scope。</p>
        <ul v-else class="scope-tree">
          <debug-scope-node v-for="node in scopeTree" :key="node.enchantment.id" :node="node" />
        </ul>
      </section>

      <section v-else>
        <pre class="raw-json">{{ stringify(snapshot) }}</pre>
      </section>
    </template>
  </div>
</template>

<style scoped>
.snapshot-inspector { min-width: 0; color: #334155; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.inspector-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
.inspector-summary div { min-width: 0; padding: 9px; border: 1px solid #e0e7f0; border-radius: 5px; background: #f6f9fc; }
.inspector-summary span, .inspector-summary strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.inspector-summary span { color: #8190a3; font-size: 9px; text-transform: uppercase; }
.inspector-summary strong { margin-top: 4px; color: #263548; font-size: 13px; }
.inspector-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #e0e7f0; }
.inspector-tabs button { padding: 7px 9px; border: 0; border-bottom: 2px solid transparent; color: #7b8798; background: transparent; cursor: pointer; font: inherit; font-size: 10px; }
.inspector-tabs button.active { color: #0958d9; border-bottom-color: #0958d9; }
.view-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.view-heading strong, .view-heading span { display: block; }
.view-heading strong { color: #334155; font-size: 11px; }
.view-heading div > span { margin-top: 3px; text-align: left; }
.view-heading > span { color: #8a99ac; font-size: 9px; text-align: right; }
.scope-tree { padding: 0; margin: 0; }
.inspector-table-wrap { max-width: 100%; overflow: auto; border: 1px solid #dce4ef; border-radius: 5px; }
.inspector-table { width: 100%; min-width: 820px; border-collapse: collapse; table-layout: fixed; background: #fff; font-size: 9px; }
.inspector-table th { padding: 8px 9px; color: #66778b; background: #f5f8fc; border-bottom: 1px solid #dce4ef; text-align: left; font-weight: 600; }
.inspector-table td { padding: 8px 9px; border-bottom: 1px solid #edf1f6; vertical-align: top; word-break: break-word; }
.inspector-table tr:last-child td { border-bottom: 0; }
.inspector-table td strong, .inspector-table td small { display: block; }
.inspector-table td strong { color: #334155; font-size: 10px; }
.inspector-table td small { margin-top: 3px; color: #8a99ac; line-height: 1.4; }
.inspector-table th:nth-child(1) { width: 30%; }
.inspector-table th:nth-child(2) { width: 10%; }
.inspector-table th:nth-child(3) { width: 15%; }
.inspector-table th:nth-child(4) { width: 11%; }
.inspector-table th:nth-child(5) { width: 10%; }
.inspector-table th:nth-child(6) { width: 24%; }
.tool-table th:nth-child(1) { width: 36%; }
.tool-table th:nth-child(2) { width: 24%; }
.tool-table th:nth-child(3) { width: 10%; }
.tool-table th:nth-child(4) { width: 30%; }
.tool-table td p { margin: 6px 0; color: #52677f; font: 10px/1.5 system-ui, sans-serif; }
.tool-name { color: #0958d9 !important; }
.value-cell { color: #52677f; }
.type-chip, .effect-chip { display: inline-block; padding: 2px 5px; border: 1px solid #d8e2ef; border-radius: 4px; color: #52677f; background: #f6f9fc; white-space: nowrap; }
.effect-chip[data-effect="read"] { color: #126b57; border-color: #b8e1d5; background: #effaf6; }
.effect-chip[data-effect="visual"] { color: #195da6; border-color: #c7dcf5; background: #eff6ff; }
.effect-chip[data-effect="draft"] { color: #8a5a10; border-color: #ead5aa; background: #fff8e8; }
.effect-chip[data-effect="commit"] { color: #a33c35; border-color: #efc2be; background: #fff2f0; }
.parameter-list { display: flex; flex-wrap: wrap; gap: 5px; }
.parameter-chip { display: inline-flex; max-width: 100%; align-items: center; gap: 5px; padding: 3px 5px; border: 1px solid #d8e2ef; border-radius: 4px; background: #f6f9fc; }
.parameter-chip b { overflow: hidden; color: #334155; font-size: 9px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.parameter-chip em { color: #7d8da1; font-size: 8px; font-style: normal; white-space: nowrap; }
.no-parameters { color: #8a99ac; }
.raw-json { max-height: calc(100vh - 260px); margin: 0; padding: 9px; overflow: auto; border: 1px solid #e0e7f0; border-radius: 4px; color: #45566b; background: #f7f9fc; font-size: 10px; line-height: 1.5; white-space: pre-wrap; }
.inspector-empty { padding: 20px; color: #8a99ac; text-align: center; font-size: 11px; }
@media (max-width: 620px) {
  .inspector-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .view-heading { align-items: flex-start; flex-direction: column; }
  .view-heading span { text-align: left; }
}
</style>
