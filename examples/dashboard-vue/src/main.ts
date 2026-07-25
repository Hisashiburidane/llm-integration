import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import { createEnchantDebug, createEnchantForge } from '@enchantforge/vue';
import App from './App.vue';
import './styles.css';

const forge = createEnchantForge({
  llm: {
    model: __LLM_MODEL__,
    configError: __LLM_CONFIG_ERROR__ ? `${__LLM_CONFIG_ERROR__}，请检查 examples/dashboard-vue/.env。` : ''
  }
});
forge.use(createEnchantDebug());

createApp(App).use(Antd).use(forge).mount('#app');
