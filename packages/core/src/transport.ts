import type { FetchTransportOptions, ObserveEvent, ReportInput } from "./types";

export interface EventTransport {
  send(input: ReportInput): Promise<void>;
}

export function createFetchTransport(options: FetchTransportOptions): EventTransport {
  const fetcher = options.fetcher ?? fetch;

  return {
    async send(input: ReportInput): Promise<void> {
      if (input.events.length === 0) {
        return;
      }

      const response = await fetcher(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...options.headers
        },
        body: JSON.stringify({
          events: input.events
        }),
        keepalive: true
      });

      if (!response.ok) {
        throw new Error(`Observe transport failed with status ${response.status}`);
      }
    }
  };
}

export async function sendWithBeaconFallback(
  transport: EventTransport,
  endpoint: string,
  events: readonly ObserveEvent[]
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const canUseBeacon = typeof navigator.sendBeacon === "function";
  if (canUseBeacon) {
    const payload = JSON.stringify({ events });
    const body = new Blob([payload], { type: "application/json" });
    const didQueue = navigator.sendBeacon(endpoint, body);
    if (didQueue) {
      return;
    }
  }

  await transport.send({ events });
}
