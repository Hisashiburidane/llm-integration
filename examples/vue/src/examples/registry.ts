import type { Component } from 'vue';
import TextToFormDemo from './TextToFormDemo.vue';
import TodoDemo from './TodoDemo.vue';

export type CodeBlock = { key: string; tab: string; code: string };

export type DemoSpec = {
  id: string;
  title: string;
  status: '真实 API' | 'TODO';
  summary: string;
  component: Component;
  codeBlocks: CodeBlock[];
};

const originalFormCode = `<script setup lang="ts">
const form = reactive({
  receiverName: '',
  receiverPhone: '',
  receiverAddress: ''
});
</script>

<template>
  <ExpressForm v-model="form" />
</template>`;

const integratedFormCode = `<script setup lang="ts">
import {
  LlmIntegration,
  createFillSteps,
  replayFillSteps
} from '@llm-ui/vue';

async function fillFromText(text: string) {
  const result = await extractShippingForm(text);
  await replayFillSteps({
    steps: createFillSteps(result.values, result.uncertainFields),
    form,
    onActiveField,
    onUncertainField
  });
}
</script>

<template>
  <LlmIntegration name="shipping-form" :metadata="shippingFieldMeta">
    <ExpressForm v-model="form" />
  </LlmIntegration>
</template>`;

const todo = (id: string, title: string, summary: string): DemoSpec => ({
  id,
  title,
  status: 'TODO',
  summary,
  component: TodoDemo,
  codeBlocks: []
});

export const demos: DemoSpec[] = [
  {
    id: 'text-to-form',
    title: 'LLM 文本填表',
    status: '真实 API',
    summary: '调用真实 OpenAI-compatible API 提取字段，并在原表单中可见地回放填写过程。',
    component: TextToFormDemo,
    codeBlocks: [
      { key: 'original', tab: '原组件', code: originalFormCode },
      { key: 'integrated', tab: '接入 LLM 后', code: integratedFormCode }
    ]
  },
  todo('asr-ticket', 'ASR 转工单', '等待接入真实 ASR 输入、工单表单和受限 executor。'),
  todo('validation-helper', '校验助手', '等待接入真实表单校验状态、错误解释和字段聚焦。'),
  todo('snapshot-restore', '语义快照', '等待实现快照解析、用户确认和真实页面状态回放。'),
  todo('workflow', '本地工作流', '等待实现动作计划审核、持久化和重复执行。'),
  todo('focus-view', 'Focus View', '等待实现图表 metadata 选择、高亮和临时视图组合。')
];
