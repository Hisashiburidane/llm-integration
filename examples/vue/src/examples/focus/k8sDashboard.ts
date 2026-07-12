import type { EChartsOption } from 'echarts';

export type PanelCategory = 'cluster' | 'workloads' | 'nodes' | 'pods' | 'network' | 'storage' | 'security';

export type K8sPanel = {
  id: string;
  category: PanelCategory;
  categoryLabel: string;
  title: string;
  metric: string;
  unit: string;
  summary: string;
  tags: string[];
  priority: 'normal' | 'warning' | 'critical';
  option: EChartsOption;
};

type PanelSeed = Omit<K8sPanel, 'category' | 'categoryLabel' | 'option'> & {
  values: number[];
  kind?: 'line' | 'bar';
};

const times = ['09:00', '09:10', '09:20', '09:30', '09:40', '09:50', '10:00'];

function chartOption(seed: PanelSeed): EChartsOption {
  const color = seed.priority === 'critical' ? '#e6533c' : seed.priority === 'warning' ? '#e3a428' : '#2da67b';
  return {
    animationDuration: 520,
    color: [color],
    grid: { left: 42, right: 16, top: 18, bottom: 30 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: times, boundaryGap: seed.kind === 'bar', axisLabel: { color: '#718079' } },
    yAxis: { type: 'value', axisLabel: { color: '#718079', formatter: `{value}${seed.unit}` }, splitLine: { lineStyle: { color: '#e8eeeb' } } },
    series: [{
      type: seed.kind ?? 'line',
      data: seed.values,
      smooth: true,
      symbol: 'none',
      areaStyle: seed.kind === 'bar' ? undefined : { opacity: 0.1 },
      barMaxWidth: 22
    }]
  };
}

