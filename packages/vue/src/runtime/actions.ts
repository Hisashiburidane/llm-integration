import {
  getCurrentInstance,
  getCurrentScope,
  inject,
  onScopeDispose,
  unref,
  type MaybeRef
} from 'vue';
import type {
  CapabilityEffect,
  EnchantCapabilityOwner,
  EnchantExecutionContext,
  EnchantMetadataNode,
  JsonSchema
} from './enchantment';
import { enchantContextKey } from './forge';

export interface EnchantActionOptions<TInput = unknown, TResult = unknown> {
  id?: string;
  name: string;
  label?: string;
  description: string;
  effect: CapabilityEffect;
  inputSchema?: JsonSchema;
  owner?: EnchantCapabilityOwner;
  provider?: string;
  target?: string;
  metadata?: EnchantMetadataNode[] | (() => EnchantMetadataNode[]);
  execute(input: TInput, context: EnchantExecutionContext): TResult | Promise<TResult>;
}

export interface EnchantActionRegistration {
  id: string;
  unregister(): void;
}

export interface EnchantFormOptions<TModel extends Record<string, unknown>> {
  id?: string;
  label?: string;
  description?: string;
  provider?: string;
  fields?: readonly Extract<keyof TModel, string>[] | Partial<Record<Extract<keyof TModel, string>, string>>;
  assign?: (values: Partial<TModel>, model: TModel) => void | Promise<void>;
}

export interface EnchantFormFillInput<TModel extends Record<string, unknown>> {
  values: Partial<TModel>;
}

let actionSequence = 0;

function componentName() {
  const type = getCurrentInstance()?.type;
  if (type && typeof type === 'object' && 'name' in type && type.name) return String(type.name);
  return 'vue-component';
}

export function useEnchantAction<TInput = unknown, TResult = unknown>(
  options: EnchantActionOptions<TInput, TResult>
): EnchantActionRegistration {
  const context = inject(enchantContextKey, undefined);
  if (!context) throw new Error('useEnchantAction() 必须在 <Enchant> 内调用。');

  actionSequence += 1;
  const id = options.id ?? `${context.id}:${options.name}:${actionSequence}`;
  const provider = options.provider ?? componentName();
  const unregister = context.registerContribution({
    id,
    capture: () => ({
      metadata: typeof options.metadata === 'function' ? options.metadata() : options.metadata,
      capabilities: [{
        id,
        owner: options.owner ?? 'application',
        provider,
        name: options.name,
        label: options.label ?? options.name,
        description: options.description,
        target: options.target,
        effect: options.effect,
        inputSchema: options.inputSchema,
        execute: (input, executionContext) => options.execute(input as TInput, executionContext)
      }]
    })
  });

  if (getCurrentScope()) onScopeDispose(unregister);
  return { id, unregister };
}

export function useEnchantForm<TModel extends Record<string, unknown>>(
  source: MaybeRef<TModel>,
  options: EnchantFormOptions<TModel> = {}
) {
  const initialModel = unref(source);
  const configuredFields = options.fields;
  const fields = Array.isArray(configuredFields)
    ? configuredFields.map(String)
    : configuredFields
      ? Object.keys(configuredFields)
      : Object.keys(initialModel);
  const labels = !configuredFields || Array.isArray(configuredFields)
    ? Object.fromEntries(fields.map((field) => [field, field]))
    : configuredFields as Record<string, string>;
  const fieldSet = new Set(fields);
  const fieldSchemas = Object.fromEntries(fields.map((field) => [field, { description: labels[field] ?? field }]));

  return useEnchantAction<EnchantFormFillInput<TModel>>({
    id: options.id,
    name: 'field.fill',
    label: options.label ?? '填写当前表单',
    description: options.description ?? `填写当前表单中的字段：${fields.join('、')}。只修改表单草稿，不提交。`,
    effect: 'draft',
    owner: 'application',
    provider: options.provider ?? 'vue-model',
    metadata: () => {
      const model = unref(source);
      return fields.map((field) => ({
        id: field,
        scopeId: '',
        kind: 'field' as const,
        label: labels[field] ?? field,
        value: model[field],
        visible: true,
        enabled: true,
        source: 'registered' as const,
        confidence: 1
      }));
    },
    inputSchema: {
      type: 'object',
      required: ['values'],
      properties: {
        values: {
          type: 'object',
          properties: fieldSchemas,
          additionalProperties: false
        }
      }
    },
    async execute(input) {
      if (!input?.values || typeof input.values !== 'object' || Array.isArray(input.values)) {
        throw new Error('field.fill 缺少 values。');
      }
      const model = unref(source);
      const applied = Object.fromEntries(
        Object.entries(input.values).filter(([field]) => fieldSet.has(field))
      ) as Partial<TModel>;
      if (options.assign) await options.assign(applied, model);
      else Object.assign(model, applied);
      const count = Object.keys(applied).length;
      return {
        status: 'success' as const,
        summary: `已填写 ${count} 个字段，表单未提交。`,
        data: { applied }
      };
    }
  });
}
