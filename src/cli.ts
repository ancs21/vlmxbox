#!/usr/bin/env bun
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import { DEFAULTS, PRESETS, DEFAULT_PRESET } from "./config";
import type { VlmConfig } from "./types";

const presetNames = Object.keys(PRESETS);

function printUsage() {
  console.log(`
vlmxbox - Turnkey VLM sandbox for Claude Code

Usage:
  vlmxbox up [options]       Start a VLM sandbox
  vlmxbox down               Stop the sandbox
  vlmxbox restart [options]  Stop and start with new config
  vlmxbox status             Show sandbox status
  vlmxbox presets            List available model presets
  vlmxbox upgrade            Upgrade vlmxbox to the latest version

Options:
  --preset <name>       Use a model preset (default: ${DEFAULT_PRESET})
  --fast                Fast startup — skip CUDA graph compilation (-O0)
  --model <id>          Override model ID
  --gpu <type>          Override GPU type
  --timeout <ms>        Idle timeout in ms (default: ${DEFAULTS.timeout})
  --tool-parser <name>  Override vLLM tool-call parser
  --vllm-image <tag>    vLLM Docker image (default: ${DEFAULTS.vllmImage})
  --help                Show this help message

Presets:
${presetNames.map((k) => `  ${k.padEnd(18)} ${PRESETS[k].description}`).join("\n")}
`);
}

async function parseConfig(): Promise<VlmConfig> {
  const { values } = parseArgs({
    args: Bun.argv.slice(3),
    options: {
      preset: { type: "string" },
      fast: { type: "boolean", default: false },
      model: { type: "string" },
      gpu: { type: "string" },
      timeout: { type: "string", default: String(DEFAULTS.timeout) },
      "tool-parser": { type: "string" },
      "vllm-image": { type: "string", default: DEFAULTS.vllmImage },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  // Interactive preset selection if no --preset flag
  let presetName = values.preset;
  if (!presetName) {
    const selected = await p.select({
      message: "Select a model preset",
      options: presetNames.map((k) => ({
        value: k,
        label: `${k} — ${PRESETS[k].gpu} ${PRESETS[k].costPerHour ?? ""}/hr`,
        hint: PRESETS[k].description,
      })),
    });
    if (p.isCancel(selected)) { process.exit(0); }
    presetName = selected as string;
  }

  const preset = PRESETS[presetName];
  if (!preset) {
    p.log.error(`Unknown preset: ${presetName}. Available: ${presetNames.join(", ")}`);
    process.exit(1);
  }

  return {
    model: values.model ?? preset.model,
    gpu: values.gpu ?? preset.gpu,
    timeout: parseInt(values.timeout!, 10),
    toolParser: values["tool-parser"] ?? preset.toolParser,
    vllmImage: values["vllm-image"] !== DEFAULTS.vllmImage
      ? values["vllm-image"]!
      : preset.vllmImage ?? DEFAULTS.vllmImage,
    extraArgs: preset.extraArgs,
    fast: values.fast!,
    costPerHour: preset.costPerHour,
  };
}

function printPresets() {
  console.log("\nAvailable presets:\n");
  for (const [name, preset] of Object.entries(PRESETS)) {
    const marker = name === DEFAULT_PRESET ? " (default)" : "";
    console.log(`  ${name}${marker}`);
    console.log(`    Model:  ${preset.model}`);
    console.log(`    GPU:    ${preset.gpu}`);
    console.log(`    Cost:   ${preset.costPerHour ?? "?"}/hr`);
    console.log(`    ${preset.description}`);
    console.log();
  }
}

async function main() {
  const subcommand = Bun.argv[2];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printUsage();
    process.exit(0);
  }

  switch (subcommand) {
    case "up": {
      const config = await parseConfig();
      const { up } = await import("./commands/up");
      await up(config);
      break;
    }
    case "restart": {
      const config = await parseConfig();
      const { down } = await import("./commands/down");
      const { up } = await import("./commands/up");
      await down();
      await up(config);
      break;
    }
    case "down": {
      const { down } = await import("./commands/down");
      await down();
      break;
    }
    case "status": {
      const { status } = await import("./commands/status");
      await status();
      break;
    }
    case "presets": {
      printPresets();
      break;
    }
    case "upgrade": {
      const { upgrade } = await import("./commands/upgrade");
      await upgrade();
      break;
    }
    default:
      p.log.error(`Unknown command: ${subcommand}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
