import { agentWelcomeMessage } from "@starbot/contracts/agent-welcome";
import type { CreateAgentInput } from "@starbot/contracts/ipc";
import { appLanguageOption } from "@starbot/i18n/languages";
import type { TranslatedLocale } from "@starbot/i18n/mobile";

export type NewAgentInput = Omit<CreateAgentInput, "initialMessage"> & { firstTask?: string };

export function agentInitialMessage(
  roleDescription: string,
  task: string,
  welcome: { locale: TranslatedLocale } | null,
): string {
  if (welcome)
    return agentWelcomeMessage({
      language: appLanguageOption(welcome.locale).label,
      firstRequestFollows: task.trim().length > 0,
    });
  const parts = [roleDescription.trim() ? `Your ongoing role is: ${roleDescription.trim()}` : "", task.trim()].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join("\n\n") : "Greet me briefly.";
}
