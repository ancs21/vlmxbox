import * as p from "@clack/prompts";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  terminateSandbox,
  deriveSandboxName,
  getSandboxStatus,
} from "../modal";
// playground runs locally, stops automatically when process exits
import { STATE_FILE } from "../config";

export async function down(): Promise<void> {
  p.intro("vlmxbox down");

  const sandboxName = deriveSandboxName(process.cwd());
  const stateFile = join(process.cwd(), STATE_FILE);

  // Check if sandbox is actually running
  const status = await getSandboxStatus(sandboxName);

  if (!status.alive && !existsSync(stateFile)) {
    p.log.info("No VLM sandbox running in this directory.");
    p.outro("");
    return;
  }

  const spin = p.spinner();
  spin.start("Stopping sandbox...");

  if (status.alive) {
    // playground is local, stops with the process
    await terminateSandbox(sandboxName);
  }

  // Clean up state file
  if (existsSync(stateFile)) {
    unlinkSync(stateFile);
  }

  spin.stop("Sandbox stopped.");
  p.outro("vlmxbox stopped");
}
