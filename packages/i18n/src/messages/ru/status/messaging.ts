import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/messaging";

export const messages = {
  "status.messaging.working": "Уже работаю…",
  "status.messaging.queued": "Ожидание: предыдущий запрос ещё выполняется. Ответ придёт сюда.",
  "status.messaging.busy": "В очереди слишком много запросов. Повторите попытку позже.",
  "status.messaging.failed": "StarBot не смог завершить этот запрос. Подробности — на хосте StarBot.",

  "status.messaging.noAnswer": "StarBot завершил работу без письменного ответа.",

  "status.messaging.noAgent": "Пока нет агента, который мог бы здесь ответить. Добавьте Оркестратора Slack в StarBot.",

  "status.messaging.delegated": "Над этим работает один из агентов. Ответ придёт сюда.",
  "status.messaging.stopped": "Остановлено.",
  "status.messaging.stop": "Остановить",
  "status.messaging.approvalTitle": "StarBot просит подтверждения, чтобы продолжить.",

  "status.messaging.approvalTitleTeammate": "Агент {agent} просит подтверждения, чтобы продолжить.",
  "status.messaging.approvalCommand": "Выполнить команду",
  "status.messaging.approvalFileChange": "Изменить файлы",
  "status.messaging.approvalPermissions": "Получить дополнительные разрешения",
  "status.messaging.approve": "Одобрить",
  "status.messaging.deny": "Отклонить",
  "status.messaging.approvedBy": "Одобрено: {user}.",
  "status.messaging.deniedBy": "Отклонено: {user}.",
  "status.messaging.answeredOnHost": "Отвечено на хосте StarBot.",

  "status.messaging.requestInactive": "Этот запрос больше не активен.",
  "status.messaging.onlyRequester": "Это может сделать только {user}. Ответить также может хост StarBot.",

  "status.messaging.hostOnly": "На этот запрос может ответить только хост StarBot.",

  "status.messaging.filesSkipped": "Некоторые файлы не отправлены: {names}.",
  "status.messaging.orchestratorName": "Оркестратор Slack",
  "status.messaging.orchestratorTitle": "Отвечает в Slack и обращается к команде",
  "status.messaging.discordNoAgent":
    "Пока нет агента, который мог бы здесь ответить. Добавьте Оркестратора Discord в StarBot.",

  "status.messaging.discordOrchestratorName": "Оркестратор Discord",
  "status.messaging.discordOrchestratorTitle": "Отвечает в Discord и обращается к команде",
  "status.messaging.integrationsSection": "Интеграции",
  "status.messaging.signInReceived": "StarBot получил установку Slack. Эту вкладку можно закрыть.",

  "status.messaging.signInUnknown": "StarBot не начинал эту установку Slack. Начните её заново в StarBot.",

  "status.messaging.telegramNoAgent":
    "Пока нет агента, который мог бы здесь ответить. В StarBot откройте Маркетплейс > Приложения > Telegram и нажмите «Добавить агента».",

  "status.messaging.telegramLinked":
    "StarBot подключён к этому чату. Упомяните {bot} или ответьте на сообщение StarBot, чтобы обратиться к агентам.",

  "status.messaging.telegramNotLinked":
    "StarBot не подключён к этому чату. Чтобы подключить его, откройте приложение StarBot, перейдите в Каталог → Приложения → Telegram и выберите «Добавить в группу» или «Открыть личный чат».",

  "status.messaging.telegramOrchestratorName": "Оркестратор Telegram",
  "status.messaging.telegramOrchestratorTitle": "Отвечает в Telegram и обращается к команде",
  "status.messaging.whatsappNoAgent":
    "Пока нет агента, который мог бы здесь ответить. Добавьте Оркестратора WhatsApp в StarBot.",

  "status.messaging.whatsappApprovalMenu": "Ответьте 1, чтобы одобрить, или 2, чтобы отклонить.",
  "status.messaging.whatsappStopMenu": "Ответьте «stop», чтобы остановить.",
  "status.messaging.whatsappPairingCode":
    "Этот номер отвечает только людям, которым разрешил владелец. Передайте владельцу этот код: {code}",
  "status.messaging.whatsappPairingApproved": "Теперь вы можете отправлять запросы на этот номер.",
  "status.messaging.whatsappOwnChat": "Сообщение себе",
  "status.messaging.whatsappWelcomeOwn":
    "👋 *StarBot подключён*\n\nПишите сюда, чтобы обратиться к своим агентам. WhatsApp Orchestrator отвечает сам или передаёт работу нужному агенту.\n\nОтправьте *stop*, чтобы остановить запрос.",

  "status.messaging.whatsappWelcomeDedicated":
    "👋 *StarBot подключён*\n\nЛюди, которым вы разрешите в StarBot, теперь могут писать на этот номер. Новый человек получит код: одобрите его в StarBot в разделе «Запросы».\n\nОтправьте *stop*, чтобы остановить запрос.",

  "status.messaging.whatsappOtherStarBot":
    "К этому номеру WhatsApp привязан ещё один StarBot, поэтому вы можете получать два ответа. Чтобы это исправить, откройте «Связанные устройства» в WhatsApp на телефоне и выйдите из StarBot, которым вы не пользуетесь.",

  "status.messaging.whatsappPaused":
    "StarBot перестал отвечать здесь на 10 минут: за короткое время пришло слишком много сообщений. Если к этому номеру привязан ещё один StarBot, откройте «Связанные устройства» в WhatsApp на телефоне и выйдите из StarBot, которым вы не пользуетесь.",

  "status.messaging.whatsappOrchestratorName": "Оркестратор WhatsApp",
  "status.messaging.whatsappOrchestratorTitle": "Отвечает в WhatsApp и обращается к команде",
} as const satisfies PartialTranslation<typeof source>;
