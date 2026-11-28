import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/status/messaging";

export const messages = {
  "status.messaging.working": "Pracuję nad tym…",
  "status.messaging.queued": "Oczekiwanie na zakończenie wcześniejszego żądania. Odpowiedź pojawi się tutaj.",
  "status.messaging.busy": "Czeka zbyt wiele żądań. Spróbuj ponownie później.",
  "status.messaging.failed": "StarBot nie mógł dokończyć tego żądania. Szczegóły są na hoście StarBot.",

  "status.messaging.noAnswer": "StarBot zakończył pracę bez odpowiedzi tekstowej.",

  "status.messaging.noAgent": "Żaden agent nie może tu jeszcze odpowiadać. Dodaj Slack Orchestrator w StarBot.",

  "status.messaging.delegated": "Członek zespołu nad tym pracuje. Odpowiedź pojawi się tutaj.",
  "status.messaging.stopped": "Zatrzymano.",
  "status.messaging.stop": "Zatrzymaj",
  "status.messaging.approvalTitle": "StarBot prosi o zatwierdzenie, aby kontynuować.",

  "status.messaging.approvalTitleTeammate": "Członek zespołu {agent} prosi o zatwierdzenie, aby kontynuować.",
  "status.messaging.approvalCommand": "Uruchomienie polecenia",
  "status.messaging.approvalFileChange": "Zmiana plików",
  "status.messaging.approvalPermissions": "Dodatkowe uprawnienia",
  "status.messaging.approve": "Zatwierdź",
  "status.messaging.deny": "Odrzuć",
  "status.messaging.approvedBy": "Zatwierdzone przez: {user}.",
  "status.messaging.deniedBy": "Odrzucone przez: {user}.",
  "status.messaging.answeredOnHost": "Odpowiedziano na hoście StarBot.",

  "status.messaging.requestInactive": "To żądanie nie jest już aktywne.",
  "status.messaging.onlyRequester": "Tylko {user} może to zrobić. Może też odpowiedzieć host StarBot.",

  "status.messaging.hostOnly": "Na to żądanie może odpowiedzieć tylko host StarBot.",

  "status.messaging.filesSkipped": "Niektóre pliki nie zostały wysłane: {names}.",
  "status.messaging.orchestratorName": "Slack Orchestrator",
  "status.messaging.orchestratorTitle": "Odpowiada w Slacku i pyta zespół",
  "status.messaging.discordNoAgent":
    "Żaden agent nie może tu jeszcze odpowiadać. Dodaj Discord Orchestrator w StarBot.",

  "status.messaging.discordOrchestratorName": "Discord Orchestrator",
  "status.messaging.discordOrchestratorTitle": "Odpowiada na Discordzie i pyta zespół",
  "status.messaging.integrationsSection": "Integracje",
  "status.messaging.signInReceived": "StarBot otrzymał instalację Slack. Możesz zamknąć tę kartę.",

  "status.messaging.signInUnknown": "StarBot nie rozpoczął tej instalacji Slack. Rozpocznij ją ponownie w StarBot.",

  "status.messaging.telegramNoAgent":
    "Żaden agent nie może tu jeszcze odpowiadać. W StarBot otwórz Marketplace > Aplikacje > Telegram i kliknij Dodaj agenta.",

  "status.messaging.telegramLinked":
    "StarBot jest połączony z tym czatem. Oznacz {bot} lub odpowiedz na wiadomość StarBot, aby zapytać agentów.",

  "status.messaging.telegramNotLinked":
    "StarBot nie jest połączony z tym czatem. Aby go połączyć, otwórz aplikację StarBot, przejdź do Marketplace → Aplikacje → Telegram i wybierz „Dodaj do grupy” lub „Otwórz czat prywatny”.",

  "status.messaging.telegramOrchestratorName": "Telegram Orchestrator",
  "status.messaging.telegramOrchestratorTitle": "Odpowiada w Telegramie i pyta zespół",
  "status.messaging.whatsappNoAgent":
    "Żaden agent nie może tu jeszcze odpowiadać. Dodaj WhatsApp Orchestrator w StarBot.",

  "status.messaging.whatsappApprovalMenu": "Odpowiedz 1, aby zatwierdzić, lub 2, aby odrzucić.",
  "status.messaging.whatsappStopMenu": "Odpowiedz „stop”, aby zatrzymać.",
  "status.messaging.whatsappPairingCode":
    "Ten numer odpowiada tylko osobom, którym pozwolił właściciel. Przekaż właścicielowi ten kod: {code}",
  "status.messaging.whatsappPairingApproved": "Możesz teraz wysyłać prośby na ten numer.",
  "status.messaging.whatsappOwnChat": "Wiadomość do siebie",
  "status.messaging.whatsappWelcomeOwn":
    "👋 *StarBot jest połączony*\n\nNapisz tutaj, aby poprosić swoich agentów. WhatsApp Orchestrator odpowiada albo przekazuje pracę właściwemu agentowi.\n\nWyślij *stop*, aby zatrzymać prośbę.",

  "status.messaging.whatsappWelcomeDedicated":
    "👋 *StarBot jest połączony*\n\nOsoby, na które pozwolisz w StarBot, mogą już pisać na ten numer. Nowa osoba dostaje kod: zatwierdź go w StarBot w sekcji Prośby.\n\nWyślij *stop*, aby zatrzymać prośbę.",

  "status.messaging.whatsappOtherStarBot":
    "Z tym numerem WhatsApp jest połączony inny StarBot, więc możesz dostać dwie odpowiedzi. Aby to naprawić, otwórz Połączone urządzenia w WhatsAppie na telefonie i wyloguj StarBot, którego nie używasz.",

  "status.messaging.whatsappPaused":
    "StarBot przestał tu odpowiadać na 10 minut: w krótkim czasie przyszło za dużo wiadomości. Jeśli z tym numerem jest połączony inny StarBot, otwórz Połączone urządzenia w WhatsAppie na telefonie i wyloguj StarBot, którego nie używasz.",

  "status.messaging.whatsappOrchestratorName": "WhatsApp Orchestrator",
  "status.messaging.whatsappOrchestratorTitle": "Odpowiada w WhatsApp i pyta zespół",
} as const satisfies PartialTranslation<typeof source>;
