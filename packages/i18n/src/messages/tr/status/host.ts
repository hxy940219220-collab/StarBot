import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/host";

export const messages = {
  "status.host.registered": "Bu StarBot, WebRTC erişimi için kaydedildi.",

  "status.host.keyRotated": "Sunucu anahtarı değiştirildi. Eşlenmiş cihazlar eşli kalır.",
  "status.host.identityUpdated": "Sunucu kimliği güncellendi.",
  "status.host.starting": "WebRTC ana makinesi başlatılıyor…",
  "status.host.ready": "Bu StarBot, WebRTC bağlantıları için hazır.",

  "status.host.signalLost": "Diğer cihazlar şu anda bu StarBot'a ulaşamıyor. Yeniden bağlanıyor.",

  "status.host.stopping": "Bu StarBot özel yapılıyor…",

  "status.host.private": "Bu StarBot özel.",

  "status.host.removed": "Bu StarBot hesabınızdan kaldırıldı. Paylaşmak için yeniden yayımlayın.",

} as const satisfies PartialTranslation<typeof source>;
