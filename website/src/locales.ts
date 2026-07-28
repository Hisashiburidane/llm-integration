export const messages = {
  'zh-CN': {
    nav: {
      home: '首页',
      start: '开始使用',
      model: '渐进模型',
      examples: '示例',
      runtime: '运行时',
      api: 'API 文档'
    },
    meta: {
      homeTitle: 'EnchantForge · Vue AI 上下文与执行框架',
      apiTitle: 'API 文档 · EnchantForge'
    },
    language: {
      label: '语言',
      zh: '中文',
      en: 'EN'
    },
    home: {
      hero: {
        kicker: '面向 Vue 的渐进式 AI 交互框架',
        title: '让 AI 读懂并操作 Vue 界面。',
        lead: '添加一个作用域边界，由组件贡献元数据和受约束的函数。DOM 访问只作为显式启用的兼容方案。',
        start: '从一个 Wrapper 开始',
        examples: '打开示例',
        api: '查看 API'
      },
      minimum: {
        kicker: '最小接入面',
        title: '一个 Wrapper，创建一个 AI 作用域。',
        body: '第一个集成点就是一棵 Vue 子树。默认情况下，边界只聚合后代组件和已安装适配器明确贡献的元数据与能力。',
        notes: {
          domTitle: '默认不遍历 DOM。',
          domBody: '渲染后的标签结构不是稳定的组件契约。',
          globalTitle: '默认不全局暴露。',
          globalBody: '作用域可以保持局部或私有，也可以明确暴露给 Aura。',
          submitTitle: '默认不提交。',
          submitBody: '执行器只准备可见的界面状态，最终业务提交仍需显式完成。'
        }
      },
      model: {
        kicker: '渐进模型',
        title: '优先显式贡献，按需选择扫描。',
        levels: {
          contribute: {
            title: 'Vue 主动贡献',
            notes: ['受控状态', '类型化函数', '组件生命周期', '不扫描 DOM']
          },
          adapt: {
            title: '组件适配器',
            notes: ['公开组件 API', '输入校验', '稳定执行', '复用集成']
          },
          fallback: {
            title: 'DOM 兼容模式',
            notes: ['显式启用', '遗留页面', '较低置信度', '浏览器事件']
          },
          reuse: {
            title: '执行器复用',
            notes: ['保存步骤', '可见回放', '本地存储验证', '可扩展后端']
          }
        }
      },
      fallback: {
        kicker: '标记式兼容',
        title: '把 DOM 访问限制在声明过的区域。',
        body: '标记式扫描让兼容范围保持局部，并且在源代码中清晰可见。'
      },
      register: {
        kicker: '注册能力',
        title: '状态重要时，使用显式注册 API。',
        body: '受控组件、校验和业务操作应该通过显式注册接入，而不是依赖 DOM 推断。'
      },
      examples: {
        kicker: '示例',
        title: '用真实场景验证框架能力。',
        body: '示例页面展示文本填表、Focus View 和实时坐席辅助等场景，每项能力都对应真实的元数据与工具调用。',
        action: '打开示例'
      },
      runtime: {
        kicker: '运行时',
        title: '局部作用域、全局助手、同一套执行模型。',
        body: '组件可以让元数据保持局部。全局助手只会聚合明确暴露到注册表的作用域，两种路径共享同一套受约束执行模型。',
        rows: {
          forge: '客户端、策略、注册表与 Agent 运行时',
          enchant: '生命周期、贡献边界与局部 Enchantment',
          adapters: '稳定的组件元数据与执行器',
          executor: '填表、聚焦、高亮、调用与回放',
          aura: '面向活跃 Enchantment 的应用级交互入口'
        }
      },
      principles: {
        kicker: '设计约束',
        title: '先明确边界，再扩展功能。',
        explicit: {
          title: '默认显式',
          body: '边界只聚合组件贡献的元数据和能力，不默认读取 DOM。'
        },
        stable: {
          title: '稳定契约优先',
          body: 'Vue 贡献与组件适配器优先于浏览器层推断。'
        },
        local: {
          title: '通用工具，局部上下文',
          body: '工具保持小而明确，字段、操作和区域通过作用域元数据提供。'
        },
        visible: {
          title: '执行过程可见',
          body: '执行器逐步改变界面状态，用户可以在提交前检查结果。'
        },
        optional: {
          title: 'DOM 只是兼容选项',
          body: '标记扫描和完整扫描都必须由应用代码明确启用。'
        }
      }
    },
    api: {
      kicker: '@enchantforge/vue · 0.1.x',
      title: 'API 文档',
      lead: '从一个 Wrapper 到自定义 Agent。这里记录 EnchantForge Vue 包的稳定公开入口，以及它们各自应承担的职责。',
      searchLabel: '搜索 API',
      searchPlaceholder: '搜索 Enchant、useEnchantForm、Agent…',
      empty: '没有匹配的 API。',
      import: '导入',
      signature: '签名',
      example: '示例',
      responsibilities: '适用场景',
      onThisPage: '本页内容',
      quickStart: '安装与初始化',
      quickStartBody: '安装 Forge 插件一次，然后在需要 AI 上下文的 Vue 子树外添加 Enchant。',
      install: '安装',
      sourceNote: '文档依据 packages/vue 的公开导出整理。示例专属能力不属于核心 API。',
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
          description: '安装运行时并创建 AI 作用域。'
        },
        contribution: {
          title: '元数据与能力贡献',
          description: '让 Vue 组件明确贡献状态与可执行函数。'
        },
        runtime: {
          title: '运行时控制',
          description: '捕获上下文、运行 Agent 并访问注册表。'
        },
        agent: {
          title: 'Agent 与 LLM',
          description: '使用内置 Agent，或接入自己的客户端和后端协议。'
        },
        knowledge: {
          title: '知识检索',
          description: '为业务能力接入静态知识或远程检索服务。'
        },
        debug: {
          title: '调试与兼容',
          description: '观察运行时信息，并为遗留界面显式启用 DOM 兼容。'
        }
      },
      entries: {
        createEnchantForge: {
          description: '创建并安装应用级运行时。它管理 Registry、Agent、Policy、Knowledge Provider 和调试插件。',
          notes: ['通常每个 Vue 应用创建一个实例。', 'LLM 可使用内置 OpenAI-compatible 客户端，也可传入自定义 Agent。', '快照默认不自动捕获。']
        },
        Enchant: {
          description: '定义一棵 Vue 子树的 AI 作用域，聚合后代组件明确贡献的元数据与能力。',
          notes: ['scan 默认为 none，不读取 DOM。', '使用 exposure 控制作用域是否暴露给 Aura、保持局部或完全私有。', 'prompt 只描述当前边界的局部规则。']
        },
        Aura: {
          description: '面向最终用户的助手组件，负责对话、进度展示、Markdown 回答与运行控制。',
          notes: ['可以使用全局 Forge Agent，也可以通过 agent 或 agentId 选择其他 Agent。', '通过 ref 暴露 submit、cancel、clear、open 等命令式方法。', '业务提示词和建议项由应用传入。']
        },
        useEnchantForm: {
          description: '根据响应式 model 自动贡献字段元数据，并注册受约束的 field.fill 草稿写入工具。',
          notes: ['必须在 Enchant 边界内调用。', '默认根据 model 的键生成字段，可以通过 fields 指定字段与标签。', '默认只修改草稿，不执行提交。']
        },
        useEnchantAction: {
          description: '把应用拥有的函数注册为带 JSON Schema、effect 与生命周期的 capability。',
          notes: ['effect 用于策略判断，不替代业务权限。', 'execute 仍由应用拥有，Core 只负责发现、校验和调度。', '组件卸载时自动取消注册。']
        },
        useEnchant: {
          description: '在当前 Enchant 内访问局部上下文，并以编程方式运行 Agent 或导出局部工具。',
          notes: ['run 自动限制到当前 Enchantment。', 'captureContext 返回模型上下文、工具和控制快照，调用方可以连接自定义 Agent。', '适合实时 ASR 等由业务组件主动触发的工作流。']
        },
        useEnchantForge: {
          description: '访问应用级 Forge 实例以及 captureContext、run、executeTool、retrieveKnowledge 等低层能力。',
          notes: ['高层场景优先使用 Enchant、Aura 和 useEnchant。', 'captureContext 可以按 local、page 或 app 聚合。', '直接执行工具时仍会经过输入校验与 Policy。']
        },
        EnchantAgent: {
          description: '可替换的 Agent 客户端协议。它负责规划工具调用，并可根据执行结果继续规划和生成最终回答。',
          notes: ['Agent 不必运行在浏览器内，可以代理任意后端协议。', 'agentId 与 resolveAgent 可以把不同组件路由到不同 Agent。', 'Core 不要求具体的 Prompt 工程或业务流程。']
        },
        createLlmClient: {
          description: '创建一个面向 OpenAI-compatible chat completions API 的轻量客户端，原生支持 function tools。',
          notes: ['默认端点为 /api/llm/chat/completions，适合由 Vite 或生产网关代理。', '支持超时、AbortSignal、自定义 headers 与 fetcher。', 'API Key 不应直接暴露在生产浏览器代码中。']
        },
        knowledgeProviders: {
          description: '提供统一的知识检索契约。静态实现适合示例与测试，HTTP 实现适合连接 Elasticsearch、向量库或混合检索服务。',
          notes: ['Core 只定义 retrieve 契约，不绑定具体 RAG 产品。', 'HTTP Provider 使用 POST JSON，并保留调用方提供的请求头。', 'Knowledge Provider 不会自动成为业务工具，需要由应用能力显式调用。']
        },
        createEnchantDebug: {
          description: '启用可移动的页面内调试控件，用于查看 Registry、快照、Trace 与 Agent 调用信息。',
          notes: ['调试模式也不会默认开启 autoCapture。', '通过 forge.use(createEnchantDebug()) 安装。', '生产构建是否启用由应用决定。']
        },
        directives: {
          description: '为无法贡献 Vue 元数据的遗留区域提供显式 DOM 标记与忽略指令。',
          notes: ['必须同时在 Enchant 上设置 scan="marked" 或 scan="auto"。', '优先使用 useEnchantForm、useEnchantAction 或稳定适配器。', 'DOM 扫描是兼容路径，不是默认集成方式。']
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
        kicker: 'Progressive AI interaction for Vue',
        title: 'Make Vue interfaces readable and executable by AI.',
        lead: 'Add a scope boundary. Components contribute metadata and constrained functions. DOM access remains an explicit compatibility option.',
        start: 'Start with one wrapper',
        examples: 'Open examples',
        api: 'Read the API'
      },
      minimum: {
        kicker: 'Minimum surface',
        title: 'One wrapper creates one AI scope.',
        body: 'The first integration point is a Vue subtree. By default, the boundary only aggregates metadata and capabilities explicitly contributed by descendants and installed adapters.',
        notes: {
          domTitle: 'No DOM traversal by default.',
          domBody: 'Rendered markup is not treated as a stable component contract.',
          globalTitle: 'No global exposure by default.',
          globalBody: 'Scopes can stay local or private, or be explicitly exposed to Aura.',
          submitTitle: 'No submit by default.',
          submitBody: 'The executor prepares visible UI state. Final business commit remains explicit.'
        }
      },
      model: {
        kicker: 'Progressive model',
        title: 'Contribute first. Scan only by choice.',
        levels: {
          contribute: {
            title: 'Vue contribution',
            notes: ['controlled state', 'typed functions', 'component lifecycle', 'no DOM scan']
          },
          adapt: {
            title: 'Component adapter',
            notes: ['public component APIs', 'validation', 'stable execution', 'shared integration']
          },
          fallback: {
            title: 'DOM compatibility',
            notes: ['explicit opt-in', 'legacy pages', 'lower confidence', 'browser events']
          },
          reuse: {
            title: 'Executor reuse',
            notes: ['saved steps', 'visible replay', 'local storage POC', 'extensible backend']
          }
        }
      },
      fallback: {
        kicker: 'Marked fallback',
        title: 'Restrict DOM access to declared regions.',
        body: 'Marked scanning keeps the compatibility surface local and visible in source code.'
      },
      register: {
        kicker: 'Register',
        title: 'Use explicit APIs when state matters.',
        body: 'Controlled components, validation, and business actions should use explicit registration instead of DOM inference.'
      },
      examples: {
        kicker: 'Examples',
        title: 'Prove the framework with real scenarios.',
        body: 'The examples cover text-to-form, Focus View, and live agent assistance. Every capability maps to real metadata and tool execution.',
        action: 'Open examples'
      },
      runtime: {
        kicker: 'Runtime',
        title: 'Local scopes, global assistant, shared execution.',
        body: 'Components can keep metadata local. A global assistant only aggregates scopes explicitly exposed to the registry. Both paths use the same constrained execution model.',
        rows: {
          forge: 'client, policy, registry, and agent runtime',
          enchant: 'lifecycle, contribution boundary, and local Enchantment',
          adapters: 'stable component metadata and executors',
          executor: 'fill, focus, highlight, invoke, and replay',
          aura: 'application-level interaction over active Enchantments'
        }
      },
      principles: {
        kicker: 'Design constraints',
        title: 'Boundaries before features.',
        explicit: {
          title: 'Explicit by default',
          body: 'A boundary aggregates component metadata and capabilities without reading its DOM.'
        },
        stable: {
          title: 'Stable contracts first',
          body: 'Vue contributions and component adapters take precedence over browser-level inference.'
        },
        local: {
          title: 'Generic tools, local context',
          body: 'Tools stay small. Fields, actions, and regions arrive as scoped metadata.'
        },
        visible: {
          title: 'Visible execution',
          body: 'The executor changes UI state step by step so users can inspect results before commit.'
        },
        optional: {
          title: 'DOM is optional',
          body: 'Marked and full DOM scans must be enabled explicitly by application code.'
        }
      }
    },
    api: {
      kicker: '@enchantforge/vue · 0.1.x',
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
        useEnchant: {
          description: 'Accesses local Enchant context to run an Agent programmatically or export local tools.',
          notes: ['run is automatically scoped to the current Enchantment.', 'captureContext returns model context, tools, and the control snapshot for custom Agents.', 'Useful for business-driven workflows such as streaming ASR.']
        },
        useEnchantForge: {
          description: 'Accesses the application Forge and lower-level APIs including captureContext, run, executeTool, and retrieveKnowledge.',
          notes: ['Prefer Enchant, Aura, and useEnchant for high-level scenarios.', 'captureContext aggregates local, page, or app scopes.', 'Direct tool execution still passes input validation and Policy.']
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
        }
      }
    }
  }
} as const;
