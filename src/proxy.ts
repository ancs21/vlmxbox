import type { Server } from "bun";

const LOCAL_PORT = 8000;

export function startProxy(
  tunnelUrl: string,
  port: number = LOCAL_PORT
): Server {
  const server = Bun.serve({
    port,
    idleTimeout: 255, // max allowed by Bun (seconds) — vLLM can take minutes for long generations
    async fetch(req) {
      const url = new URL(req.url);
      const targetUrl = `${tunnelUrl}${url.pathname}${url.search}`;

      const headers = new Headers(req.headers);
      // Remove host header so it doesn't conflict with the tunnel
      headers.delete("host");

      const body = req.body;

      try {
        const response = await fetch(targetUrl, {
          method: req.method,
          headers,
          body,
          // @ts-ignore - Bun supports duplex
          duplex: body ? "half" : undefined,
        });

        // Stream the response back, preserving headers and status
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: "Proxy error", message: String(err) }),
          { status: 502, headers: { "content-type": "application/json" } }
        );
      }
    },
  });

  return server;
}

export function stopProxy(server: Server): void {
  server.stop(true);
}
