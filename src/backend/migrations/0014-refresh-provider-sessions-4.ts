import { refreshProviderSessionsForDynamicTools } from "./0009-refresh-provider-sessions-1";
import type { StarBotMigration } from "./migration";

export const migration: StarBotMigration = {
  version: 14,
  name: "refresh-provider-sessions-4",
  up: refreshProviderSessionsForDynamicTools,
};
