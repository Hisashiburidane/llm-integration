import { readonly, ref } from 'vue';

export interface PanelAttentionSummary {
  panelId: string;
  title: string;
  visits: number;
  selections: number;
  dwellMs: number;
  lastSeenAt: number;
}

export interface PanelAttentionSnapshot {
  panels: PanelAttentionSummary[];
  trail: Array<{ panelId: string; title: string; enteredAt: number }>;
}

interface MutablePanelAttention extends PanelAttentionSummary {
  scope: string;
  activeSince?: number;
}

const records = new Map<string, MutablePanelAttention>();
const trails = new Map<string, PanelAttentionSnapshot['trail']>();
const version = ref(0);

function recordKey(scope: string, panelId: string) {
  return `${scope}:${panelId}`;
}

function ensureRecord(scope: string, panelId: string, title: string) {
  const key = recordKey(scope, panelId);
  const existing = records.get(key);
  if (existing) {
    existing.title = title;
    return existing;
  }
  const created: MutablePanelAttention = {
    scope,
    panelId,
    title,
    visits: 0,
    selections: 0,
    dwellMs: 0,
    lastSeenAt: 0
  };
  records.set(key, created);
  return created;
}

export function enterPanel(scope: string | undefined, panelId: string, title: string) {
  if (!scope) return;
  const now = Date.now();
  const record = ensureRecord(scope, panelId, title);
  if (record.activeSince !== undefined) return;
  record.activeSince = now;
  record.visits += 1;
  record.lastSeenAt = now;
  const trail = trails.get(scope) ?? [];
  trails.set(scope, [...trail, { panelId, title, enteredAt: now }].slice(-24));
  version.value += 1;
}

export function leavePanel(scope: string | undefined, panelId: string) {
  if (!scope) return;
  const record = records.get(recordKey(scope, panelId));
  if (!record || record.activeSince === undefined) return;
  record.dwellMs += Math.max(0, Date.now() - record.activeSince);
  record.activeSince = undefined;
  record.lastSeenAt = Date.now();
  version.value += 1;
}

export function selectPanel(scope: string | undefined, panelId: string, title: string) {
  if (!scope) return;
  const record = ensureRecord(scope, panelId, title);
  record.selections += 1;
  record.lastSeenAt = Date.now();
  version.value += 1;
}

export function snapshotPanelAttention(scope: string): PanelAttentionSnapshot {
  const now = Date.now();
  const panels = Array.from(records.values())
    .filter((record) => record.scope === scope)
    .map((record) => ({
      panelId: record.panelId,
      title: record.title,
      visits: record.visits,
      selections: record.selections,
      dwellMs: record.dwellMs + (record.activeSince === undefined ? 0 : Math.max(0, now - record.activeSince)),
      lastSeenAt: record.lastSeenAt
    }))
    .sort((left, right) => {
      const leftScore = left.selections * 12000 + left.dwellMs + left.visits * 1800;
      const rightScore = right.selections * 12000 + right.dwellMs + right.visits * 1800;
      return rightScore - leftScore || right.lastSeenAt - left.lastSeenAt;
    });
  return { panels, trail: [...(trails.get(scope) ?? [])] };
}

export function clearPanelAttention(scope?: string) {
  if (!scope) {
    records.clear();
    trails.clear();
  } else {
    for (const [key, record] of records) {
      if (record.scope === scope) records.delete(key);
    }
    trails.delete(scope);
  }
  version.value += 1;
}

export function usePanelAttentionVersion() {
  return readonly(version);
}
