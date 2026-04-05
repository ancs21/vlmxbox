export interface VlmConfig {
  model: string;
  gpu: string;
  timeout: number;
  toolParser: string;
  vllmImage: string;
  extraArgs: string[];
  fast: boolean;
  costPerHour?: string;
}

export interface ModelPreset {
  model: string;
  gpu: string;
  toolParser: string;
  extraArgs: string[];
  vllmImage?: string;
  description: string;
  costPerHour?: string; // estimated cost e.g. "$0.59"
}

export interface SandboxState {
  sandboxId: string;
  sandboxName: string;
  tunnelUrl: string;
  model: string;
  gpu: string;
  toolParser: string;
  startedAt: string;
}

export interface SandboxInfo {
  sandboxId: string;
  sandboxName: string;
  tunnelUrl: string;
  sandbox: unknown; // Modal Sandbox instance
}
