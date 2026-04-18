import type {
  BreadcrumbPluginOptions,
  ErrorPluginOptions,
  LongTaskPluginOptions,
  ObservePlugin,
  ObservePluginSetup,
  PerformanceMetricPayload,
  RequestPluginOptions,
  RequestTimingPayload,
  RequestIgnoreMatcher,
  ResourceErrorPayload,
  RuntimeErrorPayload,
  WhiteScreenPluginOptions
} from "./types";

function isResourceTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && ["IMG", "SCRIPT", "LINK", "VIDEO", "AUDIO"].includes(target.tagName);
}

function getResourceUrl(target: HTMLElement): string {
  if ("currentSrc" in target && typeof target.currentSrc === "string") {
    return target.currentSrc;
  }

  const src = target.getAttribute("src");
  if (src) {
    return src;
  }

  return target.getAttribute("href") ?? "";
}

function withOptionalString(key: string, value: string | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: value };
}

function withOptionalNumber(key: string, value: number | undefined): Record<string, number> {
  return value === undefined ? {} : { [key]: value };
}

function getErrorSignature(payload: RuntimeErrorPayload): string {
  return [
    payload.mechanism ?? "",
    payload.name ?? "",
    payload.message,
    payload.stack ?? "",
    payload.source ?? "",
    String(payload.line ?? ""),
    String(payload.column ?? "")
  ].join("|");
}

function shouldSkipDuplicate(
  recentSignatures: Map<string, number>,
  signature: string,
  timestamp: number,
  ttlMs: number
): boolean {
  const lastSeen = recentSignatures.get(signature);
  recentSignatures.set(signature, timestamp);

  for (const [key, value] of recentSignatures) {
    if (timestamp - value > ttlMs) {
      recentSignatures.delete(key);
    }
  }

  return lastSeen !== undefined && timestamp - lastSeen < ttlMs;
}

function getUnknownErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function sanitizeUrlForBreadcrumb(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function getSafeClickLabel(target: HTMLElement): string {
  const tagName = target.tagName.toLowerCase();
  const id = target.id ? `#${target.id}` : "";
  const role = target.getAttribute("role");
  const roleLabel = role ? `[role=${role}]` : "";
  const testId = target.getAttribute("data-testid");
  const testIdLabel = testId ? `[data-testid=${truncate(testId, 24)}]` : "";

  const isSensitive =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable;

  const text =
    !isSensitive && (tagName === "button" || tagName === "a")
      ? truncate(target.innerText.replace(/\s+/g, " ").trim(), 40)
      : "";

  return [tagName, id, roleLabel, testIdLabel, text].filter(Boolean).join("");
}

function addErrorBreadcrumb(api: ObservePluginSetup, message: string): void {
  api.addBreadcrumb({
    type: "error",
    message: truncate(message, 120)
  });
}

function addNetworkBreadcrumb(
  api: ObservePluginSetup,
  method: string,
  url: string,
  ok: boolean,
  status?: number
): void {
  api.addBreadcrumb({
    type: "http",
    message: `${normalizeRequestMethod(method)} ${sanitizeUrlForBreadcrumb(url)}`,
    data: {
      ok,
      ...(status === undefined ? {} : { status })
    }
  });
}

function addRouteBreadcrumb(api: ObservePluginSetup, url: string): void {
  api.addBreadcrumb({
    type: "navigation",
    message: sanitizeUrlForBreadcrumb(url)
  });
}

export function toRuntimeErrorPayload(
  error: unknown,
  metadata: Partial<RuntimeErrorPayload> = {}
): RuntimeErrorPayload {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...withOptionalString("stack", error.stack),
      ...metadata
    };
  }

  return {
    message: getUnknownErrorMessage(error),
    ...metadata
  };
}

