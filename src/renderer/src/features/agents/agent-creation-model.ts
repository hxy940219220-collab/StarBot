import { developmentStartingModel } from "@openbot/contracts/development-defaults";
import {
  type AgentModelId,
  type AgentProviderId,
  type AgentReasoningEffort,
  type AgentStatus,
  type AppSetupState,
  type ClientAgentModelOption,
  defaultProviderModel,
  PICKER_PROVIDERS,
} from "@openbot/contracts/ipc";

export type CreationPreference = Pick<AppSetupState, "preferredProvider" | "preferredModel">;

export interface CreationModelChoice {
  provider: AgentProviderId;
  model: AgentModelId;
  reasoningEffort?: AgentReasoningEffort | undefined;
}

export interface DevelopmentCreation {
  providerAvailable: (provider: AgentProviderId) => boolean;
}

export function resolveCreationModel(
  setup: CreationPreference | null,
  listedOptions: ClientAgentModelOption[],
  status: AgentStatus | null | undefined,
  development: DevelopmentCreation | null = null,
): CreationModelChoice | null {
  const modelOptions = listedOptions.filter((option) => option.listing !== "kept");
  const preferred = setup?.preferredProvider ?? null;
  const developmentStart = development !== null && (preferred ?? "codex") === "codex" && !setup?.preferredModel;
  const start = developmentStartingModel({
    enabled: developmentStart,
    models: modelOptions,
    providerAvailable: (provider) => development?.providerAvailable(provider) ?? false,
  });
  if (start)
    return { provider: start.provider, model: start.model.id, reasoningEffort: start.model.defaultReasoningEffort };
  const orderedBase: AgentProviderId[] = [
    ...PICKER_PROVIDERS,
    ...(PICKER_PROVIDERS.includes("opencode") ? [] : (["opencode"] as const)),
  ];
  const ordered: AgentProviderId[] = preferred
    ? [preferred, ...orderedBase.filter((provider) => provider !== preferred)]
    : orderedBase;
  const isAvailable = (provider: AgentProviderId) => {
    const row = status?.providers?.find((item) => item.id === provider);
    return row?.state === "available" && !row.off;
  };
  const isRunnable = (provider: AgentProviderId) => {
    const row = status?.providers?.find((item) => item.id === provider);
    if (row?.off) return false;
    return !row || row.state === "available" || row.state === "checking";
  };
  // Pass 1: strongly prefer a provider that is confirmed available (avoids picking unconfigured CLIs like Hermes)
  // Pass 2: fall back to runnable providers (even if `preferred` was stale, never pick a sign-in-required CLI over a ready one)
  for (const pass of ["available", "runnable"] as const) {
    for (const provider of ordered) {
      if (developmentStart && !development?.providerAvailable(provider)) continue;
      if (pass === "available") {
        if (!isAvailable(provider)) continue;
      } else if (!isRunnable(provider)) {
        continue;
      }
      const options = modelOptions.filter((option) => option.provider === provider);
      if (options.length === 0) continue;
      if (provider === preferred && setup?.preferredModel) {
        const kept = options.find((option) => option.id === setup.preferredModel);
        if (kept) return { provider, model: kept.id };
      }
      const fallback = options.find((option) => option.id === defaultProviderModel(provider)) ?? options[0];
      if (fallback) return { provider, model: fallback.id };
    }
  }
  return null;
}
