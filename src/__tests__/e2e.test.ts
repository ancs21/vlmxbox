import { describe, test, expect } from "bun:test";

const hasModal =
  !!process.env.VLMXBOX_E2E &&
  !!process.env.MODAL_TOKEN_ID &&
  !!process.env.MODAL_TOKEN_SECRET;

describe.skipIf(!hasModal)("e2e: full vlmxbox lifecycle", () => {
  // Uses a small, cheap model to minimize cost and startup time
  // Run with: VLMXBOX_E2E=1 MODAL_TOKEN_ID=... MODAL_TOKEN_SECRET=... bun test src/__tests__/e2e.test.ts

  test("vlmxbox up → health check → /v1/messages → down", async () => {
    const { createSandbox, waitForHealth, terminateSandbox, deriveSandboxName } =
      await import("../modal");
    const { startProxy, stopProxy } = await import("../proxy");

    const config = {
      model: "Qwen/Qwen2.5-0.5B-Instruct",
      gpu: "T4",
      timeout: 120_000,
      toolParser: "hermes",
      vllmImage: "vllm/vllm-openai:latest",
    };

    const sandboxName = deriveSandboxName(process.cwd());
    let info;

    try {
      // Create sandbox
      info = await createSandbox(config);
      expect(info.sandboxId).toBeTruthy();
      expect(info.tunnelUrl).toMatch(/^https:\/\//);

      // Wait for vLLM health
      await waitForHealth(info.tunnelUrl, 180_000);

      // Start local proxy
      const proxy = startProxy(info.tunnelUrl, 18000);

      try {
        // Health check through proxy
        const healthRes = await fetch("http://localhost:18000/health");
        expect(healthRes.ok).toBe(true);

        // Send a simple message to /v1/messages
        const msgRes = await fetch("http://localhost:18000/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": "dummy",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: 64,
            messages: [{ role: "user", content: "Say hello" }],
          }),
        });

        expect(msgRes.status).toBe(200);
        const body = await msgRes.json();
        expect(body.content).toBeTruthy();
      } finally {
        stopProxy(proxy);
      }
    } finally {
      // Always clean up
      await terminateSandbox(sandboxName).catch(() => {});
    }
  }, 300_000); // 5 minute timeout for the full flow
});
