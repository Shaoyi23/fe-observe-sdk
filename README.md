# fe-observe-sdk

English | [简体中文](./README.zh-CN.md)

A lightweight frontend observability SDK monorepo for web applications, focused on low runtime overhead, strict TypeScript, plugin-based collection, and clean event modeling.

## Packages

- `packages/core`: the browser SDK core package with event modeling, context capture, batching transport, and built-in plugins
- `apps/demo`: a Vite demo app with a local `/collect` mock endpoint for validation

## Quick Start

```bash
npm install
npm run typecheck
npm run build
npm run dev:demo
```

Open the demo page, trigger the demo actions, and inspect the Vite dev server logs to see batched reports.

## Current MVP Scope

- SDK initialization with app, user, and extra context
- a shared typed event model
- runtime error, resource error, performance, request timing, and custom event collection
- a plugin-based extension mechanism
- batching transport for delivery
- a demo app for local validation

## Install and Basic Usage

```bash
npm install @compass/fe-observe-sdk
```

```ts
import {
  breadcrumbsPlugin,
  errorsPlugin,
  init,
  performancePlugin,
  requestPlugin
} from "@compass/fe-observe-sdk";

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

Manual error reporting is available through `sdk.captureException()`.

```ts
sdk.captureException(new Error("Checkout failed"), {
  metadata: {
    feature: "checkout"
  }
});
```

## Plugin Overview

### 1. Performance Plugin

`performancePlugin()` reports `fcp`, `lcp`, `cls`, `inp`, and `ttfb` through the shared `performance_metric` event.

```ts
import { init, performancePlugin } from "@compass/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [performancePlugin()]
});
```

### 2. Error Plugin

`errorsPlugin()` captures `window.onerror`, `unhandledrejection`, resource loading failures, and manual errors through `sdk.captureException()`.

```ts
import { errorsPlugin, init } from "@compass/fe-observe-sdk";

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

### 3. Request Plugin

`requestPlugin()` instruments `fetch` and `XMLHttpRequest` without breaking original behavior, collecting method, url, status, duration, and success state.

```ts
import { init, requestPlugin } from "@compass/fe-observe-sdk";

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

### 4. White-screen Plugin

`whiteScreenPlugin()` uses a lightweight heuristic to detect likely blank pages, optimized for low overhead and optional adoption.

```ts
import { init, whiteScreenPlugin } from "@compass/fe-observe-sdk";

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

### 5. Long-task Plugin

`longTaskPlugin()` uses browser `longtask` entries from `PerformanceObserver` to detect main-thread jank, with optional per-entry reporting and summary aggregation.

```ts
import { init, longTaskPlugin } from "@compass/fe-observe-sdk";

init({
  endpoint: "/collect",
  plugins: [
    longTaskPlugin({
      reportEntries: false
    })
  ]
});
```

### 6. Breadcrumbs

Breadcrumbs capture a lightweight debugging trail for clicks, route changes, network events, and errors, and are automatically attached to later error events through `event.context.breadcrumbs`.

```ts
import { breadcrumbsPlugin, errorsPlugin, init, requestPlugin } from "@compass/fe-observe-sdk";

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

## Compatibility Notes

- The SDK targets modern browsers with `fetch`, DOM events, and `PerformanceObserver`
- Some plugins depend on browser support, such as `longtask` and certain web vitals entries
- Unsupported capabilities degrade to no-op behavior instead of throwing

## Repository Layout

```text
.
├── apps/demo
├── docs/architecture.md
└── packages/core
```
