import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function demoCollectorPlugin(): Plugin {
  return {
    name: "demo-collector",
    configureServer(server) {
      server.middlewares.use("/collect", async (request, response, next) => {
        if (request.method !== "POST") {
          next();
          return;
        }

        const rawBody = await readBody(request);
        const payload: unknown = rawBody.length > 0 ? (JSON.parse(rawBody) as unknown) : {};
        console.log("[demo collector]", payload);
        sendJson(response, 200, { ok: true });
      });
    }
  };
}

export default defineConfig({
  plugins: [demoCollectorPlugin()]
});
