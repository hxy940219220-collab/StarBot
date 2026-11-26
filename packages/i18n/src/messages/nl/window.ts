import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "Lokale StarBot-host",

  "window.localClientTitle": "Lokale StarBot-client",

  "window.computerUsePermissionTitle": "Zet Computerbesturing aan",
  "window.rendererStoppedTitle": "StarBot werkt niet meer",

  "window.rendererStoppedBody":
    "Het venster is meerdere keren gestopt. Je chats zijn opgeslagen en je agents blijven werken.",
  "window.rendererStoppedReload": "Herladen",
} as const satisfies PartialTranslation<typeof source>;
