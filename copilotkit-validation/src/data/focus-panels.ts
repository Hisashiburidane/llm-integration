import type { MetricPanel } from '../types';

function series(base: number, amplitude: number, phase: number) {
  return Array.from({ length: 36 }, (_, index) => {
    const wave = Math.sin(index / 4 + phase) * amplitude;
    const secondary = Math.cos(index / 2.7 + phase * 2) * amplitude * 0.28;
    return Number((base + wave + secondary).toFixed(2));
  });
}

export const focusPanels: MetricPanel[] = [
  {
    id: 'node-cpu',
    title: 'Node CPU Utilization',
    category: 'compute',
    description: '集群工作节点 CPU 使用率，观察计算资源压力。',
    unit: '%',
    value: 63.4,
    color: '#1677ff',
    tags: ['CPU', '节点', '计算资源', '负载'],
    series: series(57, 11, 0.3)
  },
  {
    id: 'pod-cpu-throttle',
    title: 'Pod CPU Throttling',
    category: 'compute',
    description: '容器受到 CPU CFS 限流的时间占比。',
    unit: '%',
    value: 8.7,
    color: '#d46b08',
    tags: ['CPU', 'Pod', '限流', '容器'],
    series: series(7, 3.6, 1.1)
  },
  {
    id: 'node-memory',
    title: 'Node Memory Working Set',
    category: 'memory',
    description: '节点不可快速回收的内存工作集使用率。',
    unit: '%',
    value: 76.2,
    color: '#722ed1',
    tags: ['内存', '节点', 'Working Set', '容量'],
    series: series(70, 7.5, 0.8)
  },
  {
    id: 'memory-pressure',
    title: 'Memory Pressure Events',
    category: 'memory',
    description: '最近时间窗口内节点内存压力事件数量。',
    unit: 'events',
    value: 12,
    color: '#cf1322',
    tags: ['内存', 'Pressure', '告警', '节点'],
    series: series(8, 5, 1.7).map((value) => Math.max(0, Math.round(value)))
  },
  {
    id: 'pvc-usage',
    title: 'PVC Capacity Usage',
    category: 'storage',
    description: '持久卷声明的平均容量使用率。',
    unit: '%',
    value: 68.9,
    color: '#08979c',
    tags: ['存储', 'PVC', '容量', '磁盘'],
    series: series(64, 5.5, 2.4)
  },
  {
    id: 'disk-io-latency',
    title: 'Disk IO P99 Latency',
    category: 'storage',
    description: '节点磁盘 IO 请求的 P99 响应延迟。',
    unit: 'ms',
    value: 18.6,
    color: '#13a8a8',
    tags: ['存储', '磁盘', 'IO', '延迟'],
    series: series(15, 7, 0.1)
  },
  {
    id: 'ingress-5xx',
    title: 'Ingress 5xx Rate',
    category: 'network',
    description: 'Ingress Controller 返回 5xx 的请求比例。',
    unit: '%',
    value: 1.38,
    color: '#cf1322',
    tags: ['网络', 'Ingress', '5xx', '错误率'],
    series: series(0.9, 0.65, 1.3).map((value) => Math.max(0, value))
  },
  {
    id: 'network-drop',
    title: 'Container Network Drops',
    category: 'network',
    description: '容器网络接口每秒丢包数量。',
    unit: 'pkt/s',
    value: 24.1,
    color: '#d46b08',
    tags: ['网络', '丢包', '容器', '接口'],
    series: series(19, 9, 2.1).map((value) => Math.max(0, value))
  },
  {
    id: 'coredns-latency',
    title: 'CoreDNS P95 Latency',
    category: 'network',
    description: '集群 DNS 请求的 P95 响应时间。',
    unit: 'ms',
    value: 42.7,
    color: '#1677ff',
    tags: ['网络', 'DNS', 'CoreDNS', '延迟'],
    series: series(36, 12, 0.5)
  }
];
