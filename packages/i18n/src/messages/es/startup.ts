import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "StarBot no pudo iniciarse",

  "startup.failedBody":
    "{message}\n\nTus datos locales no se han restablecido ni sobrescrito. Consulta la guía de solución de problemas para recuperarlos.",
  "startup.archiveChangedTitle": "Se cambiaron archivos de StarBot",

  "startup.archiveChangedBody":
    "Otro programa cambió el archivo app.asar de StarBot. StarBot funciona ahora, pero no se abrirá después de cerrarlo.\n\nPara repararlo, vuelve a instalar StarBot. Tus datos locales se conservan.",

  "startup.archiveChangedDownload": "Descargar StarBot",

  "startup.filesDamagedBody":
    "Algunos archivos de StarBot están dañados o faltan.\n\nPara repararlo, vuelve a instalar StarBot. Tus datos locales se conservan.",

  "startup.newerDataUpdatingTitle": "Actualizando StarBot",

  "startup.newerDataUpdatingBody":
    "Una versión más reciente de StarBot guardó tus datos. StarBot instala la última versión y luego se abre de nuevo.\n\nTus datos locales no se restablecieron ni se sobrescribieron.",

  "startup.newerDataTitle": "Instala la última versión de StarBot",

  "startup.newerDataBody":
    "Una versión más reciente de StarBot guardó tus datos y esta versión ({version}) no puede abrirlos. Instala la última versión para abrir tus datos.\n\nTus datos locales no se restablecieron ni se sobrescribieron.",

  "startup.newerDataDownload": "Descargar StarBot",

  "startup.newerDataGuide": "Abrir guía",
  "startup.newerDataQuit": "Salir",
  "startup.newerDataLoopTitle": "La última versión de StarBot no se abrió",

  "startup.newerDataLoopBody":
    "Una versión más reciente de StarBot guardó tus datos y esta versión ({version}) no puede abrirlos. StarBot {loopVersion} se detuvo antes de abrirse varias veces seguidas, así que no se vuelve a instalar.\n\nInstala una versión más reciente que {loopVersion} cuando esté disponible. Para obtener ayuda, abre la guía.\n\nTus datos locales no se restablecieron ni se sobrescribieron.",

  "startup.newerDataReleases": "Ver versiones",
  "startup.recoveryWindowTitle": "Recuperación de StarBot",

  "startup.recoveryTitle": "StarBot no se abrió",

  "startup.recoveryBody": {
    one: "OpenBot {version} se detuvo antes de abrirse, {count} vez seguida. Tus datos locales no se restablecieron ni se sobrescribieron.",
    other:
      "StarBot {version} se detuvo antes de abrirse, {count} veces seguidas. Tus datos locales no se restablecieron ni se sobrescribieron.",

  },
  "startup.recoveryHint":
    "Vuelve a intentarlo o instala la última versión que se abrió. Para obtener ayuda, exporta el diagnóstico y envía el archivo con tu informe.",
  "startup.recoveryHintLatest":
    "StarBot no encontró una versión anterior que pueda abrir tus datos. Vuelve a intentarlo o instala la última versión. Para obtener ayuda, exporta el diagnóstico y envía el archivo con tu informe.",

  "startup.recoveryRetry": "Reintentar",
  "startup.recoveryPreviousVersion": "Descargar versión anterior",
  "startup.recoveryLatestVersion": "Descargar última versión",
  "startup.recoveryExportDiagnostics": "Exportar diagnóstico",
  "startup.recoveryOpenDataFolder": "Abrir carpeta de datos",
  "startup.recoveryQuit": "Salir",
  "startup.recoveryDiagnosticsSaved": "El archivo de diagnóstico se guardó.",
  "startup.recoveryActionFailed": "StarBot no pudo realizar esta acción.",

} as const satisfies PartialTranslation<typeof source>;
