import type { EChartsOption } from "echarts";

export type ChartKind = "line" | "bar" | "area" | "pie" | "gauge" | "scatter" | "heatmap" | "radar" | "treemap" | "funnel";

export type ChartMeta = {
  id: string;
  title: string;
  kind: ChartKind;
  domain: string;
  metric: string;
  room: string;
  unit: string;
  intentTags: string[];
  summary: string;
  priority: "normal" | "warning" | "critical";
  option: EChartsOption;
};

export type TimeRange = "1h" | "6h" | "24h" | "7d";
export type TopicKey = "overview" | "workloads" | "nodes" | "pods" | "network" | "storage" | "security";

export type TopicMeta = {
  key: TopicKey;
  label: string;
  description: string;
  icon: string;
  tags: string[];
};

export const topics: TopicMeta[] = [
  { key: "overview", label: "Cluster Overview", description: "prod-cn-east-1 集群 SLO、容量、错误率和控制面状态", icon: "dashboard", tags: ["集群", "总览", "SLO", "apiserver", "容量"] },
  { key: "workloads", label: "Workloads", description: "Deployment、StatefulSet、DaemonSet、HPA 和发布状态", icon: "appstore", tags: ["deployment", "statefulset", "workload", "hpa", "发布"] },
  { key: "nodes", label: "Nodes", description: "节点 CPU、内存、磁盘、负载、kubelet 和系统压力", icon: "database", tags: ["node", "节点", "cpu", "memory", "kubelet"] },
  { key: "pods", label: "Pods", description: "Pod 重启、OOMKilled、调度延迟、容器资源和异常事件", icon: "container", tags: ["pod", "container", "重启", "oom", "调度"] },
  { key: "network", label: "Network", description: "Ingress、Service、CoreDNS、CNI、连接数和网络错误", icon: "branches", tags: ["network", "ingress", "service", "coredns", "cni"] },
  { key: "storage", label: "Storage", description: "PV/PVC、CSI、IOPS、吞吐、延迟和容量水位", icon: "hdd", tags: ["storage", "pv", "pvc", "csi", "iops"] },
  { key: "security", label: "Security", description: "RBAC、镜像漏洞、准入策略、证书和审计事件", icon: "safety", tags: ["security", "rbac", "audit", "certificate", "vulnerability"] }
];

