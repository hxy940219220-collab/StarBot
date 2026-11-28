import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/host";

export const messages = {
  "status.host.registered": "Este StarBot foi registrado para acesso por WebRTC.",

  "status.host.keyRotated": "Chave do servidor alterada. Os dispositivos pareados continuam pareados.",
  "status.host.identityUpdated": "Identidade do servidor atualizada.",
  "status.host.starting": "Iniciando o computador anfitrião WebRTC…",
  "status.host.ready": "Este StarBot está pronto para conexões WebRTC.",

  "status.host.signalLost":
    "Outros dispositivos não conseguem acessar este StarBot agora. Ele está se conectando novamente.",

  "status.host.stopping": "Tornando este StarBot privado…",

  "status.host.private": "Este StarBot é privado.",

  "status.host.removed": "Este StarBot foi removido da sua conta. Publique-o novamente para compartilhá-lo.",
} as const satisfies PartialTranslation<typeof source>;
