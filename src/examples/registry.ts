import type { Component } from 'vue';
import FocusViewDemo from './FocusViewDemo.vue';
import StaticScenarioDemo from './StaticScenarioDemo.vue';
import TextToFormDemo from './TextToFormDemo.vue';

export type CodeBlock = {
  key: string;
  tab: string;
  code: string;
};

export type DemoSpec = {
  id: string;
  title: string;
  status: string;
  summary: string;
  component: Component;
  input?: string;
  metadata?: string[];
  steps?: string[];
  codeBlocks: CodeBlock[];
};

const shippingWrapperCode = `<script setup lang="ts">
import { LlmIntegration } from '@/lib/components';
import ExpressForm from './ExpressForm.vue';
import LocalAssistant from './LocalAssistant.vue';
</script>

<template>
  <LlmIntegration
    name="shipping-form"
    prompt="从用户文本中提取寄件信息，填写当前表单，不要提交。"
  >
    <ExpressForm />
    <LocalAssistant />
  </LlmIntegration>
</template>`;

const expressFormCode = `<script setup lang="ts">
const form = reactive({
  receiverName: '',
  receiverPhone: '',
  province: '',
  city: '',
  district: '',
  receiverAddress: '',
  itemType: '',
  remark: ''
});
</script>

<template>
  <a-form layout="vertical">
    <a-form-item label="收件人">
      <a-input v-model:value="form.receiverName" />
    </a-form-item>
    <a-form-item label="手机号">
      <a-input v-model:value="form.receiverPhone" />
    </a-form-item>
    <a-form-item label="省份">
      <a-select v-model:value="form.province" />
    </a-form-item>
    <a-form-item label="城市">
      <a-select v-model:value="form.city" />
    </a-form-item>
    <a-form-item label="区县">
      <a-select v-model:value="form.district" allow-clear />
    </a-form-item>
    <a-form-item label="详细地址">
      <a-input v-model:value="form.receiverAddress" />
    </a-form-item>
    <a-form-item label="物品类型">
      <a-select v-model:value="form.itemType" />
    </a-form-item>
    <a-form-item label="备注">
      <a-textarea v-model:value="form.remark" />
    </a-form-item>
  </a-form>
</template>`;

const localAssistantCode = `<script setup lang="ts">
import { inject } from 'vue';
import { llmScopeKey } from '@/lib/runtime/scope';
import { parseShippingText } from '@/lib/runtime/formFill';
import { createFillSteps, replayFillSteps } from '@/lib/runtime/executor';

const scope = inject(llmScopeKey);

async function run(text: string) {
  const metadata = scope?.value.metadata ?? scanFieldsFromDom();
  const values = await llm.extract({
    prompt: scope?.value.prompt,
    metadata,
    input: text
  });

  const steps = createFillSteps(values ?? parseShippingText(text));
  await replayFillSteps({ steps, form, onActiveField, onUncertainField });
}
</script>`;

const promptCode = `你在 shipping-form 作用域内工作。
读取当前作用域的字段 metadata。
从用户输入中提取可填写内容。
返回 fill_fields 执行步骤。
对不确定字段做标记。
不要提交表单。`;

const executorCode = `[
  { type: 'scan', scopeId: 'shipping-form' },
  { type: 'fill', scopeId: 'shipping-form', values },
  { type: 'highlight', scopeId: 'shipping-form', ids: uncertainFieldIds },
  { type: 'stop', reason: 'submit requires user confirmation' }
]`;

