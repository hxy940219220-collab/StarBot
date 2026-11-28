import { LOCAL_SERVER_ID } from "@starbot/contracts/ipc";
import { Button, Check, ChevronDown, Dialog, Input, Plus, Switch, X } from "@starbot/ui";
import type { AgentProfile } from "@starbot/ui/data";
import { AgentAvatar } from "@starbot/ui/features/agents/AgentAvatar";
import { isChiefStarBot } from "@starbot/ui/features/agents/chief-starbot";
import { playKawaiiCue } from "@starbot/ui/features/agents/starbot-kawaii-audio";
import { createEffect, createMemo, createSignal, For, onCleanup, onSettled, Show } from "solid-js";
import { actionToast } from "../../action-toast";
import { useNavigation } from "../../navigation";
import { useAgents } from "../agents/agents-context";
import { useServers } from "../servers/servers-context";
import {
  addGlobalUserProfileItem,
  chiefStarBotAgentId,
  dailyDigestOpen,
  dreamAutoEnabled,
  dreamJournalEntries,
  formatTaggedMemory,
  globalUserProfileItems,
  hasDreamedToday,
  isDreamRunning,
  parseMemoryCategory,
  quickCaptureOpen,
  refreshChiefStarBotFromAnalytics,
  removeGlobalUserProfileItem,
  runStarBotNightlyDream,
  setDailyDigestOpen,
  setDreamAutoEnabled,
  setQuickCaptureOpen,
  syncMemoriesToAgentInstructions,
} from "./starbot-memory-hub";

