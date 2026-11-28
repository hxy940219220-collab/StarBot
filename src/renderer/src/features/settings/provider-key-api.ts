import type { ProviderAdminDesktopApi } from "@starbot/contracts/ipc";
import type { ProviderKeyApi } from "@starbot/ui/features/settings/OpenCodeKeyDialog";

export const providerKeyApi: ProviderKeyApi = {
  getProviderApiKeyState: (provider) => window.starbot.getProviderApiKeyState(provider),
  setProviderApiKey: (input) => window.starbot.setProviderApiKey(input),
  clearProviderApiKey: (provider) => window.starbot.clearProviderApiKey(provider),
  openExternal: (destination) => window.starbot.openExternal(destination),
};

export function hostProviderKeyApi(
  admin: () => ProviderAdminDesktopApi,
  serverId: string,
  openExternal: ProviderKeyApi["openExternal"] = (destination) => window.starbot.openExternal(destination),
): ProviderKeyApi {
  return {
    onHost: true,
    getProviderApiKeyState: (provider) => admin().getApiKeyState(provider, serverId),
    setProviderApiKey: (input) => admin().setApiKey(input, serverId),
    clearProviderApiKey: (provider) => admin().clearApiKey(provider, serverId),
    openExternal,
  };
}
