import {
  type AgentProviderId,
  agentProviderName,
  isProviderEnvironmentProvider,
  type StarBotDesktopApi,
  type ProviderEnvironment,
  type ProviderEnvironmentVariableInput,
} from "@starbot/contracts/ipc";
import type { ProviderEnvironmentControl } from "@starbot/ui/features/settings/ProviderSettingsPage";
import { useText } from "@starbot/ui/text";
import { createHostSetting } from "./host-setting-state";

export type HostProviderEnvironmentCalls = Pick<
  StarBotDesktopApi["hostAdmin"],
  "getProviderEnvironment" | "setProviderEnvironment"
>;

export interface HostProviderEnvironmentOptions {
  calls?: HostProviderEnvironmentCalls;
}

export interface ProviderEnvironmentSource extends HostProviderEnvironmentOptions {
  serverId: string;
}

export function createProviderEnvironment(
  source: () => ProviderEnvironmentSource | undefined,
  status: () => unknown,
): () => ((provider: AgentProviderId) => ProviderEnvironmentControl | undefined) | undefined {
  const { t } = useText();
  const calls = (): HostProviderEnvironmentCalls => source()?.calls ?? window.starbot.hostAdmin;

  function open(provider: AgentProviderId): ProviderEnvironmentControl | undefined {
    if (!isProviderEnvironmentProvider(provider)) return undefined;
    const setting = createHostSetting<ProviderEnvironment, ProviderEnvironmentVariableInput[]>({
      serverId: () => source()?.serverId,
      status,
      read: (serverId) => calls().getProviderEnvironment(provider, serverId),
      save: (variables, serverId) => calls().setProviderEnvironment({ provider, variables }, serverId),
      loadFailed: () => t("provider.settings.environmentLoadFailed", { name: agentProviderName(provider) }),
    });
    return {
      get value() {
        return setting.state.value;
      },
      get pending() {
        return setting.state.pending;
      },
      get error() {
        return setting.state.error;
      },
      onSave: (variables) => void setting.choose(variables),
    };
  }
  return () => (source() ? open : undefined);
}
