# @fe-observe/core

Lightweight frontend observability SDK for browser applications.

It provides a small core client plus optional plugins for:

- performance metrics
- runtime and resource errors
- request timing
- breadcrumbs
- white-screen detection
- long-task jank detection

## Install

```bash
npm install @fe-observe/core
```

For a public scoped package, publish with:

```bash
npm publish --access public
```

## Quick start

```ts
import {
  breadcrumbsPlugin,
  errorsPlugin,
  init,
  performancePlugin,
  requestPlugin
} from "@fe-observe/core";

const sdk = init({
  endpoint: "https://your-api.example.com/collect",
  app: {
    name: "web-app",
    release: "0.1.0",
    environment: "production"
  },
  breadcrumbs: {
    limit: 20
  },
  plugins: [
    performancePlugin(),
    requestPlugin({
      reportingEndpoint: "https://your-api.example.com/collect",
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

sdk.setExtra("region", "us-east-1");
```

## Manual error capture

```ts
sdk.captureException(new Error("Checkout failed"), {
  metadata: {
    feature: "checkout"
  }
});
```

## What gets reported

- `runtime_error`
- `resource_error`
- `performance_metric`
- `request_timing`
- `custom`

Every event includes:

- timestamp
- page context
- app context
- optional user context
- extra context
- recent breadcrumbs

## Build

```bash
npm run build --workspace @fe-observe/core
```

Build outputs:

- `dist/esm`
- `dist/cjs`
- `dist/types`

## Browser support notes

The core SDK targets modern browsers with `fetch`, `PerformanceObserver`, and DOM event APIs. Individual plugins degrade gracefully when a browser does not support a specific signal source such as long tasks or certain web vitals entries.

