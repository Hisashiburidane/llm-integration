import { findTopicByText, topics, type ChartMeta, type TimeRange, type TopicKey } from "./data";

export type UiActionName =
  | "navigate_topic"
  | "set_time_range"
  | "highlight_charts"
  | "open_chart"
  | "compose_dashboard"
  | "show_tooltip"
  | "summarize_context"
  | "compare_charts";

export type UiActionCall = {
  action: UiActionName;
  topicKey?: TopicKey;
  chartIds?: string[];
  chartId?: string;
  timeRange?: TimeRange;
  keyword?: string;
  reason?: string;
};

export type LlmTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const uiTool: LlmTool = {
  type: "function",
  function: {
    name: "control_datacenter_dashboard",
    description: "Control the active data-center monitoring system. Navigate topics, select charts, change time range, open detail views, compose a focused dashboard, compare charts, or show a chart tooltip.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["navigate_topic", "set_time_range", "highlight_charts", "open_chart", "compose_dashboard", "show_tooltip", "summarize_context", "compare_charts"]
        },
        topicKey: { type: "string", enum: topics.map((topic) => topic.key) },
        chartId: { type: "string" },
        chartIds: { type: "array", items: { type: "string" } },
        timeRange: { type: "string", enum: ["1h", "6h", "24h", "7d"] },
        keyword: { type: "string" },
        reason: { type: "string" }
      },
      required: ["action"]
    }
  }
};

export function buildUiContext(charts: ChartMeta[], timeRange: TimeRange, activeTopic: TopicKey) {
  return {
    page: "Data center monitoring console",
    activeTopic,
    activeTimeRange: timeRange,
    topicIndex: topics.map(({ key, label, description, tags }) => ({ key, label, description, tags })),
    capabilities: [
      "navigate_topic: open a monitoring menu/topic by semantic intent",
      "set_time_range: change the visible time window",
      "highlight_charts: highlight relevant charts on the current topic",
      "open_chart: open one chart in a modal detail view",
      "compose_dashboard: combine multiple matched charts into a child dashboard drawer",
      "show_tooltip: simulate mouse hover tooltip and x/y crosshair",
      "compare_charts: open a comparison child dashboard"
    ],
    aliveCharts: charts.map(({ id, title, kind, domain, metric, room, intentTags, summary, priority }) => ({
      id,
      title,
      kind,
      domain,
      metric,
      room,
      intentTags,
      summary,
      priority
    }))
  };
}

function matchCharts(prompt: string, charts: ChartMeta[]) {
  const text = prompt.toLowerCase();
  const words = text.split(/\s+|，|,|。|、/).filter((word) => word.length > 1);
  return charts.filter((chart) => {
    const haystack = `${chart.id} ${chart.title} ${chart.domain} ${chart.metric} ${chart.room} ${chart.intentTags.join(" ")} ${chart.summary}`.toLowerCase();
    return haystack.includes(text) || words.some((word) => haystack.includes(word));
  });
}

export function localPlan(prompt: string, charts: ChartMeta[], activeTopic: TopicKey, allCharts?: Record<TopicKey, ChartMeta[]>): UiActionCall[] {
  const text = prompt.toLowerCase();
  const calls: UiActionCall[] = [];
  const topicKey = findTopicByText(prompt);

  if (topicKey && topicKey !== activeTopic) {
    calls.push({ action: "navigate_topic", topicKey, reason: "Matched a monitoring topic from the natural-language request." });
  }

  const planningCharts = topicKey && allCharts ? allCharts[topicKey] : charts;
  const matched = matchCharts(prompt, planningCharts);
  const fallback = matched.length ? matched : planningCharts.filter((chart) => chart.priority !== "normal").slice(0, 5);

  if (prompt.includes("7天") || prompt.includes("一周") || text.includes("week")) {
    calls.push({ action: "set_time_range", timeRange: "7d", reason: "The request asks for a longer time window." });
  } else if (prompt.includes("1小时") || text.includes("hour")) {
    calls.push({ action: "set_time_range", timeRange: "1h", reason: "The request asks for a short time window." });
  } else if (prompt.includes("6小时")) {
    calls.push({ action: "set_time_range", timeRange: "6h", reason: "The request asks for a 6 hour window." });
  }

  calls.push({ action: "highlight_charts", chartIds: fallback.slice(0, 6).map((chart) => chart.id), reason: "Matched relevant chart metadata." });

  if (prompt.includes("打开") || prompt.includes("放大") || text.includes("open")) {
    if (fallback.length > 1) {
      calls.push({ action: "compose_dashboard", chartIds: fallback.slice(0, 4).map((chart) => chart.id), reason: "Multiple charts match, so compose a child dashboard." });
    } else if (fallback[0]) {
      calls.push({ action: "open_chart", chartId: fallback[0].id, reason: "Open the best matched chart." });
    }
  }

  if (prompt.includes("tooltip") || prompt.includes("鼠标") || prompt.includes("查看数据")) {
    calls.push({ action: "show_tooltip", chartId: fallback[0]?.id ?? charts[0].id, reason: "Simulate hover inspection on a chart." });
  }

  if (prompt.includes("比较") || prompt.includes("分析") || text.includes("compare")) {
    calls.push({ action: "compare_charts", chartIds: fallback.slice(0, 4).map((chart) => chart.id), reason: "Compare matched charts." });
  }

  return calls;
}

