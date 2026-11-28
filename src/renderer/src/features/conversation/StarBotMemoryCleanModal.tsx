import { LOCAL_SERVER_ID } from "@starbot/contracts/ipc";
import { Button, Check, Dialog, Sparkles, Trash2, X } from "@starbot/ui";
import { createEffect, createSignal, For, Show } from "solid-js";
import { actionToast } from "../../action-toast";
import type { MemoriesPort } from "./memories-port";
import {
  addGlobalUserProfileItem,
  type DistilledCandidate,
  distillConversationMemories,
  formatTaggedMemory,
  STARBOT_MEMORY_CATEGORIES,
  type StarBotMemoryCategory,
  syncMemoriesToAgentInstructions,
} from "./starbot-memory-hub";

export interface StarBotMemoryCleanModalProps {
  open: boolean;
  agentId: string;
  agentName: string;
  serverId?: string | undefined;
  memoriesPort: MemoriesPort | null;
  onDeleteHistory?: (() => Promise<void>) | undefined;
  onClearContext?: (() => Promise<void>) | undefined;
  onClose: () => void;
}

export function StarBotMemoryCleanModal(props: StarBotMemoryCleanModalProps) {
  const [mode, setMode] = createSignal<"distill" | "purge">("distill");
  const [purgeAutoMemories, setPurgeAutoMemories] = createSignal(false);
  const [distilling, setDistilling] = createSignal(false);
  const [executing, setExecuting] = createSignal(false);
  const [candidates, setCandidates] = createSignal<DistilledCandidate[]>([]);
  const [distilledOnce, setDistilledOnce] = createSignal(false);

  createEffect(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return;
      setMode("distill");
      setPurgeAutoMemories(false);
      setCandidates([]);
      setDistilledOnce(false);
      void runDistillPreview();
    },
  );

  async function runDistillPreview(): Promise<void> {
    if (!props.agentId || distilling()) return;
    setDistilling(true);
    try {
      const res = await distillConversationMemories(props.agentId, props.serverId ?? LOCAL_SERVER_ID);
      setCandidates(res.candidates);
      setDistilledOnce(true);
    } catch {
      setDistilledOnce(true);
    } finally {
      setDistilling(false);
    }
  }

  function toggleCandidate(id: string): void {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)));
  }

  function updateCandidateText(id: string, text: string): void {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, text } : c)));
  }

  function updateCandidateCategory(id: string, category: StarBotMemoryCategory): void {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, category } : c)));
  }

  async function clearConversationNow(): Promise<void> {
    const serverId = props.serverId ?? LOCAL_SERVER_ID;
    if (props.onDeleteHistory) {
      await props.onDeleteHistory();
    } else if (window.starbot?.agent?.deleteHistory) {
      await window.starbot.agent.deleteHistory(props.agentId, serverId);
    }
    if (props.onClearContext) {
      await props.onClearContext().catch(() => undefined);
    } else if (window.starbot?.agent?.clearContext) {
      await window.starbot.agent.clearContext(props.agentId, serverId).catch(() => undefined);
    }
  }

  async function handleExecutePurge(): Promise<void> {
    if (executing()) return;
    setExecuting(true);
    try {
      if (purgeAutoMemories() && props.memoriesPort) {
        const list = await props.memoriesPort.list();
        for (const m of list) {
          if (m.origin === "automatic") {
            await props.memoriesPort.remove(m.id).catch(() => undefined);
          }
        }
        const remaining = await props.memoriesPort.list();
        await syncMemoriesToAgentInstructions(
          props.agentId,
          props.agentName,
          remaining,
          props.serverId ?? LOCAL_SERVER_ID,
        );
      }
      await clearConversationNow();
      actionToast.success(`已彻底清空「${props.agentName}」的聊天上下文${purgeAutoMemories() ? "与自动临时记忆" : ""}`);
      props.onClose();
    } catch {
      actionToast.error("清空历史记录失败，请稍后重试");
    } finally {
      setExecuting(false);
    }
  }

  async function handleExecuteDistillAndClean(): Promise<void> {
    if (executing()) return;
    setExecuting(true);
    try {
      const chosen = candidates().filter((c) => c.selected && c.text.trim().length > 0);
      if (props.memoriesPort && chosen.length > 0) {
        for (const item of chosen) {
          const formatted = formatTaggedMemory(item.category, item.text);
          await props.memoriesPort.create(formatted);
          if (item.category === "profile") {
            addGlobalUserProfileItem(item.text);
          }
        }
        const freshList = await props.memoriesPort.list();
        await syncMemoriesToAgentInstructions(
          props.agentId,
          props.agentName,
          freshList,
          props.serverId ?? LOCAL_SERVER_ID,
        );
      }
      await clearConversationNow();
      actionToast.success(
        chosen.length > 0
          ? `已提炼 ${chosen.length} 条精华存入记忆文件，并清空冗长历史`
          : `已清空「${props.agentName}」的历史上下文`,
      );
      props.onClose();
    } catch {
      actionToast.error("提炼并清空失败，请重试");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay class="starbot-modal-backdrop">
          <Dialog.Content as="section" class="starbot-clean-memory-modal" aria-label="整理上下文与记忆">
            <Dialog.Title class="sr-only">整理「{props.agentName}」的会话与长期记忆</Dialog.Title>
            <Dialog.Description class="sr-only">
              可选择压缩提炼核心记忆后清空历史，或直接无痕清空污染上下文。
            </Dialog.Description>

            <header class="starbot-clean-modal-header">
              <div>
                <h3>提炼记忆 · {props.agentName}</h3>
              </div>
              <button type="button" class="starbot-inspector-close" onClick={props.onClose} aria-label="关闭">
                <X class="size-4" />
              </button>
            </header>

            <div class="starbot-clean-mode-tabs is-compact" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode() === "distill" ? "true" : "false"}
                class={mode() === "distill" ? "is-active" : ""}
                onClick={() => setMode("distill")}
              >
                <span>✨ 提炼并清空</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode() === "purge" ? "true" : "false"}
                class={mode() === "purge" ? "is-active is-danger" : ""}
                onClick={() => setMode("purge")}
              >
                <span>🧹 仅清空对话</span>
              </button>
            </div>

            <Show when={mode() === "distill"}>
              <div class="starbot-clean-modal-body">
                <Show
                  when={!distilling() && candidates().length > 0}
                  fallback={
                    <div class="starbot-distill-empty is-compact">
                      <span>
                        {distilling() ? "✨ 正在提炼对话要点…" : distilledOnce() ? "暂无新增记忆要点" : "准备提炼…"}
                      </span>
                      <Show when={!distilling()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={executing()}
                          onClick={() => void runDistillPreview()}
                        >
                          重新提炼
                        </Button>
                      </Show>
                    </div>
                  }
                >
                  <div class="starbot-distill-summary-bar">
                    <span>已提炼 {candidates().length} 条记忆要点</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={distilling() || executing()}
                      onClick={() => void runDistillPreview()}
                    >
                      重新提炼
                    </Button>
                  </div>
                  <div class="starbot-distill-list">
                    <For each={candidates()}>
                      {(cand) => (
                        <div class={`starbot-distill-item${cand.selected ? " is-selected" : ""}`}>
                          <button
                            type="button"
                            class={`starbot-distill-check${cand.selected ? " is-checked" : ""}`}
                            onClick={() => toggleCandidate(cand.id)}
                            aria-label="勾选保留此条记忆"
                          >
                            <Check class="size-3" />
                          </button>
                          <select
                            class="starbot-distill-cat-select"
                            value={cand.category}
                            onChange={(e) =>
                              updateCandidateCategory(cand.id, e.currentTarget.value as StarBotMemoryCategory)
                            }
                          >
                            <For each={STARBOT_MEMORY_CATEGORIES}>
                              {(cat) => (
                                <option value={cat.id}>
                                  {cat.icon} {cat.label}
                                </option>
                              )}
                            </For>
                          </select>
                          <input
                            type="text"
                            class="starbot-distill-input"
                            value={cand.text}
                            onInput={(e) => updateCandidateText(cand.id, e.currentTarget.value)}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <footer class="starbot-clean-modal-footer">
                  <Button type="button" variant="ghost" onClick={props.onClose} disabled={executing()}>
                    取消
                  </Button>
                  <Button
                    type="button"
                    loading={executing()}
                    disabled={distilling()}
                    onClick={() => void handleExecuteDistillAndClean()}
                  >
                    <Sparkles class="size-4" />
                    {candidates().some((c) => c.selected && c.text.trim()) ? "保存并清空" : "清空对话"}
                  </Button>
                </footer>
              </div>
            </Show>

            <Show when={mode() === "purge"}>
              <div class="starbot-clean-modal-body">
                <div class="starbot-purge-warning-box is-compact">
                  <strong>清空与「{props.agentName}」的当前对话？</strong>
                  <label class="starbot-purge-checkbox-row">
                    <input
                      type="checkbox"
                      checked={purgeAutoMemories()}
                      onChange={(e) => setPurgeAutoMemories(e.currentTarget.checked)}
                    />
                    <span>同时清除自动生成的临时记忆</span>
                  </label>
                </div>

                <footer class="starbot-clean-modal-footer">
                  <Button type="button" variant="ghost" onClick={props.onClose} disabled={executing()}>
                    取消
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    loading={executing()}
                    onClick={() => void handleExecutePurge()}
                  >
                    <Trash2 class="size-4" />
                    确认清空
                  </Button>
                </footer>
              </div>
            </Show>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
