import type { AttachmentSummary, FilePreview, StarBotDesktopApi } from "@starbot/contracts/ipc";
import type { AttachmentMediaSource } from "@starbot/ui/features/conversation/AttachmentCards";
import type { ChannelMemoriesApi } from "../conversation/memories-port";
import type { EventRoutinesApi } from "../conversation/routine-webhooks-api";
import type { ChannelRoutinesApi } from "../conversation/routines-port";
import type { ChannelFoldersApi } from "./channel-folders-port";

export interface ChannelsPort {
  agent: Pick<
    StarBotDesktopApi["agent"],
    | "channelCommand"
    | "chooseAttachments"
    | "listChannels"
    | "openAttachment"
    | "readChannel"
    | "respondToApproval"
    | "respondToBrowserSecret"
    | "respondToBrowserTakeover"
    | "respondToPrompt"
  > &
    ChannelMemoriesApi &
    ChannelRoutinesApi &
    Partial<Pick<StarBotDesktopApi["agent"], "discardDraftAttachment" | "downloadAttachments">> &
    Partial<Pick<StarBotDesktopApi["agent"], "deleteChannelMessage">> &
    Partial<Pick<StarBotDesktopApi["agent"], "setChannelImage">> &
    Partial<ChannelFoldersApi & Pick<StarBotDesktopApi["agent"], "chooseChannelFolder">> &
    Partial<Pick<StarBotDesktopApi["agent"], "clearChannelContext" | "compactChannelContext" | "deleteChannelHistory">>;
  eventRoutines?: EventRoutinesApi | undefined;
  browser: Pick<StarBotDesktopApi["browser"], "capturePreview">;
  openUrl: StarBotDesktopApi["openUrl"];
  fileActions: "native" | "browser";
  previewAttachment?: (attachment: AttachmentSummary) => Promise<FilePreview>;
  attachmentMedia?: AttachmentMediaSource;
  visualPage?: (attachment: AttachmentSummary) => Promise<string>;
  importAttachments?: (files: File[]) => Promise<AttachmentSummary[]>;
  onAttachmentImport?: StarBotDesktopApi["agent"]["onAttachmentImport"];
}

export function channelsPort(): ChannelsPort {
  const api = window.starbot;
  return {
    agent: api.agent,
    browser: api.browser,
    openUrl: (url) => api.openUrl(url),
    fileActions: "native",
    onAttachmentImport: (listener) => api.agent.onAttachmentImport(listener),
  };
}
