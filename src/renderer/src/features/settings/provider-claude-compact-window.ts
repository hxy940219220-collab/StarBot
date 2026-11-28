import type { ClaudeCompactWindowSetting, StarBotDesktopApi } from "@starbot/contracts/ipc";
import type { ProviderClaudeCompactWindow } from "@starbot/ui/features/settings/ProviderSettingsPage";
import { useText } from "@starbot/ui/text";
import { createHostSetting } from "./host-setting-state";

export type HostClaudeCompactWindowCalls = Pick<
  StarBotDesktopApi["hostAdmin"],
  "getClaudeCompactWindow" | "setClaudeCompactWindow"
>;

export interface HostClaudeCompactWindowOptions {
  calls?: HostClaudeCompactWindowCalls;
}

export interface ProviderClaudeCompactWindowSource extends HostClaudeCompactWindowOptions {
  serverId: string;
}

export function createProviderClaudeCompactWindow(
  source: () => ProviderClaudeCompactWindowSource | undefined,
  status: () => unknown,
): () => ProviderClaudeCompactWindow | undefined {
  const { t } = useText();
  const calls = (): HostClaudeCompactWindowCalls => source()?.calls ?? window.starbot.hostAdmin;
  const setting = createHostSetting<ClaudeCompactWindowSetting, number | null>({
    serverId: () => source()?.serverId,
    status,
    read: (serverId) => calls().getClaudeCompactWindow(serverId),
    save: (tokens, serverId) => calls().setClaudeCompactWindow(tokens, serverId),
    loadFailed: () => t("provider.settings.compactWindowLoadFailed"),
  });
  const compaction: ProviderClaudeCompactWindow = {
    get value() {
      return setting.state.value;
    },
    get pending() {
      return setting.state.pending;
    },
    get error() {
      return setting.state.error;
    },
    onChange: (tokens) => void setting.choose(tokens),
  };
  return () => (source() ? compaction : undefined);
}
