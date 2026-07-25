import { createDashboardRuntime } from './dashboard-runtime';

function runtime(configUrl: string) {
  return createDashboardRuntime<Record<string, unknown>>({
    configUrl,
    initialConfig: { id: '', topicId: '', title: '', description: '', panels: [] },
    initialDataset: { id: '', name: '', description: '', sourceLabel: '', entities: [], dimensions: [], metrics: [], relations: [] }
  });
}

export const dashboardRuntimes = {
  aviation: runtime('/api/dashboard/config'),
  airQuality: runtime('/api/dashboard/config?dashboard=air-quality-operations'),
  taxi: runtime('/api/dashboard/config?dashboard=nyc-taxi-operations')
};
