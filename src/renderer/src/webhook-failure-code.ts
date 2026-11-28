import { matchingSourceKeys } from "@starbot/i18n";
import { normalizeMessage } from "@starbot/user-errors/reference";

export function webhookFailureCode(error: unknown, fallback: string): string {
  return matchingSourceKeys(normalizeMessage(error))[0] === "error.backend.webhookRouteLimit"
    ? "webhook_route_limit"
    : fallback;
}