export function errorsPlugin(options: ErrorPluginOptions = {}): ObservePlugin {
  return {
    name: "errors",
    setup(api: ObservePluginSetup) {
      if (options.enabled === false) {
        return;
      }

      const recentSignatures = new Map<string, number>();
      const recentErrorObjects = new WeakSet<Error>();
      const duplicateTtlMs = 1000;

      const emitRuntimeError = (payload: RuntimeErrorPayload, originalError?: Error) => {
        if (originalError && recentErrorObjects.has(originalError)) {
          return;
        }

        const now = Date.now();
        const signature = getErrorSignature(payload);
        if (shouldSkipDuplicate(recentSignatures, signature, now, duplicateTtlMs)) {
          return;
        }

        if (originalError) {
          recentErrorObjects.add(originalError);
        }

        if (options.breadcrumb) {
          addErrorBreadcrumb(api, payload.message);
        }

        api.report({
          type: "runtime_error",
          payload
        });
      };

      const onError = (event: ErrorEvent) => {
        if (isResourceTarget(event.target)) {
          if (options.captureResourceError === false) {
            return;
          }

          const resourcePayload: ResourceErrorPayload = {
            tagName: event.target.tagName.toLowerCase(),
            url: getResourceUrl(event.target),
            html: event.target.outerHTML.slice(0, 200)
          };

          if (options.breadcrumb) {
            addErrorBreadcrumb(api, `${resourcePayload.tagName} ${sanitizeUrlForBreadcrumb(resourcePayload.url)}`);
          }

          api.report({
            type: "resource_error",
            payload: resourcePayload
          });
          return;
        }

        if (options.captureWindowError === false) {
          return;
        }

        const originalError = event.error instanceof Error ? event.error : undefined;
        const payload = toRuntimeErrorPayload(originalError ?? event.message, {
          ...withOptionalString("source", event.filename || undefined),
          ...withOptionalNumber("line", event.lineno || undefined),
          ...withOptionalNumber("column", event.colno || undefined),
          handled: false,
          mechanism: "onerror"
        });

        emitRuntimeError(payload, originalError);
      };

      const onUnhandledRejection = (event: PromiseRejectionEvent) => {
        if (options.captureUnhandledRejection === false) {
          return;
        }

        const originalError = event.reason instanceof Error ? event.reason : undefined;
        const payload = toRuntimeErrorPayload(event.reason, {
          handled: false,
          mechanism: "unhandledrejection"
        });
        emitRuntimeError(payload, originalError);
      };

      if (options.captureWindowError !== false || options.captureResourceError !== false) {
        window.addEventListener("error", onError, true);
      }
      if (options.captureUnhandledRejection !== false) {
        window.addEventListener("unhandledrejection", onUnhandledRejection);
      }

      return () => {
        window.removeEventListener("error", onError, true);
        window.removeEventListener("unhandledrejection", onUnhandledRejection);
      };
    }
  };
}

function reportMetric(api: ObservePluginSetup, metric: PerformanceMetricPayload): void {
  api.report({
    type: "performance_metric",
    payload: metric
  });
}

type SupportedMetricName = "fcp" | "lcp" | "cls" | "inp" | "ttfb";

function reportPerformanceMetric(
  api: ObservePluginSetup,
  name: SupportedMetricName,
  value: number,
  unit: PerformanceMetricPayload["unit"]
): void {
  reportMetric(api, {
    name,
    value,
    unit
  });
}

function onHidden(callback: () => void): () => void {
  const run = () => {
    if (document.visibilityState === "hidden") {
      callback();
    }
  };

  document.addEventListener("visibilitychange", run, true);
  window.addEventListener("pagehide", run, true);

  return () => {
    document.removeEventListener("visibilitychange", run, true);
    window.removeEventListener("pagehide", run, true);
  };
}

function observePerformanceEntries<TEntry extends PerformanceEntry>(
  type: string,
  callback: (entries: readonly TEntry[]) => void
): PerformanceObserver | undefined {
  if (typeof PerformanceObserver === "undefined") {
    return undefined;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries() as TEntry[]);
    });
    observer.observe({ type, buffered: true });
    return observer;
  } catch {
    return undefined;
  }
}

function roundMetricValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeRequestMethod(method: string | undefined): string {
  return (method ?? "GET").toUpperCase();
}

