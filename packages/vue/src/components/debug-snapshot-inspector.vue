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

const activeTab = ref<'scopes' | 'metadata' | 'tools' | 'raw'>('scopes');
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

function compactValue(value: unknown) {
  const result = stringify(value).replace(/\s+/g, ' ');
  return result.length > 90 ? `${result.slice(0, 87)}...` : result;
}

function toolComponent(enchantmentId: string, component?: string) {
  return component ?? scopeById.value.get(enchantmentId)?.source.component ?? '-';
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
        <button type="button" :class="{ active: activeTab === 'scopes' }" @click="activeTab = 'scopes'">Scopes</button>
        <button type="button" :class="{ active: activeTab === 'metadata' }" @click="activeTab = 'metadata'">Metadata</button>
        <button type="button" :class="{ active: activeTab === 'tools' }" @click="activeTab = 'tools'">Tools</button>
        <button type="button" :class="{ active: activeTab === 'raw' }" @click="activeTab = 'raw'">Raw</button>
      </nav>

      <section v-if="activeTab === 'scopes'" class="scope-view">
        <div class="view-heading">
          <strong>组件与 Enchant 层级</strong>
          <span>按 parentEnchantmentId 还原包装器嵌套关系</span>
        </div>
        <p v-if="!scopeTree.length" class="inspector-empty">当前页面没有可见 Enchant scope。</p>
        <ul v-else class="scope-tree">
          <debug-scope-node v-for="node in scopeTree" :key="node.enchantment.id" :node="node" />
        </ul>
      </section>

      <section v-else-if="activeTab === 'metadata'" class="table-view">
        <div class="view-heading">
          <strong>采集数据</strong>
          <span>包含显式贡献和 DOM adapter 采集结果</span>
        </div>
        <p v-if="!metadataRows.length" class="inspector-empty">当前页面没有 metadata。</p>
        <div v-else class="inspector-table-wrap">
          <table class="inspector-table">
            <thead><tr><th>层级路径</th><th>类型</th><th>来源组件</th><th>采集方式</th><th>状态</th><th>值</th></tr></thead>
            <tbody>
              <tr v-for="row in metadataRows" :key="row.key">
                <td><strong>{{ row.label }}</strong><small>{{ row.scopeName }} / {{ row.path }}</small></td>
                <td><span class="type-chip">{{ row.kind }}</span></td>
                <td>{{ row.component }}</td>
                <td>{{ row.source }}</td>
                <td>{{ row.visible && row.enabled ? 'active' : row.visible ? 'disabled' : 'hidden' }}</td>
                <td class="value-cell" :title="stringify(row.value)">{{ row.value === undefined ? '-' : compactValue(row.value) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else-if="activeTab === 'tools'" class="table-view">
        <div class="view-heading">
          <strong>可执行 Tools</strong>
          <span>Tool 与声明组件、所属 scope 和执行边界的对应关系</span>
        </div>
        <p v-if="!snapshot.tools.length" class="inspector-empty">当前页面没有 tools。</p>
        <div v-else class="inspector-table-wrap">
          <table class="inspector-table tool-table">
            <thead><tr><th>Tool</th><th>来源组件 / Scope</th><th>效果</th><th>Owner / Provider</th><th>输入 Schema</th></tr></thead>
            <tbody>
              <tr v-for="tool in snapshot.tools" :key="tool.capabilityId">
                <td><strong>{{ tool.label }}</strong><small>{{ tool.name }}</small><small>{{ tool.capabilityId }}</small></td>
                <td><strong>{{ toolComponent(tool.enchantmentId, tool.source?.component) }}</strong><small>{{ scopeById.get(tool.enchantmentId)?.name ?? tool.enchantmentId }}</small></td>
                <td><span class="effect-chip" :data-effect="tool.effect">{{ tool.effect }}</span></td>
                <td><strong>{{ tool.owner }}</strong><small>{{ tool.provider }}</small></td>
                <td>
                  <details class="schema-detail">
                    <summary>{{ tool.inputSchema ? '查看 Schema' : '无参数' }}</summary>
                    <pre v-if="tool.inputSchema">{{ stringify(tool.inputSchema) }}</pre>
                  </details>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
.view-heading span { color: #8a99ac; font-size: 9px; text-align: right; }
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
.tool-table th:nth-child(1) { width: 27%; }
.tool-table th:nth-child(2) { width: 22%; }
.tool-table th:nth-child(3) { width: 9%; }
.tool-table th:nth-child(4) { width: 16%; }
.tool-table th:nth-child(5) { width: 26%; }
.value-cell { color: #52677f; }
.type-chip, .effect-chip { display: inline-block; padding: 2px 5px; border: 1px solid #d8e2ef; border-radius: 4px; color: #52677f; background: #f6f9fc; white-space: nowrap; }
.effect-chip[data-effect="read"] { color: #126b57; border-color: #b8e1d5; background: #effaf6; }
.effect-chip[data-effect="visual"] { color: #195da6; border-color: #c7dcf5; background: #eff6ff; }
.effect-chip[data-effect="draft"] { color: #8a5a10; border-color: #ead5aa; background: #fff8e8; }
.effect-chip[data-effect="commit"] { color: #a33c35; border-color: #efc2be; background: #fff2f0; }
.schema-detail summary { color: #0958d9; cursor: pointer; }
.schema-detail pre, .raw-json { margin: 7px 0 0; padding: 9px; overflow: auto; border: 1px solid #e0e7f0; border-radius: 4px; color: #45566b; background: #f7f9fc; font-size: 9px; line-height: 1.5; white-space: pre-wrap; }
.raw-json { max-height: calc(100vh - 260px); margin: 0; font-size: 10px; }
.inspector-empty { padding: 20px; color: #8a99ac; text-align: center; font-size: 11px; }
@media (max-width: 620px) {
  .inspector-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .view-heading { align-items: flex-start; flex-direction: column; }
  .view-heading span { text-align: left; }
}
</style>
