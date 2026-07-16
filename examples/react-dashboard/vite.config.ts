import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL(".", import.meta.url));
  const env = loadEnv(mode, envDir, "LLM_");
  let endpoint: URL | null = null;
  let configError = "";
  try {
    if (!env.LLM_BASE_URL) throw new Error("缺少 LLM_BASE_URL");
    if (!env.LLM_MODEL) throw new Error("缺少 LLM_MODEL");
    endpoint = new URL(env.LLM_BASE_URL);
  } catch (error) {
    configError = error instanceof Error ? error.message : "LLM 配置无效";
  }

  return {
    plugins: [react()],
    define: {
      __LLM_MODEL__: JSON.stringify(env.LLM_MODEL ?? ""),
      __LLM_CONFIG_ERROR__: JSON.stringify(configError)
    },
    server: {
      port: 5173,
      proxy: {
        "/api/llm": {
          target: endpoint?.origin ?? "http://127.0.0.1:9",
          changeOrigin: true,
          headers: env.LLM_API_KEY ? { Authorization: `Bearer ${env.LLM_API_KEY.trim()}` } : {},
          rewrite: (path) => `${endpoint?.pathname.replace(/\/$/, "") ?? ""}${path.replace(/^\/api\/llm/, "")}`
        }
      }
    }
  };
});
