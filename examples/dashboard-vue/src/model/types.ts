export type Scalar = string | number | boolean;
export interface FacetOption { code: string; label: string; }
export type PanelType = 'metric' | 'line' | 'bar' | 'donut' | 'table' | 'timeline';
export type DataType = 'string' | 'number' | 'date' | 'datetime' | 'boolean';
export type Aggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p95' | 'ratio';
export type FilterOperator = 'eq' | 'neq' | 'in' | 'between' | 'gte' | 'lte';

export interface EntityDefinition {
  id: string;
  label: string;
  description: string;
  idField: string;
  displayField: string;
}

export interface DimensionDefinition {
  id: string;
  label: string;
  description: string;
  /** Physical query field; datasets are not limited to the aviation example. */
  field: string;
  dataType: DataType;
  semanticType?: 'category' | 'time' | 'entity';
}

export interface MetricDefinition {
  id: string;
  label: string;
  description: string;
  aggregation: Aggregation;
  unit?: string;
  format?: 'integer' | 'decimal' | 'percentage' | 'minutes';
  supportedDimensions: string[];
}

export interface RelationDefinition {
  id: string;
  label: string;
  description: string;
  sourceEntity: string;
  targetEntity: string;
  sourceField: string;
  targetField: string;
}

export interface DatasetDefinition {
  id: string;
  name: string;
  description: string;
  sourceLabel: string;
  entities: EntityDefinition[];
  dimensions: DimensionDefinition[];
  metrics: MetricDefinition[];
  relations: RelationDefinition[];
}

export interface TimeRange {
  startHour: number;
  endHour: number;
}

export interface FilterCondition {
  dimensionId: string;
  operator: FilterOperator;
  value: Scalar | Scalar[];
}

export interface MetricQuery {
  metricId: string;
  alias?: string;
}

export interface DimensionQuery {
  dimensionId: string;
  alias?: string;
}

export interface QuerySpec {
  datasetId: string;
  metrics: MetricQuery[];
  dimensions: DimensionQuery[];
  filters: FilterCondition[];
  timeRange?: TimeRange;
  limit?: number;
}

export interface QueryResult {
  columns: string[];
  rows: Array<Record<string, Scalar | null>>;
  loading?: boolean;
  error?: string;
  summary: {
    rowCount: number;
    source: string;
    query: QuerySpec;
  };
}

export interface VisualizationConfig {
  xField?: string;
  yField?: string;
  color?: string;
  showLabels?: boolean;
}

export interface PanelLayout {
  width: number;
  minHeight: number;
}

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  description: string;
  query: QuerySpec;
  visualization?: VisualizationConfig;
  layout: PanelLayout;
}

export interface DashboardConfig {
  id: string;
  topicId: string;
  title: string;
  description: string;
  panels: PanelConfig[];
}
