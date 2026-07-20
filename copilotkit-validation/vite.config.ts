import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const runtimePort = env.COPILOT_RUNTIME_PORT ?? '8200';

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/api/copilotkit': {
          target: `http://127.0.0.1:${runtimePort}`,
          changeOrigin: true
        }
      }
    }
  };
});
