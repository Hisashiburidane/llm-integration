import { reactive } from 'vue';
import type { EnchantCapabilityDefinition } from '@enchantforge/vue';
import { k8sPanels } from './k8sDashboard';

export const focusViewState = reactive({
  highlightedPanelIds: [] as string[],
  activePanelId: '',
  composedPanelIds: [] as string[]
});

const knownPanelIds = new Set(k8sPanels.map((panel) => panel.id));
const panelPriorities = ['normal', 'warning', 'critical'] as const;

function readExplicitPanelIds(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('panelIds 必须是数组。');
  if (!value.length) return undefined;
  const panelIds = [...new Set(value.map(String))];
  const invalid = panelIds.filter((id) => !knownPanelIds.has(id));
  if (invalid.length) throw new Error(`未知面板：${invalid.join(', ')}。`);
  return panelIds;
}

function readPanelSelection(input: unknown) {
  const selection = input && typeof input === 'object'
    ? input as { panelIds?: unknown; priority?: unknown }
    : {};
  const explicitPanelIds = readExplicitPanelIds(selection.panelIds);
  const priority = selection.priority === undefined ? undefined : String(selection.priority);
  if (priority && !panelPriorities.includes(priority as typeof panelPriorities[number])) {
    throw new Error(`未知优先级：${priority}。`);
  }
  if (!explicitPanelIds && !priority) throw new Error('panelIds 和 priority 至少需要提供一项。');

  const matched = priority
    ? k8sPanels.filter((panel) => panel.priority === priority).map((panel) => panel.id)
    : [...knownPanelIds];
  const matchedSet = new Set(matched);
  const panelIds = explicitPanelIds
    ? explicitPanelIds.filter((panelId) => matchedSet.has(panelId))
    : matched;
  if (!panelIds.length) throw new Error('没有符合条件的面板。');
  return panelIds;
}

function readPanelIds(input: unknown) {
  const value = input && typeof input === 'object'
    ? (input as { panelIds?: unknown }).panelIds
    : undefined;
  return readExplicitPanelIds(value) ?? [];
}

function readPanelId(input: unknown) {
  const panelId = input && typeof input === 'object'
    ? String((input as { panelId?: unknown }).panelId ?? '')
    : '';
  if (!knownPanelIds.has(panelId)) throw new Error(`未知面板：${panelId || 'empty'}。`);
  return panelId;
}

function highlight(panelIds: string[]) {
  focusViewState.highlightedPanelIds = panelIds;
}

export function openFocusPanel(panelId: string) {
  focusViewState.activePanelId = panelId;
  highlight([panelId]);
}

export function closeFocusPanel() {
  focusViewState.activePanelId = '';
}

export function clearFocusComposition() {
  focusViewState.composedPanelIds = [];
}

export const focusViewCapabilities: EnchantCapabilityDefinition[] = [{
  id: 'focus-view:highlight-panels',
  owner: 'application',
  provider: 'focus-view',
  name: 'dashboard.highlight',
  label: '高亮监控面板',
  description: '根据明确的 panelIds 或 priority 高亮相关面板。用户只要求查看、查找或定位数据时使用。',
  effect: 'visual',
  inputSchema: {
    type: 'object',
    properties: {
      panelIds: {
        type: 'array',
        items: { type: 'string' },
        description: '明确指定的面板 id。'
      },
      priority: {
        type: 'string',
        enum: panelPriorities,
        description: '按面板优先级选择目标。'
      }
    },
    additionalProperties: false
  },
  execute(input) {
    const panelIds = readPanelSelection(input);
    highlight(panelIds);
    return { status: 'success', summary: `已高亮 ${panelIds.length} 个面板。` };
  }
}, {
  id: 'focus-view:open-panel',
  owner: 'application',
  provider: 'focus-view',
  name: 'dashboard.open',
  label: '打开监控面板',
  description: '在详情窗口打开一个面板。仅在用户明确要求打开、放大或查看详情时使用。',
  effect: 'visual',
  inputSchema: {
    type: 'object',
    required: ['panelId'],
    properties: { panelId: { type: 'string' } }
  },
  execute(input) {
    const panelId = readPanelId(input);
    openFocusPanel(panelId);
    return { status: 'success', summary: `已打开 ${panelId}。` };
  }
}, {
  id: 'focus-view:compose-panels',
  owner: 'application',
  provider: 'focus-view',
  name: 'dashboard.compose',
  label: '组合监控面板',
  description: '根据 panelIds 创建组合视图。仅在用户明确要求组合或对比多个面板时使用。',
  effect: 'visual',
  inputSchema: {
    type: 'object',
    required: ['panelIds'],
    properties: { panelIds: { type: 'array', items: { type: 'string' } } }
  },
  execute(input) {
    const panelIds = readPanelIds(input);
    focusViewState.composedPanelIds = panelIds;
    highlight(panelIds);
    return { status: 'success', summary: `已在组合视图中打开 ${panelIds.length} 个面板。` };
  }
}, {
  id: 'focus-view:clear-state',
  owner: 'application',
  provider: 'focus-view',
  name: 'dashboard.clear',
  label: '清除面板视图状态',
  description: '清除当前 Dashboard 的高亮、详情和组合视图状态。',
  effect: 'visual',
  execute() {
    focusViewState.highlightedPanelIds = [];
    focusViewState.activePanelId = '';
    focusViewState.composedPanelIds = [];
    return { status: 'success', summary: '已清除面板视图状态。' };
  }
}];
