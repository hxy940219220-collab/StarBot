import type { AgentTaskInput, StarBotDesktopApi } from "@starbot/contracts/ipc";
import { noteAgentRequest } from "../../agent-requests";

export interface AgentTasksPort
  extends Pick<
    StarBotDesktopApi["agent"],
    | "closeTask"
    | "deleteTask"
    | "listTasks"
    | "markTaskRead"
    | "readTask"
    | "renameTask"
    | "reopenTask"
    | "startTask"
    | "stopTask"
  > {
  listTaskReads?: StarBotDesktopApi["agent"]["listTaskReads"];
  sendToTask(
    input: AgentTaskInput & {
      text: string;
      attachmentDraftIds?: string[];
      replyToMessageId?: string;
      clientMessageId: string;
    },
  ): Promise<unknown>;
  runQueuedMessageAsTask?: StarBotDesktopApi["agent"]["runQueuedMessageAsTask"];
  listArchivedTasks?: StarBotDesktopApi["agent"]["listArchivedTasks"];
  readTaskPage?: StarBotDesktopApi["agent"]["readTaskPage"];
  readTaskAround?: StarBotDesktopApi["agent"]["readTaskAround"];
  branchTask?: StarBotDesktopApi["agent"]["branchTask"];
  deleteTaskMessage?: ((input: { agentId: string; taskId: string; messageId: string }) => Promise<void>) | undefined;
  queue?: Pick<StarBotDesktopApi["agent"], "cancelQueuedMessage" | "steerQueuedMessage" | "reorderQueue"> | undefined;
}

export function agentTasksPort(server: string): AgentTasksPort {
  const { agent } = window.starbot;
  return {
    listTasks: (agentId) => agent.listTasks(agentId, server),
    listArchivedTasks: (input) => agent.listArchivedTasks(input, server),
    readTask: (input) => agent.readTask(input, server),
    readTaskPage: (input) => agent.readTaskPage(input, server),
    readTaskAround: (input) => agent.readTaskAround(input, server),
    startTask: (input) => {
      noteAgentRequest(server, input.agentId);
      return agent.startTask(input, server);
    },
    sendToTask: (input) => {
      noteAgentRequest(server, input.agentId);
      return agent.sendMessage(input, server);
    },
    runQueuedMessageAsTask: (input) => {
      noteAgentRequest(server, input.agentId);
      return agent.runQueuedMessageAsTask(input, server);
    },
    branchTask: (input) => agent.branchTask(input, server),
    stopTask: (input) => agent.stopTask(input, server),
    closeTask: (input, serverId) => agent.closeTask(input, serverId ?? server),
    reopenTask: (input, serverId) => agent.reopenTask(input, serverId ?? server),
    renameTask: (input) => agent.renameTask(input, server),
    deleteTask: (input, serverId) => agent.deleteTask(input, serverId ?? server),
    deleteTaskMessage: (input) => agent.deleteConversationMessage(input, server),
    listTaskReads: (agentId) => agent.listTaskReads(agentId, server),
    markTaskRead: (input) => agent.markTaskRead(input, server),
    queue: {
      cancelQueuedMessage: (input) => agent.cancelQueuedMessage(input, server),
      steerQueuedMessage: (input) => agent.steerQueuedMessage(input, server),
      reorderQueue: (input) => agent.reorderQueue(input, server),
    },
  };
}
