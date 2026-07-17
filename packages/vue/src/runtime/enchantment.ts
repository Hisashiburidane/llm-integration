export type EnchantExposure = 'aura' | 'local' | 'private';

export type CapabilityEffect = 'read' | 'visual' | 'draft' | 'commit';
export type EnchantCapabilityOwner = 'core' | 'adapter' | 'application';

export type MetadataSource = 'registered' | 'directive' | 'adapter' | 'dom';

export type JsonSchema = Record<string, unknown>;

export interface EnchantMetadataBase {
  id: string;
  scopeId: string;
  kind: string;
  label?: string;
  description?: string;
  visible: boolean;
  enabled: boolean;
  source: MetadataSource;
  confidence?: number;
}

export interface EnchantFieldMetadata extends EnchantMetadataBase {
  kind: 'field';
  label: string;
  semanticType?: string;
  aliases?: string[];
  required?: boolean;
  readonly?: boolean;
  value?: unknown;
  placeholder?: string;
  options?: Array<{ label: string; value: unknown }>;
  validationErrors?: string[];
  selector?: string;
}

export interface EnchantTextMetadata extends EnchantMetadataBase {
  kind: 'text';
  text: string;
}

export interface EnchantActionMetadata extends EnchantMetadataBase {
  kind: 'action';
  label: string;
  aliases?: string[];
  effect: CapabilityEffect;
  capabilityId?: string;
  disabledReason?: string;
  requiresConfirmation?: boolean;
}

export interface EnchantChartMetadata extends EnchantMetadataBase {
  kind: 'chart';
  title: string;
  metric?: string;
  dimensions?: string[];
  summary?: string;
  tags?: string[];
  priority?: 'normal' | 'warning' | 'critical';
}

export interface EnchantTableMetadata extends EnchantMetadataBase {
  kind: 'table';
  title?: string;
  entity?: string;
  columns: Array<{ key: string; label: string; type?: string }>;
  visibleRows?: Array<Record<string, unknown>>;
}

export interface EnchantRegionMetadata extends EnchantMetadataBase {
  kind: 'region' | 'panel' | 'dialog';
  children: EnchantMetadataNode[];
}

export interface EnchantCustomMetadata extends EnchantMetadataBase {
  kind: string;
  value?: unknown;
  aliases?: string[];
  required?: boolean;
}

export type EnchantMetadataNode =
  | EnchantFieldMetadata
  | EnchantTextMetadata
  | EnchantActionMetadata
  | EnchantChartMetadata
  | EnchantTableMetadata
  | EnchantRegionMetadata
  | EnchantCustomMetadata;

export interface EnchantmentStatus {
  alive: boolean;
  active: boolean;
  visible: boolean;
  enabled: boolean;
}

export type EnchantmentState = EnchantmentStatus;

export interface EnchantmentSource {
  scopeId: string;
  parentEnchantmentId?: string;
  component?: string;
}

export interface Enchantment {
  id: string;
  name?: string;
  page?: string;
  kind: 'page' | 'form' | 'table' | 'chart' | 'panel' | 'dialog' | 'custom';
  exposure: EnchantExposure;
  instruction?: string;
  status: EnchantmentStatus;
  state?: unknown;
  route?: string;
  tags?: string[];
  metadata: EnchantMetadataNode[];
  capabilities: string[];
  source: EnchantmentSource;
  version: number;
}

export interface EnchantCapabilityResult<T = unknown> {
  status: 'success' | 'partial' | 'failed';
  summary?: string;
  data?: T;
  warnings?: string[];
}

export interface EnchantProgressDetail {
  label: string;
  current?: number;
  total?: number;
}

export interface EnchantExecutionContext {
  enchantment: Enchantment;
  snapshotVersion?: number;
  signal?: AbortSignal;
  reportProgress(detail: EnchantProgressDetail): void;
}

export interface EnchantCapability<TResult = unknown> {
  id: string;
  enchantmentId: string;
  owner: EnchantCapabilityOwner;
  provider: string;
  name: string;
  label: string;
  description: string;
  target?: string;
  effect: CapabilityEffect;
  inputSchema?: JsonSchema;
  execute(input: unknown, context: EnchantExecutionContext): TResult | Promise<TResult>;
}

export type EnchantCapabilityDefinition<TResult = unknown> =
  Omit<EnchantCapability<TResult>, 'enchantmentId'> & { enchantmentId?: string };

export interface EnchantCaptureResult {
  enchantment: Enchantment;
  capabilities: EnchantCapability[];
}

export interface EnchantContribution {
  id: string;
  capture(): {
    metadata?: EnchantMetadataNode[];
    capabilities?: EnchantCapabilityDefinition[];
  };
}

export interface EnchantRegistration {
  id: string;
  name?: string;
  page?: string;
  exposure: EnchantExposure;
  parentEnchantmentId?: string;
  getStatus(): EnchantmentStatus;
  capture(): EnchantCaptureResult;
}

export interface EnchantTool {
  id: string;
  capabilityId: string;
  enchantmentId: string;
  owner: EnchantCapabilityOwner;
  provider: string;
  page?: string;
  name: string;
  label: string;
  description: string;
  target?: string;
  effect: CapabilityEffect;
  inputSchema?: JsonSchema;
}

export interface EnchantMetadataTreeNode {
  id: string;
  label: string;
  type: 'page' | 'enchantment' | 'metadata';
  kind?: string;
  children?: EnchantMetadataTreeNode[];
}

export interface EnchantSnapshot {
  id: string;
  version: number;
  pageId: string;
  createdAt: string;
  enchantments: Enchantment[];
  metadataTree: EnchantMetadataTreeNode;
  tools: EnchantTool[];
}

export interface EnchantRegistryDigest {
  pageId: string;
  version: number;
  activeEnchantments: number;
  capturedCapabilities: number;
}

export interface EnchantPlanCall {
  capabilityId: string;
  input?: unknown;
  reason?: string;
}

export interface EnchantPlan {
  message: string;
  snapshotVersion: number;
  calls: EnchantPlanCall[];
}

export type EnchantRunPhase = 'capturing' | 'planning' | 'authorizing' | 'executing' | 'completed' | 'failed';

export interface EnchantProgressEvent {
  id: string;
  runId: string;
  phase: EnchantRunPhase;
  timestamp: string;
  capabilityId?: string;
  capabilityLabel?: string;
  current?: number;
  total?: number;
  detail?: string;
}

export interface EnchantExecutionResult {
  capabilityId: string;
  ok: boolean;
  status: 'success' | 'partial' | 'failed';
  summary?: string;
  value?: unknown;
  error?: string;
  warning?: string;
}

export interface EnchantRunResult {
  runId: string;
  message: string;
  plan: EnchantPlan;
  results: EnchantExecutionResult[];
}

export interface EnchantTraceEvent {
  id: string;
  source: string;
  kind: 'snapshot' | 'request' | 'plan' | 'action' | 'result' | 'policy' | 'progress' | 'error' | 'info';
  title: string;
  detail?: unknown;
  timestamp: string;
}
