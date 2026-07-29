import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import '@enchantforge/vue/style.css';
import { createEnchantDebug, createEnchantForge } from '@enchantforge/vue';
import App from './App.vue';
import { supportApi } from './examples/asr/support-api';
import { supportExecutionPolicy } from './examples/asr/support-execution-policy';
import { supportKnowledgeProvider } from './examples/asr/support-knowledge';
import './styles.css';

const forge = createEnchantForge({
  knowledge: supportKnowledgeProvider,
  llm: {
    model: __LLM_MODEL__,
    configError: __LLM_CONFIG_ERROR__ ? `${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。` : ''
  }
});
forge.use(supportApi);
forge.use(supportExecutionPolicy);
forge.use(createEnchantDebug());

createApp(App).use(Antd).use(forge).mount('#app');
