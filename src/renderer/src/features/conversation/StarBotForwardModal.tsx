import { LOCAL_SERVER_ID } from "@openbot/contracts/ipc";
import { Button, Check, Dialog, X } from "@openbot/ui";
import type { AgentMessage, AgentProfile } from "@openbot/ui/data";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import { isChiefStarBot } from "@openbot/ui/features/agents/chief-starbot";
import { playKawaiiCue } from "@openbot/ui/features/agents/starbot-kawaii-audio";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { actionToast } from "../../action-toast";

export type ForwardMode = "single" | "step-by-step" | "merged";

export interface ForwardModalRequest {
  mode: ForwardMode;
  messages: readonly AgentMessage[];
}

function formatSenderName(msg: AgentMessage, currentAgentName: string): string {
  return msg.author === "you" ? "我" : currentAgentName || "星友";
}

function summarizePreview(messages: readonly AgentMessage[], currentAgentName: string): string {
  if (messages.length === 0) return "";
  if (messages.length === 1) {
    const raw = messages[0]!.body.trim().replace(/\s+/gu, " ");
    return raw.length > 84 ? `${raw.slice(0, 84)}…` : raw || "[图片/附件消息]";
  }
  return messages
    .slice(0, 3)
    .map((m) => {
      const snippet = m.body.trim().replace(/\s+/gu, " ").slice(0, 36) || "[附件]";
      return `${formatSenderName(m, currentAgentName)}: ${snippet}`;
    })
    .join(" · ");
}

