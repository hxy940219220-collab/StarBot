import {
  type CustomProviderApiFormat,
  DEFAULT_MODEL_SERVERS,
  type DefaultModelServerId,
  detectedModelServerKey,
} from "@starbot/contracts/ipc";
import type { DiscoveredModel } from "./custom-provider-form";
import type { DetectedProvider, ProviderDetection } from "./detected-providers";

export type ThirdPartyApiPresetId =
  | "openrouter-api"
  | "kimi-api"
  | "qwen-api"
  | "deepseek-api"
  | "glm-api"
  | "minimax-api"
  | "mimo-api"
  | "claude-api"
  | "gpt-api"
  | "gemini-api"
  | "grok-api"
  | "muse-api"
  | "hyper-api"
  | "step-api";

export type CustomProviderPresetId =
  | ThirdPartyApiPresetId
  | "openclaw"
  | "ollama"
  | "lmstudio"
  | "openai-compatible"
  | "acp";

export interface ThirdPartyApiPresetSpec {
  readonly id: ThirdPartyApiPresetId;
  readonly providerId: string;
  readonly name: string;
  readonly badge: string;
  readonly accent: string;
  readonly description: string;
  readonly baseUrl: string;
  readonly apiFormat?: CustomProviderApiFormat;
  readonly models: readonly DiscoveredModel[];
}

export const THIRD_PARTY_API_PRESETS: readonly ThirdPartyApiPresetSpec[] = [
  {
    id: "openrouter-api",
    providerId: "openrouter-api",
    name: "OpenRouter",
    badge: "OR",
    accent: "#6E56CF",
    description: "聚合全球主流模型的统一网关",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "openai/gpt-4.1", name: "GPT-4.1" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    ],
  },
  {
    id: "kimi-api",
    providerId: "kimi-api",
    name: "Kimi",
    badge: "Kimi",
    accent: "#3B82F6",
    description: "Moonshot 长上下文与 K2 推理",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [
      { id: "kimi-k2-0711-preview", name: "Kimi K2" },
      { id: "moonshot-v1-128k", name: "Moonshot 128K" },
    ],
  },
  {
    id: "qwen-api",
    providerId: "qwen-api",
    name: "Qwen 通义千问",
    badge: "Qwen",
    accent: "#7C3AED",
    description: "阿里云百炼 DashScope 兼容接口",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-max", name: "Qwen Max" },
      { id: "qwen-plus", name: "Qwen Plus" },
      { id: "qwen3-235b-a22b", name: "Qwen3 235B" },
    ],
  },
  {
    id: "deepseek-api",
    providerId: "deepseek-api",
    name: "DeepSeek",
    badge: "DS",
    accent: "#4F46E5",
    description: "DeepSeek V3 / R1 官方 API",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek Chat" },
      { id: "deepseek-reasoner", name: "DeepSeek Reasoner" },
    ],
  },
  {
    id: "glm-api",
    providerId: "glm-api",
    name: "GLM 智谱",
    badge: "GLM",
    accent: "#2563EB",
    description: "智谱开放平台 GLM 系列接口",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { id: "glm-4.5", name: "GLM-4.5" },
      { id: "glm-4-plus", name: "GLM-4 Plus" },
    ],
  },
  {
    id: "minimax-api",
    providerId: "minimax-api",
    name: "MiniMax",
    badge: "MM",
    accent: "#EC4899",
    description: "MiniMax 官方高速对话 API",
    baseUrl: "https://api.minimax.chat/v1",
    models: [
      { id: "MiniMax-M1", name: "MiniMax M1" },
      { id: "MiniMax-Text-01", name: "MiniMax Text 01" },
    ],
  },
  {
    id: "mimo-api",
    providerId: "mimo-api",
    name: "MiMo 小米",
    badge: "MiMo",
    accent: "#F97316",
    description: "小米 MiMo 推理模型 API",
    baseUrl: "https://api.xiaomimimo.com/v1",
    models: [{ id: "mimo-v2-flash", name: "MiMo V2 Flash" }],
  },
  {
    id: "claude-api",
    providerId: "claude-api",
    name: "Claude API",
    badge: "CL",
    accent: "#D97757",
    description: "Anthropic 官方 API Key 直连",
    baseUrl: "https://api.anthropic.com/v1",
    apiFormat: "anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "claude-3-7-sonnet-latest", name: "Claude 3.7 Sonnet" },
    ],
  },
  {
    id: "gpt-api",
    providerId: "openai-api",
    name: "GPT (OpenAI)",
    badge: "GPT",
    accent: "#10A37F",
    description: "OpenAI 官方 / 中转兼容 API",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4.1", name: "GPT-4.1" },
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "o4-mini", name: "o4-mini" },
    ],
  },
  {
    id: "gemini-api",
    providerId: "gemini-api",
    name: "Gemini API",
    badge: "GM",
    accent: "#4285F4",
    description: "Google AI Studio OpenAI 兼容接口",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    ],
  },
  {
    id: "grok-api",
    providerId: "grok-api",
    name: "Grok (xAI)",
    badge: "Grok",
    accent: "#18181B",
    description: "xAI 官方 Grok API",
    baseUrl: "https://api.x.ai/v1",
    models: [
      { id: "grok-3", name: "Grok 3" },
      { id: "grok-3-mini", name: "Grok 3 Mini" },
    ],
  },
  {
    id: "muse-api",
    providerId: "muse-api",
    name: "Muse",
    badge: "Muse",
    accent: "#9333EA",
    description: "Muse 创意与多模态模型 API",
    baseUrl: "https://api.muse.ai/v1",
    models: [{ id: "muse-1", name: "Muse 1" }],
  },
  {
    id: "hyper-api",
    providerId: "hyper-api",
    name: "Hyper",
    badge: "HY",
    accent: "#0EA5E9",
    description: "Hyperbolic 高速开源大模型接口",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    models: [
      { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" },
      { id: "Qwen/Qwen2.5-72B-Instruct", name: "Qwen 2.5 72B" },
    ],
  },
  {
    id: "step-api",
    providerId: "step-api",
    name: "Step 阶跃星辰",
    badge: "Step",
    accent: "#14B8A6",
    description: "阶跃星辰 StepFun 官方 API",
    baseUrl: "https://api.stepfun.com/v1",
    models: [
      { id: "step-2-16k", name: "Step 2 16K" },
      { id: "step-1-flash", name: "Step 1 Flash" },
    ],
  },
];

