import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "Lokaler StarBot-Host",

  "window.localClientTitle": "Lokaler StarBot-Client",

  "window.computerUsePermissionTitle": "Computersteuerung aktivieren",
  "window.rendererStoppedTitle": "StarBot funktioniert nicht mehr",

  "window.rendererStoppedBody":
    "Das Fenster wurde mehrmals beendet. Deine Chats sind gespeichert, und deine Agenten arbeiten weiter.",
  "window.rendererStoppedReload": "Neu laden",
} as const satisfies PartialTranslation<typeof source>;