function resolveUrl(url: string): string {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

function isStaticResourceUrl(url: string): boolean {
  return /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|map)(?:[?#].*)?$/i.test(url);
}

function matchesIgnoreRule(url: string, rule: RequestIgnoreMatcher): boolean {
  if (typeof rule === "string") {
    return url.includes(rule);
  }

  if (rule instanceof RegExp) {
    return rule.test(url);
  }

  return rule(url);
}

function shouldIgnoreRequest(url: string, options: RequestPluginOptions): boolean {
  if (options.ignoreReportingEndpoint !== false && options.reportingEndpoint) {
    const reportingEndpoint = resolveUrl(options.reportingEndpoint);
    if (url === reportingEndpoint) {
      return true;
    }
  }

  if (options.ignoreStaticResources && isStaticResourceUrl(url)) {
    return true;
  }

  for (const rule of options.ignore ?? []) {
    if (matchesIgnoreRule(url, rule)) {
      return true;
    }
  }

  return false;
}

function reportRequestTiming(
  api: ObservePluginSetup,
  method: string,
  url: string,
  duration: number,
  ok: boolean,
  status?: number
): void {
  const payload: RequestTimingPayload = {
    method: normalizeRequestMethod(method),
    url,
    duration: Math.round(duration),
    ok,
    ...withOptionalNumber("status", status)
  };

  api.report({
    type: "request_timing",
    payload
  });
}

function isVisibleElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true;
  }

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function hasMeaningfulVisualContent(minTextLength: number): boolean {
  const body = document.body;
  if (!body) {
    return false;
  }

  const text = body.innerText.replace(/\s+/g, " ").trim();
  if (text.length >= minTextLength) {
    return true;
  }

  return body.querySelector("img,svg,video,canvas,picture") !== null;
}

function isBlankCandidate(element: Element, rootSelectors: readonly string[]): boolean {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "html" || tagName === "body") {
    return true;
  }

  return rootSelectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function getDefaultSamplePoints(): ReadonlyArray<readonly [number, number]> {
  return [
    [0.5, 0.3],
    [0.2, 0.3],
    [0.8, 0.3],
    [0.5, 0.5],
    [0.2, 0.5],
    [0.8, 0.5],
    [0.5, 0.7],
    [0.2, 0.7],
    [0.8, 0.7]
  ];
}

function runWhenIdle(callback: () => void, delayMs: number): () => void {
  let timeoutId: number | undefined;
  let idleId: number | undefined;
  const idleWindow = window as Window &
    Partial<{
      requestIdleCallback: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback: (handle: number) => void;
    }>;

  const schedule = () => {
    const run = () => {
      callback();
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      idleId = idleWindow.requestIdleCallback(run, { timeout: 1000 });
      return;
    }

    timeoutId = window.setTimeout(run, 0);
  };

  timeoutId = window.setTimeout(schedule, delayMs);

  return () => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    if (idleId !== undefined && typeof idleWindow.cancelIdleCallback === "function") {
      idleWindow.cancelIdleCallback(idleId);
    }
  };
}

function reportCustomEvent(api: ObservePluginSetup, name: string, data: Record<string, number | string | boolean>): void {
  api.report({
    type: "custom",
    payload: {
      name,
      data
    }
  });
}

export function performancePlugin(): ObservePlugin {
  return {
    name: "performance",
    setup(api: ObservePluginSetup) {
      const cleanups: Array<() => void> = [];
      let didReportFcp = false;
      let latestLcp = 0;
      let clsValue = 0;
      let didReportCls = false;
      let maxInp = 0;
      let didReportInp = false;

      const navigationEntry = performance.getEntriesByType("navigation")[0];
      if (navigationEntry instanceof PerformanceNavigationTiming) {
        reportPerformanceMetric(api, "ttfb", roundMetricValue(navigationEntry.responseStart), "ms");
      }

      const paintObserver = observePerformanceEntries<PerformanceEntry>("paint", (entries) => {
        for (const entry of entries) {
          if (entry.name === "first-contentful-paint" && !didReportFcp) {
            didReportFcp = true;
            reportPerformanceMetric(api, "fcp", roundMetricValue(entry.startTime), "ms");
          }
        }
      });
      if (paintObserver) {
        cleanups.push(() => {
          paintObserver.disconnect();
        });
      }

      const lcpObserver = observePerformanceEntries<PerformanceEntry>("largest-contentful-paint", (entries) => {
        for (const entry of entries) {
          latestLcp = entry.startTime;
        }
      });
      if (lcpObserver) {
        cleanups.push(() => {
          lcpObserver.disconnect();
        });
      }

      const layoutShiftObserver = observePerformanceEntries<PerformanceEntry>(
        "layout-shift",
        (entries) => {
          for (const entry of entries) {
            const layoutShift = entry as PerformanceEntry & {
              value?: number;
              hadRecentInput?: boolean;
            };
            if (layoutShift.hadRecentInput) {
              continue;
            }
            clsValue += layoutShift.value ?? 0;
          }
        }
      );
      if (layoutShiftObserver) {
        cleanups.push(() => {
          layoutShiftObserver.disconnect();
        });
      }

      const eventObserver = observePerformanceEntries<PerformanceEntry>("event", (entries) => {
        for (const entry of entries) {
          const eventTiming = entry as PerformanceEntry & {
            duration?: number;
            interactionId?: number;
          };
          if ((eventTiming.interactionId ?? 0) === 0) {
            continue;
          }
          maxInp = Math.max(maxInp, eventTiming.duration ?? 0);
        }
      });
      if (eventObserver) {
        cleanups.push(() => {
          eventObserver.disconnect();
        });
      }

      cleanups.push(
        onHidden(() => {
          if (latestLcp > 0) {
            reportPerformanceMetric(api, "lcp", roundMetricValue(latestLcp), "ms");
            latestLcp = 0;
          }

          if (!didReportCls) {
            didReportCls = true;
            reportPerformanceMetric(api, "cls", roundMetricValue(clsValue), "score");
          }

          if (!didReportInp && maxInp > 0) {
            didReportInp = true;
            reportPerformanceMetric(api, "inp", roundMetricValue(maxInp), "ms");
          }
        })
      );

      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    }
  };
}

