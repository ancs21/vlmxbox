import { describe, test, expect, afterEach } from "bun:test";
import { startProxy, stopProxy } from "../proxy";
import type { Server } from "bun";

let proxyServer: Server | null = null;
let targetServer: ReturnType<typeof Bun.serve> | null = null;

afterEach(() => {
  if (proxyServer) stopProxy(proxyServer);
  if (targetServer) targetServer.stop(true);
  proxyServer = null;
  targetServer = null;
});

describe("startProxy", () => {
  test("proxies GET requests to target URL", async () => {
    // Start a fake target server
    targetServer = Bun.serve({
      port: 9999,
      fetch() {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "content-type": "application/json" },
        });
      },
    });

    proxyServer = startProxy("http://localhost:9999", 9998);

    const res = await fetch("http://localhost:9998/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("proxies POST requests with body", async () => {
    targetServer = Bun.serve({
      port: 9997,
      async fetch(req) {
        const body = await req.json();
        return new Response(
          JSON.stringify({ echo: body, method: req.method }),
          { headers: { "content-type": "application/json" } }
        );
      },
    });

    proxyServer = startProxy("http://localhost:9997", 9996);

    const res = await fetch("http://localhost:9996/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.echo.prompt).toBe("hello");
    expect(body.method).toBe("POST");
  });

  test("returns 502 when target is unreachable", async () => {
    proxyServer = startProxy("http://localhost:1", 9995);

    const res = await fetch("http://localhost:9995/health");
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("Proxy error");
  });

  test("preserves query parameters", async () => {
    targetServer = Bun.serve({
      port: 9994,
      fetch(req) {
        const url = new URL(req.url);
        return new Response(url.search);
      },
    });

    proxyServer = startProxy("http://localhost:9994", 9993);

    const res = await fetch("http://localhost:9993/path?foo=bar&baz=1");
    const text = await res.text();
    expect(text).toBe("?foo=bar&baz=1");
  });
});
