# fe-observe-sdk

中文：一个面向 Web 应用的轻量级前端可观测性 SDK Monorepo，强调低运行时开销、严格 TypeScript、插件化采集和清晰事件模型。  
English: A lightweight frontend observability SDK monorepo for web applications, focused on low runtime overhead, strict TypeScript, plugin-based collection, and clean event modeling.

## 项目结构 / Packages

中文：
- `packages/core`：浏览器 SDK 核心包，包含事件模型、上下文采集、批量传输和内置插件
- `apps/demo`：Vite 演示应用，提供本地 `/collect` mock 接口用于验证

English:
- `packages/core`: the browser SDK core package with event modeling, context capture, batching transport, and built-in plugins
- `apps/demo`: a Vite demo app with a local `/collect` mock endpoint for validation

## 快速开始 / Quick Start

```bash
npm install
npm run typecheck
npm run build
npm run dev:demo
```

中文：启动后打开 demo 页面，点击不同按钮，并查看 Vite dev server 日志以观察批量上报结果。  
English: Open the demo page, trigger the demo actions, and inspect the Vite dev server logs to see batched reports.

## 当前 MVP 能力 / Current MVP Scope

中文：
- SDK 初始化，支持 app、user、extra 上下文
- 统一的类型化事件模型
- 运行时错误、资源错误、性能指标、请求耗时、自定义事件采集
- 基于插件的扩展机制
- 带批量发送能力的 transport
- demo 应用用于本地验证

English:
- SDK initialization with app, user, and extra context
- a shared typed event model
- runtime error, resource error, performance, request timing, and custom event collection
- a plugin-based extension mechanism
- batching transport for delivery
- a demo app for local validation

## 安装与基础用法 / Install and Basic Usage

```bash
npm install @yachongshao/fe-observe-sdk
```

```ts
import {
  breadcrumbsPlugin,
  errorsPlugin,
  init,
  performancePlugin,
  requestPlugin
} from "@yachongshao/fe-observe-sdk";

const sdk = init({
  endpoint: "/collect",
  breadcrumbs: {
    limit: 20
  },
  plugins: [
    performancePlugin(),
    requestPlugin({
      reportingEndpoint: "/collect",
      ignoreReportingEndpoint: true,
      breadcrumb: true
    }),
    errorsPlugin({
      breadcrumb: true
    }),
    breadcrumbsPlugin()
  ]
});

sdk.setUser({
  id: "user-123"
});

sdk.setExtra("region", "cn-hz");
```

中文：手动错误上报可通过 `sdk.captureException()` 完成。  
English: Manual error reporting is available through `sdk.captureException()`.

```ts
sdk.captureException(new Error("Checkout failed"), {
  metadata: {
    feature: "checkout"
  }
});
```

## 插件能力概览 / Plugin Overview

### 1. 性能插件 / Performance Plugin

中文：`performancePlugin()` 会通过共享的 `performance_metric` 事件上报 `fcp`、`lcp`、`cls`、`inp`、`ttfb`。  
English: `performancePlugin()` reports `fcp`, `lcp`, `cls`, `inp`, and `ttfb` through the shared `performance_metric` event.

```ts
import { init, performancePlugin } from "@yachongshao/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [performancePlugin()]
});
```

### 2. 错误插件 / Error Plugin

中文：`errorsPlugin()` 支持捕获 `window.onerror`、`unhandledrejection`、资源加载错误，以及通过 `sdk.captureException()` 进行手动上报。  
English: `errorsPlugin()` captures `window.onerror`, `unhandledrejection`, resource loading failures, and manual errors through `sdk.captureException()`.

```ts
import { errorsPlugin, init } from "@yachongshao/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [
    errorsPlugin({
      captureWindowError: true,
      captureUnhandledRejection: true,
      captureResourceError: true,
      breadcrumb: true
    })
  ]
});
```

### 3. 请求插件 / Request Plugin

中文：`requestPlugin()` 会在不破坏原始行为的前提下采集 `fetch` 和 `XMLHttpRequest` 的 method、url、status、duration、success。  
English: `requestPlugin()` instruments `fetch` and `XMLHttpRequest` without breaking original behavior, collecting method, url, status, duration, and success state.

```ts
import { init, requestPlugin } from "@yachongshao/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [
    requestPlugin({
      reportingEndpoint: "/collect",
      ignoreReportingEndpoint: true,
      ignoreStaticResources: true,
      ignore: [/\/health$/, "/assets/internal"],
      breadcrumb: true
    })
  ]
});
```

### 4. 白屏检测插件 / White-screen Plugin

中文：`whiteScreenPlugin()` 使用轻量级启发式策略检测疑似白屏，默认强调低开销和可选启用。  
English: `whiteScreenPlugin()` uses a lightweight heuristic to detect likely blank pages, optimized for low overhead and optional adoption.

```ts
import { init, whiteScreenPlugin } from "@yachongshao/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [
    whiteScreenPlugin({
      enabled: true,
      delayMs: 3000,
      rootSelectors: ["#app", "#root"]
    })
  ]
});
```

### 5. 长任务卡顿插件 / Long-task Plugin

中文：`longTaskPlugin()` 基于浏览器 `PerformanceObserver` 的 `longtask` 条目采集主线程卡顿信息，可选上报单条 long task，并汇总统计。  
English: `longTaskPlugin()` uses browser `longtask` entries from `PerformanceObserver` to detect main-thread jank, with optional per-entry reporting and summary aggregation.

```ts
import { init, longTaskPlugin } from "@yachongshao/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [
    longTaskPlugin({
      reportEntries: false
    })
  ]
});
```

### 6. 面包屑插件 / Breadcrumbs

中文：面包屑用于调试错误前的用户行为链路，支持点击、路由变化、网络事件和错误事件，并通过 `event.context.breadcrumbs` 自动附加到后续错误事件上。  
English: Breadcrumbs capture a lightweight debugging trail for clicks, route changes, network events, and errors, and are automatically attached to later error events through `event.context.breadcrumbs`.

```ts
import { breadcrumbsPlugin, errorsPlugin, init, requestPlugin } from "@yachongshao/fe-observe-sdk";

init({
  endpoint: "/collect",
  breadcrumbs: {
    limit: 20
  },
  plugins: [
    breadcrumbsPlugin(),
    requestPlugin({ breadcrumb: true }),
    errorsPlugin({ breadcrumb: true })
  ]
});
```

## 兼容性与说明 / Compatibility Notes

中文：
- SDK 面向现代浏览器，依赖 `fetch`、DOM 事件、`PerformanceObserver` 等能力
- 某些插件能力依赖浏览器实现，例如 `longtask`、部分 Web Vitals 条目
- 不支持的场景会自动降级为 no-op，而不是抛出错误

English:
- The SDK targets modern browsers with `fetch`, DOM events, and `PerformanceObserver`
- Some plugins depend on browser support, such as `longtask` and certain web vitals entries
- Unsupported capabilities degrade to no-op behavior instead of throwing

## 仓库布局 / Repository Layout

```text
.
├── apps/demo
├── docs/architecture.md
└── packages/core
```
