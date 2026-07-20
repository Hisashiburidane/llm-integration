import { createApp } from 'vue';
import Antd from 'ant-design-vue';
import App from './app.vue';
import '@copilotkit/vue/styles.css';
import 'ant-design-vue/dist/reset.css';
import './styles.css';

createApp(App).use(Antd).mount('#app');
