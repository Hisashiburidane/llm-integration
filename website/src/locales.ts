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
        kicker: '不是给应用塞一个聊天框',
        title: '让 AI 真正看懂你的页面，也真的能动手。',
        lead: '表单里有什么、按钮能做什么、当前页面发生了什么，不用每做一个 AI 功能就重新拼一遍提示词。组件把这些信息说清楚，EnchantForge 负责把它们交给 AI。',
        start: '先看最短接入',
        examples: '直接看它干活',
        api: '查 API'
      },
      minimum: {
        kicker: '先别讲架构',
        title: '最简单的接入，就是包一下。',
        body: '把需要交给 AI 的那块 Vue 页面放进 Enchant。里面的组件把字段和能做的事报上来。就这么多。',
        notes: {
          domTitle: '不会偷偷扫描整张页面。',
          domBody: '组件愿意说什么，AI 才能看到什么。老页面实在改不了，再明确开启 DOM 扫描。',
          globalTitle: '不会把所有信息一股脑交给 AI。',
          globalBody: '每块页面都可以单独控制：只在本地用、交给 Aura，或者完全不公开。',
          submitTitle: '更不会替你点确认。',
          submitBody: '填表、聚焦、高亮都可以做；付款、退款、提交这类操作，默认必须有人把关。'
        }
      },
      model: {
        kicker: '从简单到复杂',
        title: '简单页面少写代码，复杂系统也没被堵死。',
        levels: {
          contribute: {
            title: '组件自己说明白',
            notes: ['表单里有什么', '哪些函数能调用', '挂载时自动登记', '卸载时自动消失']
          },
          adapt: {
            title: '常用组件，接一次就够',
            notes: ['使用组件公开 API', '统一输入校验', '执行结果更稳定', '多个项目重复使用']
          },
          fallback: {
            title: '老页面也有后手',
            notes: ['必须主动开启', '适合遗留页面', '能用但不鼓励', '通过浏览器事件操作']
          },
          reuse: {
            title: '执行过程还能接着用',
            notes: ['保存执行步骤', '界面上看得见', '可以回放验证', '以后可接自己的后端']
          }
        }
      },
      fallback: {
        kicker: '实在改不了组件',
        title: '那就只扫描你点名的地方。',
        body: '给要读取的输入框做个标记，EnchantForge 只看这些，不会因为“智能”两个字就把整张页面翻个底朝天。'
      },
      register: {
        kicker: '关键操作别靠猜',
        title: '把能做什么，写成一个明确的函数。',
        body: '比如填表、查数据、打开弹窗。函数需要什么参数、会产生什么影响，都写清楚。AI 负责选择，应用负责真正执行。'
      },
      examples: {
        kicker: '概念讲完了',
        title: '别听它怎么说，看它到底能不能干。',
        body: '文本自动填快递单、监控大屏自动聚焦、客服通话实时生成工单建议。不是预先录好的动画，每一步都对应真实的上下文和工具调用。',
        action: '去看真实示例'
      },
      runtime: {
        kicker: '它到底怎么工作',
        title: '组件把话说明白，AI 才不用猜。',
        body: '页面里的组件各自说明“我是谁、我有什么、我能做什么”。EnchantForge 把这些信息按页面整理好，再交给 Aura 或你自己的 Agent。',
        rows: {
          forge: '总控：收集上下文、选择 Agent、执行安全规则',
          enchant: '划范围：告诉框架这一块页面属于谁',
          adapters: '翻译器：把常用组件变成 AI 能理解的说明',
          executor: '动手干：填表、聚焦、高亮、调用函数',
          aura: '对话入口：用户从这里提要求、看进度和结果'
        }
      },
      principles: {
        kicker: '我们故意不做的事',
        title: 'AI 可以聪明，框架不能自作聪明。',
        explicit: {
          title: '不偷看',
          body: '组件没有主动提供的信息，框架默认不从 DOM 里猜。'
        },
        stable: {
          title: '不猜组件',
          body: '优先相信 Vue 状态和公开 API，不把页面标签当成业务真相。'
        },
        local: {
          title: '不把全世界塞进提示词',
          body: '当前任务需要哪些页面信息，就只给哪些。'
        },
        visible: {
          title: '不偷偷动手',
          body: '填了什么、高亮了什么、调用了什么，界面上都看得见。'
        },
        optional: {
          title: '不拿兼容方案当主角',
          body: 'DOM 扫描留给老页面，新页面应该提供稳定、明确的能力。'
        }
      }
    },
    api: {
      title: 'API 文档',
      lead: '如果只是让 AI 填个表，前面几个 API 就够了。等你要接自己的 Agent、知识库和执行策略，再继续往下看。',
      searchLabel: '搜索 API',
      searchPlaceholder: '搜索 Enchant、useEnchantForm、Agent…',
      empty: '没找到。可能是名字输错了，也可能它还不是公开 API。',
      import: '怎么引入',
      signature: '它接收什么',
      example: '怎么用',
      responsibilities: '有几件事要说清楚',
      onThisPage: '快速跳转',
      quickStart: '先跑起来',
      quickStartBody: '整个应用安装一次 Forge。需要 AI 能力的页面区域，再用 Enchant 包起来。',
      install: '安装',
      sourceNote: '这里写的是 packages/vue 真正公开的能力。示例里那些业务操作很精彩，但它们不是核心库 API。',
      kinds: {
        component: '组件',
        composable: '组合式 API',
        factory: '工厂函数',
        interface: '接口',
        directive: '指令'
      },
      groups: {
        foundation: {
          title: '先跑起来',
          description: '安装一次运行时，再告诉框架页面的哪一块需要 AI。'
        },
        contribution: {
          title: '告诉 AI 页面有什么',
          description: '表单有哪些字段，页面能做哪些事，让组件自己说清楚。'
        },
        runtime: {
          title: '自己控制执行',
          description: '不想只用现成助手？可以自己获取上下文、调用 Agent、执行工具。'
        },
        agent: {
          title: '换成你自己的大脑',
          description: '内置 Agent 能直接用，也可以换成公司的模型网关或自研后端。'
        },
        knowledge: {
          title: '接入业务知识',
          description: '规则、手册和知识库不该硬塞进提示词，按需要检索就行。'
        },
        debug: {
          title: '出问题时别靠猜',
          description: '把框架看到了什么、调用了什么摆在页面上；老页面则用明确的兼容方案。'
        }
      },
      entries: {
        createEnchantForge: {
          description: '整个框架的总开关。Agent、知识库、安全规则和调试工具，都从这里接进来。',
          notes: ['大多数 Vue 应用创建一个就够了。', '可以直接连接 OpenAI-compatible API，也可以换成自己的 Agent。', '快照不会默认不停记录，调试也不例外。']
        },
        Enchant: {
          description: '给一块 Vue 页面划个范围：这块区域叫什么、里面有什么、能做什么。',
          notes: ['默认不扫描 DOM。', '可以交给 Aura，也可以只在当前组件里使用，或者完全不公开。', '这里的 prompt 只写这块页面自己的规则。']
        },
        Aura: {
          description: '现成的助手界面。用户在这里提要求、看执行进度、读结果，也可以随时取消或清空。',
          notes: ['默认使用 Forge 的 Agent，也可以单独指定另一个。', '业务代码可以主动让它提交、取消、清空或展开。', '具体要怎么回答、推荐问什么，由你的应用决定。']
        },
        useEnchantForm: {
          description: '把一个 Vue 表单 model 交给框架。字段说明和填表工具会自动准备好。',
          notes: ['它要放在 Enchant 里面。', '默认读取 model 的字段名，也可以给字段换成人能看懂的名字。', '它只负责填草稿，绝不会顺手帮你提交。']
        },
        useEnchantAction: {
          description: '把一个普通函数变成 AI 可以调用的工具，并把参数和影响范围说清楚。',
          notes: ['effect 告诉框架风险级别，但真正的业务权限仍由应用负责。', '函数还是你的，Core 只负责发现、校验参数和安排执行。', '组件卸载后，这个工具会自动消失。']
        },
        useEnchant: {
          description: '让业务组件主动使用当前区域的 AI 能力，不必等用户在聊天框里按发送。',
          notes: ['run 只会看到当前 Enchant 的内容。', '也可以拿到整理好的上下文和工具，交给自己的 Agent。', '实时语音转工单这类业务主动触发的场景，就用它。']
        },
        useEnchantForge: {
          description: '需要自己掌控全局时，用它直接访问 Forge：取上下文、跑 Agent、执行工具、查知识库。',
          notes: ['普通页面先用 Enchant、Aura 和 useEnchant，代码会少很多。', '上下文可以只取当前区域，也可以取整页或整个应用。', '直接执行工具也绕不过参数校验和安全规则。']
        },
        EnchantAgent: {
          description: '如果内置 Agent 不合适，就按这个接口接自己的。它决定调用哪些工具，也可以根据结果继续下一步。',
          notes: ['Agent 可以在后端，浏览器只需要一个客户端。', '不同页面可以通过 agentId 走不同的 Agent。', '提示词怎么写、业务流程怎么走，框架不替你做主。']
        },
        createLlmClient: {
          description: '连接 OpenAI-compatible chat completions API 的轻量客户端，function tools 可以直接用。',
          notes: ['默认请求 /api/llm/chat/completions，开发时可以交给 Vite 代理。', '超时、取消请求、自定义请求头和 fetch 都支持。', '生产环境不要把真正的 API Key 写进前端。']
        },
        knowledgeProviders: {
          description: '框架不替你选知识库，只规定“怎么查、返回什么”。本地规则和远程 RAG 都能接。',
          notes: ['静态 Provider 适合示例和测试，HTTP Provider 适合真正的检索服务。', '后端用 Elasticsearch、向量库还是混合检索，都不影响前端接口。', '接上知识库不等于 AI 会自动使用，应用仍要提供明确的查询工具。']
        },
        createEnchantDebug: {
          description: '把调试信息直接放在页面里。框架看到了什么、版本为什么变化、Agent 调了什么，不用靠猜。',
          notes: ['开了调试也不会默认疯狂记录快照。', '用 forge.use(createEnchantDebug()) 安装。', '生产环境要不要开，应用自己决定。']
        },
        directives: {
          description: '组件实在改不了，就在 DOM 上标出哪些能看、哪些别碰。这是给老页面留的后手。',
          notes: ['Enchant 还要同时设置 scan="marked" 或 scan="auto"。', '新代码优先用 useEnchantForm、useEnchantAction 或组件适配器。', '能扫描不代表应该扫描，稳定接口永远更可靠。']
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
