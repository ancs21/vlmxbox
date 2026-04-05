import { describe, test, expect } from "bun:test";
import { deriveSandboxName } from "../modal";

describe("deriveSandboxName", () => {
  test("returns deterministic name from cwd", () => {
    const cwd = process.cwd();
    const name1 = deriveSandboxName(cwd);
    const name2 = deriveSandboxName(cwd);
    expect(name1).toBe(name2);
    expect(name1).toMatch(/^vlmxbox-[a-f0-9]{12}$/);
  });

  test("returns different names for different directories", () => {
    const name1 = deriveSandboxName("/");
    const name2 = deriveSandboxName("/usr");
    expect(name1).not.toBe(name2);
  });

  test("resolves symlinks for consistent naming", () => {
    // /tmp on macOS is a symlink to /private/tmp
    const name1 = deriveSandboxName("/tmp");
    const name2 = deriveSandboxName("/private/tmp");
    expect(name1).toBe(name2);
  });
});

// Integration tests — require MODAL_TOKEN_ID + MODAL_TOKEN_SECRET
// Run with: VLMXBOX_E2E=1 bun test src/__tests__/modal.test.ts
describe.skipIf(!process.env.VLMXBOX_E2E)("Modal SDK integration", () => {
  test.todo("createSandbox with valid config returns sandboxId and tunnelUrl");
  test.todo("waitForHealth resolves when health endpoint returns 200");
  test.todo("waitForHealth throws after timeout when endpoint never responds");
  test.todo("getOrReconnectSandbox reconnects when sandbox already exists");
  test.todo("getSandboxStatus returns terminated state for dead sandbox");
  test.todo("terminateSandbox handles non-existent sandbox gracefully");
});
