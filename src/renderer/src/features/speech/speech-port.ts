import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

export interface SpeechPort {
  voice: Pick<
    StarBotDesktopApi["voice"],
    | "getSpeechSettings"
    | "setSpeechSettings"
    | "getSpeechModelStatus"
    | "getModelStatuses"
    | "downloadSpeechModel"
    | "onSpeechModelStatus"
    | "speak"
    | "warmSpeech"
    | "keepRecording"
    | "getServer"
    | "onServerSettings"
  >;
  agent: Pick<StarBotDesktopApi["agent"], "readConversationPage" | "discardDraftAttachment">;
}

export function speechPort(): SpeechPort {
  return window.starbot;
}
