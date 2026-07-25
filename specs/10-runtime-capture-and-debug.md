# 10. 运行时 Capture、Snapshot 与 Debug

## 1. 基本模型

EnchantForge 将实时注册和模型上下文分开：

```text
EnchantRegistration
  -> mounted boundary, status, state source, capture function

Enchantment
  -> one capture result

Snapshot
  -> immutable collection used by one agent run or debug inspection
```

registry 保存 registration，不保存持续更新的 metadata tree。默认 Enchant mount 只注册边界和显式 contribution；只有配置 `scan="marked"` 或 `scan="auto"` 时，DOM scanner 才会在调用时运行。

## 2. 响应式 State

```vue
<Enchant :state="formState">
  <BusinessForm />
</Enchant>
```

`state` 支持普通对象、ref、computed 或 getter。Forge 保存 source；capture 时使用当前值。默认不 deep-watch state，也不因 state 更新创建 snapshot。

生命周期使用 `Enchantment.status`：alive、active、visible、enabled。应用状态使用 `Enchantment.state`。两者不能共用同一个字段。

## 3. 默认 Snapshot 策略

```ts
createEnchantForge({
  snapshots: {
    autoCapture: false,
    retention: 0,
    throttle: 120
  }
})
```

默认语义：

- Aura 常驻时只读取 registry digest；
- agent run 开始时生成临时 snapshot；
- 如果 registry 在 LLM 规划期间变化，Forge 会丢弃旧计划并重新 capture/replan 一次；
- executor 使用该临时 snapshot 和实时 registration status；
- 执行结束后不将 snapshot 保存到 history；
- trace 只记录 snapshot id、version 和数量摘要。

## 4. 自动捕获

用户可以明确启用：

```ts
createEnchantForge({
  snapshots: {
    autoCapture: true,
    retention: 20,
    throttle: 200
  }
})
```

自动观察只产生 invalidate 信号。Forge 对同一时间窗口内的变化进行 debounce，再统一 capture。snapshot history 使用固定容量 ring buffer。

规划完成后如果 registry 仍然变化，执行器继续拒绝 stale snapshot；重规划不是绕过执行前校验的方式。

## 5. Debug 插件

```ts
const forge = createEnchantForge()

forge.use(createEnchantDebug({
  snapshots: {
    retention: 30
  }
}))
```

显式 Enchant debug 插件可以提供 DOM observer、响应式 state watch、自动 capture 和 snapshot history 的配置入口，但默认不打开 `autoCapture`。不能因为浏览器安装了通用 Vue Devtools 或 debug overlay 就隐式开启这些成本；需要主动传入 `snapshots.autoCapture: true`。

Debug 插件同时提供轻量页面内调试控件，不依赖独立 Devtools 应用：

```ts
forge.use(createEnchantDebug({
  overlay: true,
  title: 'Enchant Debug'
}))
```

插件安装到 Vue app 后会自动在页面右下角显示 Debug 控件。点击后可以查看当前 digest、navigation、policy、snapshot、capability exporter 和 execution trace；`overlay: false` 只启用 snapshot 观察，不挂载页面控件。该控件是诊断入口，不参与 Aura 会话和业务执行。

## 6. 嵌套边界

父 Enchant 的 DOM scanner 遇到子 `[data-enchant]` 时停止向下采集。父 snapshot 通过 registration 父子关系表达层级，不复制子边界的字段和文字。

## 7. Aura

Aura orb 使用 digest 显示 active Enchantment 数量和运行状态。打开聊天面板也不自动生成完整 snapshot。以下操作才 capture：

- 用户提交自然语言操作；
- 应用调用 `forge.capture()`；
- debug inspector 请求当前上下文；
- 自动捕获配置生效。
