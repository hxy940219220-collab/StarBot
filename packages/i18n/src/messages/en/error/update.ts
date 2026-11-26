import { defineMessages } from "../../../message";

export const messages = defineMessages("error.update", {
  "error.update.unsupported": "Updates are available in installed desktop builds.",
  "error.update.notReady": "An update is not ready to install.",
  "error.update.restartFailed": "StarBot could not restart to install the update.",
  "error.update.downloadStalled": "The update download stopped responding. Try again.",
  "error.update.installFailed": "Could not install the update. Quit and reopen StarBot, then try again.",
  "error.update.notInstalled": "The last restart did not install the update. Restart to try again.",
  "error.update.downloadFailed": "Could not download the update. Try again.",
  "error.update.signatureNotConfirmed":
    "StarBot could not verify the update. Try again. If this error continues, download StarBot from starbot.app/download.",

  "error.update.checkFailed": "Could not check for updates. Try again.",
  "error.update.checkStalled": "The update check stopped responding. Try again.",
  "error.update.checkOffline": "Could not reach the update service. Check your internet connection, then try again.",
  "error.update.checkUnavailable":
    "The update service did not answer. StarBot tries again on its own in a few minutes.",
  "error.update.checkNoRelease":
    "No published update was found for this platform. StarBot tries again on its own in a few minutes.",
  "error.update.managedByNix": "Nix installs updates for this copy of StarBot. Update it with Nix.",
  "error.update.managedByHost":
    "Updates on this Mac are installed by the host. The update stays ready until the host's maintenance runs.",
  "error.update.siblingSession":
    "Another StarBot session is still running from this application. Stop StarBot in every other macOS user account first, then install the update again.",
  "error.update.siblingSessionSameAccount":
    "Another StarBot process is still running in this user account. Quit it, then install the update again.",
  "error.update.siblingCheckFailed": "Could not verify other StarBot sessions. Try again before installing.",
  "error.update.readOnlyLocation":
    "StarBot cannot install updates from this location. Quit StarBot. In Finder, drag StarBot into the Applications folder (if it is already there, drag it out and back in). Then open StarBot and install the update again.",
  "error.update.appImageMissing":
    "StarBot cannot install the update because its AppImage file was moved, renamed or replaced. Quit StarBot, then open the AppImage file again.",
  "error.update.appImageReadOnly":
    "StarBot cannot install updates in the folder of its AppImage file. Quit StarBot, move the AppImage file to a folder in your home folder, then open it and install the update again.",
  "error.update.remoteDisabled": "Updates from server admins are turned off on this computer.",
  "error.update.restartStarted": "StarBot is already restarting to install the update.",
  "error.update.alreadyRestarting": "StarBot is already restarting.",
});
