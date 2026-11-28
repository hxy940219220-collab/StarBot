import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface OnboardingPort {
  getSetupState: StarBotDesktopApi["getSetupState"];
  saveSetup: StarBotDesktopApi["saveSetup"];
  onSetupState: StarBotDesktopApi["onSetupState"];
  servers: Pick<StarBotDesktopApi["servers"], "previewInvite">;
  openUrl: StarBotDesktopApi["openUrl"];
  getAnalyticsDefault: StarBotDesktopApi["getAnalyticsDefault"];
}

export function onboardingPort(): OnboardingPort {
  return window.starbot;
}