export function createInsight(charts: ChartMeta[], selectedIds: string[], activeTopic: TopicKey) {
  const selected = selectedIds.length ? charts.filter((chart) => selectedIds.includes(chart.id)) : charts.filter((chart) => chart.priority !== "normal").slice(0, 5);
  const critical = selected.filter((chart) => chart.priority === "critical");
  const warning = selected.filter((chart) => chart.priority === "warning");
  const metrics = selected.slice(0, 5).map((chart) => chart.metric).join("、");
  const entities = Array.from(new Set(selected.map((chart) => chart.room))).slice(0, 5).join("、");
  const topic = topics.find((item) => item.key === activeTopic)?.label ?? activeTopic;

  if (!selected.length) {
    return `${topic} 当前没有明显异常图表。建议查看 Overview 的 SLO、API Server latency 和 Pod restart rate。`;
  }

  return `${topic} 诊断摘要：我关注了 ${selected.length} 个相关图表，其中 ${critical.length} 个 critical、${warning.length} 个 warning。主要指标是 ${metrics}，涉及对象包括 ${entities}。建议先确认是否存在共同时间窗口的尖峰，再按链路顺序检查：入口流量 -> 服务延迟 -> Pod 重启/OOM -> Node 或存储压力。`;
}

export function recommendPrompts(activeTopic: TopicKey) {
  const base: Record<TopicKey, string[]> = {
    overview: ["分析当前集群最值得关注的异常", "打开 API Server latency 和 etcd fsync", "组合 SLO、Pod restart 和 CPU capacity 图表"],
    workloads: ["检查发布后不可用副本", "找 HPA 扩缩容异常", "对比 deployment availability 和 error budget"],
    nodes: ["查看节点压力和 kubelet 异常", "找 CPU/Memory 使用最高的节点", "组合 node pressure heatmap 和 pod pending"],
    pods: ["找 OOMKilled 和重启异常", "查看调度延迟和 image pull duration", "分析 Pod pending 的可能原因"],
    network: ["分析 ingress 5xx 和 CoreDNS 错误", "组合 CNI packet drop 与 service latency", "查看网络策略 deny 是否异常"],
    storage: ["找 PVC 容量接近阈值的对象", "分析 CSI 延迟和 PVC IO", "打开 Prometheus/Loki 存储风险图表"],
    security: ["查看即将到期的 TLS 证书", "分析 RBAC 风险和镜像漏洞", "组合 audit event、RBAC、vulnerability 图表"]
  };
  return base[activeTopic];
}
export function extractToolCalls(response: any): UiActionCall[] {
  const message = response?.choices?.[0]?.message;
  const toolCalls = message?.tool_calls ?? [];
  const calls = toolCalls
    .filter((call: any) => call?.function?.name === "control_datacenter_dashboard")
    .map((call: any) => {
      try {
        return JSON.parse(call.function.arguments);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (calls.length) return calls;

  try {
    const parsed = JSON.parse(message?.content ?? "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}


