import * as p from "@clack/prompts";
import { existsSync, renameSync, unlinkSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO = "ancs21/vlmxbox";

function detectAssetName(): string {
  const os = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `vlmxbox-${os}-${arch}`;
}

async function fetchLatestVersion(): Promise<{ tag: string; downloadUrl: string }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github.v3+json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status}: ${await res.text()}`);
  }

  const release = await res.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] };
  const assetName = detectAssetName();
  const asset = release.assets.find((a) => a.name === assetName);

  if (!asset) {
    throw new Error(
      `No binary found for ${assetName} in release ${release.tag_name}. Available: ${release.assets.map((a) => a.name).join(", ")}`
    );
  }

  return { tag: release.tag_name, downloadUrl: asset.browser_download_url };
}

function getCurrentVersion(): string {
  // Read from package.json at build time — Bun embeds this
  return require("../../package.json").version;
}

function getBinaryPath(): string {
  return resolve(process.argv[0]);
}

export async function upgrade(): Promise<void> {
  p.intro("vlmxbox upgrade");

  const currentVersion = getCurrentVersion();
  p.log.info(`Current version: ${currentVersion}`);

  const spin = p.spinner();
  spin.start("Checking for updates...");

  let latest: { tag: string; downloadUrl: string };
  try {
    latest = await fetchLatestVersion();
  } catch (err: any) {
    spin.stop("Failed to check for updates");
    p.log.error(err.message);
    process.exit(1);
  }

  const latestVersion = latest.tag.replace(/^v/, "");

  if (latestVersion === currentVersion) {
    spin.stop("Already up to date");
    p.log.success(`vlmxbox ${currentVersion} is the latest version.`);
    p.outro("");
    return;
  }

  spin.message(`Downloading ${latest.tag}...`);

  const binaryPath = getBinaryPath();
  const tmpPath = binaryPath + ".tmp";

  try {
    const res = await fetch(latest.downloadUrl, {
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }

    await Bun.write(tmpPath, res);
    chmodSync(tmpPath, 0o755);

    // Atomic replace: rename new over old
    const backupPath = binaryPath + ".bak";
    try {
      if (existsSync(binaryPath)) {
        renameSync(binaryPath, backupPath);
      }
      renameSync(tmpPath, binaryPath);
      // Clean up backup
      try { unlinkSync(backupPath); } catch {}
    } catch (err) {
      // Rollback: restore backup
      try {
        if (existsSync(backupPath)) renameSync(backupPath, binaryPath);
      } catch {}
      try { unlinkSync(tmpPath); } catch {}
      throw err;
    }

    spin.stop("Download complete");
    p.log.success(`Upgraded vlmxbox: ${currentVersion} → ${latestVersion}`);
  } catch (err: any) {
    spin.stop("Upgrade failed");
    try { unlinkSync(tmpPath); } catch {}
    p.log.error(err.message);
    process.exit(1);
  }

  p.outro("");
}
