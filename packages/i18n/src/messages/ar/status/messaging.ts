import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/messaging";

export const messages = {
  "status.messaging.working": "جارٍ العمل على ذلك…",
  "status.messaging.queued": "في الانتظار حتى ينتهي طلب سابق. ستصل الإجابة هنا.",
  "status.messaging.busy": "هناك طلبات كثيرة جدًا في الانتظار. أعد المحاولة لاحقًا.",
  "status.messaging.failed": "تعذّر على StarBot إنهاء هذا الطلب. التفاصيل لدى مضيف StarBot.",

  "status.messaging.noAnswer": "انتهى StarBot دون إجابة مكتوبة.",

  "status.messaging.noAgent": "لا يوجد وكيل يستطيع الإجابة هنا بعد. أضف Slack Orchestrator في StarBot.",

  "status.messaging.delegated": "يعمل زميل على ذلك. ستصل الإجابة هنا.",
  "status.messaging.stopped": "تم الإيقاف.",
  "status.messaging.stop": "إيقاف",
  "status.messaging.approvalTitle": "يطلب StarBot الموافقة للمتابعة.",

  "status.messaging.approvalTitleTeammate": "يطلب الزميل {agent} الموافقة للمتابعة.",
  "status.messaging.approvalCommand": "تشغيل أمر",
  "status.messaging.approvalFileChange": "تغيير الملفات",
  "status.messaging.approvalPermissions": "الحصول على أذونات إضافية",
  "status.messaging.approve": "موافقة",
  "status.messaging.deny": "رفض",
  "status.messaging.approvedBy": "وافق عليه {user}.",
  "status.messaging.deniedBy": "رفضه {user}.",
  "status.messaging.answeredOnHost": "تمت الإجابة على مضيف StarBot.",

  "status.messaging.requestInactive": "لم يعد هذا الطلب نشطًا.",
  "status.messaging.onlyRequester": "لا يستطيع فعل ذلك إلا {user}. يستطيع مضيف StarBot أيضًا الإجابة.",

  "status.messaging.hostOnly": "لا يستطيع الإجابة على هذا الطلب إلا مضيف StarBot.",

  "status.messaging.filesSkipped": "لم تُرسَل بعض الملفات: {names}.",
  "status.messaging.orchestratorName": "Slack Orchestrator",
  "status.messaging.orchestratorTitle": "يجيب في Slack ويسأل الفريق",
  "status.messaging.discordNoAgent": "لا يوجد وكيل يستطيع الإجابة هنا بعد. أضف Discord Orchestrator في StarBot.",

  "status.messaging.discordOrchestratorName": "Discord Orchestrator",
  "status.messaging.discordOrchestratorTitle": "يجيب في Discord ويسأل الفريق",
  "status.messaging.integrationsSection": "التكاملات",
  "status.messaging.signInReceived": "استلم StarBot تثبيت Slack. يمكنك إغلاق علامة التبويب هذه.",

  "status.messaging.signInUnknown": "لم يبدأ StarBot تثبيت Slack هذا. ابدأه مرة أخرى في StarBot.",

  "status.messaging.telegramNoAgent":
    "لا يوجد وكيل يستطيع الإجابة هنا بعد. في StarBot، افتح المتجر > التطبيقات > Telegram وانقر على إضافة وكيل.",

  "status.messaging.telegramLinked": "StarBot متصل بهذه الدردشة. اذكر {bot} أو ردّ على رسالة من StarBot لسؤال الوكلاء.",

  "status.messaging.telegramNotLinked":
    "StarBot غير متصل بهذه الدردشة. لربطه، افتح تطبيق StarBot وانتقل إلى المتجر ← التطبيقات ← Telegram، ثم اختر «إضافة إلى مجموعة» أو «فتح دردشة مباشرة».",

  "status.messaging.telegramOrchestratorName": "Telegram Orchestrator",
  "status.messaging.telegramOrchestratorTitle": "يجيب في Telegram ويسأل الفريق",
  "status.messaging.whatsappNoAgent": "لا يوجد وكيل يستطيع الإجابة هنا بعد. أضف WhatsApp Orchestrator في StarBot.",

  "status.messaging.whatsappApprovalMenu": "أرسل 1 للموافقة أو 2 للرفض.",
  "status.messaging.whatsappStopMenu": "أرسل stop للإيقاف.",
  "status.messaging.whatsappPairingCode":
    "يجيب هذا الرقم عن الأشخاص الذين سمح لهم مالكه فقط. أعطِ المالك هذا الرمز: {code}",
  "status.messaging.whatsappPairingApproved": "يمكنك الآن إرسال الطلبات إلى هذا الرقم.",
  "status.messaging.whatsappOwnChat": "مراسلة نفسك",
  "status.messaging.whatsappWelcomeOwn":
    "👋 *StarBot متصل*\n\nاكتب هنا لتسأل وكلاءك. يجيب WhatsApp Orchestrator، أو يسند العمل إلى الوكيل المناسب.\n\nأرسل *stop* لإيقاف طلب.",

  "status.messaging.whatsappWelcomeDedicated":
    "👋 *StarBot متصل*\n\nيستطيع الأشخاص الذين تسمح لهم في StarBot الكتابة الآن إلى هذا الرقم. يحصل الشخص الجديد على رمز: وافق عليه في StarBot ضمن الطلبات.\n\nأرسل *stop* لإيقاف طلب.",

  "status.messaging.whatsappOtherStarBot":
    "يوجد StarBot آخر مرتبط برقم واتساب هذا، لذلك قد تصلك إجابتان. لإصلاح ذلك، افتح الأجهزة المرتبطة في واتساب على هاتفك وسجّل الخروج من StarBot الذي لا تستخدمه.",

  "status.messaging.whatsappPaused":
    "توقّف StarBot عن الرد هنا لمدة 10 دقائق: وصلت رسائل كثيرة جدًا في وقت قصير. إذا كان StarBot آخر مرتبطًا بهذا الرقم، فافتح الأجهزة المرتبطة في واتساب على هاتفك وسجّل الخروج من StarBot الذي لا تستخدمه.",

  "status.messaging.whatsappOrchestratorName": "WhatsApp Orchestrator",
  "status.messaging.whatsappOrchestratorTitle": "يجيب في WhatsApp ويسأل الفريق",
} as const satisfies PartialTranslation<typeof source>;
