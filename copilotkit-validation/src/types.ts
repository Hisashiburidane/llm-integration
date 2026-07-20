export interface MetricPanel {
  id: string;
  title: string;
  category: 'compute' | 'memory' | 'storage' | 'network';
  description: string;
  unit: string;
  value: number;
  color: string;
  tags: string[];
  series: number[];
}