const groups: Array<{ category: PanelCategory; label: string; panels: PanelSeed[] }> = [
  { category: 'cluster', label: 'Cluster Health', panels: [
    { id: 'cluster-api-latency', title: 'API Server P99', metric: 'apiserver_request_duration_seconds', unit: 'ms', summary: 'API Server P99 latency has crossed the 180 ms warning line.', tags: ['control-plane', 'latency', 'slo'], priority: 'warning', values: [92, 104, 111, 138, 186, 201, 174] },
    { id: 'cluster-etcd-fsync', title: 'etcd Fsync P99', metric: 'etcd_disk_wal_fsync_duration_seconds', unit: 'ms', summary: 'etcd WAL persistence remains healthy.', tags: ['control-plane', 'etcd', 'disk'], priority: 'normal', values: [8, 9, 8, 11, 10, 9, 8] },
    { id: 'cluster-slo', title: 'Cluster SLO', metric: 'cluster_availability_ratio', unit: '%', summary: 'Thirty-day cluster availability is below its 99.95% target.', tags: ['availability', 'slo', 'control-plane'], priority: 'critical', values: [99.98, 99.97, 99.96, 99.94, 99.91, 99.89, 99.92] }
  ] },
  { category: 'workloads', label: 'Workloads', panels: [
    { id: 'workload-unavailable', title: 'Unavailable Replicas', metric: 'kube_deployment_status_replicas_unavailable', unit: '', summary: 'Checkout and payment deployments have unavailable replicas.', tags: ['deployment', 'replica', 'availability'], priority: 'critical', values: [1, 1, 2, 4, 7, 6, 5], kind: 'bar' },
    { id: 'workload-hpa', title: 'HPA Saturation', metric: 'kube_hpa_status_current_replicas', unit: '%', summary: 'Several HPAs are close to their maximum replica count.', tags: ['hpa', 'autoscaling', 'capacity'], priority: 'warning', values: [62, 68, 72, 78, 91, 94, 88] },
    { id: 'workload-rollout', title: 'Rollout Duration', metric: 'deployment_rollout_duration_seconds', unit: 's', summary: 'Rollout duration is within the normal range.', tags: ['deployment', 'rollout', 'release'], priority: 'normal', values: [42, 38, 51, 47, 44, 49, 41], kind: 'bar' }
  ] },
  { category: 'nodes', label: 'Nodes', panels: [
    { id: 'node-cpu', title: 'Node CPU Usage', metric: 'node_cpu_utilization', unit: '%', summary: 'Worker node CPU utilization is elevated.', tags: ['node', 'cpu', 'capacity'], priority: 'warning', values: [58, 61, 66, 72, 84, 91, 87] },
    { id: 'node-memory', title: 'Node Memory Pressure', metric: 'node_memory_utilization', unit: '%', summary: 'Two nodes are under sustained memory pressure.', tags: ['node', 'memory', 'pressure'], priority: 'critical', values: [71, 74, 76, 79, 88, 93, 94] },
    { id: 'node-disk', title: 'Node Disk IO', metric: 'node_disk_io_time_seconds_total', unit: '%', summary: 'Disk IO utilization is stable.', tags: ['node', 'disk', 'io'], priority: 'normal', values: [31, 34, 29, 38, 35, 41, 37] }
  ] },
  { category: 'pods', label: 'Pods', panels: [
    { id: 'pod-restarts', title: 'Pod Restart Rate', metric: 'kube_pod_container_status_restarts_total', unit: '/m', summary: 'Restart rate increased after the latest rollout.', tags: ['pod', 'restart', 'rollout'], priority: 'critical', values: [2, 3, 4, 8, 19, 24, 21], kind: 'bar' },
    { id: 'pod-pending', title: 'Pending Pods', metric: 'kube_pod_status_phase_pending', unit: '', summary: 'Pending pods correlate with node memory pressure.', tags: ['pod', 'pending', 'scheduler'], priority: 'warning', values: [1, 2, 2, 5, 9, 12, 10], kind: 'bar' },
    { id: 'pod-oom', title: 'OOMKilled Events', metric: 'kube_pod_container_status_last_terminated_reason', unit: '', summary: 'OOMKilled events are concentrated in checkout workloads.', tags: ['pod', 'oom', 'memory'], priority: 'critical', values: [0, 0, 1, 1, 4, 7, 6], kind: 'bar' }
  ] },
  { category: 'network', label: 'Network', panels: [
    { id: 'network-ingress-5xx', title: 'Ingress 5xx Rate', metric: 'nginx_ingress_controller_requests_5xx', unit: '%', summary: 'Ingress 5xx errors are above the 2% threshold.', tags: ['network', 'ingress', '5xx', 'error'], priority: 'critical', values: [0.4, 0.6, 0.8, 1.2, 2.8, 4.1, 3.6] },
    { id: 'network-coredns', title: 'CoreDNS Latency', metric: 'coredns_dns_request_duration_seconds', unit: 'ms', summary: 'CoreDNS P99 latency is degrading.', tags: ['network', 'dns', 'coredns', 'latency'], priority: 'warning', values: [18, 22, 21, 34, 48, 61, 57] },
    { id: 'network-drop', title: 'CNI Packet Drops', metric: 'node_network_receive_drop_total', unit: '/s', summary: 'Packet drops are isolated to two worker nodes.', tags: ['network', 'cni', 'packet', 'drop'], priority: 'critical', values: [2, 3, 5, 9, 24, 31, 28], kind: 'bar' }
  ] },
  { category: 'storage', label: 'Storage', panels: [
    { id: 'storage-pvc', title: 'PVC Capacity', metric: 'kubelet_volume_stats_used_bytes', unit: '%', summary: 'Prometheus and Loki PVCs are nearing capacity.', tags: ['storage', 'pvc', 'capacity'], priority: 'critical', values: [78, 80, 82, 85, 89, 93, 95] },
    { id: 'storage-csi', title: 'CSI Operation Latency', metric: 'storage_operation_duration_seconds', unit: 'ms', summary: 'CSI attach latency is slightly elevated.', tags: ['storage', 'csi', 'latency'], priority: 'warning', values: [82, 91, 88, 102, 119, 128, 116] },
    { id: 'storage-iops', title: 'Volume IOPS', metric: 'node_disk_reads_completed_total', unit: 'k', summary: 'Volume IOPS follows the expected traffic curve.', tags: ['storage', 'volume', 'iops'], priority: 'normal', values: [12, 16, 19, 22, 24, 21, 18] }
  ] },
  { category: 'security', label: 'Security', panels: [
    { id: 'security-tls', title: 'TLS Certificate Expiry', metric: 'probe_ssl_earliest_cert_expiry', unit: 'd', summary: 'Three ingress certificates expire within 14 days.', tags: ['security', 'tls', 'certificate'], priority: 'critical', values: [28, 26, 24, 21, 18, 14, 11], kind: 'bar' },
    { id: 'security-rbac', title: 'RBAC Denials', metric: 'apiserver_authorization_decisions_denied_total', unit: '/m', summary: 'RBAC denial rate increased for CI service accounts.', tags: ['security', 'rbac', 'authorization'], priority: 'warning', values: [3, 4, 5, 6, 11, 15, 13], kind: 'bar' },
    { id: 'security-images', title: 'Critical Image CVEs', metric: 'image_vulnerability_critical_total', unit: '', summary: 'Four running images contain critical vulnerabilities.', tags: ['security', 'image', 'cve'], priority: 'critical', values: [2, 2, 3, 3, 4, 4, 4], kind: 'bar' }
  ] }
];

export const panelGroups = groups.map((group) => ({
  category: group.category,
  label: group.label,
  panels: group.panels.map((panel) => ({ ...panel, category: group.category, categoryLabel: group.label, option: chartOption(panel) }))
}));

export const k8sPanels: K8sPanel[] = panelGroups.flatMap((group) => group.panels);
