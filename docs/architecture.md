# Architecture

## Minimal plan

The monorepo starts with one production package and one validation app:

- `packages/core` owns the browser SDK runtime
- `apps/demo` validates integration and provides a local collector endpoint

This keeps the first MVP small while preserving room for future packages like framework bindings or additional plugins.

## Core package structure

- `src/types.ts`: strict shared contracts for events, context, transport, plugins, and SDK options
- `src/context.ts`: lightweight page and app context snapshot collection
- `src/transport.ts`: transport abstraction plus fetch implementation
- `src/batcher.ts`: queueing, flush interval management, and lifecycle flush hooks
- `src/plugins.ts`: first built-in browser plugins
- `src/sdk.ts`: public SDK initialization and plugin wiring

## Event model

Each emitted event shares the same shape:

- `type`: stable event discriminator
- `timestamp`: emission time in epoch milliseconds
- `context`: current page metadata, app metadata, custom tags, and recent breadcrumbs
- `payload`: event-specific typed data

This keeps ingestion simple on the backend while allowing future plugin-specific payloads to remain strongly typed.

## Plugin model

Plugins receive a small setup API:

- `report(event)`: emit a typed event
- `setUser(user)`: update the current user context
- `setExtra(key, value)`: enrich shared context

Plugins return an optional cleanup function so the SDK can detach listeners cleanly.

## Runtime flow

1. `init()` builds the context store, transport, and batcher.
2. Registered plugins subscribe to browser APIs and emit typed events.
3. The SDK enriches every event with a fresh context snapshot.
4. The batcher flushes on size, interval, or page lifecycle changes.
5. The transport posts `{ events }` to the configured endpoint.

## Performance metrics

The built-in performance plugin is self-contained and emits normalized `performance_metric` events:

- `fcp`: when the first content is painted
- `lcp`: when the largest visible content element is painted
- `cls`: accumulated unexpected layout movement during the page lifecycle
- `inp`: the slowest observed interaction latency for the page
- `ttfb`: the server/network delay until the first byte of the main document response

Implementation notes:

- uses `PerformanceObserver` with buffered entries to avoid polling and minimize startup work
- reports `ttfb` from the navigation timing entry immediately when available
- defers final `lcp`, `cls`, and `inp` emission until `visibilitychange` or `pagehide`, which matches how these page-level metrics stabilize

## Error monitoring

The built-in error plugin normalizes runtime failures into shared `runtime_error` and `resource_error` events.

- `window.onerror` captures uncaught synchronous errors with source location when available
- `unhandledrejection` captures rejected promises that escape application handling
- resource errors capture failing asset URLs and element metadata
- `captureException()` gives application code a manual path into the same runtime error schema

Implementation notes:

- runtime errors include normalized message, stack, source location, mechanism, handled state, and optional metadata
- the plugin keeps a short-lived in-memory dedupe cache to reduce double reporting of the same error across browser surfaces
- config flags allow disabling all automatic capture or specific listeners independently

## Request monitoring

The built-in request plugin instruments both `fetch` and `XMLHttpRequest` and emits normalized `request_timing` events.

- wraps native APIs and forwards the original arguments unchanged
- records method, resolved url, status, duration, and success state
- supports ignore rules for observability endpoints and optional static-resource filtering

Implementation notes:

- `fetch` instrumentation delegates to the original `window.fetch` and restores it on destroy
- `XMLHttpRequest` instrumentation patches `open` and `send`, stores lightweight per-instance metadata, and restores the original prototype methods on destroy
- ignore rules accept substring matches, regular expressions, or predicate functions

## White-screen detection

The white-screen feature is implemented as an optional plugin so applications can opt in only where the heuristic is useful.

Detection strategy:

- wait for the page `load` event
- delay detection by a configurable timeout to avoid startup noise
- run the check in idle time when possible
- sample multiple viewport points with `elementFromPoint()`
- count a point as blank when it resolves to `html`, `body`, or a configured root container
- only report when the blank-point ratio is high and the document also lacks meaningful text or media

Why this approach:

- much cheaper than DOM serialization or screenshot analysis
- works in most browsers without extra dependencies
- keeps false positives under better control than checking only for an empty root node

Tradeoffs:

- cannot perfectly distinguish a broken blank page from an intentionally sparse layout
- may under-report apps that render only through canvas or delayed client hydration
- reports a symptom signal, not the root cause, so it is most useful when combined with error and request telemetry

## Long-task jank detection

The long-task plugin is an optional observer-based signal for main-thread jank.

Detection strategy:

- subscribe to the `longtask` performance entry type through `PerformanceObserver`
- treat each entry as a blocking episode on the main thread
- optionally emit per-entry `custom` events
- aggregate summary statistics and emit a final `long_task_summary` event on `visibilitychange` or `pagehide`

Aggregated statistics:

- task count
- total long-task duration
- total blocking time using `max(duration - 50ms, 0)`
- max duration
- average duration

Compatibility and limitations:

- `longtask` support is not universal and is most reliable in Chromium-family browsers
- browsers without the entry type simply skip collection
- long tasks show that jank occurred, but do not fully explain the source of the blocking work
- cross-origin or deeper attribution data is intentionally out of scope for this MVP to keep the plugin small and predictable

## Breadcrumb collection

Breadcrumbs are stored in a bounded in-memory ring buffer inside the shared context store and are attached automatically to subsequent events through `context.breadcrumbs`.

Collection model:

- `breadcrumbsPlugin()` captures click and route breadcrumbs
- `requestPlugin({ breadcrumb: true })` records lightweight network breadcrumbs
- `errorsPlugin({ breadcrumb: true })` and `captureException()` record error breadcrumbs

Privacy and false-signal controls:

- click capture records only a sanitized element label rather than arbitrary DOM text
- input-like elements are treated as sensitive and do not expose typed content
- route and request breadcrumbs drop query strings to reduce accidental capture of identifiers or tokens
- the buffer limit is configurable and defaults to a small size so memory and payload growth stay bounded

## Next extension points

- add `XMLHttpRequest` instrumentation beside `fetch`
- introduce sampling and event filtering
- split plugins into separate packages if bundle pressure grows
- add retry or offline queueing when backend requirements are clearer
