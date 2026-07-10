import type { FieldId, ShippingFormState } from './formFill';

export type ExecutorStep = {
  id: string;
  label: string;
  fieldId?: FieldId;
  value?: string;
  uncertain?: boolean;
  status: 'pending' | 'running' | 'done';
};

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function createFillSteps(values: ShippingFormState): ExecutorStep[] {
  const steps: ExecutorStep[] = [
    { id: 'scan', label: 'scan scope: shipping-form', status: 'pending' },
    { id: 'extract', label: 'extract candidate values from input', status: 'pending' }
  ];

  (Object.keys(values) as FieldId[]).forEach((fieldId) => {
    const value = values[fieldId];
    if (!value) return;
    steps.push({
      id: `fill-${fieldId}`,
      label: `fill ${fieldId}`,
      fieldId,
      value,
      uncertain: fieldId === 'itemType' || fieldId === 'remark' || fieldId === 'district',
      status: 'pending'
    });
  });

  steps.push({ id: 'done', label: 'stop before submit', status: 'pending' });
  return steps;
}

export async function replayFillSteps(options: {
  steps: ExecutorStep[];
  form: ShippingFormState;
  onActiveField: (fieldId: FieldId | null) => void;
  onUncertainField: (fieldId: FieldId) => void;
}) {
  for (const step of options.steps) {
    step.status = 'running';
    options.onActiveField(step.fieldId ?? null);
    await sleep(step.fieldId ? 460 : 360);

    if (step.fieldId && step.value) {
      options.form[step.fieldId] = step.value;
      if (step.uncertain) options.onUncertainField(step.fieldId);
    }

    step.status = 'done';
    await sleep(120);
  }

  options.onActiveField(null);
}
