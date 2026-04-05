import * as p from "@clack/prompts";
import type { Server } from "bun";
import type { VlmConfig } from "../types";
import {
  getOrReconnectSandbox,
  waitForHealth,
  streamSandboxLogs,
  terminateSandbox,
  deriveSandboxName,
  getSandboxStatus,
} from "../modal";
import { startPlayground, stopPlayground } from "../playground-local";
import { startProxy, stopProxy } from "../proxy";
import {
  STATE_FILE,
  HEALTH_CHECK_TIMEOUT_FIRST_RUN_MS,
  HEALTH_CHECK_TIMEOUT_WARM_MS,
  POLL_INTERVAL_MS,
  TUNNEL_HEALTH_CHECK_INTERVAL_MS,
  VLLM_PORT,
} from "../config";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const LOCAL_PORT = 8000;

function stateFilePath(): string {
  return join(process.cwd(), STATE_FILE);
}

async function writeStateFile(state: Record<string, unknown>): Promise<void> {
  const tmpPath = stateFilePath() + ".tmp";
  await Bun.write(tmpPath, JSON.stringify(state, null, 2));
  const { renameSync } = await import("node:fs");
  renameSync(tmpPath, stateFilePath());
}

function cleanupStateFile(): void {
  try {
    if (existsSync(stateFilePath())) unlinkSync(stateFilePath());
  } catch {}
}

export async function up(config: VlmConfig): Promise<void> {
  p.intro("vlmxbox");

  // Check for stale state
  const sandboxName = deriveSandboxName(process.cwd());
  if (existsSync(stateFilePath())) {
    const status = await getSandboxStatus(sandboxName);
    if (!status.alive) {
      p.log.warn("Found stale state file — cleaning up");
      cleanupStateFile();
    }
  }

  const spin = p.spinner();
  spin.start(`Creating sandbox (${config.gpu} GPU)...`);

  let info;
  try {
    info = await getOrReconnectSandbox(config);
  } catch (err: any) {
    spin.stop("Sandbox creation failed");
    p.log.error(err.message);
    process.exit(1);
  }

  spin.stop("Sandbox created.");

  // Stream sandbox logs so user can see vLLM startup progress
  p.log.info("Streaming sandbox logs...\n");
  const stopLogs = streamSandboxLogs(info.sandbox, (line, stream) => {
    const prefix = stream === "stderr" ? "ERR" : "   ";
    console.log(`  ${prefix} │ ${line}`);
  });

  try {
    await waitForHealth(
      info.tunnelUrl,
      info.sandbox,
      sandboxName,
      HEALTH_CHECK_TIMEOUT_FIRST_RUN_MS
    );
  } catch (err: any) {
    stopLogs();
    console.log();
    p.log.error(err.message);
    await terminateSandbox(sandboxName).catch(() => {});
    process.exit(1);
  }

  stopLogs();
  console.log();

  let proxyServer: Server;
  try {
    proxyServer = startProxy(info.tunnelUrl, LOCAL_PORT);
  } catch (err: any) {
    p.log.error(`Could not bind to localhost:${LOCAL_PORT} — ${err.message}`);
    process.exit(1);
  }

  p.log.success("vLLM is healthy. Local proxy started.");

  // Write state file (atomic)
  await writeStateFile({
    sandboxId: info.sandboxId,
    sandboxName: info.sandboxName,
    tunnelUrl: info.tunnelUrl,
    model: config.model,
    gpu: config.gpu,
    toolParser: config.toolParser,
    localPort: LOCAL_PORT,
    startedAt: new Date().toISOString(),
  });

  // Launch local playground UI
  const PLAYGROUND_PORT = 3000;
  const playgroundServer = startPlayground(info.tunnelUrl, config.model, PLAYGROUND_PORT);
  const playgroundUrl = `http://localhost:${PLAYGROUND_PORT}`;

  // Display connection info
  const lines = [
    `Model:    ${config.model}`,
    `GPU:      ${config.gpu}`,
    `Cost:     ${config.costPerHour ?? "?"}/hr (auto-stops after ${config.timeout / 1000}s idle)`,
    `Local:    http://localhost:${LOCAL_PORT}`,
    `Tunnel:   ${info.tunnelUrl}`,
  ];

  lines.push(`Chat UI:  ${playgroundUrl}`);

  lines.push(
    "",
    "OpenAI-compatible endpoint:",
    "",
    `  Base URL:  http://localhost:${LOCAL_PORT}/v1`,
    `  API Key:   dummy`,
    `  Model:     ${config.model}`,
  );

  p.note(lines.join("\n"), "vlmxbox is running");

  p.log.info("Press Ctrl+C to stop everything.");

  // Signal handlers for cleanup — must be robust, no throws
  let cleaning = false;
  const cleanup = async () => {
    if (cleaning) return;
    cleaning = true;
    console.log("\n  Shutting down...");

    try { stopProxy(proxyServer); } catch {}
    try { stopPlayground(playgroundServer); } catch {}
    try { await terminateSandbox(sandboxName); } catch {}
    try { cleanupStateFile(); } catch {}

    console.log("  Sandbox terminated. vlmxbox stopped.");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Polling loop — monitor sandbox health
  let tunnelCheckCounter = 0;
  const tunnelCheckEveryN = Math.ceil(
    TUNNEL_HEALTH_CHECK_INTERVAL_MS / POLL_INTERVAL_MS
  );

  while (true) {
    await Bun.sleep(POLL_INTERVAL_MS);

    // Check if sandbox is still alive
    const status = await getSandboxStatus(sandboxName);
    if (!status.alive) {
      console.log();
      p.log.warn("Sandbox terminated (idle timeout or crash).");
      stopProxy(proxyServer);
      cleanupStateFile();
      p.outro("vlmxbox stopped");
      process.exit(0);
    }

    // Periodic tunnel health check
    tunnelCheckCounter++;
    if (tunnelCheckCounter >= tunnelCheckEveryN) {
      tunnelCheckCounter = 0;
      try {
        const res = await fetch(`${info.tunnelUrl}/health`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) {
          p.log.warn("Tunnel health check returned non-OK status");
        }
      } catch {
        p.log.warn(
          "Tunnel unreachable but sandbox is alive — connection may be degraded"
        );
      }
    }
  }
}
