import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  BuiltInAgent,
  CopilotRuntime,
  convertMessagesToVercelAISDKMessages,
  convertToolsToVercelAITools
} from '@copilotkit/runtime/v2';
import { createCopilotNodeListener } from '@copilotkit/runtime/v2/node';
import { config as loadEnv } from 'dotenv';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFiles = [
  resolve(projectRoot, '.env.local'),
  resolve(projectRoot, '.env'),
  resolve(projectRoot, '..', '.env')
];

for (const path of envFiles) {
  if (existsSync(path)) loadEnv({ path, override: false });
}

process.env.COPILOTKIT_TELEMETRY_DISABLED ??= 'true';
const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
const baseURL = process.env.LLM_BASE_URL ?? process.env.OPENAI_BASE_URL;
const modelName = process.env.LLM_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

if (!apiKey) {
  throw new Error('Missing LLM_API_KEY. Copy .env.example to .env and configure the runtime.');
}

const openai = createOpenAI({ apiKey, baseURL });
const assistantPrompt = [
  '你是 Vue 应用中的界面助手。',
  '优先调用当前页面注册的前端工具完成用户明确要求。',
  '严格遵守工具描述中的触发边界，不编造工具参数或页面元素 ID。',
  '不要提交表单。操作完成后用一句中文说明结果。'
].join('\n');

const runtime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      type: 'aisdk',
      factory: ({ input, abortSignal }) => {
        const pageContext = input.context
          .map(({ description, value }) => `${description}\n${value}`)
          .join('\n\n');

        return streamText({
          model: openai.chat(modelName),
          system: [assistantPrompt, pageContext].filter(Boolean).join('\n\n'),
          messages: convertMessagesToVercelAISDKMessages(input.messages),
          tools: convertToolsToVercelAITools(input.tools),
          abortSignal
        });
      }
    })
  }
});

const port = Number(process.env.COPILOT_RUNTIME_PORT ?? 8200);
createServer(
  createCopilotNodeListener({
    runtime,
    basePath: '/api/copilotkit',
    cors: true
  })
).listen(port, '127.0.0.1', () => {
  console.log(`Copilot Runtime: http://127.0.0.1:${port}/api/copilotkit`);
});
