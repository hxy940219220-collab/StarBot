import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/host";

export const messages = {
  "status.host.registered": "تم تسجيل StarBot هذا للوصول عبر WebRTC.",

  "status.host.keyRotated": "تغيّر مفتاح الخادم. تبقى الأجهزة المقترنة مقترنة.",
  "status.host.identityUpdated": "تم تحديث هوية الخادم.",
  "status.host.starting": "جارٍ تشغيل مضيف WebRTC…",
  "status.host.ready": "StarBot هذا جاهز لاتصالات WebRTC.",

  "status.host.signalLost": "لا يمكن للأجهزة الأخرى الوصول إلى StarBot هذا الآن. سيتصل مرة أخرى.",

  "status.host.stopping": "جارٍ جعل StarBot هذا خاصًا…",

  "status.host.private": "StarBot هذا خاص.",

  "status.host.removed": "أُزيل StarBot هذا من حسابك. انشره مرة أخرى لمشاركته.",
} as const satisfies PartialTranslation<typeof source>;
