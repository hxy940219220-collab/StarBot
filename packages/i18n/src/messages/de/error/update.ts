import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/update";

export const messages = {
  "error.update.unsupported": "Aktualisierungen sind in installierten Desktop-Versionen verfügbar.",
  "error.update.notReady": "Es ist keine Aktualisierung zur Installation bereit.",
  "error.update.restartFailed": "StarBot konnte zur Installation der Aktualisierung nicht neu starten.",

  "error.update.downloadStalled": "Der Download der Aktualisierung reagiert nicht mehr. Versuche es erneut.",
  "error.update.installFailed":
    "Die Aktualisierung konnte nicht installiert werden. Beende und öffne StarBot erneut und versuche es noch einmal.",

  "error.update.notInstalled":
    "Beim letzten Neustart wurde die Aktualisierung nicht installiert. Starte neu, um es noch einmal zu versuchen.",
  "error.update.downloadFailed": "Die Aktualisierung konnte nicht heruntergeladen werden. Versuche es erneut.",
  "error.update.signatureNotConfirmed":
    "StarBot konnte die Aktualisierung nicht prüfen. Versuche es erneut. Wenn der Fehler bleibt, lade StarBot von starbot.app/download herunter.",

  "error.update.checkFailed": "Es konnte nicht nach Aktualisierungen gesucht werden. Versuche es erneut.",
  "error.update.checkStalled": "Die Suche nach Aktualisierungen reagiert nicht mehr. Versuche es erneut.",
  "error.update.checkOffline":
    "Der Aktualisierungsdienst konnte nicht erreicht werden. Prüfe deine Internetverbindung und versuche es erneut.",
  "error.update.checkUnavailable":
    "Der Aktualisierungsdienst hat nicht geantwortet. StarBot versucht es in einigen Minuten automatisch erneut.",

  "error.update.checkNoRelease":
    "Für diese Plattform wurde keine veröffentlichte Aktualisierung gefunden. StarBot versucht es in einigen Minuten automatisch erneut.",

  "error.update.managedByNix":
    "Nix installiert Aktualisierungen für diese Kopie von StarBot. Aktualisiere sie mit Nix.",

  "error.update.managedByHost":
    "Aktualisierungen auf diesem Mac werden vom Host installiert. Die Aktualisierung bleibt bereit, bis die Host-Wartung ausgeführt wird.",
  "error.update.siblingSession":
    "Eine andere StarBot-Sitzung läuft noch aus dieser Anwendung. Stoppe StarBot zuerst in allen anderen macOS-Benutzerkonten und installiere die Aktualisierung erneut.",

  "error.update.siblingSessionSameAccount":
    "Ein anderer StarBot-Prozess läuft noch in diesem Benutzerkonto. Beende ihn und installiere die Aktualisierung erneut.",

  "error.update.siblingCheckFailed":
    "Andere StarBot-Sitzungen konnten nicht überprüft werden. Versuche es vor der Installation erneut.",

  "error.update.readOnlyLocation":
    "StarBot kann von diesem Ort aus keine Aktualisierungen installieren. Beende StarBot. Ziehe StarBot im Finder in den Ordner „Programme“ (wenn es schon dort ist, ziehe es heraus und wieder hinein). Öffne StarBot dann und installiere die Aktualisierung erneut.",

  "error.update.appImageMissing":
    "StarBot kann das Update nicht installieren, weil seine AppImage-Datei verschoben, umbenannt oder ersetzt wurde. Beende StarBot und öffne die AppImage-Datei dann erneut.",

  "error.update.appImageReadOnly":
    "StarBot kann im Ordner seiner AppImage-Datei keine Updates installieren. Beende StarBot, verschiebe die AppImage-Datei in einen Ordner in deinem Home-Ordner, öffne sie dann und installiere das Update erneut.",

  "error.update.remoteDisabled": "Aktualisierungen durch Serveradministratoren sind auf diesem Computer deaktiviert.",
  "error.update.restartStarted": "StarBot startet bereits zur Installation der Aktualisierung neu.",

  "error.update.alreadyRestarting": "StarBot startet bereits neu.",

} as const satisfies PartialTranslation<typeof source>;
