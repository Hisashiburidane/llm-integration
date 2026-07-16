import type {
  EnchantCapability,
  EnchantFieldMetadata,
  EnchantMetadataNode,
  EnchantTextMetadata
} from './enchantment';
import type { EnchantVisualController } from './visual';

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export interface DomScanOptions {
  enchantmentId: string;
  scopeId: string;
  page?: string;
  visual: EnchantVisualController;
}

export interface DomScanResult {
  metadata: EnchantMetadataNode[];
  capabilities: EnchantCapability[];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'field';
}

function fieldLabel(element: Element) {
  const formItem = element.closest('.ant-form-item');
  const formLabel = formItem?.querySelector('.ant-form-item-label label')?.textContent?.trim();
  const explicitLabel = element.id
    ? element.ownerDocument.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent?.trim()
    : '';
  return formLabel
    || explicitLabel
    || element.getAttribute('aria-label')?.trim()
    || element.getAttribute('placeholder')?.trim()
    || element.getAttribute('name')?.trim()
    || '未命名字段';
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

export function scanDom(root: HTMLElement, options: DomScanOptions): DomScanResult {
  const elements = Array.from(root.querySelectorAll<FieldElement>('input:not([type="hidden"]), textarea, select'))
    .filter((element) => !element.closest('[data-enchant-ignore]'))
    .filter((element) => element.closest('[data-enchant]') === root);
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

  const text = ownedText(root);
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
    name: 'scope.read',
    label: `读取 ${options.scopeId}`,
    description: '读取当前区域的结构化 metadata。',
    effect: 'read',
    execute: (_input, context) => context.enchantment.metadata
  }, {
    id: `${options.enchantmentId}:highlight`,
    enchantmentId: options.enchantmentId,
    name: 'scope.highlight',
    label: `高亮 ${options.scopeId}`,
    description: '在当前页面高亮这个区域。',
    effect: 'visual',
    execute: () => {
      options.visual.highlight(options.page ?? 'current-page', options.scopeId);
      return { status: 'success' as const, summary: `已高亮 ${options.scopeId}。` };
    }
  }, {
    id: `${options.enchantmentId}:open`,
    enchantmentId: options.enchantmentId,
    name: 'scope.open',
    label: `打开 ${options.scopeId}`,
    description: '打开这个区域的只读详情视图。仅在用户明确要求打开、详情或放大时使用。',
    effect: 'visual',
    execute: () => {
      options.visual.open(options.page ?? 'current-page', options.scopeId);
      return { status: 'success' as const, summary: `已打开 ${options.scopeId}。` };
    }
  }, {
    id: `${options.enchantmentId}:compose`,
    enchantmentId: options.enchantmentId,
    name: 'scope.compose',
    label: `组合 ${options.scopeId}`,
    description: '把这个区域加入组合视图。仅在用户明确要求组合或对比多个区域时使用。',
    effect: 'visual',
    execute: () => {
      options.visual.compose(options.page ?? 'current-page', options.scopeId);
      return { status: 'success' as const, summary: `已将 ${options.scopeId} 加入组合视图。` };
    }
  }, {
    id: `${options.enchantmentId}:clear-visual`,
    enchantmentId: options.enchantmentId,
    name: 'scope.clearVisual',
    label: `清除 ${options.page ?? '当前页面'} 的视觉状态`,
    description: '清除当前页面由 Aura 产生的高亮、详情和组合视图状态。',
    effect: 'visual',
    execute: () => {
      options.visual.clear(options.page ?? 'current-page');
      return { status: 'success' as const, summary: '已清除当前页面的视觉状态。' };
    }
  }];

  if (fields.length) {
    capabilities.push({
      id: `${options.enchantmentId}:focus-field`,
      enchantmentId: options.enchantmentId,
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

function ownedText(root: HTMLElement) {
  const texts: string[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
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
  return texts.join(' ').slice(0, 1600);
}

function formLabelConfidence(element: Element) {
  return element.closest('.ant-form-item') || element.getAttribute('aria-label') ? 0.82 : 0.62;
}
