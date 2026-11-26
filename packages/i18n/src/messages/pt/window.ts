import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "Computador anfitrião local do StarBot",

  "window.localClientTitle": "Cliente local do StarBot",

  "window.computerUsePermissionTitle": "Ativar Uso do computador",
  "window.rendererStoppedTitle": "O StarBot parou de funcionar",

  "window.rendererStoppedBody":
    "A janela parou várias vezes. Suas conversas estão salvas e seus agentes continuam trabalhando.",
  "window.rendererStoppedReload": "Recarregar",
} as const satisfies PartialTranslation<typeof source>;
