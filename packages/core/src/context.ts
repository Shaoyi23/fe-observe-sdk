import type {
  AppContext,
  Breadcrumb,
  BreadcrumbInput,
  BreadcrumbBufferOptions,
  ContextRecord,
  ContextValue,
  ObserveContext,
  ObserveUser,
  PageContext
} from "./types";

function getViewport(): PageContext["viewport"] {
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function cloneExtra(extra: Map<string, ContextValue>): ContextRecord {
  return Object.freeze(Object.fromEntries(extra) as Record<string, ContextValue>);
}

function cloneBreadcrumbs(breadcrumbs: readonly Breadcrumb[]): readonly Breadcrumb[] {
  return Object.freeze([...breadcrumbs]);
}

export function createContextStore(
  initialApp: AppContext = {},
  initialUser?: ObserveUser,
  initialExtra: ContextRecord = {},
  breadcrumbOptions: BreadcrumbBufferOptions = {}
) {
  const breadcrumbLimit = Math.max(1, breadcrumbOptions.limit ?? 20);
  let app: AppContext = { ...initialApp };
  let user = initialUser;
  const extra = new Map<string, ContextValue>(Object.entries(initialExtra));
  const breadcrumbs: Breadcrumb[] = [];

  return {
    getSnapshot(): ObserveContext {
      return {
        page: {
          url: window.location.href,
          path: window.location.pathname,
          title: document.title,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          viewport: getViewport()
        },
        app,
        ...(user === undefined ? {} : { user }),
        extra: cloneExtra(extra),
        breadcrumbs: cloneBreadcrumbs(breadcrumbs)
      };
    },
    addBreadcrumb(input: BreadcrumbInput): void {
      breadcrumbs.push({
        ...input,
        timestamp: Date.now()
      });

      if (breadcrumbs.length > breadcrumbLimit) {
        breadcrumbs.splice(0, breadcrumbs.length - breadcrumbLimit);
      }
    },
    setExtra(key: string, value: ContextValue): void {
      extra.set(key, value);
    },
    setUser(nextUser: ObserveUser | undefined): void {
      user = nextUser;
    },
    setApp(nextApp: AppContext): void {
      app = { ...nextApp };
    }
  };
}