export function requestPlugin(options: RequestPluginOptions = {}): ObservePlugin {
  return {
    name: "request",
    setup(api: ObservePluginSetup) {
      if (options.enabled === false) {
        return;
      }

      const cleanups: Array<() => void> = [];

      if (options.captureFetch !== false && typeof window.fetch === "function" && typeof Request === "function") {
        const originalFetch = window.fetch;

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const startedAt = performance.now();
          const request = new Request(input, init);
          const method = normalizeRequestMethod(request.method);
          const url = resolveUrl(request.url);

          try {
            const response = await originalFetch.call(window, input, init);
            if (!shouldIgnoreRequest(url, options)) {
              if (options.breadcrumb) {
                addNetworkBreadcrumb(api, method, url, response.ok, response.status);
              }
              reportRequestTiming(api, method, url, performance.now() - startedAt, response.ok, response.status);
            }
            return response;
          } catch (error: unknown) {
            if (!shouldIgnoreRequest(url, options)) {
              if (options.breadcrumb) {
                addNetworkBreadcrumb(api, method, url, false);
              }
              reportRequestTiming(api, method, url, performance.now() - startedAt, false);
            }
            throw error;
          }
        };

        cleanups.push(() => {
          window.fetch = originalFetch;
        });
      }

      if (options.captureXhr !== false && typeof XMLHttpRequest !== "undefined") {
        const OriginalXhrOpen = XMLHttpRequest.prototype.open;
        const OriginalXhrSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (
          this: XMLHttpRequest,
          method: string,
          url: string | URL,
          async?: boolean,
          username?: string | null,
          password?: string | null
        ): void {
          const requestUrl = typeof url === "string" ? url : url.toString();
          Reflect.set(this, "__observe_method__", normalizeRequestMethod(method));
          Reflect.set(this, "__observe_url__", resolveUrl(requestUrl));
          Reflect.set(this, "__observe_reported__", false);
          OriginalXhrOpen.call(this, method, url, async ?? true, username ?? undefined, password ?? undefined);
        };

        XMLHttpRequest.prototype.send = function (
          this: XMLHttpRequest,
          body?: Document | XMLHttpRequestBodyInit | null
        ): void {
          const startedAt = performance.now();
          Reflect.set(this, "__observe_started_at__", startedAt);

          const finalize = () => {
            const alreadyReported = Reflect.get(this, "__observe_reported__");
            if (alreadyReported === true) {
              return;
            }

            Reflect.set(this, "__observe_reported__", true);
            const url = Reflect.get(this, "__observe_url__");
            const method = Reflect.get(this, "__observe_method__");
            const started = Reflect.get(this, "__observe_started_at__");

            if (typeof url !== "string" || typeof method !== "string" || typeof started !== "number") {
              return;
            }

            if (shouldIgnoreRequest(url, options)) {
              return;
            }

            const duration = performance.now() - started;
            if (options.breadcrumb) {
              addNetworkBreadcrumb(api, method, url, this.status >= 200 && this.status < 400, this.status);
            }
            reportRequestTiming(api, method, url, duration, this.status >= 200 && this.status < 400, this.status);
          };

          this.addEventListener("loadend", finalize, { once: true });
          OriginalXhrSend.call(this, body);
        };

        cleanups.push(() => {
          XMLHttpRequest.prototype.open = OriginalXhrOpen;
          XMLHttpRequest.prototype.send = OriginalXhrSend;
        });
      }

      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    }
  };
}

export function fetchPlugin(options: RequestPluginOptions = {}): ObservePlugin {
  return requestPlugin({
    ...options,
    captureXhr: false
  });
}

