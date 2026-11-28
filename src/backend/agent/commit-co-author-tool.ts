import { STARBOT_COMMIT_TRAILER } from "@starbot/contracts/ipc";
import { sourceText } from "@starbot/i18n/source";
import { Effect } from "effect";
import { z } from "zod";
import type { DynamicToolCallParams } from "../protocol";
import type { ToolApprovalDecision } from "./attention-registry";
import { type StarBotToolResponse, starBotToolFailure, starBotToolResult } from "./routine-tools";
import { ToolOperationFailed, toToolOperationFailed } from "./tool-operation";

export const setCommitCoAuthorToolSchema = z.strictObject({
  enabled: z.boolean(),
});

const SETTING_PLACE = "Server settings > Agent defaults > Git commits > Credit StarBot in commits";

export type SetCommitCoAuthor = (enabled: boolean) => Effect.Effect<unknown, { readonly cause: unknown }>;

export interface SetCommitCoAuthorToolOptions {
  current(): boolean;
  set: SetCommitCoAuthor;
  requestedByPerson: boolean;
  approve(reason: string): Effect.Effect<ToolApprovalDecision, ToolOperationFailed>;
}

export const handleSetCommitCoAuthorTool = Effect.fn("SetCommitCoAuthorTool.handle")(
  function* (
    params: DynamicToolCallParams,
    options: SetCommitCoAuthorToolOptions,
  ): Effect.fn.Return<StarBotToolResponse, ToolOperationFailed> {
    const { enabled } = setCommitCoAuthorToolSchema.parse(params.arguments, { reportInput: true });
    if (options.current() === enabled) return starBotToolResult({ status: "unchanged", enabled });
    if (!options.requestedByPerson)
      return starBotToolFailure(
        `Only a message from the owner of this StarBot, in your chat or a thread they opened, can change this setting. When a person asked for it, tell them that the owner can change it in ${SETTING_PLACE}.`,
      );
    const decision = yield* options.approve(
      sourceText(enabled ? "status.agent.commitCoAuthorOn" : "status.agent.commitCoAuthorOff"),
    );
    if (decision === "cancel")
      return starBotToolResult({
        status: "cancelled",
        next: "Nobody answered the card, so the setting did not change.",
      });
    if (decision !== "accept")
      return starBotToolResult({
        status: "declined",
        next: "The user selected Deny, so the setting did not change. Do not ask again for this request.",
      });
    yield* options.set(enabled).pipe(toToolOperationFailed);
    return starBotToolResult({
      status: "changed",
      enabled,
      next: enabled
        ? `Agents add the trailer to the commits that they make from their next turn. The user can change it in ${SETTING_PLACE}.`
        : `Agents no longer add the trailer. Do not add it in this turn either: "${STARBOT_COMMIT_TRAILER}". The commits made before keep it; change them only when the user asks. The user can change it in ${SETTING_PLACE}.`,
    });
  },
  Effect.catchDefect((cause) => Effect.fail(new ToolOperationFailed({ cause }))),
);
