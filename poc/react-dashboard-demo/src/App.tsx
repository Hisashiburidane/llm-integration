import {
  AlertOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  BulbOutlined,
  CloseOutlined,
  ContainerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EyeOutlined,
  HddOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { Bubble, Prompts, Sender, type BubbleItemType, type PromptsItemType } from "@ant-design/x";
import { Alert, Button, Card, Col, Drawer, Flex, Form, Input, Layout, Menu, Modal, Row, Space, Statistic, Switch, Tag, Tooltip, Typography, message } from "antd";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createTopicCharts, timeRangeLabel, topics, type ChartMeta, type TimeRange, type TopicKey } from "./data";
import { buildUiContext, createInsight, extractToolCalls, localPlan, recommendPrompts, uiTool, type UiActionCall } from "./llmRuntime";

const { Header, Sider, Content } = Layout;
const { Text, Title } = Typography;
type ChartInstance = any;
type LlmConfig = { baseUrl: string; apiKey: string; model: string };
type AssistantMsg = { key: string; role: "ai" | "user" | "system"; content: string };

type DragState = { pointerId: number; startX: number; startY: number; startRight: number; startBottom: number } | null;

const defaultConfig: LlmConfig = {
  baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
  model: import.meta.env.VITE_OPENAI_MODEL || "gpt-4.1-mini"
};
const highlightTraceDuration = import.meta.env.VITE_HIGHLIGHT_TRACE_DURATION || "3.8s";
function priorityColor(priority: ChartMeta["priority"]) {
  if (priority === "critical") return "red";
  if (priority === "warning") return "gold";
  return "green";
}

function menuIcon(icon: string) {
  const map: Record<string, JSX.Element> = {
    dashboard: <DashboardOutlined />,
    appstore: <AppstoreOutlined />,
    database: <DatabaseOutlined />,
    container: <ContainerOutlined />,
    branches: <ApartmentOutlined />,
    hdd: <HddOutlined />,
    safety: <SafetyCertificateOutlined />,
    alert: <AlertOutlined />
  };
  return map[icon] ?? <DashboardOutlined />;
}

function ChartPanel({ chart, highlighted, dimmed, registerChart, onOpen, onTooltip }: {
  chart: ChartMeta;
  highlighted: boolean;
  dimmed: boolean;
  registerChart: (id: string, instance?: ChartInstance) => void;
  onOpen: (chart: ChartMeta) => void;
  onTooltip: (chart: ChartMeta) => void;
}) {
  return (
    <Card
      className={`chart-card ${highlighted ? "chart-card-highlighted" : ""} ${dimmed ? "chart-card-dimmed" : ""}`}
      size="small"
      title={<Space size={6}><span>{chart.title}</span><Tag color={priorityColor(chart.priority)}>{chart.priority}</Tag></Space>}
      extra={<Space size={4}><Tooltip title="Show tooltip"><Button size="small" icon={<EyeOutlined />} onClick={() => onTooltip(chart)} /></Tooltip><Tooltip title="Open detail"><Button size="small" icon={<SearchOutlined />} onClick={() => onOpen(chart)} /></Tooltip></Space>}
    >
      <ReactECharts option={chart.option} style={{ height: 168 }} notMerge onChartReady={(instance) => registerChart(chart.id, instance)} />
      <Text className="chart-summary" type="secondary">{chart.metric} · {chart.room}</Text>
    </Card>
  );
}