export function whiteScreenPlugin(options: WhiteScreenPluginOptions = {}): ObservePlugin {
  return {
    name: "white-screen",
    setup(api: ObservePluginSetup) {
      if (options.enabled === false) {
        return;
      }

      const delayMs = options.delayMs ?? 3000;
      const blankPointThreshold = options.blankPointThreshold ?? 0.8;
      const rootSelectors = options.rootSelectors ?? ["#app", "#root", "#__next", "#__nuxt"];
      const minTextLength = options.minTextLength ?? 24;
      let didReport = false;

      const detect = () => {
        if (didReport || document.visibilityState === "hidden") {
          return;
        }

        if (hasMeaningfulVisualContent(minTextLength)) {
          return;
        }

        const points = getDefaultSamplePoints();
        let blankHits = 0;

        for (const [xRatio, yRatio] of points) {
          const x = Math.max(1, Math.floor(window.innerWidth * xRatio));
          const y = Math.max(1, Math.floor(window.innerHeight * yRatio));
          const element = document.elementFromPoint(x, y);

          if (!element || !isVisibleElement(element) || isBlankCandidate(element, rootSelectors)) {
            blankHits += 1;
          }
        }

        const blankRatio = blankHits / points.length;
        if (blankRatio < blankPointThreshold) {
          return;
        }

        didReport = true;
        api.report({
          type: "custom",
          payload: {
            name: "white_screen_detected",
            data: {
              blank_points: blankHits,
              total_points: points.length,
              blank_ratio: Math.round(blankRatio * 100) / 100
            }
          }
        });
      };

      const scheduleDetection = () => {
        return runWhenIdle(detect, delayMs);
      };

      let cancelScheduled = () => {};

      if (document.readyState === "complete") {
        cancelScheduled = scheduleDetection();
      } else {
        const onLoad = () => {
          cancelScheduled = scheduleDetection();
        };
        window.addEventListener("load", onLoad, { once: true });
        return () => {
          cancelScheduled();
          window.removeEventListener("load", onLoad);
        };
      }

      return () => {
        cancelScheduled();
      };
    }
  };
}

export function longTaskPlugin(options: LongTaskPluginOptions = {}): ObservePlugin {
  return {
    name: "long-task",
    setup(api: ObservePluginSetup) {
      if (options.enabled === false) {
        return;
      }

      let count = 0;
      let totalDuration = 0;
      let totalBlockingTime = 0;
      let maxDuration = 0;
      let didReportSummary = false;

      const observer = observePerformanceEntries<PerformanceEntry>("longtask", (entries) => {
        for (const entry of entries) {
          const duration = roundMetricValue(entry.duration);
          const blockingTime = roundMetricValue(Math.max(0, entry.duration - 50));

          count += 1;
          totalDuration += duration;
          totalBlockingTime += blockingTime;
          maxDuration = Math.max(maxDuration, duration);

          if (options.reportEntries) {
            reportCustomEvent(api, "long_task", {
              start_time: roundMetricValue(entry.startTime),
              duration,
              blocking_time: blockingTime
            });
          }
        }
      });

      if (!observer) {
        return;
      }

      const stopHiddenListener = onHidden(() => {
        if (didReportSummary || count === 0) {
          return;
        }

        didReportSummary = true;
        reportCustomEvent(api, "long_task_summary", {
          long_task_count: count,
          total_duration: roundMetricValue(totalDuration),
          total_blocking_time: roundMetricValue(totalBlockingTime),
          max_duration: roundMetricValue(maxDuration),
          avg_duration: roundMetricValue(totalDuration / count)
        });
      });

      return () => {
        stopHiddenListener();
        observer.disconnect();
      };
    }
  };
}

export function breadcrumbsPlugin(options: BreadcrumbPluginOptions = {}): ObservePlugin {
  return {
    name: "breadcrumbs",
    setup(api: ObservePluginSetup) {
      if (options.enabled === false) {
        return;
      }

      const cleanups: Array<() => void> = [];

      if (options.captureClicks !== false) {
        const onClick = (event: MouseEvent) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) {
            return;
          }

          api.addBreadcrumb({
            type: "ui.click",
            message: getSafeClickLabel(target)
          });
        };

        document.addEventListener("click", onClick, true);
        cleanups.push(() => {
          document.removeEventListener("click", onClick, true);
        });
      }

      if (options.captureRouteChanges !== false) {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        const recordCurrentRoute = () => {
          addRouteBreadcrumb(api, window.location.href);
        };

        history.pushState = function (...args) {
          originalPushState.apply(history, args);
          recordCurrentRoute();
        };

        history.replaceState = function (...args) {
          originalReplaceState.apply(history, args);
          recordCurrentRoute();
        };

        const onRouteChange = () => {
          recordCurrentRoute();
        };

        window.addEventListener("popstate", onRouteChange);
        window.addEventListener("hashchange", onRouteChange);

        cleanups.push(() => {
          history.pushState = originalPushState;
          history.replaceState = originalReplaceState;
          window.removeEventListener("popstate", onRouteChange);
          window.removeEventListener("hashchange", onRouteChange);
        });
      }

      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    }
  };
}
