<script setup lang="ts">
import { ref } from 'vue';
import { CopilotChat, CopilotKitProvider } from '@copilotkit/vue/v2';
import TextToForm from './examples/text-to-form.vue';
import FocusView from './examples/focus-view.vue';

const activeDemo = ref<'form' | 'focus'>('form');
</script>

<template>
  <CopilotKitProvider runtime-url="/api/copilotkit" :show-dev-console="true">
    <div class="app-shell">
      <header class="app-header">
        <div class="brand-block">
          <div class="brand-mark">CK</div>
          <div>
            <strong>CopilotKit Vue Validation</strong>
            <span>Independent framework comparison</span>
          </div>
        </div>
        <a-segmented
          v-model:value="activeDemo"
          :options="[
            { label: 'Text to Form', value: 'form' },
            { label: 'Focus View', value: 'focus' }
          ]"
        />
        <a-tag>CopilotKit 1.63.1</a-tag>
      </header>

      <div class="workspace">
        <main class="demo-region">
          <TextToForm v-if="activeDemo === 'form'" />
          <FocusView v-else />
        </main>

        <aside class="assistant-region">
          <div class="assistant-header">
            <div>
              <strong>CopilotKit Agent</strong>
              <span>当前页面的 Context 与 Tools 随示例挂载</span>
            </div>
            <span class="status-dot" title="Runtime endpoint: /api/copilotkit" />
          </div>
          <CopilotChat class="copilot-chat" :welcome-screen="true">
            <template #welcome-message>
              <div class="chat-welcome">
                <strong>当前页面已连接</strong>
                <p>输入自然语言，Agent 会根据当前注册的 Context 选择 Frontend Tool。</p>
              </div>
            </template>
          </CopilotChat>
        </aside>
      </div>
    </div>
  </CopilotKitProvider>
</template>
