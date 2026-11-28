import { DEFAULT_REMOTE_CONTROL_POLICY, isRemoteControlAccess, type RemoteControlPolicy } from "@starbot/contracts/ipc";
import { isBoolean, isDynamicRecord } from "@starbot/contracts/runtime-values";
import { PreferenceStore } from "./preference-file";

export type RemoteControlPolicyStore = PreferenceStore<RemoteControlPolicy>;

export function createRemoteControlPolicyStore(path: string): RemoteControlPolicyStore {
  return new PreferenceStore({
    path,
    defaultValue: DEFAULT_REMOTE_CONTROL_POLICY,
    decode: (parsed) =>
      isDynamicRecord(parsed) &&
      parsed.version === 1 &&
      isRemoteControlAccess(parsed.access) &&
      isBoolean(parsed.askOnHost)
        ? { access: parsed.access, askOnHost: parsed.askOnHost }
        : null,
  });
}
