<script setup lang="ts">
import { computed, reactive } from 'vue';
import { useAgentContext, useFrontendTool } from '@copilotkit/vue/v2';
import { z } from 'zod';

const locations = [
  { province: '广东省', cities: ['广州市', '深圳市', '揭阳市', '佛山市'] },
  { province: '浙江省', cities: ['杭州市', '宁波市', '温州市', '绍兴市'] },
  { province: '江苏省', cities: ['南京市', '苏州市', '无锡市', '常州市'] }
] as const;

const form = reactive({
  receiverName: '',
  receiverPhone: '',
  province: '',
  city: '',
  detailedAddress: '',
  itemName: '',
  remark: ''
});

const cityOptions = computed(() =>
  locations.find((item) => item.province === form.province)?.cities ?? []
);

function clearForm() {
  Object.assign(form, {
    receiverName: '',
    receiverPhone: '',
    province: '',
    city: '',
    detailedAddress: '',
    itemName: '',
    remark: ''
  });
}

useAgentContext({
  description: '当前页面是快递寄件表单。以下是字段定义、可选值和当前值。',
  value: () => ({
    page: '寄快递',
    submitAllowed: false,
    fields: [
      { name: 'receiverName', label: '收件人', required: true, options: [], value: form.receiverName },
      { name: 'receiverPhone', label: '联系电话', required: true, options: [], value: form.receiverPhone },
      { name: 'province', label: '省份', required: true, options: locations.map((item) => item.province), value: form.province },
      { name: 'city', label: '城市', required: true, options: [...cityOptions.value], value: form.city },
      { name: 'detailedAddress', label: '详细地址', required: true, options: [], value: form.detailedAddress },
      { name: 'itemName', label: '物品名称', required: true, options: [], value: form.itemName },
      { name: 'remark', label: '备注', required: false, options: [], value: form.remark }
    ]
  })
});

useFrontendTool({
  name: 'fillShippingForm',
  description: '从用户提供的非结构化文本中提取收件信息并填写当前快递表单。仅填写，不提交。省份和城市必须使用页面 Context 中列出的值。',
  parameters: z.object({
    receiverName: z.string().describe('收件人姓名'),
    receiverPhone: z.string().describe('联系电话'),
    province: z.string().describe('省份完整名称'),
    city: z.string().describe('城市完整名称'),
    detailedAddress: z.string().describe('不含省市的详细地址'),
    itemName: z.string().describe('寄送物品名称'),
    remark: z.string().optional().describe('可选备注')
  }),
  handler: async (input) => {
    const location = locations.find((item) => item.province === input.province);
    if (!location || !location.cities.some((city) => city === input.city)) {
      throw new Error('省市不在当前表单的可选范围内。');
    }

    Object.assign(form, input, { remark: input.remark ?? '' });
    return `已填写 ${input.receiverName} 的收件信息，表单尚未提交。`;
  }
});

useFrontendTool({
  name: 'clearShippingForm',
  description: '当用户明确要求清空或重置当前快递表单时调用。',
  parameters: z.object({}),
  handler: async () => {
    clearForm();
    return '快递表单已清空。';
  }
});
</script>

<template>
  <section class="demo-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow">TEXT TO FORM</div>
        <h1>非结构化文本填写快递表单</h1>
        <p>页面显式提供 Context，并注册一个负责写入 Vue 状态的 Frontend Tool。</p>
      </div>
      <a-tag color="blue">2 tools</a-tag>
    </div>

    <a-alert type="info" show-icon>
      <template #message>建议输入</template>
      <template #description>
        帮我预约寄一个手机给张三，电话 13800138000，广东省揭阳市榕城区临江北路 23 号楼 902，备注易碎。
      </template>
    </a-alert>

    <div class="surface form-surface">
      <div class="surface-title">
        <div>
          <h2>寄件信息</h2>
          <span>CopilotKit Tool 只填写当前响应式对象，不执行提交。</span>
        </div>
        <a-button size="small" @click="clearForm">重置</a-button>
      </div>

      <a-form layout="vertical" :model="form">
        <div class="form-grid">
          <a-form-item label="收件人" required>
            <a-input v-model:value="form.receiverName" placeholder="姓名" />
          </a-form-item>
          <a-form-item label="联系电话" required>
            <a-input v-model:value="form.receiverPhone" placeholder="手机号码" />
          </a-form-item>
          <a-form-item label="省份" required>
            <a-select
              v-model:value="form.province"
              placeholder="选择省份"
              :options="locations.map((item) => ({ label: item.province, value: item.province }))"
              @change="form.city = ''"
            />
          </a-form-item>
          <a-form-item label="城市" required>
            <a-select
              v-model:value="form.city"
              placeholder="选择城市"
              :disabled="!form.province"
              :options="cityOptions.map((city) => ({ label: city, value: city }))"
            />
          </a-form-item>
          <a-form-item class="span-2" label="详细地址" required>
            <a-input v-model:value="form.detailedAddress" placeholder="街道、门牌号、楼层房号" />
          </a-form-item>
          <a-form-item label="物品名称" required>
            <a-input v-model:value="form.itemName" placeholder="例如：手机" />
          </a-form-item>
          <a-form-item label="备注">
            <a-input v-model:value="form.remark" placeholder="可选" />
          </a-form-item>
        </div>
        <a-button type="primary" disabled>提交寄件单</a-button>
      </a-form>
    </div>
  </section>
</template>
