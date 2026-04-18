export type Primitive = string | number | boolean | null;

export type ContextValue = Primitive | readonly Primitive[];

export type ContextRecord = Readonly<Record<string, ContextValue>>;

export type ObserveEventType =
  | "runtime_error"
  | "resource_error"
  | "performance_metric"
  | "request_timing"
  | "custom";

export interface ViewportContext {
  readonly width: number;
  readonly height: number;
}

export interface PageContext {
  readonly url: string;
  readonly path: string;
  readonly title: string;
  readonly referrer: string;
  readonly userAgent: string;
  readonly viewport: ViewportContext;
}

export interface AppContext {
  readonly name?: string;
  readonly release?: string;
  readonly environment?: string;
}

export interface ObserveUser {
  readonly id: string;
  readonly email?: string;
  readonly username?: string;
}

export type BreadcrumbType = "ui.click" | "navigation" | "http" | "error";

export interface Breadcrumb {
  readonly type: BreadcrumbType;
  readonly timestamp: number;
  readonly message: string;
  readonly data?: ContextRecord;
}

export interface BreadcrumbInput {
  readonly type: BreadcrumbType;
  readonly message: string;
  readonly data?: ContextRecord;
}

export interface ObserveContext {
  readonly page: PageContext;
  readonly app: AppContext;
  readonly user?: ObserveUser;
  readonly extra: ContextRecord;
  readonly breadcrumbs: readonly Breadcrumb[];
}

export interface RuntimeErrorPayload {
  readonly name?: string;
  readonly message: string;
  readonly stack?: string;
  readonly source?: string;
  readonly line?: number;
  readonly column?: number;
  readonly handled?: boolean;
  readonly mechanism?: "onerror" | "unhandledrejection" | "manual";
  readonly metadata?: ContextRecord;
}

export interface ResourceErrorPayload {
  readonly tagName: string;
  readonly url: string;
  readonly html?: string;
}

export interface PerformanceMetricPayload {
  readonly name: string;
  readonly value: number;
  readonly unit: "ms" | "score";
}

export interface RequestTimingPayload {
  readonly method: string;
  readonly url: string;
  readonly status?: number;
  readonly duration: number;
  readonly ok: boolean;
}

export interface CustomPayload {
  readonly name: string;
  readonly data: ContextRecord;
}

export interface ObserveEventMap {
  readonly runtime_error: RuntimeErrorPayload;
  readonly resource_error: ResourceErrorPayload;
  readonly performance_metric: PerformanceMetricPayload;
  readonly request_timing: RequestTimingPayload;
  readonly custom: CustomPayload;
}

export interface ObserveEvent<TType extends ObserveEventType = ObserveEventType> {
  readonly type: TType;
  readonly timestamp: number;
  readonly context: ObserveContext;
  readonly payload: ObserveEventMap[TType];
}

export interface EventInput<TType extends ObserveEventType = ObserveEventType> {
  readonly type: TType;
  readonly payload: ObserveEventMap[TType];
}

export interface ReportInput {
  readonly events: readonly ObserveEvent[];
}

export interface BatchOptions {
  readonly maxSize?: number;
  readonly flushIntervalMs?: number;
}

export interface TransportOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetcher?: typeof fetch;
}

export interface FetchTransportOptions extends TransportOptions {
  readonly endpoint: string;
}

export interface ObservePluginSetup {
  report<TType extends ObserveEventType>(event: EventInput<TType>): void;
  addBreadcrumb(breadcrumb: BreadcrumbInput): void;
  setUser(user: ObserveUser | undefined): void;
  setExtra(key: string, value: ContextValue): void;
}

export interface ObservePlugin {
  readonly name: string;
  setup(api: ObservePluginSetup): void | (() => void);
}

export interface ErrorPluginOptions {
  readonly enabled?: boolean;
  readonly captureWindowError?: boolean;
  readonly captureUnhandledRejection?: boolean;
  readonly captureResourceError?: boolean;
  readonly breadcrumb?: boolean;
}

export type RequestIgnoreMatcher = string | RegExp | ((url: string) => boolean);

export interface RequestPluginOptions {
  readonly enabled?: boolean;
  readonly captureFetch?: boolean;
  readonly captureXhr?: boolean;
  readonly ignore?: readonly RequestIgnoreMatcher[];
  readonly ignoreReportingEndpoint?: boolean;
  readonly reportingEndpoint?: string;
  readonly ignoreStaticResources?: boolean;
  readonly breadcrumb?: boolean;
}

export interface BreadcrumbBufferOptions {
  readonly limit?: number;
}

export interface BreadcrumbPluginOptions {
  readonly enabled?: boolean;
  readonly captureClicks?: boolean;
  readonly captureRouteChanges?: boolean;
}

export interface WhiteScreenPluginOptions {
  readonly enabled?: boolean;
  readonly delayMs?: number;
  readonly blankPointThreshold?: number;
  readonly rootSelectors?: readonly string[];
  readonly minTextLength?: number;
}

export interface LongTaskPluginOptions {
  readonly enabled?: boolean;
  readonly reportEntries?: boolean;
}

export interface CaptureExceptionOptions {
  readonly handled?: boolean;
  readonly mechanism?: "manual";
  readonly metadata?: ContextRecord;
}

export interface ObserveSdkOptions {
  readonly endpoint: string;
  readonly app?: AppContext;
  readonly user?: ObserveUser;
  readonly extra?: ContextRecord;
  readonly breadcrumbs?: BreadcrumbBufferOptions;
  readonly batch?: BatchOptions;
  readonly plugins?: readonly ObservePlugin[];
  readonly transport?: TransportOptions;
}

export interface ObserveClient {
  report<TType extends ObserveEventType>(event: EventInput<TType>): void;
  use(plugin: ObservePlugin): void;
  captureException(error: unknown, options?: CaptureExceptionOptions): void;
  addBreadcrumb(breadcrumb: BreadcrumbInput): void;
  setUser(user: ObserveUser | undefined): void;
  setExtra(key: string, value: ContextValue): void;
  destroy(): Promise<void>;
}

export interface ObserveInternalClient extends ObserveClient {
  flush(): Promise<void>;
}

export type ObserveSdk = ObserveClient;
