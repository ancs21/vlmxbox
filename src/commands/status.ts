import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { deriveSandboxName, getSandboxStatus } from "../modal";
import { STATE_FILE } from "../config";
import type { SandboxState } from "../types";

export async function status(): Promise<void> {
  p.intro("vlmxbox status");

  const sandboxName = deriveSandboxName(process.cwd());
  const stateFile = join(process.cwd(), STATE_FILE);

  // Check live status from Modal
  const liveStatus = await getSandboxStatus(sandboxName);

  if (!liveStatus.alive && !existsSync(stateFile)) {
    p.log.info("No VLM sandbox running in this directory.");
    p.outro("");
    return;
  }

  // Read cached state for metadata
  let state: SandboxState | null = null;
  if (existsSync(stateFile)) {
    try {
      state = await Bun.file(stateFile).json();
    } catch {}
  }

  const statusLabel = liveStatus.alive ? "Running" : "Stopped";
  const uptime = state?.startedAt
    ? formatUptime(new Date(state.startedAt))
    : "unknown";

  const lines = [
    `Status:   ${statusLabel}`,
    `Sandbox:  ${sandboxName}`,
  ];

  if (state) {
    lines.push(
      `Model:    ${state.model}`,
      `GPU:      ${state.gpu}`,
      `Parser:   ${state.toolParser}`,
      `Tunnel:   ${state.tunnelUrl}`,
      `Uptime:   ${uptime}`,
    );
  }

  if (!liveStatus.alive && existsSync(stateFile)) {
    lines.push("", "Stale state file detected. Run `vlmxbox down` to clean up.");
  }

  p.note(lines.join("\n"), statusLabel);
  p.outro("");
}

function formatUptime(startedAt: Date): string {
  const ms = Date.now() - startedAt.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
