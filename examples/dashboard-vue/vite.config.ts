import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, envDir, 'LLM_');
  const allEnv = loadEnv(mode, envDir, '');
  const baseUrl = env.LLM_BASE_URL?.trim();
  const model = env.LLM_MODEL?.trim();
  const dataPort = allEnv.DASHBOARD_DATA_PORT?.trim() || '5176';
  let target = 'http://127.0.0.1:9';
  let basePath = '';
  let configError = '';

  try {
    if (!baseUrl) throw new Error('缺少 LLM_BASE_URL');
    if (!model) throw new Error('缺少 LLM_MODEL');
    const endpoint = new URL(baseUrl);
    target = endpoint.origin;
    basePath = endpoint.pathname.replace(/\/$/, '');
  } catch (error) {
    configError = error instanceof Error ? error.message : 'LLM 配置无效';
  }

  return {
    base: '/dashboard/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@enchantforge/vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url))
      }
    },
    define: {
      __LLM_MODEL__: JSON.stringify(model ?? ''),
      __LLM_CONFIG_ERROR__: JSON.stringify(configError)
    },
    server: {
      port: 5175,
      proxy: {
        '/api/dashboard': {
          target: `http://127.0.0.1:${dataPort}`,
          changeOrigin: true
        },
        '/api/llm': {
          target,
          changeOrigin: true,
          secure: true,
          headers: env.LLM_API_KEY ? { Authorization: `Bearer ${env.LLM_API_KEY.trim()}` } : {},
          rewrite: (path: string) => `${basePath}${path.replace(/^\/api\/llm/, '')}`
        }
      }
    }
  };
});