export default function App() {
  const chartRefs = useRef(new Map<string, ChartInstance>());
  const dragRef = useRef<DragState>(null);
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const topicCharts = useMemo(() => createTopicCharts(tick), [tick]);
  const [activeTopic, setActiveTopic] = useState<TopicKey>("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [activeChart, setActiveChart] = useState<ChartMeta | null>(null);
  const [composedCharts, setComposedCharts] = useState<ChartMeta[]>([]);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(defaultConfig);
  const [input, setInput] = useState("跳转到 Network，找出 ingress 5xx、CoreDNS、CNI packet drop 相关图表，组合成子 dashboard，并显示 tooltip");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantPos, setAssistantPos] = useState({ right: 22, bottom: 22 });
  const [messages, setMessages] = useState<AssistantMsg[]>([
    { key: "hello", role: "ai", content: "我已读取当前页面元数据：7 个 K8s 专题菜单，当前专题暴露 30 个 alive 图表。你可以让我跳转菜单、筛选图表、组合子 dashboard 或模拟 hover tooltip。" }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 3500);
    return () => window.clearInterval(id);
  }, [live]);

  const charts = topicCharts[activeTopic];
  const activeTopicMeta = topics.find((topic) => topic.key === activeTopic) ?? topics[0];
  const uiContext = useMemo(() => buildUiContext(charts, timeRange, activeTopic), [charts, timeRange, activeTopic]);
  const promptItems: PromptsItemType[] = useMemo(() => recommendPrompts(activeTopic).map((text, index) => ({ key: `${activeTopic}-${index}`, icon: index === 0 ? <BulbOutlined /> : index === 1 ? <SearchOutlined /> : <DashboardOutlined />, label: text, description: text })), [activeTopic]);
  const highlightedCharts = charts.filter((chart) => highlightedIds.includes(chart.id));
  const hasHighlights = highlightedIds.length > 0;
  const criticalCount = charts.filter((chart) => chart.priority === "critical").length;
  const warningCount = charts.filter((chart) => chart.priority === "warning").length;

  function addMessage(role: AssistantMsg["role"], content: string) {
    setMessages((current) => [...current, { key: `${Date.now()}-${current.length}`, role, content }].slice(-16));
  }

  function registerChart(id: string, instance?: ChartInstance) { if (instance) chartRefs.current.set(id, instance); }
  function log(line: string) { addMessage("system", line); }

  function navigateTopic(topicKey: TopicKey) {
    setActiveTopic(topicKey);
    setHighlightedIds([]);
    setActiveChart(null);
    setComposedCharts([]);
    const topic = topics.find((item) => item.key === topicKey);
    log(`已跳转到 ${topic?.label ?? topicKey}。`);
  }

  function showTooltip(chart: ChartMeta) {
    const instance = chartRefs.current.get(chart.id);
    instance?.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: 24 });
    instance?.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex: 24 });
    setHighlightedIds((ids) => Array.from(new Set([chart.id, ...ids])).slice(0, 8));
    log(`已在 ${chart.title} 上模拟 hover，显示 tooltip 和十字准线。`);
  }

  function findChartsForCall(call: UiActionCall) {
    const allCharts = call.topicKey ? topicCharts[call.topicKey] : charts;
    const ids = call.chartIds?.length ? call.chartIds : call.chartId ? [call.chartId] : [];
    return allCharts.filter((chart) => ids.includes(chart.id));
  }

  function executeAction(call: UiActionCall) {
    if (call.action === "navigate_topic" && call.topicKey) return navigateTopic(call.topicKey);
    const selected = findChartsForCall(call);
    if (call.action === "set_time_range" && call.timeRange) { setTimeRange(call.timeRange); log(`时间范围已切换为 ${timeRangeLabel(call.timeRange)}。`); return; }
    if (call.action === "highlight_charts") { setHighlightedIds(selected.map((chart) => chart.id)); log(`已高亮 ${selected.length} 个相关图表。`); return; }
    if (call.action === "open_chart" && selected[0]) { setActiveChart(selected[0]); log(`已打开 ${selected[0].title}。`); return; }
    if (call.action === "compose_dashboard") { const cards = selected.length ? selected : highlightedCharts; setComposedCharts(cards); log(`已组合 ${cards.length} 个图表为子 dashboard。`); return; }
    if (call.action === "show_tooltip") { showTooltip(selected[0] ?? highlightedCharts[0] ?? charts[0]); return; }
    if (call.action === "compare_charts") { const compare = selected.length ? selected : highlightedCharts; setComposedCharts(compare); log(`已进入对比视图：${compare.map((chart) => chart.metric).join(" vs ")}。`); return; }
    if (call.action === "summarize_context") log(`当前是 ${activeTopicMeta.label}：${activeTopicMeta.description}。`);
  }

  function executeCalls(calls: UiActionCall[], source: "LLM" | "离线模拟") {
    calls.forEach(executeAction);
    const ids = calls.flatMap((call) => call.chartIds ?? (call.chartId ? [call.chartId] : []));
    addMessage("ai", `${source} 已执行 ${calls.length} 个动作：${calls.map((call) => call.action).join("、")}。`);
    addMessage("ai", createInsight(charts, ids, activeTopic));
  }

  async function runOfflineSimulation(text: string) {
    const calls = localPlan(text, charts, activeTopic, topicCharts);
    executeCalls(calls, "离线模拟");
  }

  async function callLlm(text: string) {
    if (!llmConfig.baseUrl || !llmConfig.model || !llmConfig.apiKey) { message.warning("请在 .env 中配置 VITE_OPENAI_API_KEY，或使用离线模拟。"); return; }
    setLoading(true);
    try {
      const response = await fetch(`${llmConfig.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmConfig.apiKey}` },
        body: JSON.stringify({
          model: llmConfig.model,
          temperature: 0.2,
          messages: [
            { role: "system", content: "You control a Kubernetes Grafana-like dashboard. Use navigate_topic when needed. Prefer aliveCharts ids. If multiple charts match, compose a dashboard. Use show_tooltip for hover inspection." },
            { role: "user", content: `UI context:\n${JSON.stringify(uiContext)}\n\nUser request:\n${text}` }
          ],
          tools: [uiTool],
          tool_choice: "auto"
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const calls = extractToolCalls(await response.json());
      if (!calls.length) { addMessage("ai", "LLM 没有返回可执行动作。可以换一种更具体的说法，例如指定 Network、Pods、PVC、CoreDNS。 即可。"); return; }
      executeCalls(calls, "LLM");
    } catch (error) {
      addMessage("ai", error instanceof Error ? `LLM 调用失败：${error.message}` : "LLM 调用失败。");
    } finally { setLoading(false); }
  }

  function submitAssistant(text: string, offline = false) {
    const value = text.trim();
    if (!value) return;
    addMessage("user", value);
    setInput("");
    if (offline) void runOfflineSimulation(value);
    else void callLlm(value);
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startRight: assistantPos.right, startBottom: assistantPos.bottom };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextRight = Math.max(8, Math.min(window.innerWidth - 420, drag.startRight - (event.clientX - drag.startX)));
    const nextBottom = Math.max(8, Math.min(window.innerHeight - 120, drag.startBottom - (event.clientY - drag.startY)));
    setAssistantPos({ right: nextRight, bottom: nextBottom });
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  const bubbleItems: BubbleItemType[] = messages.map((item) => ({ key: item.key, role: item.role, content: item.content }));

  return (
    <Layout className="app-shell" style={{ "--highlight-trace-duration": highlightTraceDuration } as React.CSSProperties}>
      <Header className="app-header">
        <Space><DashboardOutlined /><Title level={4}>K8s Observability Console</Title></Space>
        <Space><Tag color="blue">prod-cn-east-1</Tag><Tag color="geekblue">{activeTopicMeta.label}</Tag><Tag>{timeRangeLabel(timeRange)}</Tag><Tag color="red">{criticalCount} critical</Tag><Tag color="gold">{warningCount} warning</Tag><Switch size="small" checked={live} onChange={setLive} /> <Text className="live-label">live</Text></Space>
      </Header>
      <Layout>
        <Sider width={232} className="menu-panel"><Menu mode="inline" selectedKeys={[activeTopic]} items={topics.map((topic) => ({ key: topic.key, icon: menuIcon(topic.icon), label: topic.label }))} onClick={(event) => navigateTopic(event.key as TopicKey)} /></Sider>
        <Content className="content">
          <Row gutter={[8, 8]} className="stat-row">
            <Col span={6}><Card size="small" className="metric-card"><Statistic title="Ready Nodes" value={47} suffix="/ 48" /></Card></Col>
            <Col span={6}><Card size="small" className="metric-card"><Statistic title="CPU Requested" value={71.4} suffix="%" precision={1} /></Card></Col>
            <Col span={6}><Card size="small" className="metric-card"><Statistic title="Pod Restarts" value={criticalCount * 3 + warningCount * 2} valueStyle={{ color: "#d44a3a" }} /></Card></Col>
            <Col span={6}><Card size="small" className="metric-card"><Statistic title="SLO 30d" value={99.93} suffix="%" precision={2} /></Card></Col>
          </Row>
          <Alert className="context-alert" type="info" showIcon message={`${activeTopicMeta.label}: ${activeTopicMeta.description}。助手已读取菜单索引和当前专题 ${charts.length} 个 alive 图表，可自然语言跳转、筛选、高亮、组合和查看 tooltip。`} />
          <Row gutter={[8, 8]} className={hasHighlights ? "chart-grid has-highlight" : "chart-grid"}>{charts.map((chart) => <Col xs={24} md={12} xl={8} xxl={6} key={chart.id}><ChartPanel chart={chart} highlighted={highlightedIds.includes(chart.id)} dimmed={hasHighlights && !highlightedIds.includes(chart.id)} registerChart={registerChart} onOpen={setActiveChart} onTooltip={showTooltip} /></Col>)}</Row>
        </Content>
      </Layout>

      <div className={assistantOpen ? "assistant-panel open" : "assistant-panel"} style={{ right: assistantPos.right, bottom: assistantPos.bottom }}>
        <div className="assistant-avatar" onClick={() => setAssistantOpen((value) => !value)}><RobotOutlined /></div>
        {assistantOpen ? <Card className="assistant-card" size="small" title={<div className="assistant-titlebar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}><Space><RobotOutlined />K8s 助手</Space><span className="drag-hint">drag</span></div>} extra={<Space><Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setSettingsOpen((v) => !v)} /><Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setAssistantOpen(false)} /></Space>}>
          {settingsOpen ? <Form layout="vertical" className="assistant-settings"><div className="env-note">默认读取 .env：VITE_OPENAI_BASE_URL / VITE_OPENAI_API_KEY / VITE_OPENAI_MODEL</div><Form.Item label="Base URL"><Input value={llmConfig.baseUrl} onChange={(e) => setLlmConfig({ ...llmConfig, baseUrl: e.target.value })} /></Form.Item><Form.Item label="API Key"><Input.Password value={llmConfig.apiKey} onChange={(e) => setLlmConfig({ ...llmConfig, apiKey: e.target.value })} /></Form.Item><Form.Item label="Model"><Input value={llmConfig.model} onChange={(e) => setLlmConfig({ ...llmConfig, model: e.target.value })} /></Form.Item></Form> : null}
          <Prompts className="assistant-prompts" items={promptItems} wrap onItemClick={({ data }) => setInput(String(data.description ?? data.label ?? ""))} />
          <Bubble.List className="assistant-bubbles" autoScroll items={bubbleItems} role={{ ai: { placement: "start", variant: "filled", typing: { effect: "fade-in" }, avatar: <RobotOutlined /> }, user: { placement: "end", variant: "filled" }, system: { placement: "start", variant: "borderless" } }} />
          <Sender value={input} loading={loading} onChange={setInput} onSubmit={(value) => submitAssistant(value)} placeholder="输入自然语言操作，例如：跳转到 Pods，打开 OOMKilled 图表" autoSize={{ minRows: 2, maxRows: 4 }} />
          <Flex gap={8} className="assistant-actions"><Tooltip title="不调用 LLM，用简单规则模拟 tool 调用，仅用于 POC 无 key 演示"><Button icon={<BulbOutlined />} onClick={() => submitAssistant(input, true)}>离线模拟</Button></Tooltip></Flex>
        </Card> : null}
      </div>

      <Modal open={Boolean(activeChart)} title={activeChart?.title} width={980} onCancel={() => setActiveChart(null)} footer={null} destroyOnClose>{activeChart ? <><ReactECharts option={activeChart.option} style={{ height: 520 }} notMerge /><Alert type="success" showIcon message={activeChart.summary} /></> : null}</Modal>
      <Drawer open={Boolean(composedCharts.length)} title="Assistant Child Dashboard" width="78vw" onClose={() => setComposedCharts([])} destroyOnClose><Row gutter={[8, 8]}>{composedCharts.map((chart) => <Col xs={24} lg={12} key={chart.id}><Card size="small" title={chart.title}><ReactECharts option={chart.option} style={{ height: 280 }} notMerge /><Text type="secondary">{chart.summary}</Text></Card></Col>)}</Row></Drawer>
    </Layout>
  );
}