const timeLabels = Array.from({ length: 30 }, (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`);
const namespaces = ["payments", "checkout", "orders", "inventory", "gateway", "observability", "platform", "ml-serving"];
const nodes = ["cn-prod-a-01", "cn-prod-a-02", "cn-prod-a-03", "cn-prod-b-01", "cn-prod-b-02", "cn-prod-gpu-01", "cn-prod-db-01", "cn-prod-edge-01"];
const workloads = ["payment-api", "checkout-api", "order-worker", "inventory-sync", "gateway-nginx", "prometheus", "grafana", "recommendation-svc"];
const colors = ["#5794f2", "#73bf69", "#f2cc0c", "#ff9830", "#f2495c", "#b877d9", "#56a64b", "#ff7383"];

function series(length: number, base: number, amp: number, phase = 0, spikeAt?: number, tick = 0) {
  return Array.from({ length }, (_, index) => {
    const daily = Math.sin((index + tick * 0.35) / 3.4 + phase) * amp;
    const jitter = Math.cos((index + tick * 0.55) / 1.9 + phase * 0.7) * amp * 0.24;
    const spike = spikeAt === index ? amp * 2.9 : 0;
    return Number(Math.max(0, base + daily + jitter + spike).toFixed(2));
  });
}

function ranked(names: string[], base: number, spread: number, tick = 0) {
  return names.map((name, index) => ({ name, value: Number((base + index * spread * 0.62 + Math.sin(index * 1.7 + tick * 0.22) * spread).toFixed(2)) }));
}

function axisBase(unit: string): EChartsOption {
  return {
    color: colors,
    tooltip: { trigger: "axis", axisPointer: { type: "cross", lineStyle: { color: "#f2cc0c", width: 1, type: "dashed" } } },
    grid: { left: 38, right: 12, top: 18, bottom: 24 },
    xAxis: { type: "category", data: timeLabels, boundaryGap: false, axisTick: { show: false }, axisLabel: { fontSize: 10, color: "#8a94a6" }, axisLine: { lineStyle: { color: "#d8dee8" } } },
    yAxis: { type: "value", name: unit, nameTextStyle: { color: "#8a94a6", fontSize: 10 }, splitLine: { lineStyle: { color: "#edf1f6" } }, axisLabel: { fontSize: 10, color: "#8a94a6" } }
  };
}

function lineOption(unit: string, data: number[], color = colors[0]): EChartsOption {
  return { ...axisBase(unit), series: [{ type: "line", smooth: true, showSymbol: false, lineStyle: { width: 1.8, color }, areaStyle: undefined, data }] };
}

function areaOption(unit: string, data: number[], color = colors[1]): EChartsOption {
  return { ...axisBase(unit), series: [{ type: "line", smooth: true, showSymbol: false, lineStyle: { width: 1.6, color }, areaStyle: { opacity: 0.16, color }, data }] };
}

function barOption(unit: string, data: Array<{ name: string; value: number }>, color = colors[0]): EChartsOption {
  return {
    color: [color],
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: 40, right: 12, top: 18, bottom: 34 },
    xAxis: { type: "category", data: data.map((item) => item.name), axisLabel: { rotate: 28, fontSize: 10, color: "#8a94a6" }, axisTick: { show: false } },
    yAxis: { type: "value", name: unit, splitLine: { lineStyle: { color: "#edf1f6" } }, axisLabel: { fontSize: 10, color: "#8a94a6" } },
    series: [{ type: "bar", data: data.map((item) => item.value), barMaxWidth: 18 }]
  };
}

function pieOption(data: Array<{ name: string; value: number }>): EChartsOption {
  return { color: colors, tooltip: { trigger: "item" }, legend: { bottom: 0, type: "scroll", itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 10 } }, series: [{ type: "pie", radius: ["48%", "72%"], center: ["50%", "42%"], avoidLabelOverlap: true, label: { fontSize: 10 }, data }] };
}

function gaugeOption(unit: string, value: number, max = 100): EChartsOption {
  return { series: [{ type: "gauge", min: 0, max, progress: { show: true, width: 8 }, axisLine: { lineStyle: { width: 8 } }, axisTick: { show: false }, splitLine: { length: 6 }, axisLabel: { fontSize: 9 }, pointer: { width: 3 }, detail: { formatter: `{value}${unit}`, fontSize: 16, offsetCenter: [0, "58%"] }, data: [{ value }] }] };
}

function scatterOption(unit: string): EChartsOption {
  const data = Array.from({ length: 54 }, (_, index) => [Number((12 + ((index * 19) % 82)).toFixed(1)), Number((3 + ((index * 29) % 180) + Math.sin(index) * 12).toFixed(1))]);
  return { ...axisBase(unit), xAxis: { type: "value", name: "CPU %", splitLine: { lineStyle: { color: "#edf1f6" } }, axisLabel: { fontSize: 10, color: "#8a94a6" } }, series: [{ type: "scatter", symbolSize: 7, data }] };
}

function heatmapOption(names: string[], unit = "ms"): EChartsOption {
  const data = names.flatMap((name, row) => timeLabels.slice(0, 16).map((_, col) => [col, row, Number((12 + row * 3.2 + Math.abs(Math.sin(col / 2 + row)) * 70).toFixed(1))]));
  return { tooltip: { position: "top" }, grid: { left: 70, right: 12, top: 14, bottom: 36 }, xAxis: { type: "category", data: timeLabels.slice(0, 16), axisLabel: { fontSize: 10 } }, yAxis: { type: "category", data: names, axisLabel: { fontSize: 10 } }, visualMap: { min: 0, max: unit === "%" ? 100 : 160, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 70, textStyle: { fontSize: 10 } }, series: [{ type: "heatmap", data }] };
}

function radarOption(labels: string[]): EChartsOption {
  return { tooltip: {}, radar: { radius: "64%", indicator: labels.map((name, index) => ({ name, max: 100 + index * 10 })), axisName: { fontSize: 10 } }, series: [{ type: "radar", areaStyle: { opacity: 0.14 }, data: [{ value: labels.map((_, index) => 72 + ((index * 13) % 25)), name: "score" }] }] };
}

function treemapOption(items: string[]): EChartsOption {
  return { tooltip: {}, series: [{ type: "treemap", roam: false, breadcrumb: { show: false }, label: { fontSize: 11 }, upperLabel: { show: false }, data: items.map((name, index) => ({ name, value: 20 + index * 9 + ((index * 7) % 15) })) }] };
}

function funnelOption(): EChartsOption {
  return { tooltip: { trigger: "item" }, series: [{ type: "funnel", left: "8%", top: 12, width: "84%", height: "82%", label: { fontSize: 11 }, data: [{ name: "Alerting", value: 100 }, { name: "Routed", value: 86 }, { name: "Acknowledged", value: 61 }, { name: "Mitigated", value: 39 }, { name: "Resolved", value: 31 }] }] };
}

type MetricSpec = { title: string; kind: ChartKind; metric: string; entity: string; unit: string; base: number; amp: number; tags: string[]; summary: string; priority?: ChartMeta["priority"] };

const commonSpecs: MetricSpec[] = [
  { title: "API Server Request Rate", kind: "area", metric: "apiserver_request_total", entity: "kube-system", unit: "rps", base: 1850, amp: 420, tags: ["apiserver", "request", "control-plane"], summary: "控制面请求量在发布窗口后升高，峰值约 2.6k rps。" },
  { title: "API Server p99 Latency", kind: "line", metric: "apiserver_request_duration_seconds_bucket", entity: "kube-system", unit: "ms", base: 210, amp: 55, tags: ["apiserver", "latency", "p99"], summary: "p99 延迟维持在 180-280ms，偶发尖峰需要结合 etcd 查看。", priority: "warning" },
  { title: "Cluster CPU Utilization", kind: "gauge", metric: "cluster:node_cpu:ratio", entity: "cluster", unit: "%", base: 68, amp: 0, tags: ["cpu", "capacity"], summary: "集群 CPU 使用率 68%，离 HPA 扩容阈值仍有余量。" },
  { title: "Cluster Memory Working Set", kind: "area", metric: "container_memory_working_set_bytes", entity: "cluster", unit: "GiB", base: 842, amp: 96, tags: ["memory", "working-set"], summary: "内存工作集平稳增长，夜间批任务释放后回落。" },
  { title: "Pod Restart Rate", kind: "bar", metric: "kube_pod_container_status_restarts_total", entity: "namespaces", unit: "restart/h", base: 3, amp: 2, tags: ["pod", "restart"], summary: "checkout 与 orders 命名空间重启次数偏高。", priority: "warning" },
  { title: "Pending Pods", kind: "line", metric: "kube_pod_status_phase_pending", entity: "scheduler", unit: "pods", base: 7, amp: 5, tags: ["pending", "scheduler"], summary: "Pending Pod 数在 GPU 节点资源竞争时上升。" },
  { title: "Node Pressure Heatmap", kind: "heatmap", metric: "kube_node_status_condition", entity: "nodes", unit: "%", base: 0, amp: 0, tags: ["node", "pressure", "heatmap"], summary: "cn-prod-b-02 与 gpu 节点有间歇性 MemoryPressure。", priority: "warning" },
  { title: "Namespace CPU Top", kind: "bar", metric: "namespace:container_cpu_usage_seconds_total:sum_rate", entity: "namespaces", unit: "core", base: 28, amp: 11, tags: ["namespace", "cpu"], summary: "payments 和 ml-serving 消耗最多 CPU。" },
  { title: "Namespace Memory Top", kind: "bar", metric: "namespace:container_memory_working_set_bytes:sum", entity: "namespaces", unit: "GiB", base: 64, amp: 24, tags: ["namespace", "memory"], summary: "observability 的 Prometheus TSDB 占用明显。" },
  { title: "Ingress 5xx Ratio", kind: "line", metric: "nginx_ingress_controller_requests", entity: "ingress-nginx", unit: "%", base: 0.35, amp: 0.18, tags: ["ingress", "5xx", "error"], summary: "gateway 路径 5xx 比例轻微抬升。", priority: "warning" },
  { title: "Service p95 Latency", kind: "scatter", metric: "http_server_request_duration_seconds", entity: "services", unit: "ms", base: 0, amp: 0, tags: ["service", "latency", "p95"], summary: "高 CPU 样本通常伴随 120ms 以上接口延迟。" },
  { title: "CoreDNS Query Rate", kind: "area", metric: "coredns_dns_requests_total", entity: "kube-system", unit: "qps", base: 5200, amp: 1100, tags: ["coredns", "dns", "qps"], summary: "CoreDNS 查询量跟随业务流量变化，缓存命中率稳定。" },
  { title: "CoreDNS Error Ratio", kind: "line", metric: "coredns_dns_responses_total", entity: "kube-system", unit: "%", base: 0.18, amp: 0.09, tags: ["coredns", "error"], summary: "SERVFAIL 比例低于 0.4%，未达到告警阈值。" },
  { title: "Etcd Leader Changes", kind: "bar", metric: "etcd_server_leader_changes_seen_total", entity: "etcd", unit: "count", base: 1, amp: 1, tags: ["etcd", "leader"], summary: "etcd leader 变更次数很低，控制面稳定。" },
  { title: "Etcd fsync p99", kind: "line", metric: "etcd_disk_wal_fsync_duration_seconds", entity: "etcd", unit: "ms", base: 8, amp: 4, tags: ["etcd", "disk", "fsync"], summary: "WAL fsync p99 低于 18ms，磁盘无明显瓶颈。" },
  { title: "PVC Usage Top", kind: "bar", metric: "kubelet_volume_stats_used_bytes", entity: "pvcs", unit: "%", base: 52, amp: 19, tags: ["pvc", "storage", "usage"], summary: "prometheus-data 与 loki-chunks 接近 80% 容量水位。", priority: "warning" },
  { title: "PVC IO Latency", kind: "line", metric: "storage_operation_duration_seconds", entity: "csi", unit: "ms", base: 14, amp: 6, tags: ["pvc", "io", "latency"], summary: "CSI 读写延迟稳定在 10-25ms。" },
  { title: "Image Pull Duration", kind: "line", metric: "kubelet_runtime_operations_duration_seconds", entity: "kubelet", unit: "s", base: 7, amp: 2.8, tags: ["image", "pull", "kubelet"], summary: "镜像拉取耗时在发布期间升高。" },
  { title: "HPA Desired Replicas", kind: "area", metric: "kube_horizontalpodautoscaler_status_desired_replicas", entity: "hpa", unit: "replicas", base: 42, amp: 13, tags: ["hpa", "replicas"], summary: "HPA 在流量高峰将核心服务扩至 50+ 副本。" },
  { title: "Deployment Availability", kind: "gauge", metric: "kube_deployment_status_replicas_available", entity: "deployments", unit: "%", base: 96.7, amp: 0, tags: ["deployment", "availability"], summary: "Deployment 可用副本比例 96.7%，低于目标的服务主要在 checkout。" },
  { title: "Rollout Error Budget", kind: "pie", metric: "slo:error_budget_remaining", entity: "slo", unit: "%", base: 0, amp: 0, tags: ["slo", "error-budget"], summary: "checkout-api 消耗了最多错误预算。", priority: "warning" },
  { title: "Container OOMKilled", kind: "bar", metric: "kube_pod_container_status_last_terminated_reason", entity: "containers", unit: "count", base: 0, amp: 2, tags: ["oom", "container"], summary: "recommendation-svc 与 order-worker 出现 OOMKilled。", priority: "critical" },
  { title: "Scheduling Latency", kind: "line", metric: "scheduler_e2e_scheduling_duration_seconds", entity: "scheduler", unit: "ms", base: 65, amp: 26, tags: ["scheduler", "latency"], summary: "调度延迟 p95 在资源紧张时超过 120ms。" },
  { title: "CNI Packet Drops", kind: "area", metric: "cilium_drop_count_total", entity: "cilium", unit: "pps", base: 18, amp: 10, tags: ["cni", "packet-drop"], summary: "CNI drop 在 edge 节点波动较明显。", priority: "warning" },
  { title: "Network Policy Verdicts", kind: "pie", metric: "cilium_policy_verdict_total", entity: "cilium", unit: "count", base: 0, amp: 0, tags: ["network-policy", "verdict"], summary: "大部分流量被允许，少量 deny 来自默认拒绝策略。" },
  { title: "Audit Event Funnel", kind: "funnel", metric: "apiserver_audit_event_total", entity: "audit", unit: "count", base: 0, amp: 0, tags: ["audit", "security"], summary: "高风险审计事件从产生到闭环的转化路径。" },
  { title: "RBAC Risk Score", kind: "radar", metric: "rbac_risk_score", entity: "rbac", unit: "score", base: 0, amp: 0, tags: ["rbac", "risk"], summary: "cluster-admin 绑定、通配权限和长期 token 是主要风险。" },
  { title: "Vulnerability by Namespace", kind: "treemap", metric: "image_vulnerability_total", entity: "trivy", unit: "count", base: 0, amp: 0, tags: ["vulnerability", "image"], summary: "platform 与 ml-serving 镜像漏洞数量较高。", priority: "warning" },
  { title: "TLS Certificate Expiry", kind: "bar", metric: "x509_cert_expires_in_seconds", entity: "cert-manager", unit: "days", base: 14, amp: 7, tags: ["tls", "certificate"], summary: "两个 ingress 证书将在 14 天内到期。", priority: "critical" },
  { title: "Alertmanager Noise", kind: "bar", metric: "alertmanager_notifications_total", entity: "alertmanager", unit: "alerts/h", base: 35, amp: 18, tags: ["alert", "noise"], summary: "watchdog 与 CPUThrottlingHigh 是主要噪声来源。" }
];

const topicOverrides: Record<TopicKey, { prefix: string; tags: string[]; entityPool: string[]; focus: string }> = {
  overview: { prefix: "", tags: ["cluster", "overview"], entityPool: ["prod-cn-east-1"], focus: "集群全局" },
  workloads: { prefix: "Workload / ", tags: ["deployment", "statefulset", "rollout"], entityPool: workloads, focus: "工作负载" },
  nodes: { prefix: "Node / ", tags: ["node", "kubelet", "capacity"], entityPool: nodes, focus: "节点" },
  pods: { prefix: "Pod / ", tags: ["pod", "container", "event"], entityPool: workloads.map((item) => `${item}-pod`), focus: "Pod 与容器" },
  network: { prefix: "Network / ", tags: ["ingress", "service", "dns", "cni"], entityPool: ["ingress-nginx", "coredns", "cilium", "istio-system", "gateway"], focus: "网络路径" },
  storage: { prefix: "Storage / ", tags: ["pvc", "pv", "csi", "iops"], entityPool: ["prometheus-data", "loki-chunks", "mysql-data", "redis-aof", "minio-bucket"], focus: "存储卷" },
  security: { prefix: "Security / ", tags: ["audit", "rbac", "policy", "vulnerability"], entityPool: ["rbac", "kyverno", "trivy", "cert-manager", "audit"], focus: "安全控制" }
};

function optionFor(spec: MetricSpec, index: number, tick = 0): EChartsOption {
  if (spec.kind === "line") return lineOption(spec.unit, series(30, spec.base, spec.amp, index / 3, index % 9 === 0 ? 22 : undefined, tick), colors[index % colors.length]);
  if (spec.kind === "area") return areaOption(spec.unit, series(30, spec.base, spec.amp, index / 4, index % 8 === 0 ? 18 : undefined, tick), colors[index % colors.length]);
  if (spec.kind === "bar") return barOption(spec.unit, ranked(index % 2 ? workloads : namespaces, spec.base, Math.max(1, spec.amp), tick), colors[index % colors.length]);
  if (spec.kind === "pie") return pieOption(ranked(["payments", "checkout", "orders", "platform", "ml-serving"], 12, 7, tick));
  if (spec.kind === "gauge") return gaugeOption(spec.unit, spec.base, spec.unit === "%" ? 100 : Math.max(100, spec.base * 1.5));
  if (spec.kind === "scatter") return scatterOption(spec.unit);
  if (spec.kind === "heatmap") return heatmapOption(nodes.slice(0, 7), spec.unit);
  if (spec.kind === "radar") return radarOption(["RBAC", "Secrets", "Images", "Network", "Admission"]);
  if (spec.kind === "treemap") return treemapOption(namespaces);
  return funnelOption();
}

export function createTopicCharts(tick = 0): Record<TopicKey, ChartMeta[]> {
  return topics.reduce(
    (result, topic) => {
      const override = topicOverrides[topic.key];
      result[topic.key] = commonSpecs.map((spec, index) => {
        const entity = override.entityPool[index % override.entityPool.length] ?? spec.entity;
        const priority = spec.priority ?? (index % 13 === 0 ? "critical" : index % 5 === 0 ? "warning" : "normal");
        return {
          id: `${topic.key}-${String(index + 1).padStart(2, "0")}`,
          title: `${override.prefix}${spec.title}`,
          kind: spec.kind,
          domain: topic.label,
          metric: spec.metric,
          room: entity,
          unit: spec.unit,
          intentTags: Array.from(new Set([...topic.tags, ...override.tags, ...spec.tags, entity, override.focus])),
          summary: `${override.focus}视角：${spec.summary}`,
          priority,
          option: optionFor(spec, index, tick)
        };
      });
      return result;
    },
    {} as Record<TopicKey, ChartMeta[]>
  );
}

export function createCharts(): ChartMeta[] {
  return createTopicCharts().overview;
}

export function findTopicByText(text: string): TopicKey | null {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+|，|,|。|、/).filter((word) => word.length > 1);
  const found = topics.find((topic) => {
    const haystack = `${topic.key} ${topic.label} ${topic.description} ${topic.tags.join(" ")}`.toLowerCase();
    return haystack.includes(lower) || words.some((word) => haystack.includes(word));
  });
  return found?.key ?? null;
}

export function timeRangeLabel(range: TimeRange) {
  const labels: Record<TimeRange, string> = {
    "1h": "Last 1h",
    "6h": "Last 6h",
    "24h": "Last 24h",
    "7d": "Last 7d"
  };
  return labels[range];
}
