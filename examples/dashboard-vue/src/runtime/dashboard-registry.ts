import { createDashboardRuntime } from './dashboard-runtime';

function runtime(configUrl: string) {
  return createDashboardRuntime<Record<string, unknown>>({
    configUrl,
    initialConfig: { id: '', topicId: '', title: '', description: '', panels: [] },
    initialDataset: { id: '', name: '', description: '', sourceLabel: '', entities: [], dimensions: [], metrics: [], relations: [] }
  });
}

export const dashboardIds = {
  aviation: 'aviation-operations',
  airQuality: 'air-quality-operations',
  taxi: 'nyc-taxi-operations',
  otel: 'otel-demo-observability'
} as const;

export function createDashboardRuntimeFor(dashboardId: string) {
  return runtime(`/api/dashboard/config?dashboard=${encodeURIComponent(dashboardId)}`);
}

export const dashboardRuntimes = {
  aviation: createDashboardRuntimeFor(dashboardIds.aviation),
  airQuality: createDashboardRuntimeFor(dashboardIds.airQuality),
  taxi: createDashboardRuntimeFor(dashboardIds.taxi),
  otel: createDashboardRuntimeFor(dashboardIds.otel)
};
