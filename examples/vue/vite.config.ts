import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, envDir, 'LLM_');
  const baseUrl = env.LLM_BASE_URL?.trim();
  const model = env.LLM_MODEL?.trim();
  const timeoutMs = positiveInteger(env.LLM_TIMEOUT_MS, 60_000);
  const maxTokens = positiveInteger(env.LLM_MAX_TOKENS, 2048);
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
    base: '/examples/',
    plugins: [vue()],
    define: {
      __LLM_MODEL__: JSON.stringify(model ?? ''),
      __LLM_TIMEOUT_MS__: JSON.stringify(timeoutMs),
      __LLM_MAX_TOKENS__: JSON.stringify(maxTokens),
      __LLM_CONFIG_ERROR__: JSON.stringify(configError)
    },
    server: {
      port: 5174,
      proxy: {
        '/api/llm': {
          target,
          changeOrigin: true,
          secure: true,
          headers: env.LLM_API_KEY
            ? { Authorization: `Bearer ${env.LLM_API_KEY.trim()}` }
            : {},
          rewrite: (path) => `${basePath}${path.replace(/^\/api\/llm/, '')}`
        }
      }
    }
  };
});
