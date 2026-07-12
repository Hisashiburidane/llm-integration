<script setup lang="ts">
import { reactive, ref } from 'vue';
import { CheckCircleOutlined, ClockCircleOutlined, LoadingOutlined } from '@ant-design/icons-vue';
import {
  LlmIntegration,
  createFillSteps,
  replayFillSteps,
  type ExecutorStep,
  createEmptyShippingForm,
  shippingFieldMeta,
  type FieldId
} from '@llm-ui/vue';
import CodeTabs from './CodeTabs.vue';
import type { DemoSpec } from './registry';
import { extractShippingForm } from '../llmClient';

defineProps<{
  demo: DemoSpec;
}>();

const defaultInput = `张三
12233322112
广东揭阳榕城区 xx 街道 23 号楼 902
寄手机`;

const textInput = ref(defaultInput);
const form = reactive(createEmptyShippingForm());
const steps = ref<ExecutorStep[]>([]);
const activeField = ref<FieldId | null>(null);
const uncertainFields = ref<Set<FieldId>>(new Set());
const isRunning = ref(false);
const errorMessage = ref('');

const columns = [
  { title: 'field', dataIndex: 'id', key: 'id' },
  { title: 'type', dataIndex: 'type', key: 'type' },
  { title: 'required', dataIndex: 'required', key: 'required' }
];

function resetDemo() {
  Object.assign(form, createEmptyShippingForm());
  activeField.value = null;
  uncertainFields.value = new Set();
  steps.value = [];
}

async function runDemo() {
  if (isRunning.value) return;

  resetDemo();
  errorMessage.value = '';
  isRunning.value = true;
  try {
    const result = await extractShippingForm(textInput.value);
    steps.value = createFillSteps(result.values, result.uncertainFields);

    await replayFillSteps({
      steps: steps.value,
      form,
      onActiveField: (fieldId) => {
        activeField.value = fieldId;
      },
      onUncertainField: (fieldId) => {
        uncertainFields.value = new Set([...uncertainFields.value, fieldId]);
      }
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'LLM 调用失败。';
  } finally {
    isRunning.value = false;
  }
}

function fieldClass(id: FieldId) {
  return { active: activeField.value === id, uncertain: uncertainFields.value.has(id) };
}
</script>

<template>
  <LlmIntegration
    name="shipping-form"
    prompt="从用户文本中提取寄件信息，填写当前表单，不要提交。"
    :metadata="shippingFieldMeta"
  >
    <div class="interactive-demo antd-demo-grid">
      <a-card title="输入" size="small" class="demo-card input-workbench">
        <template #extra>
          <a-button size="small" :disabled="isRunning" @click="textInput = defaultInput">重置输入</a-button>
        </template>
        <a-textarea v-model:value="textInput" :rows="8" spellcheck="false" />
        <a-alert v-if="errorMessage" class="llm-error" type="error" show-icon :message="errorMessage" />
        <a-space class="demo-actions">
          <a-button type="primary" :loading="isRunning" @click="runDemo">运行执行器</a-button>
          <a-button :disabled="isRunning" @click="resetDemo">重置表单</a-button>
        </a-space>
      </a-card>

      <a-card title="shipping-form 作用域" size="small" class="demo-card form-workbench">
        <template #extra><a-tag>local</a-tag></template>
        <a-form layout="vertical">
          <a-form-item label="收件人" :class="fieldClass('receiverName')">
            <a-input v-model:value="form.receiverName" />
          </a-form-item>
          <a-form-item label="手机号" :class="fieldClass('receiverPhone')">
            <a-input v-model:value="form.receiverPhone" />
          </a-form-item>
          <a-form-item label="省份" :class="fieldClass('province')">
            <a-select v-model:value="form.province" placeholder="请选择省份">
              <a-select-option value="广东省">广东省</a-select-option>
              <a-select-option value="浙江省">浙江省</a-select-option>
              <a-select-option value="江苏省">江苏省</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="城市" :class="fieldClass('city')">
            <a-select v-model:value="form.city" placeholder="请选择城市">
              <a-select-option value="揭阳市">揭阳市</a-select-option>
              <a-select-option value="广州市">广州市</a-select-option>
              <a-select-option value="深圳市">深圳市</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="区县" :class="fieldClass('district')">
            <a-select v-model:value="form.district" placeholder="请选择区县" allow-clear>
              <a-select-option value="榕城区">榕城区</a-select-option>
              <a-select-option value="揭东区">揭东区</a-select-option>
              <a-select-option value="普宁市">普宁市</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="详细地址" :class="fieldClass('receiverAddress')">
            <a-input v-model:value="form.receiverAddress" />
          </a-form-item>
          <a-form-item label="物品类型" :class="fieldClass('itemType')">
            <a-select v-model:value="form.itemType" placeholder="请选择">
              <a-select-option value="Document">文件</a-select-option>
              <a-select-option value="Clothing">衣物</a-select-option>
              <a-select-option value="Digital device">数码产品</a-select-option>
              <a-select-option value="Food">食品</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="备注" :class="fieldClass('remark')">
            <a-textarea v-model:value="form.remark" :rows="3" />
          </a-form-item>
        </a-form>
      </a-card>

      <a-card title="元数据" size="small" class="demo-card metadata-workbench">
        <a-table size="small" :pagination="false" :data-source="shippingFieldMeta" :columns="columns" row-key="id" />
      </a-card>

      <a-card title="执行器" size="small" class="demo-card steps-workbench">
        <a-steps direction="vertical" size="small" :current="steps.findIndex((step) => step.status === 'running')">
          <a-step v-for="step in steps" :key="step.id" :title="step.label" :description="step.value">
            <template #icon>
              <LoadingOutlined v-if="step.status === 'running'" />
              <CheckCircleOutlined v-else-if="step.status === 'done'" />
              <ClockCircleOutlined v-else />
            </template>
          </a-step>
        </a-steps>
        <a-empty v-if="!steps.length" description="尚未运行" />
      </a-card>
    </div>

    <CodeTabs :blocks="demo.codeBlocks" />
  </LlmIntegration>
</template>
