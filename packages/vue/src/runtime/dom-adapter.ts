import type {
  EnchantCapability,
  EnchantFieldMetadata,
  EnchantMetadataNode,
  EnchantTextMetadata
} from './enchantment';
import { getEnchantMarkedElements } from './dom-directives';

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const fieldSelector = 'input:not([type="hidden"]), textarea, select';

export type EnchantScanMode = 'auto' | 'marked' | 'none';

export interface EnchantScanConfig {
  mode?: EnchantScanMode;
  fields?: boolean;
  text?: boolean;
}

export type EnchantScan = EnchantScanMode | EnchantScanConfig;

export interface DomScanOptions {
  enchantmentId: string;
  scopeId: string;
  scan?: EnchantScan;
}

export interface DomScanResult {
  metadata: EnchantMetadataNode[];
  capabilities: EnchantCapability[];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
}

function fieldLabel(element: Element) {
  const control = element as FieldElement;
  const linkedLabel = control.labels?.[0]?.textContent?.trim();
  const labelledBy = element.getAttribute('aria-labelledby')
    ?.split(/\s+/)
    .map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim())
    .filter(Boolean)
    .join(' ');
  return linkedLabel
    || labelledBy
    || element.getAttribute('aria-label')?.trim()
    || nearbyLabel(element)
    || element.getAttribute('placeholder')?.trim()
    || element.getAttribute('name')?.trim()
    || '未命名字段';
}

function nearbyLabel(element: Element) {
  let container = element.parentElement;
  for (let depth = 0; container && depth < 4; depth += 1, container = container.parentElement) {
    const labels = container.querySelectorAll('label');
    const controls = container.querySelectorAll('input:not([type="hidden"]), textarea, select');
    if (labels.length === 1 && controls.length === 1) return labels[0].textContent?.trim();
  }
  return '';
}

function semanticType(element: FieldElement) {
  if (element instanceof HTMLTextAreaElement) return 'textarea';
  if (element instanceof HTMLSelectElement) return 'enum';
  const type = element.type.toLowerCase();
  if (type === 'tel') return 'phone';
  if (type === 'email') return 'email';
  if (type === 'date' || type === 'datetime-local') return 'date';
  if (type === 'number') return 'number';
  return 'text';
}

function setNativeValue(element: FieldElement, value: unknown) {
  const normalized = value == null ? '' : String(value);
  element.focus();
  element.value = normalized;
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: normalized }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  return element.value;
}

function isReadonly(element: FieldElement) {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.readOnly
    : false;
}

function resolveScanConfig(scan: EnchantScan | undefined): Required<EnchantScanConfig> {
  if (typeof scan === 'string') {
    return {
      mode: scan,
      fields: scan !== 'none',
      text: scan !== 'none'
    };
  }
  const mode = scan?.mode ?? 'none';
  return {
    mode,
    fields: scan?.fields ?? mode !== 'none',
    text: scan?.text ?? mode !== 'none'
  };
}

function belongsToRoot(element: Element, root: HTMLElement) {
  return !element.closest('[data-enchant-ignore]')
    && element.closest('[data-enchant]') === root;
}

function markedRoots(root: HTMLElement) {
  const elements = getEnchantMarkedElements(root);
  return elements
    .filter((element) => belongsToRoot(element, root))
    .filter((element, index, elements) => !elements.some((candidate, candidateIndex) => (
      candidateIndex !== index && candidate.contains(element)
    )));
}

function scanFields(root: HTMLElement, mode: EnchantScanMode) {
  const elements = new Set<FieldElement>();
  const roots = mode === 'marked' ? markedRoots(root) : [root];
  roots.forEach((scanRoot) => {
    if (scanRoot.matches(fieldSelector)) elements.add(scanRoot as FieldElement);
    scanRoot.querySelectorAll<FieldElement>(fieldSelector).forEach((element) => elements.add(element));
  });
  return Array.from(elements).filter((element) => belongsToRoot(element, root));
}

