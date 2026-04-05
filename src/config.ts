import type { VlmConfig, ModelPreset } from "./types";

// Gemma 4 Docker image (required for Gemma 4 models)
const GEMMA4_IMAGE = "vllm/vllm-openai:gemma4";

// Model presets — exact match with https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html
export const PRESETS: Record<string, ModelPreset> = {
  // --- Quick Start (Single GPU) ---
  "gemma4-e2b": {
    model: "google/gemma-4-E2B-it",
    gpu: "T4",
    toolParser: "gemma4",
    vllmImage: GEMMA4_IMAGE,
    extraArgs: [
      "--max-model-len", "8192",
    ],
    description: "Gemma 4 E2B — 2B effective, cheapest testing option. T4 GPU.",
    costPerHour: "$0.59",
  },
  "gemma4-e4b": {
    model: "google/gemma-4-E4B-it",
    gpu: "T4",
    toolParser: "gemma4",
    vllmImage: GEMMA4_IMAGE,
    extraArgs: [
      "--max-model-len", "8192",
    ],
    description: "Gemma 4 E4B — 4B effective, good for dev testing. T4 GPU.",
    costPerHour: "$0.59",
  },

  // --- 26B MoE on 1× A100/H100 (BF16) ---
  "gemma4-moe": {
    model: "google/gemma-4-26B-A4B-it",
    gpu: "A100-80GB",
    toolParser: "gemma4",
    vllmImage: GEMMA4_IMAGE,
    extraArgs: [
      "--max-model-len", "32768",
      "--gpu-memory-utilization", "0.90",
    ],
    description: "Gemma 4 26B MoE — only 4B active params, 26B quality. A100 GPU.",
    costPerHour: "$2.50",
  },

  // --- 31B Dense on 2× A100/H100 (TP2, BF16) — Full-Featured Server ---
  "gemma4-31b": {
    model: "google/gemma-4-31B-it",
    gpu: "H100:2",
    toolParser: "gemma4",
    vllmImage: GEMMA4_IMAGE,
    extraArgs: [
      "--tensor-parallel-size", "2",
      "--max-model-len", "16384",
      "--gpu-memory-utilization", "0.90",
      "--enable-auto-tool-choice",
      "--reasoning-parser", "gemma4",
      "--tool-call-parser", "gemma4",
      "--limit-mm-per-prompt", "{\"image\": 0, \"audio\": 0}",
      "--async-scheduling",
    ],
    description: "Gemma 4 31B — full recipe, TP2, thinking + tool calling. 2× H100.",
    costPerHour: "$7.90",
  },
  "gemma4-31b-vision": {
    model: "google/gemma-4-31B-it",
    gpu: "H100:2",
    toolParser: "gemma4",
    vllmImage: GEMMA4_IMAGE,
    extraArgs: [
      "--tensor-parallel-size", "2",
      "--max-model-len", "16384",
      "--gpu-memory-utilization", "0.90",
      "--enable-auto-tool-choice",
      "--reasoning-parser", "gemma4",
      "--tool-call-parser", "gemma4",
      "--limit-mm-per-prompt", "{\"image\": 4, \"audio\": 1}",
      "--async-scheduling",
    ],
    description: "Gemma 4 31B + vision — full recipe, TP2, multimodal. 2× H100.",
    costPerHour: "$7.90",
  },

  // --- Qwen3 (Apache 2.0) — fully open-source ---

  "qwen3-4b": {
    model: "Qwen/Qwen3-4B",
    gpu: "T4",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--max-model-len", "8192",
      "--reasoning-parser", "qwen3",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
      "--enable-prefix-caching",
    ],
    description: "Qwen3 4B — Apache 2.0, thinking + tool calling. T4 GPU.",
    costPerHour: "$0.59",
  },
  "qwen3-8b": {
    model: "Qwen/Qwen3-8B",
    gpu: "A10G",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--max-model-len", "16384",
      "--reasoning-parser", "qwen3",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
      "--enable-prefix-caching",
    ],
    description: "Qwen3 8B — Apache 2.0, strong coding + tool calling. A10G GPU.",
    costPerHour: "$1.10",
  },
  "qwen3-32b": {
    model: "Qwen/Qwen3-32B",
    gpu: "A100-80GB",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--max-model-len", "32768",
      "--gpu-memory-utilization", "0.90",
      "--reasoning-parser", "qwen3",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
      "--enable-prefix-caching",
    ],
    description: "Qwen3 32B — Apache 2.0, top coding quality. A100 GPU.",
    costPerHour: "$2.50",
  },
  "qwen3-30b-moe": {
    model: "Qwen/Qwen3-30B-A3B",
    gpu: "T4",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--max-model-len", "8192",
      "--reasoning-parser", "qwen3",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
      "--enable-prefix-caching",
    ],
    description: "Qwen3 30B MoE — Apache 2.0, only 3B active, 30B quality. T4 GPU.",
    costPerHour: "$0.59",
  },

  // --- Qwen3.5 (Apache 2.0) — from official recipe ---
  // https://docs.vllm.ai/projects/recipes/en/latest/Qwen/Qwen3.5.html

  "qwen3.5-text": {
    model: "Qwen/Qwen3.5-397B-A17B-FP8",
    gpu: "H100:8",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--data-parallel-size", "8",
      "--enable-expert-parallel",
      "--language-model-only",
      "--reasoning-parser", "qwen3",
      "--enable-prefix-caching",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
    ],
    description: "Qwen3.5 397B MoE FP8 — Apache 2.0, text-only throughput. 8× H100.",
    costPerHour: "$31.58",
  },
  "qwen3.5-vision": {
    model: "Qwen/Qwen3.5-397B-A17B-FP8",
    gpu: "H100:8",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--data-parallel-size", "8",
      "--enable-expert-parallel",
      "--mm-encoder-tp-mode", "data",
      "--mm-processor-cache-type", "shm",
      "--reasoning-parser", "qwen3",
      "--enable-prefix-caching",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
    ],
    description: "Qwen3.5 397B MoE FP8 — Apache 2.0, multimodal. 8× H100.",
    costPerHour: "$31.58",
  },
  "qwen3.5-latency": {
    model: "Qwen/Qwen3.5-397B-A17B-FP8",
    gpu: "H100:8",
    toolParser: "qwen3_coder",
    extraArgs: [
      "--tensor-parallel-size", "8",
      "--speculative-config", "{\"method\": \"mtp\", \"num_speculative_tokens\": 1}",
      "--reasoning-parser", "qwen3",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "qwen3_coder",
    ],
    description: "Qwen3.5 397B MoE FP8 — Apache 2.0, low-latency MTP-1. 8× H100.",
    costPerHour: "$31.58",
  },

  // --- OpenAI GPT-OSS (Apache 2.0) — from official recipe ---
  // https://docs.vllm.ai/projects/recipes/en/latest/OpenAI/GPT-OSS.html

  "gpt-oss-20b": {
    model: "openai/gpt-oss-20b",
    gpu: "A100-80GB",
    toolParser: "openai",
    extraArgs: [
      "--no-enable-prefix-caching",
      "--max-cudagraph-capture-size", "2048",
      "--max-num-batched-tokens", "8192",
      "--stream-interval", "20",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "openai",
    ],
    description: "GPT-OSS 20B — Apache 2.0, 3.6B active MoE, reasoning + tools. Single A100.",
    costPerHour: "$2.50",
  },
  "gpt-oss-120b": {
    model: "openai/gpt-oss-120b",
    gpu: "A100-80GB",
    toolParser: "openai",
    extraArgs: [
      "--no-enable-prefix-caching",
      "--max-cudagraph-capture-size", "2048",
      "--max-num-batched-tokens", "8192",
      "--stream-interval", "20",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "openai",
    ],
    description: "GPT-OSS 120B — Apache 2.0, 5.1B active MoE, strong reasoning. Single A100.",
    costPerHour: "$2.50",
  },
  "gpt-oss-120b-tp8": {
    model: "openai/gpt-oss-120b",
    gpu: "H100:8",
    toolParser: "openai",
    extraArgs: [
      "--tensor-parallel-size", "8",
      "--no-enable-prefix-caching",
      "--max-cudagraph-capture-size", "2048",
      "--max-num-batched-tokens", "8192",
      "--stream-interval", "20",
      "--gpu-memory-utilization", "0.95",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "openai",
    ],
    description: "GPT-OSS 120B — Apache 2.0, TP8 max throughput. 8× H100.",
    costPerHour: "$31.58",
  },

  // --- Mistral Instruct (Apache 2.0) — from official recipe ---
  // https://docs.vllm.ai/projects/recipes/en/latest/Mistral/Ministral-3-Instruct.html

  "ministral-3b": {
    model: "mistralai/Ministral-3-3B-Instruct-2512",
    gpu: "T4",
    toolParser: "mistral",
    extraArgs: [
      "--tokenizer_mode", "mistral",
      "--config_format", "mistral",
      "--load_format", "mistral",
      "--max-model-len", "8192",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "mistral",
    ],
    description: "Ministral 3B Instruct — Apache 2.0, tool calling, vision. T4 GPU.",
    costPerHour: "$0.59",
  },
  "ministral-8b": {
    model: "mistralai/Ministral-3-8B-Instruct-2512",
    gpu: "A10G",
    toolParser: "mistral",
    extraArgs: [
      "--tokenizer_mode", "mistral",
      "--config_format", "mistral",
      "--load_format", "mistral",
      "--max-model-len", "16384",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "mistral",
    ],
    description: "Ministral 8B Instruct — Apache 2.0, tool calling, vision. A10G GPU.",
    costPerHour: "$1.10",
  },
  "ministral-14b": {
    model: "mistralai/Ministral-3-14B-Instruct-2512",
    gpu: "H100",
    toolParser: "mistral",
    extraArgs: [
      "--tokenizer_mode", "mistral",
      "--config_format", "mistral",
      "--load_format", "mistral",
      "--max-model-len", "32768",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "mistral",
    ],
    description: "Ministral 14B Instruct — Apache 2.0, tool calling, vision. H100 GPU.",
    costPerHour: "$3.95",
  },

  // --- Mistral Reasoning (Apache 2.0) — from official recipe ---
  // https://docs.vllm.ai/projects/recipes/en/latest/Mistral/Ministral-3-Reasoning.html

  "ministral-3b-reasoning": {
    model: "mistralai/Ministral-3-3B-Reasoning-2512",
    gpu: "T4",
    toolParser: "mistral",
    extraArgs: [
      "--tokenizer_mode", "mistral",
      "--config_format", "mistral",
      "--load_format", "mistral",
      "--max-model-len", "8192",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "mistral",
      "--reasoning-parser", "mistral",
    ],
    description: "Ministral 3B Reasoning — Apache 2.0, thinking + tools + vision. T4 GPU.",
    costPerHour: "$0.59",
  },
  "ministral-8b-reasoning": {
    model: "mistralai/Ministral-3-8B-Reasoning-2512",
    gpu: "A10G",
    toolParser: "mistral",
    extraArgs: [
      "--tokenizer_mode", "mistral",
      "--config_format", "mistral",
      "--load_format", "mistral",
      "--max-model-len", "16384",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "mistral",
      "--reasoning-parser", "mistral",
    ],
    description: "Ministral 8B Reasoning — Apache 2.0, thinking + tools + vision. A10G GPU.",
    costPerHour: "$1.10",
  },
  "ministral-14b-reasoning": {
    model: "mistralai/Ministral-3-14B-Reasoning-2512",
    gpu: "H100:2",
    toolParser: "mistral",
    extraArgs: [
      "--tensor-parallel-size", "2",
      "--tokenizer_mode", "mistral",
      "--config_format", "mistral",
      "--load_format", "mistral",
      "--enable-auto-tool-choice",
      "--tool-call-parser", "mistral",
      "--reasoning-parser", "mistral",
    ],
    description: "Ministral 14B Reasoning — Apache 2.0, thinking + tools + vision. 2× H100.",
    costPerHour: "$7.90",
  },
};

export const DEFAULT_PRESET = "gemma4-e4b";

export const DEFAULTS: VlmConfig = {
  ...PRESETS[DEFAULT_PRESET],
  timeout: 600_000,
  vllmImage: PRESETS[DEFAULT_PRESET].vllmImage ?? "vllm/vllm-openai:latest",
};

export const MODAL_APP_NAME = "vlmxbox-server";
export const MODAL_VOLUME_NAME = "vlmxbox-model-cache";
export const VLLM_PORT = 8000;
export const HEALTH_CHECK_INTERVAL_MS = 2_000;
export const HEALTH_CHECK_TIMEOUT_FIRST_RUN_MS = 600_000;
export const HEALTH_CHECK_TIMEOUT_WARM_MS = 120_000;
export const POLL_INTERVAL_MS = 5_000;
export const TUNNEL_HEALTH_CHECK_INTERVAL_MS = 30_000;
export const STATE_FILE = ".vlmxbox-state.json";
