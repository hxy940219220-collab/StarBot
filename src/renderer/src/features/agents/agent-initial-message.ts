import { agentWelcomeMessage } from "@starbot/contracts/agent-welcome";
import { appLanguageOption } from "@starbot/i18n/languages";
import type { FirstAgentDraft } from "@starbot/ui/features/agents/FirstAgentSetup";
import { currentText } from "@starbot/ui/text";

export function createAgentInitialMessage(draft: Pick<FirstAgentDraft, "purpose">, welcomeSupported: boolean): string {
  if (welcomeSupported) return agentWelcomeMessage({ language: appLanguageOption(currentText().locale()).label });
  const purpose = draft.purpose.trim();
  return purpose ? `Your ongoing role is: ${purpose}` : "Greet me briefly.";
}
