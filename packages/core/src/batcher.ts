import { sendWithBeaconFallback, type EventTransport } from "./transport";
import type { BatchOptions, ObserveEvent } from "./types";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL = 5000;

export class EventBatcher {
  private readonly queue: ObserveEvent[] = [];
  private readonly maxSize: number;
  private readonly flushIntervalMs: number;
  private readonly detachments: Array<() => void> = [];
  private timerId: number | undefined;
  private flushInFlight: Promise<void> | undefined;

  constructor(
    private readonly transport: EventTransport,
    private readonly endpoint: string,
    options: BatchOptions = {}
  ) {
    this.maxSize = options.maxSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL;
    this.bindLifecycleFlush();
  }

  push(event: ObserveEvent): void {
    this.queue.push(event);

    if (this.queue.length >= this.maxSize) {
      void this.flush();
      return;
    }

    if (this.timerId === undefined) {
      this.timerId = window.setTimeout(() => {
        this.timerId = undefined;
        void this.flush();
      }, this.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushInFlight) {
      return this.flushInFlight;
    }

    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) {
      return;
    }

    if (this.timerId !== undefined) {
      window.clearTimeout(this.timerId);
      this.timerId = undefined;
    }

    this.flushInFlight = sendWithBeaconFallback(this.transport, this.endpoint, batch).finally(() => {
      this.flushInFlight = undefined;
    });

    return this.flushInFlight;
  }

  destroy(): Promise<void> {
    if (this.timerId !== undefined) {
      window.clearTimeout(this.timerId);
      this.timerId = undefined;
    }

    for (const detach of this.detachments.splice(0, this.detachments.length)) {
      detach();
    }

    return this.flush();
  }

  private bindLifecycleFlush(): void {
    const flush = () => {
      void this.flush();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    this.detachments.push(() => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  }
}