export const demos: DemoSpec[] = [
  {
    id: 'text-to-form',
    title: '文本填表',
    status: '可交互',
    summary: '把非结构化收件信息映射到局部表单作用域，逐步回放字段填写过程。',
    component: TextToFormDemo,
    codeBlocks: [
      { key: 'wrapper', tab: 'Wrapper', code: shippingWrapperCode },
      { key: 'form', tab: 'ExpressForm', code: expressFormCode },
      { key: 'assistant', tab: 'LocalAssistant', code: localAssistantCode },
      { key: 'prompt', tab: '提示词', code: promptCode },
      { key: 'executor', tab: 'Executor', code: executorCode }
    ]
  },
  {
    id: 'asr-ticket',
    title: 'ASR 转工单',
    status: '场景',
    summary: '热线 ASR 进入助手后，先生成候选动作，再由用户确认是否创建工单草稿。',
    component: StaticScenarioDemo,
    input: '用户来电描述：小区 3 栋 1202 厨房漏水，已经影响楼下，希望今天安排维修。',
    metadata: ['global assistant', 'repair ticket route', 'repair form scope', 'confirm action'],
    steps: ['监听 ASR 文本片段', '识别维修意图', '显示候选操作气泡', '用户确认后打开并填写工单草稿'],
    codeBlocks: [
      { key: 'api', tab: 'API', code: `assistant.ingest({\n  source: 'asr',\n  text: transcriptSegment\n})` },
      { key: 'prompt', tab: '提示词', code: `判断当前 ASR 片段是否触发已支持的页面动作。\n如果置信度足够高，返回一个候选操作建议。\n在用户确认前不要执行页面动作。` },
      { key: 'executor', tab: 'Executor', code: `[\n  { type: 'navigate', target: 'repair-ticket' },\n  { type: 'fill', scopeId: 'repair-form', values },\n  { type: 'stop', reason: 'wait for user submit' }\n]` }
    ]
  },
  {
    id: 'validation-helper',
    title: '校验助手',
    status: '场景',
    summary: '表单提交失败时，结合字段元数据和 validation errors 解释问题并定位字段。',
    component: StaticScenarioDemo,
    input: '用户连续提交失败，页面已有字段校验错误，但错误分散在多个折叠区域中。',
    metadata: ['field labels', 'validation errors', 'required state', 'focus action'],
    steps: ['读取 validation errors', '解释失败字段', '聚焦第一个无效字段', '高亮相关控件'],
    codeBlocks: [
      { key: 'api', tab: 'API', code: `scope.on('validation:failed', (errors) => {\n  assistant.explain(errors)\n})` },
      { key: 'prompt', tab: '提示词', code: `结合字段 metadata 和 validation errors 解释提交失败原因。\n返回需要高亮的字段列表。\n给出简短、可执行的修正提示。` },
      { key: 'executor', tab: 'Executor', code: `[\n  { type: 'highlight', scopeId, ids: invalidFieldIds },\n  { type: 'focus', scopeId, id: firstInvalid }\n]` }
    ]
  },
  {
    id: 'snapshot-restore',
    title: '语义快照',
    status: '原型',
    summary: '通过可见的 executor 回放恢复页面状态，而不是静默应用 URL 参数。',
    component: StaticScenarioDemo,
    input: '来自其他用户的一段 base64 语义快照。',
    metadata: ['route target', 'filter fields', 'panel ids', 'highlight ids'],
    steps: ['解析 snapshot', '展示执行计划', '等待用户确认', '可见地回放步骤'],
    codeBlocks: [
      { key: 'api', tab: 'API', code: `runExecutorSteps([\n  { type: 'navigate', target: 'repair' },\n  { type: 'fill', scopeId: 'filters', values: {} }\n])` },
      { key: 'prompt', tab: '提示词', code: `解析语义快照内容。\n先展示将要执行的步骤计划。\n只有在用户确认后才开始回放。` },
      { key: 'executor', tab: 'Executor', code: `[\n  { type: 'navigate', target },\n  { type: 'fill', scopeId, values },\n  { type: 'highlight', ids }\n]` }
    ]
  },
  {
    id: 'workflow',
    title: '本地工作流',
    status: '原型',
    summary: '把用户确认过的执行计划保存为可重复运行的本地命令。',
    component: StaticScenarioDemo,
    input: '保存为：创建维修工单草稿。',
    metadata: ['executor steps', 'scope ids', 'field ids', 'action ids'],
    steps: ['生成 executor plan', '用户检查计划', '保存到 localStorage', '后续再次运行'],
    codeBlocks: [
      { key: 'api', tab: 'API', code: `saveWorkflow({\n  name: 'create repair ticket draft',\n  steps\n})` },
      { key: 'prompt', tab: '提示词', code: `将用户确认过的 executor plan 转换为本地快捷命令。\n只保存 scopeId、actionId、fieldId 和必要字段值。\n不要保存敏感字段原文。` },
      { key: 'executor', tab: 'Executor', code: `localStorage.setItem(\n  'llm-ui.workflow.repair-draft',\n  JSON.stringify(steps)\n)` }
    ]
  },
  {
    id: 'focus-view',
    title: 'Focus View',
    status: '只读',
    summary: '根据图表和表格元数据生成临时关注视图，高亮相关节点并淡化其他区域。',
    component: FocusViewDemo,
    metadata: ['chart title', 'metric', 'tags', 'priority', 'open action'],
    steps: ['按相关性排序节点', '高亮匹配项', '淡化无关区域', '创建临时 workspace'],
    codeBlocks: [
      { key: 'api', tab: 'API', code: `createFocusView({\n  nodes: matchedMetadataNodes\n})` },
      { key: 'prompt', tab: '提示词', code: `根据当前可见的图表和表格 metadata 判断相关性。\n返回需要高亮的节点。\n返回需要组合到 focus view 的节点。` },
      { key: 'executor', tab: 'Executor', code: `[\n  { type: 'highlight', ids },\n  { type: 'openWorkspace', nodes }\n]` }
    ]
  }
];
