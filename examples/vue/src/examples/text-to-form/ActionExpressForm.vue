<script setup lang="ts">
import { useEnchantAction } from '@enchantforge/vue';
import ExpressForm from './ExpressForm.vue';
import type { ShippingForm } from './shippingFormStore';

const model = defineModel<ShippingForm>({ required: true });

const fieldLabels: Record<keyof ShippingForm, string> = {
  receiverName: '收件人',
  receiverPhone: '手机号',
  province: '省份',
  city: '城市',
  district: '区县',
  receiverAddress: '详细地址',
  itemType: '物品类型',
  remark: '备注'
};

useEnchantAction<{ values: Partial<ShippingForm> }>({
  name: 'shipping.fill_progressively',
  label: '逐项填写寄件单',
  description: '从用户输入中提取寄件信息并逐项填写当前表单，只修改草稿，不提交。',
  effect: 'draft',
  inputSchema: {
    type: 'object',
    required: ['values'],
    properties: {
      values: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(fieldLabels).map(([field, label]) => [field, { type: 'string', description: label }])
        ),
        additionalProperties: false
      }
    }
  },
  async execute({ values }, context) {
    const entries = Object.entries(values)
      .filter((entry): entry is [string, string] => entry[0] in fieldLabels && typeof entry[1] === 'string');

    for (const [index, [field, value]] of entries.entries()) {
      if (context.signal?.aborted) throw new Error('操作已取消。');
      context.reportProgress({
        label: `正在填写${fieldLabels[field]}`,
        current: index + 1,
        total: entries.length
      });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      if (context.signal?.aborted) throw new Error('操作已取消。');
      model.value[field] = value;
    }

    return {
      status: 'success' as const,
      summary: `已逐项填写 ${entries.length} 个字段，表单未提交。`,
      data: { appliedFields: entries.map(([field]) => field) }
    };
  }
});
</script>

<template>
  <ExpressForm v-model="model" />
</template>
