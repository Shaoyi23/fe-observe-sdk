# fe-observe-sdk

[English](./README.md) | 简体中文

一个面向 Web 应用的轻量级前端可观测性 SDK Monorepo，强调低运行时开销、严格 TypeScript、插件化采集和清晰事件模型。

## 项目结构

- `packages/core`：浏览器 SDK 核心包，包含事件模型、上下文采集、批量传输和内置插件
- `apps/demo`：Vite 演示应用，提供本地 `/collect` mock 接口用于验证

## 快速开始

```bash
npm install
npm run typecheck
npm run build
npm run dev:demo
```

启动后打开 demo 页面，点击不同按钮，并查看 Vite dev server 日志以观察批量上报结果。

## 当前 MVP 能力

- SDK 初始化，支持 app、user、extra 上下文
- 统一的类型化事件模型
- 运行时错误、资源错误、性能指标、请求耗时、自定义事件采集
- 基于插件的扩展机制
- 带批量发送能力的 transport
- demo 应用用于本地验证

## 安装与基础用法

```bash
npm install compass-fe-observe-sdk
```

```ts
import {
  breadcrumbsPlugin,
  errorsPlugin,
  init,
  performancePlugin,
  requestPlugin
} from "compass-fe-observe-sdk";

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

手动错误上报可通过 `sdk.captureException()` 完成。

```ts
sdk.captureException(new Error("Checkout failed"), {
  metadata: {
    feature: "checkout"
  }
});
```

## 插件能力概览

### 1. 性能插件

`performancePlugin()` 会通过共享的 `performance_metric` 事件上报 `fcp`、`lcp`、`cls`、`inp`、`ttfb`。

```ts
import { init, performancePlugin } from "compass-fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [performancePlugin()]
});
```

### 2. 错误插件

`errorsPlugin()` 支持捕获 `window.onerror`、`unhandledrejection`、资源加载错误，以及通过 `sdk.captureException()` 进行手动上报。

```ts
import { errorsPlugin, init } from "compass-fe-observe-sdk";

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

### 3. 请求插件

`requestPlugin()` 会在不破坏原始行为的前提下采集 `fetch` 和 `XMLHttpRequest` 的 method、url、status、duration、success。

```ts
import { init, requestPlugin } from "compass-fe-observe-sdk";

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

### 4. 白屏检测插件

`whiteScreenPlugin()` 使用轻量级启发式策略检测疑似白屏，默认强调低开销和可选启用。

```ts
import { init, whiteScreenPlugin } from "compass-fe-observe-sdk";

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

### 5. 长任务卡顿插件

`longTaskPlugin()` 基于浏览器 `PerformanceObserver` 的 `longtask` 条目采集主线程卡顿信息，可选上报单条 long task，并汇总统计。

```ts
import { init, longTaskPlugin } from "compass-fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [
    longTaskPlugin({
      reportEntries: false
    })
  ]
});
```

### 6. 面包屑

面包屑用于调试错误前的用户行为链路，支持点击、路由变化、网络事件和错误事件，并通过 `event.context.breadcrumbs` 自动附加到后续错误事件上。

```ts
import { breadcrumbsPlugin, errorsPlugin, init, requestPlugin } from "compass-fe-observe-sdk";

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

## 兼容性说明

- SDK 面向现代浏览器，依赖 `fetch`、DOM 事件、`PerformanceObserver` 等能力
- 某些插件能力依赖浏览器实现，例如 `longtask`、部分 Web Vitals 条目
- 不支持的场景会自动降级为 no-op，而不是抛出错误

## 仓库布局

```text
.
├── apps/demo
├── docs/architecture.md
└── packages/core
```
