import { createDashboardRuntime } from './dashboard-runtime';

function runtime(configUrl: string) {
  return createDashboardRuntime<Record<string, unknown>>({
    configUrl,
    initialConfig: { id: '', topicId: '', title: '', description: '', panels: [] },
    initialDataset: { id: '', name: '', description: '', sourceLabel: '', entities: [], dimensions: [], metrics: [], relations: [] }
  });
}

export function createDashboardRuntimeFor(dashboardId: string) {
  return runtime(`/api/dashboard/config?dashboard=${encodeURIComponent(dashboardId)}`);
}