const THIRD_PARTY_PRESET_MAP = new Map<ThirdPartyApiPresetId, ThirdPartyApiPresetSpec>(
  THIRD_PARTY_API_PRESETS.map((preset) => [preset.id, preset]),
);

export type LocalServerProbe = { status: "checking" } | { status: "running"; models: number };

function foundServer(detection: ProviderDetection | undefined, id: DefaultModelServerId) {
  const key = detectedModelServerKey(DEFAULT_MODEL_SERVERS[id].baseUrl);
  return detection?.found.find((row) => row.kind === "models" && row.key === key);
}

export function localServerProbes(
  detection: ProviderDetection | undefined,
): Partial<Record<DefaultModelServerId, LocalServerProbe>> {
  const probes: Partial<Record<DefaultModelServerId, LocalServerProbe>> = {};
  for (const id of ["ollama", "lmstudio"] as const) {
    const found = foundServer(detection, id);
    if (found?.kind === "models") probes[id] = { status: "running", models: found.models.length };
    else if (detection?.scanning) probes[id] = { status: "checking" };
  }
  return probes;
}

export function presetSetupProvider(
  preset: CustomProviderPresetId,
  detection: ProviderDetection | undefined,
): DetectedProvider {
  if (preset === "openclaw") {
    return { kind: "agent", key: "openclaw", id: "openclaw", name: "OpenClaw", command: "openclaw", args: "acp" };
  }
  if (preset === "acp") return { kind: "agent", key: "", id: "", name: "", command: "", args: "" };
  if (preset === "openai-compatible") return { kind: "models", key: "", id: "", name: "", baseUrl: "", models: [] };

  const thirdParty = THIRD_PARTY_PRESET_MAP.get(preset as ThirdPartyApiPresetId);
  if (thirdParty) {
    return {
      kind: "models",
      key: detectedModelServerKey(thirdParty.baseUrl),
      id: thirdParty.providerId,
      name: thirdParty.name,
      baseUrl: thirdParty.baseUrl,
      apiFormat: thirdParty.apiFormat ?? "openai",
      models: thirdParty.models,
    };
  }

  const found = foundServer(detection, preset as DefaultModelServerId);
  if (found) return found;
  const server = DEFAULT_MODEL_SERVERS[preset as DefaultModelServerId];
  return {
    kind: "models",
    key: detectedModelServerKey(server.baseUrl),
    id: preset,
    name: server.name,
    baseUrl: server.baseUrl,
    models: [],
  };
}
