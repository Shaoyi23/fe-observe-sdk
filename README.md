# fe-observe-sdk

A minimal frontend observability SDK monorepo focused on low overhead, strict TypeScript, and plugin-driven collection.

## Packages

- `packages/core`: browser SDK core with event modeling, batching transport, context capture, and built-in plugins
- `apps/demo`: Vite demo app with a mock `/collect` endpoint for local validation

## Quick start

```bash
npm install
npm run typecheck
npm run build
npm run dev:demo
```

Open the demo, click the buttons, and inspect the terminal logs from the Vite dev server to see collected batches.

## MVP scope

- SDK initialization with app metadata, user context, and extra context
- Typed event envelope for runtime errors, resource errors, performance metrics, request timing, and custom events
- Fetch transport with in-memory batching and lifecycle-triggered flush
- Plugin registration mechanism with small built-in browser plugins
- Demo app that exercises the main signals

## Performance plugin

`performancePlugin()` reports these normalized metrics through the shared `performance_metric` event:

- `fcp`: first contentful paint, in milliseconds
- `lcp`: largest contentful paint, in milliseconds
- `cls`: cumulative layout shift, as a score
- `inp`: interaction to next paint, in milliseconds
- `ttfb`: time to first byte, in milliseconds

Usage:

```ts
import { init, performancePlugin } from "@fe-observe/core";

const sdk = init({
  endpoint: "/collect",
  plugins: [performancePlugin()]
});
```

The plugin is passive and observer-based. It uses buffered `PerformanceObserver` entries where available and reports final page-level metrics through the normal SDK batching pipeline.

## Error plugin

`errorsPlugin()` captures:

- `window.onerror` runtime errors
- `unhandledrejection` promise failures
- resource loading failures for elements like `img`, `script`, and `link`
- manual exceptions through `sdk.captureException(error, options)`

Usage:

```ts
import { errorsPlugin, init } from "@fe-observe/core";

const sdk = init({
  endpoint: "/collect",
  plugins: [
    errorsPlugin({
      captureWindowError: true,
      captureUnhandledRejection: true,
      captureResourceError: true
    })
  ]
});

sdk.captureException(new Error("checkout failed"), {
  metadata: {
    feature: "checkout"
  }
});
```

Set `enabled: false` or disable individual capture flags to turn the plugin off without removing it from the integration path.

## Request plugin

`requestPlugin()` captures request timing for both `fetch` and `XMLHttpRequest` without changing their observable behavior.

- method
- absolute url
- status
- duration
- success state

Usage:

```ts
import { init, requestPlugin } from "@fe-observe/core";

const sdk = init({
  endpoint: "/collect",
  plugins: [
    requestPlugin({
      reportingEndpoint: "/collect",
      ignoreReportingEndpoint: true,
      ignoreStaticResources: true,
      ignore: [/\/health$/, "/assets/internal"]
    })
  ]
});
```

Notes:

- `captureFetch` and `captureXhr` can be disabled independently
- `ignoreReportingEndpoint` helps avoid self-reporting the SDK delivery endpoint
- `ignoreStaticResources` is optional and skips common asset file extensions when enabled
- `fetchPlugin()` remains available as a compatibility alias for fetch-only monitoring

## White-screen plugin

`whiteScreenPlugin()` provides an optional, low-cost heuristic for detecting likely blank-page failures.

Chosen method:

- wait until after page load, then delay a little more so normal rendering has time to settle
- run detection in idle time where possible
- sample several viewport points with `document.elementFromPoint()`
- treat the page as suspicious only when most sample points hit `html`, `body`, or configured app-root containers
- require the page to also have very little visible text or media content

Usage:

```ts
import { init, whiteScreenPlugin } from "@fe-observe/core";

const sdk = init({
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

False-positive controls:

- delayed execution after load instead of checking during the initial render path
- idle scheduling to avoid adding pressure during page startup
- dual-condition heuristic: blank point sampling alone is not enough; the page must also lack meaningful text/media
- configurable root selectors and thresholds for apps with custom shells

Tradeoffs:

- this is heuristic detection, not screenshot-level certainty
- sparse but valid UIs can still look blank if thresholds are too aggressive
- apps with skeleton screens or canvas-only rendering may need custom tuning or should disable the plugin
- it reports a normalized `custom` event named `white_screen_detected` rather than trying to infer a richer failure cause

## Long-task plugin

`longTaskPlugin()` detects main-thread jank using the browser `PerformanceObserver` `longtask` entry type.

What it captures:

- optional per-entry `custom` events named `long_task`
- an aggregated `custom` event named `long_task_summary`

Summary fields:

- `long_task_count`
- `total_duration`
- `total_blocking_time`
- `max_duration`
- `avg_duration`

Usage:

```ts
import { init, longTaskPlugin } from "@fe-observe/core";

const sdk = init({
  endpoint: "/collect",
  plugins: [
    longTaskPlugin({
      reportEntries: false
    })
  ]
});
```

Compatibility and limitations:

- this relies on `PerformanceObserver` support for the `longtask` entry type
- in practice, support is strongest in Chromium-based browsers and not universal across all engines
- if the browser does not support long-task entries, the plugin becomes a no-op
- long-task data is a main-thread symptom signal; it tells you that blocking happened, not which application function caused it
- attribution details are intentionally omitted in this MVP because they are limited and inconsistent across environments

## Breadcrumbs

Breadcrumbs provide a bounded recent-activity trail that gets attached to error events through `event.context.breadcrumbs`.

Sources:

- clicks through `breadcrumbsPlugin()`
- route changes through `breadcrumbsPlugin()`
- network events through `requestPlugin({ breadcrumb: true })`
- errors through `errorsPlugin({ breadcrumb: true })` and `sdk.captureException()`

Usage:

```ts
import { breadcrumbsPlugin, errorsPlugin, init, requestPlugin } from "@fe-observe/core";

const sdk = init({
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

Safety and privacy choices:

- the breadcrumb buffer is bounded and drops the oldest items first
- click breadcrumbs record only a lightweight element label like tag, id, role, or `data-testid`
- text inputs, textareas, and contenteditable nodes do not contribute captured text
- route and network breadcrumbs strip query strings and keep only origin plus pathname

Tradeoff:

- breadcrumbs are intentionally low-detail, so they are best for sequence reconstruction rather than full replay

## Repository layout

```text
.
├── apps/demo
├── docs/architecture.md
└── packages/core
```
