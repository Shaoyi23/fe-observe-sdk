import { EventBatcher } from "./batcher";
import { createContextStore } from "./context";
import { createFetchTransport } from "./transport";
import type {
  BreadcrumbInput,
  CaptureExceptionOptions,
  ContextValue,
  EventInput,
  ObserveClient,
  ObserveEvent,
  ObserveEventType,
  ObservePlugin,
  RuntimeErrorPayload,
  ObserveUser,
  ObserveSdkOptions
} from "./types";
import { toRuntimeErrorPayload } from "./plugins";

class BrowserObserveSdk implements ObserveClient {
  private readonly contextStore: ReturnType<typeof createContextStore>;
  private readonly batcher: EventBatcher;
  private readonly cleanups: Array<() => void> = [];
  private destroyed = false;

  constructor(private readonly options: ObserveSdkOptions) {
    this.contextStore = createContextStore(options.app, options.user, options.extra, options.breadcrumbs);
    const transport = createFetchTransport({
      endpoint: options.endpoint,
      ...options.transport
    });
    this.batcher = new EventBatcher(transport, options.endpoint, options.batch);

    for (const plugin of options.plugins ?? []) {
      this.use(plugin);
    }
  }

  report<TType extends ObserveEventType>(event: EventInput<TType>): void {
    if (this.destroyed) {
      return;
    }

    const record: ObserveEvent<TType> = {
      type: event.type,
      payload: event.payload,
      timestamp: Date.now(),
      context: this.contextStore.getSnapshot()
    };

    this.batcher.push(record);
  }

  use(plugin: ObservePlugin): void {
    if (this.destroyed) {
      return;
    }

    const cleanup = plugin.setup({
      report: (event) => this.report(event),
      addBreadcrumb: (breadcrumb) => this.addBreadcrumb(breadcrumb),
      setUser: (user) => this.setUser(user),
      setExtra: (key, value) => this.setExtra(key, value)
    });

    if (typeof cleanup === "function") {
      this.cleanups.push(cleanup);
    }
  }

  captureException(error: unknown, options: CaptureExceptionOptions = {}): void {
    if (this.destroyed) {
      return;
    }

    const payload: RuntimeErrorPayload = {
      ...toRuntimeErrorPayload(error),
      handled: options.handled ?? true,
      mechanism: options.mechanism ?? "manual",
      ...(options.metadata === undefined ? {} : { metadata: options.metadata })
    };

    this.addBreadcrumb({
      type: "error",
      message: payload.message,
      ...(payload.metadata === undefined ? {} : { data: payload.metadata })
    });

    this.report({
      type: "runtime_error",
      payload
    });
  }

  addBreadcrumb(breadcrumb: BreadcrumbInput): void {
    if (this.destroyed) {
      return;
    }

    this.contextStore.addBreadcrumb(breadcrumb);
  }

  setUser(user: ObserveUser | undefined): void {
    if (this.destroyed) {
      return;
    }

    this.contextStore.setUser(user);
  }

  setExtra(key: string, value: ContextValue): void {
    if (this.destroyed) {
      return;
    }

    this.contextStore.setExtra(key, value);
  }

  private flush(): Promise<void> {
    return this.batcher.flush();
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    for (const cleanup of this.cleanups.splice(0, this.cleanups.length)) {
      cleanup();
    }
    await this.batcher.destroy();
  }
}

export function init(options: ObserveSdkOptions): ObserveClient {
  return new BrowserObserveSdk(options);
}

export function initObserve(options: ObserveSdkOptions): ObserveClient {
  return new BrowserObserveSdk(options);
}