export function scanDom(root: HTMLElement, options: DomScanOptions): DomScanResult {
  const scan = resolveScanConfig(options.scan);
  if (scan.mode === 'none') return { metadata: [], capabilities: [] };

  const elements = scan.fields ? scanFields(root, scan.mode) : [];
  const handles = new Map<string, FieldElement>();
  const usedIds = new Map<string, number>();

  const fields: EnchantFieldMetadata[] = elements.map((element, index) => {
    const label = fieldLabel(element);
    const baseId = element.name?.trim() || element.id?.trim() || slugify(label) || `field-${index + 1}`;
    const occurrence = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, occurrence);
    const id = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    handles.set(id, element);
    const password = element instanceof HTMLInputElement && element.type === 'password';
    return {
      id,
      scopeId: options.scopeId,
      kind: 'field',
      label,
      semanticType: semanticType(element),
      required: element.required || element.getAttribute('aria-required') === 'true',
      readonly: isReadonly(element) || element.disabled,
      value: password ? undefined : element.value,
      placeholder: element.getAttribute('placeholder') ?? undefined,
      options: element instanceof HTMLSelectElement
        ? Array.from(element.options).map((option) => ({ label: option.text, value: option.value }))
        : undefined,
      visible: element.getClientRects().length > 0,
      enabled: !element.disabled,
      source: 'dom',
      confidence: formLabelConfidence(element),
      selector: element.id ? `#${CSS.escape(element.id)}` : undefined
    };
  });

  const text = scan.text ? ownedText(root, scan.mode) : '';
  const textMetadata: EnchantTextMetadata[] = text ? [{
    id: `${options.scopeId}-text`,
    scopeId: options.scopeId,
    kind: 'text',
    text: text.slice(0, 1600),
    visible: true,
    enabled: true,
    source: 'dom',
    confidence: 0.7
  }] : [];

  const capabilities: EnchantCapability[] = [{
    id: `${options.enchantmentId}:read`,
    enchantmentId: options.enchantmentId,
    owner: 'adapter',
    provider: 'dom',
    name: 'scope.read',
    label: `读取 ${options.scopeId}`,
    description: '读取当前区域的结构化 metadata。',
    effect: 'read',
    execute: (_input, context) => context.enchantment.metadata
  }];

  if (fields.length) {
    capabilities.push({
      id: `${options.enchantmentId}:focus-field`,
      enchantmentId: options.enchantmentId,
      owner: 'adapter',
      provider: 'dom',
      name: 'field.focus',
      label: `聚焦 ${options.scopeId} 的字段`,
      description: '根据 fieldId 聚焦当前区域内的一个字段。',
      effect: 'visual',
      inputSchema: { type: 'object', required: ['fieldId'], properties: { fieldId: { type: 'string' } } },
      execute(input) {
        const fieldId = typeof input === 'object' && input ? String((input as Record<string, unknown>).fieldId ?? '') : '';
        const element = handles.get(fieldId);
        if (!element) throw new Error(`字段 ${fieldId || 'empty'} 不存在。`);
        element.focus();
        return { status: 'success' as const, summary: `已聚焦 ${fieldId}。`, data: { fieldId } };
      }
    }, {
      id: `${options.enchantmentId}:fill-fields`,
      enchantmentId: options.enchantmentId,
      owner: 'adapter',
      provider: 'dom',
      name: 'field.fill',
      label: `填写 ${options.scopeId}`,
      description: '按字段 metadata id 批量填写当前区域；只形成草稿，不提交表单。',
      effect: 'draft',
      inputSchema: {
        type: 'object',
        required: ['values'],
        properties: { values: { type: 'object', additionalProperties: true } }
      },
      execute(input, context) {
        const values = typeof input === 'object' && input && typeof (input as Record<string, unknown>).values === 'object'
          ? (input as { values: Record<string, unknown> }).values
          : undefined;
        if (!values) throw new Error('field.fill 缺少 values。');
        const applied: Record<string, string> = {};
        const skipped: string[] = [];
        const entries = Object.entries(values);
        entries.forEach(([fieldId, value], index) => {
          context.reportProgress({
            label: `正在填写 ${fields.find((field) => field.id === fieldId)?.label ?? fieldId}`,
            current: index + 1,
            total: entries.length
          });
          const element = handles.get(fieldId);
          if (!element || element.disabled || isReadonly(element)) {
            skipped.push(fieldId);
            return;
          }
          applied[fieldId] = setNativeValue(element, value);
        });
        const appliedCount = Object.keys(applied).length;
        return {
          status: skipped.length ? 'partial' as const : 'success' as const,
          summary: skipped.length
            ? `已填写 ${appliedCount} 个字段，${skipped.length} 个字段未能写入。表单未提交。`
            : `已填写 ${appliedCount} 个字段，表单未提交。`,
          data: { applied, skipped }
        };
      }
    });
  }

  return { metadata: [...fields, ...textMetadata], capabilities };
}

function ownedText(root: HTMLElement, mode: EnchantScanMode) {
  const texts: string[] = [];
  const roots = mode === 'marked' ? markedRoots(root) : [root];
  roots.forEach((scanRoot) => {
    const walker = root.ownerDocument.createTreeWalker(scanRoot, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (
        parent
        && parent.closest('[data-enchant]') === root
        && !parent.closest('[data-enchant-ignore]')
        && !['SCRIPT', 'STYLE'].includes(parent.tagName)
      ) {
        const value = node.textContent?.replace(/\s+/g, ' ').trim();
        if (value) texts.push(value);
      }
      node = walker.nextNode();
    }
  });
  return texts.join(' ').slice(0, 1600);
}

function formLabelConfidence(element: Element) {
  const control = element as FieldElement;
  if (control.labels?.length || element.getAttribute('aria-labelledby') || element.getAttribute('aria-label')) return 0.9;
  return nearbyLabel(element) ? 0.76 : 0.62;
}
