import { errorsPlugin, fetchPlugin, init, performancePlugin } from "../../../packages/core/src/index";
import "./style.css";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("Missing #app root");
}

const logLines: string[] = [];

function renderLog(): void {
  const logElement = document.querySelector<HTMLElement>("[data-log]");
  if (!logElement) {
    return;
  }

  logElement.textContent = logLines.join("\n");
}

function pushLog(message: string): void {
  logLines.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
  logLines.splice(8);
  renderLog();
}

const sdk = init({
  endpoint: "/collect",
  app: {
    name: "demo-app",
    release: "0.1.0",
    environment: "local"
  },
  user: {
    id: "demo-user"
  },
  extra: {
    surface: "demo"
  },
  batch: {
    maxSize: 5,
    flushIntervalMs: 3000
  },
  plugins: [errorsPlugin(), performancePlugin(), fetchPlugin()]
});

sdk.setExtra("session_kind", "interactive");

appElement.innerHTML = `
  <main class="shell">
    <section class="hero">
      <span>Frontend observability SDK MVP</span>
      <h1>Small core. Pluggable signals. Demoable today.</h1>
      <p>
        This page wires the SDK into a lightweight app and exercises runtime errors,
        resource failures, performance capture, and request timing with batched delivery.
      </p>
    </section>
    <section class="grid">
      <article class="card">
        <h2>Runtime Error</h2>
        <p>Trigger a normal JavaScript error and let the error plugin emit a typed event.</p>
        <div class="actions">
          <button data-action="runtime-error">Throw error</button>
        </div>
      </article>
      <article class="card">
        <h2>Resource Error</h2>
        <p>Load a missing image to validate resource failure capture through the DOM error event.</p>
        <div class="actions">
          <button data-action="resource-error">Break image</button>
        </div>
      </article>
      <article class="card">
        <h2>Request Timing</h2>
        <p>Send a request to the local collector and observe the fetch plugin record timing metadata.</p>
        <div class="actions">
          <button data-action="request">Send request</button>
          <button data-action="custom">Send custom event</button>
        </div>
      </article>
    </section>
    <section class="log" data-log>Waiting for demo actions...</section>
  </main>
`;

renderLog();

document.querySelector<HTMLButtonElement>("[data-action='runtime-error']")?.addEventListener("click", () => {
  pushLog("Triggering runtime error");
  window.setTimeout(() => {
    throw new Error("Demo runtime failure");
  }, 0);
});

document.querySelector<HTMLButtonElement>("[data-action='resource-error']")?.addEventListener("click", () => {
  pushLog("Requesting missing image");
  const image = new Image();
  image.src = "/missing-demo-image.png";
  image.alt = "Missing demo image";
  document.body.append(image);
});

document.querySelector<HTMLButtonElement>("[data-action='request']")?.addEventListener("click", async () => {
  pushLog("Sending request to /collect");
  await fetch("/collect", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      demo: true,
      sentAt: Date.now()
    })
  });
});

document.querySelector<HTMLButtonElement>("[data-action='custom']")?.addEventListener("click", () => {
  pushLog("Queueing custom event");
  sdk.report({
    type: "custom",
    payload: {
      name: "demo_click",
      data: {
        source: "demo-button"
      }
    }
  });
});

window.addEventListener("beforeunload", () => {
  void sdk.destroy();
});
