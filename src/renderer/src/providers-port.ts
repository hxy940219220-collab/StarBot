import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface ProvidersPort {
  cancelProviderCodeLogin: StarBotDesktopApi["cancelProviderCodeLogin"];
  connectProvider: StarBotDesktopApi["connectProvider"];
  connectProviderInMainlandChina: StarBotDesktopApi["connectProviderInMainlandChina"];
  cancelProviderSignIn: StarBotDesktopApi["cancelProviderSignIn"];
  refreshAgentProviders: StarBotDesktopApi["refreshAgentProviders"];
  setProviderOn: StarBotDesktopApi["setProviderOn"];
  restartProvider: StarBotDesktopApi["restartProvider"];
  cancelProviderRestart: StarBotDesktopApi["cancelProviderRestart"];
  chooseInstalledCli: StarBotDesktopApi["chooseInstalledCli"];
  startProviderCodeLogin: StarBotDesktopApi["startProviderCodeLogin"];
  providerRuntimes: StarBotDesktopApi["providerRuntimes"];
  connectProviderAccount: StarBotDesktopApi["connectProviderAccount"];
  connectProviderAccountKey: StarBotDesktopApi["connectProviderAccountKey"];
  cancelProviderAccountSignIn: StarBotDesktopApi["cancelProviderAccountSignIn"];
  renameProviderAccount: StarBotDesktopApi["renameProviderAccount"];
  removeProviderAccount: StarBotDesktopApi["removeProviderAccount"];
  setProviderAccountPool: StarBotDesktopApi["setProviderAccountPool"];
  setLiveVoiceAccount: StarBotDesktopApi["setLiveVoiceAccount"];
  signOutProvider: StarBotDesktopApi["signOutProvider"];
  providerUsageResets: StarBotDesktopApi["providerUsageResets"];
  resetProviderUsage: StarBotDesktopApi["resetProviderUsage"];
  providerAdmin: StarBotDesktopApi["providerAdmin"];
}

export function providersPort(): ProvidersPort {
  return window.starbot;
}
