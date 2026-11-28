import type {
  AgentNotificationLevelsSnapshot,
  AgentSessionSettings,
  AskSideQuestionInput,
  AttachmentSummary,
  FilePreview,
  StarBotDesktopApi,
  ResetAgentSessionSettingInput,
  SaveSkillSuggestionInput,
  SaveSkillSuggestionResult,
  SetAgentSessionSettingInput,
  TestRoutineInput,
  WithdrawFeedbackResult,
} from "@starbot/contracts/ipc";
import type { AttachmentMediaSource } from "@starbot/ui/features/conversation/AttachmentCards";
import type { AgentSkillCalls, SkillCatalogCalls } from "../../skills-port";
import type { AgentTemplatePublishCalls } from "../agent-templates/agent-templates-port";
import type { BrowserProfileCalls } from "../browser/browser-profiles-port";
import type { FilesPort } from "../files/files-port";
import type { AgentFoldersApi, AgentInstructionsApi } from "./agent-folders-port";
import type { SharedTableCalls } from "./conversation-port";
import type { ConversationProps } from "./conversation-types";
import type { AgentMemoriesApi } from "./memories-port";
import type { EventRoutinesApi } from "./routine-webhooks-api";
import type { AgentRoutinesApi, RoutineResultsCalls } from "./routines-port";
import type { CodexLivePort } from "./stores/codex-live-conversation-store";

export interface ConversationRuntime {
  agent: Pick<
    StarBotDesktopApi["agent"],
    | "discardDraftAttachment"
    | "importAttachmentData"
    | "downloadAttachments"
    | "editQueuedMessage"
    | "listInstalledSkills"
    | "listMcpServers"
    | "listWorkspaceDirectory"
    | "onAttachmentImport"
    | "openAttachment"
    | "openSharedFile"
    | "openWorkspaceFile"
    | "previewSharedFile"
    | "previewWorkspaceFile"
    | "respondToBrowserSecret"
    | "setMessageReaction"
  > &
    Partial<Pick<StarBotDesktopApi["agent"], "openMessageLink" | "pasteMessageLink" | "cancelMessageLink">> &
    Partial<Pick<StarBotDesktopApi["agent"], "stopAttachmentDownload" | "onAttachmentDownload">> &
    Partial<Pick<StarBotDesktopApi["agent"], "retryAttachmentImport" | "discardAttachmentImport">> &
    Partial<Pick<StarBotDesktopApi["agent"], "testMcpServer">>;
  browser: Pick<
    StarBotDesktopApi["browser"],
    | "capturePreview"
    | "closePictureInPicture"
    | "closeWindow"
    | "focusWindow"
    | "navigate"
    | "onPictureInPictureEvent"
    | "onWindowEvent"
    | "open"
    | "openPictureInPicture"
    | "openWindow"
    | "publishWindowModel"
    | "reload"
    | "stop"
    | "releaseControl"
    | "setVisible"
    | "startTeach"
    | "stopTeach"
    | "takeControl"
  >;
  voice: Pick<
    StarBotDesktopApi["voice"],
    | "getSettings"
    | "getServer"
    | "onModelStatus"
    | "prepareModel"
    | "transcribe"
    | "startStream"
    | "appendStream"
    | "finishStream"
    | "cancelStream"
    | "onStreamTranscript"
  >;
  openUrl: StarBotDesktopApi["openUrl"];
  askSideQuestion?: ((input: AskSideQuestionInput) => Promise<string>) | undefined;
  sideQuestionThreads?: boolean | undefined;
  liveVoice?: CodexLivePort | undefined;
  skillCatalog?: SkillCatalogCalls | undefined;
  withdrawFeedback?: ((input: { agentId: string; messageId: string }) => Promise<WithdrawFeedbackResult>) | undefined;
  saveSkillSuggestion?: ((input: SaveSkillSuggestionInput) => Promise<SaveSkillSuggestionResult>) | undefined;
  previewAttachment?: (attachment: AttachmentSummary) => Promise<FilePreview>;
  attachmentMedia?: AttachmentMediaSource;
  visualPage?: (attachment: AttachmentSummary) => Promise<string>;
  importFiles?: (files: File[]) => Promise<void>;
  cancelImportFiles?: () => Promise<void>;
  browserProfiles?: BrowserProfileCalls | undefined;
  routines?: AgentRoutinesApi | undefined;
  agentMemories?: AgentMemoriesApi | undefined;
  agentFolders?: AgentFoldersApi | undefined;
  agentInstructions?: AgentInstructionsApi | undefined;
  routineResultCalls?: RoutineResultsCalls | undefined;
  routineRunCommand?: ((input: TestRoutineInput) => Promise<string>) | undefined;
  agentMemoryLimit?: (() => Promise<number>) | undefined;
  storageCalls?: FilesPort | undefined;
  agentNotificationLevels?: AgentNotificationLevelCalls | undefined;
  admin?:
    | {
        skills: AgentSkillCalls;
        sharedTables: SharedTableCalls;
        agentTemplates: AgentTemplatePublishCalls;
        eventRoutines?: EventRoutinesApi | undefined;
        sessionSettings?:
          | {
              read(agentId: string): Promise<AgentSessionSettings>;
              set(input: SetAgentSessionSettingInput): Promise<AgentSessionSettings>;
              reset(input: ResetAgentSessionSettingInput): Promise<AgentSessionSettings>;
              subscribe?(agentId: string, listener: () => void): () => void;
            }
          | undefined;
      }
    | undefined;
}

export interface AgentNotificationLevelCalls {
  list(): Promise<AgentNotificationLevelsSnapshot>;
  subscribe?(listener: (levels: AgentNotificationLevelsSnapshot) => void): () => void;
}

export function conversationRuntime(props: Pick<ConversationProps, "runtime">): ConversationRuntime {
  return props.runtime ?? window.starbot;
}
