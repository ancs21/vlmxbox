import { ModalClient, AlreadyExistsError, NotFoundError } from "modal";
import type { Sandbox, Tunnel } from "modal";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  MODAL_APP_NAME,
  MODAL_VOLUME_NAME,
  VLLM_PORT,
  HEALTH_CHECK_INTERVAL_MS,
  HEALTH_CHECK_TIMEOUT_FIRST_RUN_MS,
  HEALTH_CHECK_TIMEOUT_WARM_MS,
} from "./config";
import type { VlmConfig, SandboxInfo } from "./types";

export function deriveSandboxName(cwd: string): string {
  const resolved = realpathSync(cwd);
  const hash = createHash("sha256").update(resolved).digest("hex").slice(0, 12);
  return `vlmxbox-${hash}`;
}

function buildVllmCommand(config: VlmConfig): string[] {
  // vllm/vllm-openai image ENTRYPOINT is "vllm serve", so command = just the flags
  const base = [
    "--model",
    config.model,
    "--download-dir",
    "/models",
    "--host",
    "0.0.0.0",
    "--port",
    String(VLLM_PORT),
  ];

  // Add tool calling flags only if not already in extraArgs (31B presets include their own)
  const hasToolChoice = config.extraArgs?.includes("--enable-auto-tool-choice");
  if (!hasToolChoice) {
    base.push("--enable-auto-tool-choice", "--tool-call-parser", config.toolParser);
  }

  // Fast mode: -O0 skips CUDA graph compilation for ~60s faster startup
  if (config.fast) {
    base.push("-O0");
  }

  // Append preset-specific extra args
  if (config.extraArgs?.length) {
    base.push(...config.extraArgs);
  }

  return base;
}

export async function createSandbox(config: VlmConfig): Promise<SandboxInfo> {
  const modal = new ModalClient();
  const app = await modal.apps.fromName(MODAL_APP_NAME, {
    createIfMissing: true,
  });

  const image = modal.images
    .fromRegistry(config.vllmImage)
    .dockerfileCommands([
      "RUN pip install huggingface-hub 2>/dev/null || true",
    ]);

  // Model weights volume
  const modelVolume = await modal.volumes.fromName(MODAL_VOLUME_NAME, {
    createIfMissing: true,
  });

  // Torch compile cache volume — persists compiled kernels across restarts
  // Saves ~69s on warm restarts (skips torch.compile entirely)
  const cacheVolume = await modal.volumes.fromName("vlmxbox-compile-cache", {
    createIfMissing: true,
  });

  const sandboxName = deriveSandboxName(process.cwd());

  // Pass through HF_TOKEN if set locally
  const env: Record<string, string> = {
    TORCHINDUCTOR_COMPILE_THREADS: "1", // more stable compilation
  };
  if (process.env.HF_TOKEN) env.HF_TOKEN = process.env.HF_TOKEN;
  if (process.env.HUGGING_FACE_HUB_TOKEN) env.HF_TOKEN = process.env.HUGGING_FACE_HUB_TOKEN;

  const sandbox = await modal.sandboxes.create(app, image, {
    name: sandboxName,
    gpu: config.gpu,
    command: buildVllmCommand(config),
    volumes: {
      "/models": modelVolume,
      "/root/.cache/vllm": cacheVolume, // persist torch compile cache
    },
    encryptedPorts: [VLLM_PORT],
    timeoutMs: 3_600_000, // 1 hour max lifetime
    idleTimeoutMs: config.timeout,
    env,
  });

  const tunnels = await sandbox.tunnels();
  const tunnel = tunnels[VLLM_PORT];
  if (!tunnel) {
    throw new Error(`No tunnel found for port ${VLLM_PORT}`);
  }

  return {
    sandboxId: sandbox.sandboxId,
    sandboxName,
    tunnelUrl: tunnel.url,
    sandbox,
  };
}

export async function getOrReconnectSandbox(
  config: VlmConfig
): Promise<SandboxInfo> {
  try {
    return await createSandbox(config);
  } catch (err) {
    if (err instanceof AlreadyExistsError) {
      const sandboxName = deriveSandboxName(process.cwd());
      return await reconnectSandbox(sandboxName);
    }
    throw err;
  }
}

export async function reconnectSandbox(
  sandboxName: string
): Promise<SandboxInfo> {
  const modal = new ModalClient();
  const sandbox = await modal.sandboxes.fromName(MODAL_APP_NAME, sandboxName);
  const tunnels = await sandbox.tunnels();
  const tunnel = tunnels[VLLM_PORT];
  if (!tunnel) {
    throw new Error(`No tunnel found for port ${VLLM_PORT}`);
  }

  return {
    sandboxId: sandbox.sandboxId,
    sandboxName,
    tunnelUrl: tunnel.url,
    sandbox,
  };
}

export async function getSandboxStatus(
  sandboxName: string
): Promise<{ alive: boolean; exitCode: number | null }> {
  const modal = new ModalClient();
  try {
    const sandbox = await modal.sandboxes.fromName(
      MODAL_APP_NAME,
      sandboxName
    );
    const exitCode = await sandbox.poll();
    return { alive: exitCode === null, exitCode };
  } catch (err) {
    if (err instanceof NotFoundError) {
      return { alive: false, exitCode: null };
    }
    throw err;
  }
}

export async function terminateSandbox(sandboxName: string): Promise<void> {
  const modal = new ModalClient();
  try {
    const sandbox = await modal.sandboxes.fromName(
      MODAL_APP_NAME,
      sandboxName
    );
    await sandbox.terminate({ wait: true });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return; // already gone
    }
    throw err;
  }
}

/**
 * Stream sandbox stdout/stderr logs to a callback. Runs in background.
 * Returns an abort function to stop streaming.
 */
export function streamSandboxLogs(
  sandbox: unknown,
  onLog: (line: string, stream: "stdout" | "stderr") => void
): () => void {
  const sb = sandbox as { stdout: ReadableStream<string>; stderr: ReadableStream<string>; poll: () => Promise<number | null> };
  let aborted = false;

  async function readStream(stream: ReadableStream<string>, name: "stdout" | "stderr") {
    try {
      const reader = stream.getReader();
      while (!aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          for (const line of value.split("\n")) {
            if (line.trim()) onLog(line, name);
          }
        }
      }
      reader.releaseLock();
    } catch {
      // stream closed
    }
  }

  readStream(sb.stdout, "stdout");
  readStream(sb.stderr, "stderr");

  return () => { aborted = true; };
}

/**
 * Wait for vLLM health endpoint while checking sandbox status.
 * Streams logs via onLog callback. Throws if sandbox dies or times out.
 */
export async function waitForHealth(
  tunnelUrl: string,
  sandbox: unknown,
  sandboxName: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_WARM_MS
): Promise<void> {
  const sb = sandbox as { poll: () => Promise<number | null> };
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Check if sandbox crashed
    const exitCode = await sb.poll();
    if (exitCode !== null) {
      throw new Error(
        `Sandbox exited with code ${exitCode} before becoming healthy. Check logs above for errors.`
      );
    }

    // Check health endpoint
    try {
      const res = await fetch(`${tunnelUrl}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      if (res.ok) return;
    } catch {
      // server not ready yet
    }

    await Bun.sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  throw new Error(
    `vLLM health check timed out after ${Math.round(timeoutMs / 1000)}s. The model may still be loading — try increasing --timeout or check Modal dashboard.`
  );
}

export async function checkTunnelHealth(tunnelUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${tunnelUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
