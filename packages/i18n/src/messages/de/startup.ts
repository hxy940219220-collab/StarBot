import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "StarBot konnte nicht starten",

  "startup.failedBody":
    "{message}\n\nDeine lokalen Daten wurden weder zurückgesetzt noch überschrieben. Schritte zur Wiederherstellung findest du in der Anleitung zur Fehlerbehebung.",
  "startup.archiveChangedTitle": "StarBot-Dateien wurden geändert",

  "startup.archiveChangedBody":
    "Ein anderes Programm hat die StarBot-Datei app.asar geändert. StarBot läuft jetzt, startet aber nicht mehr, wenn du es beendest.\n\nInstalliere StarBot erneut, um es zu reparieren. Deine lokalen Daten bleiben erhalten.",

  "startup.archiveChangedDownload": "StarBot laden",

  "startup.filesDamagedBody":
    "Einige StarBot-Dateien sind beschädigt oder fehlen.\n\nInstalliere StarBot erneut, um es zu reparieren. Deine lokalen Daten bleiben erhalten.",

  "startup.newerDataUpdatingTitle": "StarBot wird aktualisiert",

  "startup.newerDataUpdatingBody":
    "Eine neuere Version von StarBot hat deine Daten gespeichert. StarBot installiert die neueste Version und startet dann neu.\n\nDeine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",

  "startup.newerDataTitle": "Neueste StarBot-Version installieren",

  "startup.newerDataBody":
    "Eine neuere Version von StarBot hat deine Daten gespeichert, und diese Version ({version}) kann sie nicht öffnen. Installiere die neueste Version, um deine Daten zu öffnen.\n\nDeine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",

  "startup.newerDataDownload": "StarBot laden",

  "startup.newerDataGuide": "Anleitung öffnen",
  "startup.newerDataQuit": "Beenden",
  "startup.newerDataLoopTitle": "Das neueste StarBot hat sich nicht geöffnet",

  "startup.newerDataLoopBody":
    "Eine neuere Version von StarBot hat deine Daten gespeichert, und diese Version ({version}) kann sie nicht öffnen. StarBot {loopVersion} wurde mehrmals hintereinander vor dem Öffnen beendet und wird daher nicht erneut installiert.\n\nInstalliere eine Version neuer als {loopVersion}, sobald eine verfügbar ist. Für Hilfe öffne die Anleitung.\n\nDeine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",

  "startup.newerDataReleases": "Versionen anzeigen",
  "startup.recoveryWindowTitle": "StarBot-Wiederherstellung",

  "startup.recoveryTitle": "StarBot wurde nicht geöffnet",

  "startup.recoveryBody": {
    one: "StarBot {version} wurde {count} Mal in Folge vor dem Öffnen beendet. Deine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",
    other:
      "StarBot {version} wurde {count} Mal in Folge vor dem Öffnen beendet. Deine lokalen Daten wurden nicht zurückgesetzt oder überschrieben.",
  },
  "startup.recoveryHint":
    "Versuche es erneut oder installiere die letzte Version, die sich geöffnet hat. Für Hilfe exportiere die Diagnosedaten und sende die Datei mit deinem Bericht.",
  "startup.recoveryHintLatest":
    "StarBot hat keine frühere Version gefunden, die deine Daten öffnen kann. Versuche es erneut oder installiere die neueste Version. Für Hilfe exportiere die Diagnosedaten und sende die Datei mit deinem Bericht.",

  "startup.recoveryRetry": "Wiederholen",
  "startup.recoveryPreviousVersion": "Vorherige Version laden",
  "startup.recoveryLatestVersion": "Neueste Version laden",
  "startup.recoveryExportDiagnostics": "Diagnose exportieren",
  "startup.recoveryOpenDataFolder": "Datenordner öffnen",
  "startup.recoveryQuit": "Beenden",
  "startup.recoveryDiagnosticsSaved": "Die Diagnosedatei ist gespeichert.",
  "startup.recoveryActionFailed": "StarBot konnte diese Aktion nicht ausführen.",
} as const satisfies PartialTranslation<typeof source>;
