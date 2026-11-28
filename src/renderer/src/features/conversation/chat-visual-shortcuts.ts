import type { ChatVisualKey } from "@starbot/contracts/chat-visual";
import { SHORTCUT_COMMANDS } from "@starbot/ui/features/settings/keyboard-shortcuts";
import { matchesShortcut } from "../../keyboard-shortcut-preference";
import { isOpenSettingsShortcut } from "../settings/settings-shortcut";

export function isChatVisualAppShortcut(key: ChatVisualKey): boolean {
  if (isOpenSettingsShortcut(key) || SHORTCUT_COMMANDS.some((command) => matchesShortcut(key, command))) return true;
  return (key.metaKey || key.ctrlKey) && !key.altKey && !key.shiftKey && /^[1-9]$/u.test(key.key);
}