export function StarBotWorkspaceCapsules() {
  const { agentList, activeAgent } = useAgents();
  const { activeServer } = useServers();
  const { selectAgent } = useNavigation();

  const [targetAgentId, setTargetAgentId] = createSignal<string>("");
  const [botDropdownOpen, setBotDropdownOpen] = createSignal(false);
  const [captureText, setCaptureText] = createSignal("");
  const [submittingCapture, setSubmittingCapture] = createSignal(false);
  const [digestTab, setDigestTab] = createSignal<"dream" | "profile">("dream");
  const [newProfileFact, setNewProfileFact] = createSignal("");

  const serverId = () => activeServer()?.id ?? LOCAL_SERVER_ID;

  // Refresh Chief StarBot ranking once when agent list settles
  let rankedOnceKey = "";
  createEffect(
    () =>
      agentList()
        .map((a) => a.id)
        .join(","),
    (idsKey) => {
      if (!idsKey || idsKey === rankedOnceKey) return;
      rankedOnceKey = idsKey;
      void refreshChiefStarBotFromAnalytics(agentList(), serverId());
    },
  );

  // Safe Nightly / Early-Morning Dreaming Check (only between 00:00 - 05:59, max once per calendar day!)
  let startupDreamChecked = false;
  createEffect(
    () => [agentList().length, dreamAutoEnabled()] as const,
    ([count, autoOn]) => {
      if (startupDreamChecked || count === 0 || !autoOn) return;
      startupDreamChecked = true;
      if (hasDreamedToday()) return;
      const hour = new Date().getHours();
      if (hour >= 0 && hour < 6) {
        const timer = window.setTimeout(() => {
          void runStarBotNightlyDream({
            agents: agentList(),
            serverId: serverId(),
            manual: false,
          });
        }, 15_000);
        onCleanup(() => window.clearTimeout(timer));
      }
    },
  );

  // Listen for custom `starbot:open-quick-capture` event + conflict-free `Shift + Space` shortcut
  onSettled(() => {
    const openQuickAsk = () => {
      const preferred = activeAgent()?.id ?? chiefStarBotAgentId() ?? agentList()[0]?.id ?? "";
      setTargetAgentId(preferred);
      setBotDropdownOpen(false);
      setQuickCaptureOpen(true);
      void playKawaiiCue("drawer-open");
    };
    const isTypingInNonEmptyField = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return target.value.trim().length > 0;
      }
      const editable = target.closest<HTMLElement>('[contenteditable="true"]');
      if (editable) {
        return (editable.textContent ?? "").trim().length > 0;
      }
      return false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === "Space") {
        if (quickCaptureOpen()) return;
        if (isTypingInNonEmptyField(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        openQuickAsk();
      }
    };
    window.addEventListener("starbot:open-quick-capture", openQuickAsk);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("starbot:open-quick-capture", openQuickAsk);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  });

  createEffect(
    () => quickCaptureOpen(),
    (isOpen) => {
      if (!isOpen) {
        setBotDropdownOpen(false);
        return;
      }
      if (!targetAgentId()) {
        setTargetAgentId(activeAgent()?.id ?? chiefStarBotAgentId() ?? agentList()[0]?.id ?? "");
      }
    },
  );

  const selectedTargetAgent = createMemo<AgentProfile | undefined>(
    () => agentList().find((a) => a.id === targetAgentId()) ?? activeAgent() ?? agentList()[0],
  );

  const chiefAgent = createMemo<AgentProfile | undefined>(() => {
    const id = chiefStarBotAgentId();
    return agentList().find((a) => a.id === id) ?? agentList()[0];
  });

  async function pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setCaptureText((prev) => (prev.trim() ? `${prev}\n${text.trim()}` : text.trim()));
      } else {
        actionToast.warning("剪贴板暂无文本");
      }
    } catch {
      actionToast.warning("请按 ⌘V 粘贴文本");
    }
  }

  async function handleQuickCaptureAction(action: "ask" | "memory" | "todo"): Promise<void> {
    const content = captureText().trim();
    const target = selectedTargetAgent();
    if (!content || !target || submittingCapture()) return;
    setSubmittingCapture(true);
    try {
      if (action === "memory") {
        const { category } = parseMemoryCategory(content);
        const tagged = formatTaggedMemory(category, content);
        await window.starbot.agent.createMemory({ agentId: target.id, text: tagged }, serverId());
        if (category === "profile") {
          addGlobalUserProfileItem(content);
        }
        const list = await window.starbot.agent.listMemories(target.id, serverId()).catch(() => []);
        await syncMemoriesToAgentInstructions(target.id, target.name, list, serverId());
        void playKawaiiCue("success");
        setCaptureText("");
        setQuickCaptureOpen(false);
        actionToast.success(`已存入「${target.name}」的长期记忆`);
        return;
      }

      const prompt = action === "ask" ? content : `请帮我把以下想法拆解为清晰可执行的下一步待办清单：\n\n${content}`;

      await window.starbot.agent.sendMessage({ agentId: target.id, text: prompt }, serverId());
      void playKawaiiCue("message-send");
      selectAgent(target.id);
      setCaptureText("");
      setQuickCaptureOpen(false);
      actionToast.success(action === "ask" ? `已向「${target.name}」发起提问` : `已交由「${target.name}」拆解待办`);
    } catch {
      actionToast.error("发送失败，请确认模型已就绪");
    } finally {
      setSubmittingCapture(false);
    }
  }

  async function handleManualDreamNow(): Promise<void> {
    if (isDreamRunning()) return;
    const entry = await runStarBotNightlyDream({
      agents: agentList(),
      serverId: serverId(),
      manual: true,
    });
    if (entry) {
      actionToast.success(`「${entry.chiefAgentName}」已完成今日记忆归纳`);
    } else {
      actionToast.warning("暂无足够的新对话可供归纳");
    }
  }

  function handleAddGlobalFact(e: SubmitEvent): void {
    e.preventDefault();
    const val = newProfileFact().trim();
    if (!val) return;
    addGlobalUserProfileItem(val);
    setNewProfileFact("");
  }

  return (
    <>
      {/* 随手问 · 闪念（Shift + Space） */}
      <Dialog.Root open={quickCaptureOpen()} onOpenChange={setQuickCaptureOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="starbot-modal-backdrop" onClick={() => setBotDropdownOpen(false)}>
            <Dialog.Content
              as="section"
              class="starbot-quick-capture-modal"
              aria-label="随手问 · 闪念"
              onClick={() => setBotDropdownOpen(false)}
            >
              <Dialog.Title class="sr-only">随手问 · 闪念（Shift + Space）</Dialog.Title>
              <Dialog.Description class="sr-only">随时向任意星友直接提问、拆解待办或记下闪念。</Dialog.Description>

              <div class="starbot-minimal-modal-top">
                <div class="starbot-minimal-modal-heading">
                  <strong>✦ 随手问 · 闪念</strong>
                  <span class="starbot-shortcut-kbd-badge">Shift + Space</span>
                </div>
                <button
                  type="button"
                  class="starbot-inspector-close"
                  onClick={() => setQuickCaptureOpen(false)}
                  aria-label="关闭"
                >
                  <X class="size-4" />
                </button>
              </div>

              <textarea
                class="starbot-capsule-textarea is-spacious"
                rows={6}
                placeholder="直接输入问题随时问星友，或顺手记下一闪而过的灵感与待办…（按 ⌘ + Enter 直接提问）"
                value={captureText()}
                onInput={(e) => setCaptureText(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.isComposing && captureText().trim()) {
                    e.preventDefault();
                    void handleQuickCaptureAction("ask");
                  }
                }}
                autofocus
              />

              <div class="starbot-minimal-capture-bottom">
                <div class="starbot-capsule-agent-select-wrap" onClick={(e) => e.stopPropagation()}>
                  <div class="starbot-bot-picker">
                    <button
                      type="button"
                      class={`starbot-bot-picker-trigger${botDropdownOpen() ? " is-open" : ""}`}
                      aria-haspopup="listbox"
                      aria-expanded={botDropdownOpen() ? "true" : "false"}
                      onClick={() => setBotDropdownOpen((v) => !v)}
                    >
                      <Show when={selectedTargetAgent()}>
                        {(ag) => (
                          <>
                            <AgentAvatar agent={ag()} class="starbot-bot-picker-avatar" />
                            <span class="starbot-bot-picker-name">{ag().name}</span>
                            <Show when={isChiefStarBot(ag().id)}>
                              <span class="starbot-gold-badge">主星友</span>
                            </Show>
                          </>
                        )}
                      </Show>
                      <ChevronDown class="size-3.5 starbot-bot-picker-chevron" aria-hidden="true" />
                    </button>

                    <Show when={botDropdownOpen()}>
                      <div class="starbot-bot-picker-menu" role="listbox" aria-label="选择目标星友">
                        <For each={agentList()}>
                          {(ag) => {
                            const active = () => selectedTargetAgent()?.id === ag.id;
                            return (
                              <button
                                type="button"
                                role="option"
                                aria-selected={active() ? "true" : "false"}
                                class={`starbot-bot-picker-option${active() ? " is-active" : ""}`}
                                onClick={() => {
                                  setTargetAgentId(ag.id);
                                  setBotDropdownOpen(false);
                                }}
                              >
                                <AgentAvatar agent={ag} class="starbot-bot-picker-option-avatar" />
                                <span class="starbot-bot-picker-option-label">{ag.name}</span>
                                <Show when={isChiefStarBot(ag.id)}>
                                  <span class="starbot-gold-badge">主星友</span>
                                </Show>
                                <Show when={active()}>
                                  <Check class="size-3.5 starbot-bot-picker-check" aria-hidden="true" />
                                </Show>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </div>

                  <button type="button" class="starbot-mem-footer-link" onClick={() => void pasteFromClipboard()}>
                    粘贴剪贴板
                  </button>
                </div>

                <div class="starbot-capsule-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!captureText().trim() || submittingCapture()}
                    onClick={() => void handleQuickCaptureAction("memory")}
                  >
                    存入记忆
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!captureText().trim() || submittingCapture()}
                    onClick={() => void handleQuickCaptureAction("todo")}
                  >
                    拆解待办
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={submittingCapture()}
                    disabled={!captureText().trim()}
                    onClick={() => void handleQuickCaptureAction("ask")}
                  >
                    直接提问 ↵
                  </Button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 极简「星夜梦境 & 共享画像」双页签弹窗 */}
      <Dialog.Root open={dailyDigestOpen()} onOpenChange={setDailyDigestOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="starbot-modal-backdrop">
            <Dialog.Content as="section" class="starbot-daily-digest-modal" aria-label="星夜梦境与共享画像">
              <Dialog.Title class="sr-only">星夜梦境与共享画像</Dialog.Title>
              <Dialog.Description class="sr-only">
                主星友夜间自动归纳今日对话记忆，以及跨星友共享个人画像。
              </Dialog.Description>

              <div class="starbot-minimal-modal-top">
                <div class="starbot-minimal-seg-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={digestTab() === "dream" ? "true" : "false"}
                    class={digestTab() === "dream" ? "is-active" : ""}
                    onClick={() => setDigestTab("dream")}
                  >
                    星夜梦境
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={digestTab() === "profile" ? "true" : "false"}
                    class={digestTab() === "profile" ? "is-active" : ""}
                    onClick={() => setDigestTab("profile")}
                  >
                    共享画像 ({globalUserProfileItems().length})
                  </button>
                </div>
                <button
                  type="button"
                  class="starbot-inspector-close"
                  onClick={() => setDailyDigestOpen(false)}
                  aria-label="关闭"
                >
                  <X class="size-4" />
                </button>
              </div>

              <Show when={digestTab() === "dream"}>
                <div class="starbot-digest-scroll">
                  <Show when={chiefAgent()}>
                    {(chief) => (
                      <div class="starbot-minimal-chief-bar">
                        <div class="starbot-minimal-chief-left">
                          <AgentAvatar agent={chief()} />
                          <div>
                            <strong>{chief().name} · 主星友</strong>
                            <span>每日凌晨自动回顾对话，将偏好与事项归纳至长期记忆</span>
                          </div>
                        </div>
                        <div class="starbot-minimal-chief-right">
                          <Switch
                            checked={dreamAutoEnabled()}
                            aria-label="每日自动归纳"
                            onChange={setDreamAutoEnabled}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            loading={isDreamRunning()}
                            onClick={() => void handleManualDreamNow()}
                          >
                            立即归纳
                          </Button>
                        </div>
                      </div>
                    )}
                  </Show>

                  <Show
                    when={dreamJournalEntries().length > 0}
                    fallback={
                      <div class="starbot-distill-empty">
                        暂无梦境记录。主星友会在深夜自动为你整理当日对话，也可点击右上角「立即归纳」。
                      </div>
                    }
                  >
                    <div class="starbot-minimal-dream-list">
                      <For each={dreamJournalEntries()}>
                        {(entry) => (
                          <article class="starbot-minimal-dream-item">
                            <header>
                              <strong>{entry.date}</strong>
                              <span>
                                {entry.chiefAgentName} · {entry.createdAt}
                              </span>
                            </header>
                            <p>{entry.summary}</p>
                            <Show when={entry.savedItems.length > 0}>
                              <ul>
                                <For each={entry.savedItems}>{(item) => <li>{item.text}</li>}</For>
                              </ul>
                            </Show>
                          </article>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>

              <Show when={digestTab() === "profile"}>
                <div class="starbot-digest-scroll">
                  <p class="starbot-minimal-tab-desc">
                    添加你的职业、技术栈或沟通偏好，工作台内所有星友都会共享这些背景设定。
                  </p>
                  <form class="starbot-digest-profile-form" onSubmit={handleAddGlobalFact}>
                    <Input
                      value={newProfileFact()}
                      placeholder="例如：独立开发者，偏爱简洁直接的中文结论…"
                      onValueChange={setNewProfileFact}
                    />
                    <Button type="submit" size="sm" disabled={!newProfileFact().trim()}>
                      <Plus class="size-4" />
                    </Button>
                  </form>

                  <Show
                    when={globalUserProfileItems().length > 0}
                    fallback={<div class="starbot-distill-empty">暂无共享画像条目</div>}
                  >
                    <ul class="starbot-mem-minimal-list">
                      <For each={globalUserProfileItems()}>
                        {(fact) => (
                          <li class="starbot-mem-minimal-row is-compact">
                            <p class="starbot-mem-minimal-content">{fact}</p>
                            <button
                              type="button"
                              class="starbot-mem-inline-del"
                              onClick={() => removeGlobalUserProfileItem(fact)}
                            >
                              移除
                            </button>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </Show>
            </Dialog.Content>
          </Dialog.Overlay>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
