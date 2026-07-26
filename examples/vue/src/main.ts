import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import { loader } from '@guolao/vue-monaco-editor';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import 'ant-design-vue/dist/reset.css';
import '@enchantforge/vue/style.css';
import { createEnchantDebug, createEnchantForge } from '@enchantforge/vue';
import App from './App.vue';
import './styles.css';

(globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (_: string, label: string) => Worker;
  };
}).MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

loader.config({ monaco });

const forge = createEnchantForge({
  llm: {
    model: __LLM_MODEL__,
    configError: __LLM_CONFIG_ERROR__ ? `${__LLM_CONFIG_ERROR__}，请检查 examples/vue/.env。` : ''
  }
});
forge.use(createEnchantDebug());

createApp(App).use(Antd).use(forge).mount('#app');
