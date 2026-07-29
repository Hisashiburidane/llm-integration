<script setup lang="ts">
import type { EnchantDebugScopeNode } from '../runtime/debug-view';

defineProps<{
  node: EnchantDebugScopeNode;
}>();
</script>

<template>
  <li class="scope-node">
    <details open>
      <summary>
        <span class="scope-branch" aria-hidden="true"></span>
        <span class="scope-identity">
          <strong>{{ node.enchantment.name ?? node.enchantment.id }}</strong>
          <small>{{ node.enchantment.id }}</small>
        </span>
        <span class="scope-badge">{{ node.enchantment.kind }}</span>
        <span class="scope-badge exposure">{{ node.enchantment.exposure }}</span>
        <span class="scope-source">{{ node.enchantment.source.component ?? '-' }}</span>
        <span class="scope-count">{{ node.enchantment.metadata.length }} data</span>
        <span class="scope-count">{{ node.tools.length }} tools</span>
      </summary>
      <div class="scope-detail">
        <span>scope: {{ node.enchantment.source.scopeId }}</span>
        <span v-if="node.enchantment.source.parentEnchantmentId">parent: {{ node.enchantment.source.parentEnchantmentId }}</span>
        <span>status: {{ Object.entries(node.enchantment.status).filter(([, value]) => value).map(([key]) => key).join(', ') }}</span>
      </div>
      <ul v-if="node.children.length">
        <debug-scope-node v-for="child in node.children" :key="child.enchantment.id" :node="child" />
      </ul>
    </details>
  </li>
</template>

<style scoped>
.scope-node { position: relative; list-style: none; }
.scope-node + .scope-node { margin-top: 7px; }
.scope-node summary {
  display: grid;
  grid-template-columns: 10px minmax(150px, 1fr) auto auto minmax(90px, auto) auto auto;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
  border: 1px solid #dce4ef;
  border-radius: 5px;
  color: #334155;
  background: #fff;
  cursor: pointer;
  list-style: none;
}
.scope-node summary::-webkit-details-marker { display: none; }
.scope-node summary:hover { border-color: #9bb8dc; background: #f8fbff; }
.scope-branch::before { content: '›'; display: inline-block; color: #7890aa; transition: transform 120ms ease; }
details[open] > summary .scope-branch::before { transform: rotate(90deg); }
.scope-identity { min-width: 0; }
.scope-identity strong, .scope-identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scope-identity strong { font-size: 11px; }
.scope-identity small { margin-top: 3px; color: #8a99ac; font-size: 9px; }
.scope-badge, .scope-count {
  padding: 2px 5px;
  border: 1px solid #d8e2ef;
  border-radius: 4px;
  color: #52677f;
  background: #f6f9fc;
  font-size: 9px;
  white-space: nowrap;
}
.scope-badge.exposure { color: #195da6; background: #eff6ff; border-color: #c7dcf5; }
.scope-source { overflow: hidden; color: #52677f; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.scope-detail { display: flex; flex-wrap: wrap; gap: 6px 12px; padding: 7px 12px 2px 28px; color: #8996a8; font-size: 9px; }
.scope-node ul { padding: 7px 0 0 20px; margin: 0; border-left: 1px solid #dce4ef; }
@media (max-width: 760px) {
  .scope-node summary { grid-template-columns: 10px minmax(120px, 1fr) auto auto; }
  .scope-source, .scope-count { display: none; }
}
</style>
