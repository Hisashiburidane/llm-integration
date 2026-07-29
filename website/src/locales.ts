export const messages = {
  'zh-CN': {
    nav: {
      home: '首页',
      start: '快速开始',
      model: '接入方式',
      examples: '真实示例',
      runtime: '怎么工作',
      api: 'API 文档'
    },
    meta: {
      homeTitle: 'EnchantForge · 让 AI 看懂并操作 Vue 页面',
      apiTitle: 'API 文档 · EnchantForge'
    },
    language: {
      label: '语言',
      zh: '中文',
      en: 'EN'
    },
    home: {
      hero: {
        kicker: 'LLM integration framework for Vue',
        title: '帮 AI 对齐颗粒度',
        problem: '面向 Vue 应用的 AI 集成框架',
        lead: '为 Web 应用构建 AI 上下文。',
        start: '快速开始',
        examples: '查看示例',
        api: 'API 文档'
      },
      minimum: {
        kicker: '先让 AI 看见',
        title: '应用知道的，AI 也该知道',
        body: 'EnchantForge 将应用提供的信息组织成 AI 可以理解的上下文。',
        notes: {
          domTitle: '信息来自应用本身',
          domBody: '字段、状态、页面结构，以及它们原本的含义。',
          globalTitle: '上下文始终对应当前页面',
          globalBody: '组件的加入、离开和变化，都会反映在下一次调用中。',
          submitTitle: '让函数，成为 AI 的能力',
          submitBody: '从一次页面交互，到完整业务流程。'
        }
      },
      model: {
        kicker: '接入方式',
        title: '从组件到整个应用',
        body: '在组件中注册表单和函数，或者在应用中注册跨页面 API。Aura 和自定义 Agent 都可以使用 Forge 生成的上下文与工具。',
        groups: {
          provide: '向 Forge 注册',
          consume: '使用上下文与工具'
        },
        levels: {
          component: {
            title: '组件接入',
            notes: ['注册表单模型', '提供局部函数', '绑定组件生命周期']
          },
          application: {
            title: '应用接入',
            notes: ['注册共享能力', '跨页面使用', '通过插件安装']
          },
          assistant: {
            title: '使用 Aura',
            notes: ['默认助手界面', '会话与 Markdown', '进度和结果反馈', '支持外部控制']
          },
          agent: {
            title: '接入自己的 Agent',
            notes: ['导出上下文与工具', '接入不同后端和协议', '执行仍经过框架约束']
          }
        }
      },
      register: {
        kicker: '注册函数',
        title: '让 AI 调用应用函数',
        body: '应用描述函数的用途和参数，Forge 将它作为工具提供给 AI，并在调用前完成校验。'
      },
      examples: {
        kicker: '示例',
        title: '从模型请求到页面结果',
        body: '每个示例都会发起真实模型请求、调用应用函数，并在页面中呈现执行结果。',
        action: '查看示例'
      },
      runtime: {
        kicker: '运行机制',
        title: '组件提供信息，Forge 组织上下文',
        body: 'Aura 和自定义 Agent 使用同一份上下文与工具。',
        rows: {
          forge: '注册、聚合、策略与 Agent',
          enchant: '定义局部上下文边界',
          adapters: '接入稳定的组件 API',
          executor: '校验并执行工具调用',
          aura: '提供对话与执行反馈'
        }
      },
      principles: {
        kicker: '我们故意不做的事',
        title: 'AI 可以聪明，框架不能自作聪明',
        explicit: {
          title: '不偷看',
          body: '未主动提供的信息，默认不读取。'
        },
        stable: {
          title: '不猜组件',
          body: '优先使用 Vue 状态和公开 API。'
        },
        local: {
          title: '不把全世界塞进提示词',
          body: '只提供当前任务需要的信息。'
        },
        visible: {
          title: '不偷偷动手',
          body: '执行过程和结果始终可见。'
        },
        owned: {
          title: '业务归应用',
          body: '框架管理机制，应用定义语义和副作用。'
        }
      }
    },
    api: {
      title: 'API 文档',
      lead: '本文档按接入层级介绍 EnchantForge 的公开 API。基础场景可从 Enchant、Aura 和 useEnchantForm 开始；需要自定义 Agent、知识检索或执行策略时，再使用运行时扩展接口。',
      searchLabel: '搜索 API',
      searchPlaceholder: '搜索 Enchant、useEnchantForm、Agent…',
      empty: '未找到匹配的公开 API，请检查名称或搜索关键词。',
      import: '导入',
      signature: '类型签名',
      example: '使用示例',
      responsibilities: '使用说明',
      onThisPage: '本页目录',
      quickStart: '快速开始',
      quickStartBody: '在应用入口安装一个 Forge 实例，再使用 Enchant 包裹需要贡献 AI 上下文的 Vue 组件树。',
      install: '安装',
      sourceNote: '本文档仅覆盖 packages/vue 的公开导出。示例项目中的业务能力不属于核心库 API。',
      kinds: {
        component: '组件',
        composable: '组合式 API',
        factory: '工厂函数',
        interface: '接口',
        directive: '指令'
      },
      groups: {
        foundation: {
          title: '基础接入',
          description: '安装应用运行时，并为 Vue 组件树建立明确的 AI 上下文边界。'
        },
        contribution: {
          title: '元数据与能力声明',
          description: '由 Vue 组件或应用模块显式贡献结构化元数据和可执行能力。'
        },
        runtime: {
          title: '运行时控制',
          description: '获取上下文、运行 Agent、执行工具，并扩展运行与执行链路。'
        },
        agent: {
          title: 'Agent 与 LLM',
          description: '使用内置 Agent，或接入企业模型网关和自定义 Agent 协议。'
        },
        knowledge: {
          title: '知识检索',
          description: '通过统一接口连接静态知识、本地服务或远程检索系统。'
        },
        debug: {
          title: '调试与兼容',
          description: '检查运行时状态、LLM 请求和执行记录，并为旧页面显式启用 DOM 兼容能力。'
        },
        observability: {
          title: '可观测性',
          description: '将 Agent 运行、LLM 请求和能力执行接入现有 OpenTelemetry 链路。'
        }
      },
      entries: {
        createEnchantForge: {
          description: '创建应用级 EnchantForge 实例。该实例统一管理 Registry、Agent、Policy、Knowledge Provider、插件和运行时状态。',
          notes: ['一个 Vue 应用通常只需要一个 Forge 实例。', '可使用内置 OpenAI-compatible Client，也可注入自定义 LlmClient 或 EnchantAgent。', 'Snapshot 自动采集默认关闭，仅在明确需要记录历史状态时启用。']
        },
        Enchant: {
          description: '为一段 Vue 组件树建立 AI 上下文边界，并聚合后代组件显式贡献的元数据与能力。',
          notes: ['scan 默认为 none，不读取 DOM。', 'exposure 可控制当前边界是否对 Aura、局部组件或外部上下文可见。', 'prompt 仅用于描述当前边界内的规则，不应承载全局业务配置。']
        },
        Aura: {
          description: '面向最终用户的助手组件，提供对话输入、执行进度、Markdown 响应和运行控制。',
          notes: ['默认使用 Forge 的 Agent，也可通过 agent 或 agentId 指定其他 Agent。', '组件实例提供 submit、cancel、clear 和 open 等命令式方法。', '业务提示词、推荐问题和交互策略由应用负责配置。']
        },
        useEnchantForm: {
          description: '从响应式表单 model 推导字段元数据，并注册受约束的草稿填充能力。',
          notes: ['应在 Enchant 上下文内调用。', '字段默认使用 model 的键名，也可显式配置字段标签。', '该能力只修改草稿状态，不执行表单提交。']
        },
        useEnchantAction: {
          description: '将应用函数注册为具有 JSON Schema、影响级别和生命周期的可执行能力。',
          notes: ['effect 为 Policy 提供决策依据，但不能替代业务鉴权。', '应用拥有 execute 的业务实现；Core 负责发现、参数校验和执行调度。', '能力会随所属 Vue 组件卸载而自动注销。']
        },
        applicationApis: {
          description: '在组件之外定义可复用的应用能力集合，并以 Forge 插件的形式按需注册。',
          notes: ['defineEnchantAction 保留完整类型推导，不会自动注册能力。', 'defineEnchantApi 将一组 Action 注册为应用级上下文，适合订单、账户等共享 API。', '业务状态、权限和副作用仍由应用提供的 execute 函数负责。']
        },
        useEnchant: {
          description: '在业务组件中访问当前 Enchant 上下文，主动运行 Agent 或导出局部工具。',
          notes: ['run 自动限定在当前 Enchantment 范围内。', 'captureContext 可导出模型上下文和工具，供自定义 Agent 使用。', '适用于实时语音、事件驱动辅助等由业务主动触发的场景。']
        },
        useEnchantForge: {
          description: '访问应用级 Forge 实例及其底层 API，包括上下文捕获、Agent 运行、工具执行和知识检索。',
          notes: ['常规场景优先使用 Enchant、Aura 和 useEnchant。', 'captureContext 可按局部、页面或整个应用聚合上下文。', '直接调用 executeTool 仍会经过参数校验和 Policy。']
        },
        middleware: {
          description: '在不修改 Core 执行逻辑的前提下，为 Agent 运行和能力执行添加横切行为。',
          notes: ['中间件必须调用 next 才会继续后续链路。', '适合实现日志、指标、追踪、缓存或应用自定义的幂等策略。', '业务规则应由应用中间件实现，Core 不内置特定场景的节流或去重语义。']
        },
        EnchantAgent: {
          description: '可替换的 Agent 客户端协议，负责规划工具调用、根据执行结果继续规划，并生成最终响应。',
          notes: ['Agent 可代理任意后端协议，不要求在浏览器中实现完整推理流程。', '可通过 agentId 和 resolveAgent 将不同组件路由到不同 Agent。', '业务提示词和工作流策略由应用或自定义 Agent 负责。']
        },
        createLlmClient: {
          description: '创建 OpenAI-compatible Chat Completions 客户端，并使用原生 function tools 协议。',
          notes: ['默认端点为 /api/llm/chat/completions，可由开发或生产网关代理。', '支持超时、AbortSignal、自定义请求头、maxTokens 和自定义 fetch。', '生产环境不应在浏览器代码中暴露真实 API Key。']
        },
        knowledgeProviders: {
          description: '统一知识检索契约，可连接静态知识、本地服务或远程 RAG 系统。',
          notes: ['静态 Provider 适合示例与测试，HTTP Provider 适合接入独立检索服务。', '后端可自由选择 Elasticsearch、向量数据库或混合检索方案。', 'Knowledge Provider 不会自动成为模型工具，应用需显式定义相应的查询能力。']
        },
        createEnchantDebug: {
          description: '启用可移动的页内调试控件，用于检查 Registry、Snapshot、Trace、LLM 请求和 Agent 执行。',
          notes: ['调试模式不会默认启用 Snapshot 自动采集。', '通过 forge.use(createEnchantDebug()) 安装。', '是否在生产构建中启用由应用决定。']
        },
        directives: {
          description: '为无法提供 Vue 元数据的旧页面声明可扫描或应忽略的 DOM 区域。',
          notes: ['需要同时在 Enchant 上设置 scan="marked" 或 scan="auto"。', '新代码应优先使用 useEnchantForm、useEnchantAction 或稳定组件适配器。', 'DOM 扫描是显式启用的兼容路径，不是默认集成方式。']
        },
        openTelemetry: {
          description: '创建 OpenTelemetry 插件，为 Agent 运行、LLM 请求和能力执行生成 spans 与 metrics。',
          notes: ['从 @enchantforge/vue/otel 子入口导入，不会影响不使用可观测性的应用。', 'tracer 和 meter 由应用现有的 OpenTelemetry SDK 提供。', '输入和输出默认不写入 telemetry；仅在确认数据安全后启用 captureInputs 或 captureOutputs。']
        }
      }
    }
  },
  en: {
    nav: {
      home: 'Home',
      start: 'Start',
      model: 'Model',
      examples: 'Examples',
      runtime: 'Runtime',
      api: 'API'
    },
    meta: {
      homeTitle: 'EnchantForge · AI context and execution for Vue',
      apiTitle: 'API reference · EnchantForge'
    },
    language: {
      label: 'Language',
      zh: '中文',
      en: 'EN'
    },
    home: {
      hero: {
        kicker: 'LLM integration framework for Vue',
        title: 'Context at the right granularity',
        problem: 'An AI context framework for Vue',
        lead: 'Build AI context for web applications.',
        start: 'Get started',
        examples: 'View examples',
        api: 'API reference'
      },
      minimum: {
        kicker: 'Let AI see first',
        title: 'What the application knows, AI should know',
        body: 'EnchantForge organizes application information into context AI can understand.',
        notes: {
          domTitle: 'Information comes from the application itself',
          domBody: 'Fields, state, interface structure, and their original meaning.',
          globalTitle: 'Context always reflects the current page',
          globalBody: 'Components joining, leaving, and changing are reflected in the next request.',
          submitTitle: 'Turn functions into AI capabilities',
          submitBody: 'From a single interface interaction to an entire business workflow.'
        }
      },
      model: {
        kicker: 'Integration paths',
        title: 'From one component to the entire application',
        body: 'Register forms and functions in a component, or register cross-page APIs in the application. Aura and custom Agents can use the context and tools generated by Forge.',
        groups: {
          provide: 'Register with Forge',
          consume: 'Use context and tools'
        },
        levels: {
          component: {
            title: 'Component integration',
            notes: ['register form models', 'expose local functions', 'follow the component lifecycle']
          },
          application: {
            title: 'Application integration',
            notes: ['register shared capabilities', 'use them across pages', 'install as a plugin']
          },
          assistant: {
            title: 'Use Aura',
            notes: ['default assistant interface', 'conversation and Markdown', 'progress and results', 'external control']
          },
          agent: {
            title: 'Connect your own Agent',
            notes: ['export context and tools', 'connect different backends and protocols', 'keep execution constrained by the framework']
          }
        }
      },
      register: {
        kicker: 'Register functions',
        title: 'Let AI call application functions',
        body: 'Applications describe each function and its parameters. Forge exposes it as a tool and validates every call.'
      },
      examples: {
        kicker: 'Examples',
        title: 'From model request to page result',
        body: 'Each example sends a real model request, calls application functions, and renders the result in the page.',
        action: 'View examples'
      },
      runtime: {
        kicker: 'Runtime',
        title: 'Components contribute. Forge assembles context',
        body: 'Aura and custom Agents consume the same context and tools.',
        rows: {
          forge: 'registry, aggregation, policy, and Agent',
          enchant: 'local context boundary',
          adapters: 'stable component APIs',
          executor: 'validate and execute tool calls',
          aura: 'conversation and execution feedback'
        }
      },
      principles: {
        kicker: 'Design constraints',
        title: 'Boundaries before features',
        explicit: {
          title: 'Explicit by default',
          body: 'Uncontributed information stays unread.'
        },
        stable: {
          title: 'Stable contracts first',
          body: 'Prefer Vue state and public APIs.'
        },
        local: {
          title: 'Generic tools, local context',
          body: 'Provide only what the current task needs.'
        },
        visible: {
          title: 'Visible execution',
          body: 'Execution and results remain visible.'
        },
        owned: {
          title: 'Application-owned semantics',
          body: 'Core owns mechanisms. Applications own meaning and effects.'
        }
      }
    },
    api: {
      title: 'API reference',
      lead: 'From one wrapper to a custom Agent. These are the stable public entry points of the EnchantForge Vue package and the responsibilities each one owns.',
      searchLabel: 'Search APIs',
      searchPlaceholder: 'Search Enchant, useEnchantForm, Agent…',
      empty: 'No matching API.',
      import: 'Import',
      signature: 'Signature',
      example: 'Example',
      responsibilities: 'When to use it',
      onThisPage: 'On this page',
      quickStart: 'Install and initialize',
      quickStartBody: 'Install the Forge plugin once, then wrap the Vue subtree that should contribute AI context.',
      install: 'Install',
      sourceNote: 'This reference follows the public exports from packages/vue. Example-only capabilities are not Core APIs.',
      kinds: {
        component: 'Component',
        composable: 'Composable',
        factory: 'Factory',
        interface: 'Interface',
        directive: 'Directive'
      },
      groups: {
        foundation: {
          title: 'Foundation',
          description: 'Install the runtime and create AI scopes.'
        },
        contribution: {
          title: 'Metadata and capabilities',
          description: 'Let Vue components contribute state and executable functions explicitly.'
        },
        runtime: {
          title: 'Runtime control',
          description: 'Capture context, run Agents, and access the Registry.'
        },
        agent: {
          title: 'Agent and LLM',
          description: 'Use the built-in Agent or connect your own client and backend protocol.'
        },
        knowledge: {
          title: 'Knowledge retrieval',
          description: 'Connect static knowledge or a remote retrieval service.'
        },
        debug: {
          title: 'Debug and compatibility',
          description: 'Inspect runtime state and explicitly opt legacy interfaces into DOM compatibility.'
        },
        observability: {
          title: 'Observability',
          description: 'Connect Agent runs, LLM requests, and capability execution to OpenTelemetry.'
        }
      },
      entries: {
        createEnchantForge: {
          description: 'Creates the application runtime that owns the Registry, Agent, Policy, Knowledge Provider, and debug plugins.',
          notes: ['Create one instance for most Vue applications.', 'Use the built-in OpenAI-compatible client or provide a custom Agent.', 'Snapshot auto-capture is disabled by default.']
        },
        Enchant: {
          description: 'Defines an AI scope around a Vue subtree and aggregates metadata and capabilities explicitly contributed by descendants.',
          notes: ['scan defaults to none and does not read the DOM.', 'Use exposure to make a scope available to Aura, local only, or private.', 'prompt describes rules local to this boundary.']
        },
        Aura: {
          description: 'End-user assistant UI for conversation, progress, Markdown responses, and run control.',
          notes: ['Use the Forge Agent or select another Agent through agent or agentId.', 'A template ref exposes submit, cancel, clear, open, and other imperative methods.', 'Business prompts and suggestions belong to the application.']
        },
        useEnchantForm: {
          description: 'Derives field metadata from a reactive model and registers a constrained field.fill draft tool.',
          notes: ['Call it inside an Enchant boundary.', 'Fields default to model keys and can be mapped to explicit labels.', 'It mutates draft state only and never submits.']
        },
        useEnchantAction: {
          description: 'Registers an application-owned function as a lifecycle-bound capability with JSON Schema and an effect.',
          notes: ['effect informs policy but does not replace business authorization.', 'The application owns execute; Core only discovers, validates, and schedules it.', 'The contribution unregisters with the Vue scope.']
        },
        applicationApis: {
          description: 'Defines reusable application capability sets outside component setup and registers them as Forge plugins.',
          notes: ['defineEnchantAction preserves type inference and does not register by itself.', 'defineEnchantApi registers Actions as application-level context.', 'Application execute functions continue to own business state, authorization, and effects.']
        },
        useEnchant: {
          description: 'Accesses local Enchant context to run an Agent programmatically or export local tools.',
          notes: ['run is automatically scoped to the current Enchantment.', 'captureContext returns model context, tools, and the control snapshot for custom Agents.', 'Useful for business-driven workflows such as streaming ASR.']
        },
        useEnchantForge: {
          description: 'Accesses the application Forge and lower-level APIs including captureContext, run, executeTool, and retrieveKnowledge.',
          notes: ['Prefer Enchant, Aura, and useEnchant for high-level scenarios.', 'captureContext aggregates local, page, or app scopes.', 'Direct tool execution still passes input validation and Policy.']
        },
        middleware: {
          description: 'Adds cross-cutting behavior around Agent runs and capability execution without changing Core.',
          notes: ['Middleware must call next to continue the chain.', 'Use it for logging, metrics, tracing, caching, or application-owned idempotency.', 'Core does not impose scenario-specific throttling or deduplication semantics.']
        },
        EnchantAgent: {
          description: 'Replaceable Agent client protocol for planning tool calls, continuing after results, and producing a final response.',
          notes: ['The Agent may proxy any backend protocol and does not need to run in the browser.', 'agentId and resolveAgent can route components to different Agents.', 'Core does not prescribe business prompts or workflows.']
        },
        createLlmClient: {
          description: 'Creates a lightweight client for OpenAI-compatible chat completions with native function-tool support.',
          notes: ['The default endpoint is /api/llm/chat/completions for a Vite or production gateway proxy.', 'Supports timeouts, AbortSignal, custom headers, and a custom fetcher.', 'Do not expose production API keys in browser code.']
        },
        knowledgeProviders: {
          description: 'A shared retrieval contract. The static provider fits examples and tests; the HTTP provider connects Elasticsearch, vector stores, or hybrid retrieval.',
          notes: ['Core defines retrieve without choosing a RAG product.', 'The HTTP Provider sends POST JSON and preserves caller headers.', 'Knowledge does not become a business tool automatically; application capabilities call it explicitly.']
        },
        createEnchantDebug: {
          description: 'Enables a movable in-page debug control for Registry, snapshots, traces, and Agent calls.',
          notes: ['Debug mode does not enable autoCapture by default.', 'Install it with forge.use(createEnchantDebug()).', 'The application decides whether to enable it in production builds.']
        },
        directives: {
          description: 'Explicit DOM markers for legacy regions that cannot contribute Vue metadata.',
          notes: ['Also set scan="marked" or scan="auto" on Enchant.', 'Prefer useEnchantForm, useEnchantAction, or stable adapters.', 'DOM scanning is a compatibility path, not the default integration.']
        },
        openTelemetry: {
          description: 'Creates an OpenTelemetry plugin for Agent runs, LLM requests, and capability execution spans and metrics.',
          notes: ['Import it from the @enchantforge/vue/otel subpath so applications that do not use telemetry remain unaffected.', 'The application provides tracer and meter instances from its OpenTelemetry SDK.', 'Inputs and outputs are excluded by default; enable capture only after reviewing data sensitivity.']
        }
      }
    }
  }
} as const;
