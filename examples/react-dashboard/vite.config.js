import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(function (_a) {
    var _b, _c;
    var mode = _a.mode;
    var env = loadEnv(mode, new URL(".", import.meta.url).pathname, "LLM_");
    var endpoint = null;
    var configError = "";
    try {
        if (!env.LLM_BASE_URL)
            throw new Error("缺少 LLM_BASE_URL");
        if (!env.LLM_MODEL)
            throw new Error("缺少 LLM_MODEL");
        endpoint = new URL(env.LLM_BASE_URL);
    }
    catch (error) {
        configError = error instanceof Error ? error.message : "LLM 配置无效";
    }
    return {
        plugins: [react()],
        define: {
            __LLM_MODEL__: JSON.stringify((_b = env.LLM_MODEL) !== null && _b !== void 0 ? _b : ""),
            __LLM_CONFIG_ERROR__: JSON.stringify(configError)
        },
        server: {
            port: 5173,
            proxy: {
                "/api/llm": {
                    target: (_c = endpoint === null || endpoint === void 0 ? void 0 : endpoint.origin) !== null && _c !== void 0 ? _c : "http://127.0.0.1:9",
                    changeOrigin: true,
                    headers: env.LLM_API_KEY ? { Authorization: "Bearer ".concat(env.LLM_API_KEY.trim()) } : {},
                    rewrite: function (path) { var _a; return "".concat((_a = endpoint === null || endpoint === void 0 ? void 0 : endpoint.pathname.replace(/\/$/, "")) !== null && _a !== void 0 ? _a : "").concat(path.replace(/^\/api\/llm/, "")); }
                }
            }
        }
    };
});
