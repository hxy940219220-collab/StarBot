import { resolveLocale, translateFor } from "@starbot/i18n";
import { app, dialog, shell } from "electron";
import { DOWNLOAD_URL } from "./download-url";

if (!app.isPackaged && app.commandLine.hasSwitch("starbot-replica")) {
  process.chdir(app.getAppPath());
}

function isDamagedInstallation(error: unknown): boolean {
  if (!app.isPackaged || !(error instanceof Error)) return false;
  if (error instanceof SyntaxError) return true;
  const code = "code" in error ? error.code : undefined;
  return code === "ERR_INVALID_PACKAGE_CONFIG" || code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
}

function runsAsServer(): boolean {
  return (
    process.platform === "linux" && (process.env.STARBOT_SERVER === "1" || process.env.STARBOT_HOSTED_SERVER === "1")
  );
}

function report(message: string, error: unknown): void {
  process.stderr.write(`${message} ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
}

async function showDamagedInstallation(): Promise<void> {
  const translate = translateFor(resolveLocale("system", app.getLocale()));
  const { response } = await dialog.showMessageBox({
    type: "error",
    message: translate("startup.failedTitle"),
    detail: translate("startup.filesDamagedBody"),
    buttons: [translate("startup.archiveChangedDownload"), translate("common.close")],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) await shell.openExternal(DOWNLOAD_URL);
}

if (__STARBOT_PERF_PROBES__ && !app.isPackaged && process.env.STARBOT_PERF_PROBES === "1") {
  const { installPerfProbes } = await import("./perf-probes-install");
  installPerfProbes();
}

try {
  await import("./index");
} catch (error) {
  if (!isDamagedInstallation(error)) throw error;
  report("StarBot cannot start: a program file is damaged or missing.", error);
  if (runsAsServer()) {
    app.exit(1);
  } else {
    app
      .whenReady()
      .then(showDamagedInstallation)
      .catch((dialogError: unknown) => report("Could not show the damaged installation dialog.", dialogError))
      .finally(() => app.exit(1));
  }
}