export function StarBotForwardModal(props: {
  request: ForwardModalRequest | null;
  currentAgent: { id: string; name: string } | null | undefined;
  agents: readonly AgentProfile[];
  serverId?: string | undefined;
  onSelectAgent?: ((agentId: string) => void) | undefined;
  onClose: () => void;
  onForwarded?: (() => void) | undefined;
}) {
  const [selectedBotIds, setSelectedBotIds] = createSignal<ReadonlySet<string>>(new Set());
  const [comment, setComment] = createSignal("");
  const [jumpAfterSend, setJumpAfterSend] = createSignal(true);
  const [sending, setSending] = createSignal(false);

  const candidateBots = createMemo(() => props.agents.filter((a) => a.id !== props.currentAgent?.id));

  createEffect(
    () => props.request,
    (req) => {
      if (!req) return;
      setComment("");
      const candidates = candidateBots();
      if (candidates.length === 1) {
        setSelectedBotIds(new Set<string>([candidates[0]!.id]));
      } else {
        const chief = candidates.find((c) => isChiefStarBot(c.id));
        setSelectedBotIds(chief ? new Set<string>([chief.id]) : new Set<string>());
      }
    },
  );

  function toggleBot(botId: string): void {
    const next = new Set(selectedBotIds());
    if (next.has(botId)) next.delete(botId);
    else next.add(botId);
    setSelectedBotIds(next);
  }

  const modeTitle = () => {
    const req = props.request;
    if (!req) return "转发给其他星友";
    if (req.mode === "single") return "转发消息给星友";
    if (req.mode === "step-by-step") return `逐条转发给星友（共 ${req.messages.length} 条）`;
    return `合并转发聊天记录（共 ${req.messages.length} 条）`;
  };

  async function handleConfirmForward(): Promise<void> {
    const req = props.request;
    const targets = candidateBots().filter((b) => selectedBotIds().has(b.id));
    if (!req || targets.length === 0 || sending()) return;

    const srvId = props.serverId ?? LOCAL_SERVER_ID;
    const fromName = props.currentAgent?.name ?? "星友";
    const extraNote = comment().trim();

    setSending(true);
    try {
      for (const bot of targets) {
        if (req.mode === "single") {
          const msg = req.messages[0];
          if (!msg) continue;
          const header = msg.author === "you" ? "【转发我的消息】" : `【转发自「${fromName}」的消息】`;
          const fullText = [header, msg.body.trim(), ...(extraNote ? [`\n💬 附言：${extraNote}`] : [])]
            .filter(Boolean)
            .join("\n\n");
          await window.openbot.agent.sendMessage({ agentId: bot.id, text: fullText }, srvId);
        } else if (req.mode === "step-by-step") {
          for (const msg of req.messages) {
            const prefix = msg.author === "you" ? "[我]" : `[${fromName}]`;
            const body = msg.body.trim();
            if (!body) continue;
            await window.openbot.agent.sendMessage(
              { agentId: bot.id, text: `【逐条转发 · ${prefix}】\n${body}` },
              srvId,
            );
          }
          if (extraNote) {
            await window.openbot.agent.sendMessage({ agentId: bot.id, text: extraNote }, srvId);
          }
        } else {
          const lines = req.messages
            .map((m) => {
              const sender = formatSenderName(m, fromName);
              const content = m.body.trim() || "[附件消息]";
              return `▸ ${sender}：\n${content}`;
            })
            .join("\n\n");
          const mergedPayload = [
            `📋 合并转发的聊天记录（与「${fromName}」共 ${req.messages.length} 条）`,
            "━━━━━━━━━━━━━━",
            lines,
            "━━━━━━━━━━━━━━",
            ...(extraNote ? [`💬 附言：${extraNote}`] : ["请阅读以上聊天记录并协助跟进。"]),
          ].join("\n");
          await window.openbot.agent.sendMessage({ agentId: bot.id, text: mergedPayload }, srvId);
        }
      }

      void playKawaiiCue("success");
      const names = targets.map((t) => `「${t.name}」`).join("、");
      actionToast.success(`已转发给 ${names}`);
      props.onForwarded?.();
      props.onClose();

      if (targets.length === 1 && jumpAfterSend() && props.onSelectAgent) {
        props.onSelectAgent(targets[0]!.id);
      }
    } catch {
      actionToast.error("转发失败，请确认目标星友模型已连接就绪");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog.Root
      open={props.request !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="starbot-modal-backdrop">
          <Dialog.Content as="section" class="starbot-forward-modal" aria-label={modeTitle()}>
            <Dialog.Title class="sr-only">{modeTitle()}</Dialog.Title>
            <Dialog.Description class="sr-only">选择一个或多个星友转发选中的聊天消息。</Dialog.Description>

            <div class="starbot-minimal-modal-top">
              <div class="starbot-minimal-modal-heading">
                <strong>{modeTitle()}</strong>
                <span>支持多选星友一键同步上下文</span>
              </div>
              <button type="button" class="starbot-inspector-close" onClick={() => props.onClose()} aria-label="关闭">
                <X class="size-4" />
              </button>
            </div>

            <Show when={props.request}>
              {(req) => (
                <div class="starbot-forward-preview-box">
                  <span class="starbot-forward-preview-tag">
                    {req().mode === "merged"
                      ? `[合并记录 · ${req().messages.length} 条]`
                      : req().mode === "step-by-step"
                        ? `[逐条发送 · ${req().messages.length} 条]`
                        : "[单条消息]"}
                  </span>
                  <p>{summarizePreview(req().messages, props.currentAgent?.name ?? "星友")}</p>
                </div>
              )}
            </Show>

            <div class="starbot-forward-bot-section">
              <span class="starbot-forward-section-label">选择接收消息的星友（可多选）</span>
              <Show
                when={candidateBots().length > 0}
                fallback={
                  <div class="starbot-distill-empty">
                    当前还没有其他星友，请先点击左侧「+」创建第二只星友后再转发协作。
                  </div>
                }
              >
                <div class="starbot-forward-bot-list">
                  <For each={candidateBots()}>
                    {(bot) => {
                      const checked = () => selectedBotIds().has(bot.id);
                      return (
                        <button
                          type="button"
                          class={`starbot-forward-bot-row${checked() ? " is-selected" : ""}`}
                          onClick={() => toggleBot(bot.id)}
                        >
                          <AgentAvatar agent={bot} class="starbot-forward-bot-avatar" />
                          <div class="starbot-forward-bot-meta">
                            <div class="starbot-forward-bot-name-line">
                              <strong>{bot.name}</strong>
                              <Show when={isChiefStarBot(bot.id)}>
                                <span class="starbot-gold-badge">主星友</span>
                              </Show>
                            </div>
                            <Show when={bot.description && bot.description !== "General-purpose assistant"}>
                              <span>{bot.description}</span>
                            </Show>
                          </div>
                          <span class={`starbot-distill-check${checked() ? " is-checked" : ""}`}>
                            <Check class="size-3" />
                          </span>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>

            <input
              type="text"
              class="starbot-forward-note-input"
              placeholder="给星友捎句话（选填，例如：帮我接着优化这个方案）…"
              value={comment()}
              onInput={(e) => setComment(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.isComposing && selectedBotIds().size > 0) {
                  e.preventDefault();
                  void handleConfirmForward();
                }
              }}
            />

            <div class="starbot-forward-footer">
              <Show when={selectedBotIds().size === 1} fallback={<span />}>
                <label class="starbot-forward-jump-toggle">
                  <input
                    type="checkbox"
                    checked={jumpAfterSend()}
                    onChange={(e) => setJumpAfterSend(e.currentTarget.checked)}
                  />
                  <span>发送后跳转到该星友对话</span>
                </label>
              </Show>

              <div class="starbot-capsule-actions">
                <Button type="button" variant="ghost" size="sm" disabled={sending()} onClick={() => props.onClose()}>
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  loading={sending()}
                  disabled={selectedBotIds().size === 0 || candidateBots().length === 0}
                  onClick={() => void handleConfirmForward()}
                >
                  {selectedBotIds().size > 1 ? `发送给 ${selectedBotIds().size} 位星友` : "发送"}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
