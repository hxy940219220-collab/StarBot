import type {
  AgentDockDragPhase,
  AgentDockSnapEdge,
  StarBotCompanionInfo,
  StarBotCompanionModelChoice,
} from "@starbot/contracts/ipc";
import { Check, Mic, Sparkles, X } from "@starbot/ui";
import type { AgentDockVoice } from "@starbot/ui/features/agent-dock/AgentDock";
import { AgentAvatar, type ZodiacCuteEmote } from "@starbot/ui/features/agents/AgentAvatar";
import { playKawaiiCue } from "@starbot/ui/features/agents/starbot-kawaii-audio";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import "./starbot-floating-companion.css";

export type CompanionSubPanel = "bots" | "models" | "usage" | "context" | null;

export interface StarBotFloatingCompanionProps {
  bots: readonly StarBotCompanionInfo[];
  activeBotId: string | null;
  modelChoices: readonly StarBotCompanionModelChoice[];
  sizePercent?: number | undefined;
  expandSide?: "left" | "right" | undefined;
  anchorX?: number | undefined;
  anchorY?: number | undefined;
  stageWidth?: number | undefined;
  stageHeight?: number | undefined;
  dockedEdge?: AgentDockSnapEdge | null | undefined;
  inWindow?: boolean | undefined;
  closePanelNonce?: number | undefined;
  onPanelOpenChange?: ((open: boolean) => void) | undefined;
  voice: AgentDockVoice;
  onSelectBot: (agentId: string) => void;
  onSendVoiceText: (agentId: string, text: string) => Promise<void>;
  onSwitchModel: (agentId: string, provider: string, model: string) => void;
  onStarBotChat: (agentId: string) => void;
  onResizeSizePercent?: ((sizePercent: number) => void) | undefined;
  onHide?: (() => void) | undefined;
  onDrag?: ((phase: AgentDockDragPhase) => void) | undefined;
  onVoiceStateChange?:
    | ((state: {
        active: boolean;
        phase?: "preparing" | "requesting" | "recording" | "transcribing";
        elapsedSeconds?: number;
        liveText?: string;
        levels?: number[];
        agentId?: string | null;
      }) => void)
    | undefined;
}

function formatCompactTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function StarBotFloatingCompanion(props: StarBotFloatingCompanionProps) {
  const [hovered, setHovered] = createSignal(false);
  const [activePanel, setActivePanel] = createSignal<CompanionSubPanel>(null);
  const [modelSourceTab, setModelSourceTab] = createSignal<"local" | "api">("local");
  const [selectedProviderLabel, setSelectedProviderLabel] = createSignal<string | null>(null);
  const [waitingReplyForBotId, setWaitingReplyForBotId] = createSignal<string | null>(null);
  const [baselineReplyId, setBaselineReplyId] = createSignal<string | null>(null);
  const [shownReply, setShownReply] = createSignal<{
    agentId: string;
    agentName: string;
    replyId: string | null;
    text: string;
    streaming: boolean;
    completedNotice?: boolean;
  } | null>(null);
  const [dismissedReplyKey, setDismissedReplyKey] = createSignal<string | null>(null);
  const [replyBubbleHovered, setReplyBubbleHovered] = createSignal(false);
  const [windowPos, setWindowPos] = createSignal({ x: 32, y: 80 });
  const [inWindowDockedEdge, setInWindowDockedEdge] = createSignal<AgentDockSnapEdge | null>(null);
  const [draggingNow, setDraggingNow] = createSignal(false);
  const [suppressHoverUntilLeave, setSuppressHoverUntilLeave] = createSignal(false);
  const [voiceDraftText, setVoiceDraftText] = createSignal("");
  const [voiceError, setVoiceError] = createSignal<string | null>(null);
  const [dragDizzy, setDragDizzy] = createSignal(false);
  const [celebratePhase, setCelebratePhase] = createSignal<"burst" | "starry" | null>(null);
  const [thinkingPillVisible, setThinkingPillVisible] = createSignal(false);
  const [localSizePercent, setLocalSizePercent] = createSignal(Math.max(70, Math.min(140, props.sizePercent ?? 100)));

  let hoverLeaveTimer: ReturnType<typeof setTimeout> | undefined;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  let dizzyTimer: ReturnType<typeof setTimeout> | undefined;
  let celebrateBurstTimer: ReturnType<typeof setTimeout> | undefined;
  let celebrateEndTimer: ReturnType<typeof setTimeout> | undefined;
  let replyAutoDismissTimer: ReturnType<typeof setTimeout> | undefined;
  let thinkingPillTimer: ReturnType<typeof setTimeout> | undefined;
  let prevTrackedBotId: string | null = null;
  let prevBotWorking = false;
  let prevBotReplyId: string | null = null;
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let lastDragX = 0;
  let lastDragDir = 0;
  let dragShakeFlips = 0;
  let lastDragFlipAt = 0;
  let dragMoved = false;
  let winStartRight = 32;
  let winStartBottom = 80;

  onCleanup(() => {
    clearTimeout(hoverLeaveTimer);
    clearTimeout(errorTimer);
    clearTimeout(dizzyTimer);
    clearTimeout(celebrateBurstTimer);
    clearTimeout(celebrateEndTimer);
    clearTimeout(replyAutoDismissTimer);
    clearTimeout(thinkingPillTimer);
  });

  createEffect(
    () => props.sizePercent,
    (pct) => {
      if (pct !== undefined && Number.isFinite(pct)) {
        setLocalSizePercent(Math.max(70, Math.min(140, Math.round(pct))));
      }
    },
  );

  function applySizePercent(next: number): void {
    const clamped = Math.max(70, Math.min(140, Math.round(next)));
    setLocalSizePercent(clamped);
    props.onResizeSizePercent?.(clamped);
  }

  function triggerCompletionCelebration(): void {
    clearTimeout(celebrateBurstTimer);
    clearTimeout(celebrateEndTimer);
    setCelebratePhase("burst");
    void playKawaiiCue("mascot-happy", { subtle: true });
    celebrateBurstTimer = setTimeout(() => {
      setCelebratePhase("starry");
    }, 2_400);
    celebrateEndTimer = setTimeout(() => {
      setCelebratePhase(null);
    }, 6_600);
  }

  function scheduleReplyAutoDismiss(): void {
    clearTimeout(replyAutoDismissTimer);
    replyAutoDismissTimer = setTimeout(() => {
      if (replyBubbleHovered()) return;
      const cur = shownReply();
      if (cur && !cur.streaming) {
        setShownReply(null);
      }
    }, 12_000);
  }

  const currentBot = createMemo<StarBotCompanionInfo | null>(() => {
    const all = props.bots;
    if (all.length === 0) return null;
    return all.find((b) => b.agent.id === props.activeBotId) ?? all[0] ?? null;
  });

  const isRecording = () =>
    props.voice.phase === "preparing" ||
    props.voice.phase === "requesting" ||
    props.voice.phase === "recording" ||
    props.voice.phase === "transcribing";

  const isThinking = createMemo(() => {
    const bot = currentBot();
    if (!bot) return false;
    return bot.working || waitingReplyForBotId() === bot.agent.id;
  });

  // Pop up the top thinking pill briefly (2.6s) when thinking begins, then auto-hide so only the thinking animation stays
  createEffect(
    () => ({ thinking: isThinking(), botId: currentBot()?.agent.id ?? null }),
    (curr, prev) => {
      clearTimeout(thinkingPillTimer);
      if (curr.thinking && curr.botId) {
        if (!prev?.thinking || prev.botId !== curr.botId) {
          setThinkingPillVisible(true);
          thinkingPillTimer = setTimeout(() => {
            setThinkingPillVisible(false);
          }, 2_600);
        }
      } else {
        setThinkingPillVisible(false);
      }
    },
  );

  // Sync voice recording state to Dynamic Island via main renderer
  createEffect(
    () => ({
      phase: props.voice.phase,
      elapsed: props.voice.elapsedSeconds,
      liveText: props.voice.liveText,
      levels: props.voice.levels,
      botId: currentBot()?.agent.id ?? null,
    }),
    (st) => {
      if (!props.onVoiceStateChange) return;
      if (st.phase === "idle") {
        props.onVoiceStateChange({ active: false });
      } else {
        props.onVoiceStateChange({
          active: true,
          phase: st.phase,
          elapsedSeconds: st.elapsed,
          liveText: st.liveText,
          levels: st.levels.slice(-10),
          agentId: st.botId,
        });
      }
    },
  );

  // Watch working -> completed transitions AND incoming/streaming replies on the active companion bot
  createEffect(
    () => {
      const bot = currentBot();
      if (!bot) return null;
      return {
        botId: bot.agent.id,
        botName: bot.agent.name,
        working: bot.working,
        replyId: bot.latestReplyId,
        replyText: bot.latestReplyText,
        waitingId: waitingReplyForBotId(),
        baseId: baselineReplyId(),
      };
    },
    (state) => {
      if (!state) return;
      const { botId, botName, working, replyId, replyText, waitingId, baseId } = state;
      const sameBot = prevTrackedBotId === botId;
      const wasWorking = sameBot && prevBotWorking;
      const hadNewReplySincePrev = sameBot && Boolean(replyId && replyId !== prevBotReplyId && replyText);

      // Update tracked state immediately
      prevTrackedBotId = botId;
      prevBotWorking = working;
      prevBotReplyId = replyId;

      // While actively working, stop any old celebration and clear stale completed bubble from a previous turn
      if (working) {
        if (!wasWorking) {
          clearTimeout(celebrateBurstTimer);
          clearTimeout(celebrateEndTimer);
          clearTimeout(replyAutoDismissTimer);
          setCelebratePhase(null);
          if (shownReply()?.agentId === botId && !shownReply()?.streaming) {
            setShownReply(null);
          }
        }
        // If triggered via companion voice send and live text is already streaming, show streaming preview
        if (waitingId === botId && replyText && replyId && replyId !== baseId) {
          const key = `${botId}:${replyId}`;
          if (dismissedReplyKey() !== key) {
            setShownReply({
              agentId: botId,
              agentName: botName,
              replyId,
              text: replyText,
              streaming: true,
              completedNotice: false,
            });
          }
        }
        return;
      }

      // Transitioned from working -> finished (whether triggered from desktop chat, mobile, script, or voice!)
      const finishedFromVoice = waitingId === botId && Boolean(replyText && replyId && replyId !== baseId);
      const finishedTask = wasWorking || finishedFromVoice || (hadNewReplySincePrev && !working);
      if (finishedTask) {
        if (waitingId === botId) setWaitingReplyForBotId(null);
        const key = `${botId}:${replyId ?? "done"}`;
        if (dismissedReplyKey() !== key) {
          setShownReply({
            agentId: botId,
            agentName: botName,
            replyId,
            text: replyText || "新回复已生成，点击前往对话查看完整内容。",
            streaming: false,
            completedNotice: true,
          });
          scheduleReplyAutoDismiss();
        }
        triggerCompletionCelebration();
        return;
      }

      // Keep already-shown reply bubble in sync if its final text settles slightly after completion
      const currentShown = shownReply();
      if (currentShown && currentShown.agentId === botId && replyText) {
        if (currentShown.replyId === replyId || currentShown.replyId === null) {
          setShownReply({
            ...currentShown,
            agentName: botName,
            replyId,
            text: replyText,
            streaming: false,
          });
        }
      }
    },
  );

  const currentDockedEdge = createMemo<AgentDockSnapEdge | null>(() =>
    props.inWindow ? inWindowDockedEdge() : (props.dockedEdge ?? null),
  );

  createEffect(
    () => currentDockedEdge(),
    (edge, prev) => {
      if (draggingNow() && edge !== null && prev === null) {
        void playKawaiiCue("tap", { subtle: true });
      }
    },
  );

  const isInteracting = createMemo(
    () => !draggingNow() && ((hovered() && !suppressHoverUntilLeave()) || activePanel() !== null || isRecording()),
  );
  const arcVisible = () => isInteracting();
  const isHalfHiddenResting = createMemo(() => currentDockedEdge() !== null && !isInteracting());
  const expandLeft = createMemo(() => {
    if (props.inWindow) {
      const edge = inWindowDockedEdge();
      if (edge === "left") return false;
      if (edge === "right") return true;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      return windowPos().x <= vw * 0.55;
    }
    return (props.expandSide ?? "left") === "left";
  });

  // Notify Electron helper window when a popover card opens/closes so clicking outside on desktop blurs & auto-closes it!
  createEffect(
    () => activePanel() !== null,
    (open) => {
      props.onPanelOpenChange?.(open);
      if (!open) return;
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target;
        if (target instanceof Element && target.closest(".starbot-companion-card, .starbot-arc-btn")) return;
        if (event.button === 2 && target instanceof Element && target.closest(".starbot-companion-orb")) return;
        setActivePanel(null);
      };
      const onWindowBlur = () => {
        setActivePanel(null);
        setHovered(false);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") setActivePanel(null);
      };
      document.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown, true);
        window.removeEventListener("blur", onWindowBlur);
        window.removeEventListener("keydown", onKeyDown);
      };
    },
  );

  createEffect(
    () => props.closePanelNonce ?? 0,
    (nonce, prev) => {
      if (prev !== undefined && nonce !== prev) {
        setActivePanel(null);
        setHovered(false);
      }
    },
  );

  const groupedBySource = createMemo(() => {
    const bot = currentBot();
    const build = (source: "local" | "api") => {
      const groups = new Map<
        string,
        { key: string; provider: string; providerLabel: string; items: StarBotCompanionModelChoice[] }
      >();
      for (const choice of props.modelChoices) {
        const itemSource = choice.source ?? "local";
        if (itemSource !== source) continue;
        const pretty = choice.providerLabel || choice.provider.charAt(0).toUpperCase() + choice.provider.slice(1);
        let group = groups.get(pretty);
        if (!group) {
          group = { key: pretty, provider: choice.provider, providerLabel: pretty, items: [] };
          groups.set(pretty, group);
        }
        group.items.push(choice);
      }
      const list = [...groups.values()];
      if (bot) {
        list.sort(
          (a, b) =>
            Number(b.items.some((i) => i.provider === bot.provider && i.model === bot.model)) -
            Number(a.items.some((i) => i.provider === bot.provider && i.model === bot.model)),
        );
      }
      return list;
    };
    return { local: build("local"), api: build("api") };
  });

  // Sync default source tab ("local" vs "api") and active provider chip when opening the model panel
  createEffect(
    () => ({ open: activePanel() === "models", bot: currentBot(), bySource: groupedBySource() }),
    ({ open, bot, bySource }) => {
      if (!open) return;
      const inApi =
        bot && bySource.api.find((g) => g.items.some((i) => i.provider === bot.provider && i.model === bot.model));
      const inLocal =
        bot && bySource.local.find((g) => g.items.some((i) => i.provider === bot.provider && i.model === bot.model));
      const nextSource: "local" | "api" = inApi
        ? "api"
        : inLocal
          ? "local"
          : bySource.local.length > 0
            ? "local"
            : "api";
      setModelSourceTab(nextSource);
      const activeGroup = (nextSource === "api" ? inApi : inLocal) ?? bySource[nextSource][0] ?? null;
      setSelectedProviderLabel(activeGroup?.key ?? null);
    },
  );

  const visibleProviderGroups = createMemo(() => groupedBySource()[modelSourceTab()]);

  const activeProviderGroup = createMemo(() => {
    const list = visibleProviderGroups();
    if (list.length === 0) return null;
    const wanted = selectedProviderLabel();
    return list.find((g) => g.key === wanted) ?? list[0] ?? null;
  });

  // Scale ONLY the 3D clay mascot character (70%->48px, 100%->69px, 140%->96px; ~50px-100px visible diameter)
  // while keeping the 4 orbital action buttons strictly fixed-size (30px) in a snug, non-overlapping arc.
  const sizeRatio = createMemo(() => {
    const pct = Math.max(70, Math.min(140, localSizePercent()));
    return (pct - 70) / 70;
  });

  const botDiameter = createMemo(() => Math.round(48 + sizeRatio() * 48));
  const botRadius = createMemo(() => Math.max(24, Math.round(botDiameter() / 2)));
  const orbitalRadius = createMemo(() => Math.max(56, Math.round(botDiameter() / 2 + 25)));
  const sideCardOffset = createMemo(() => orbitalRadius() + 24);

  const stageW = createMemo(() => props.stageWidth ?? 860);
  const stageH = createMemo(() => props.stageHeight ?? 560);
  const rawAnchorX = createMemo(() => props.anchorX ?? Math.round(stageW() / 2));
  const rawAnchorY = createMemo(() => props.anchorY ?? Math.round(stageH() / 2));

  const effectiveAnchor = createMemo(() => {
    const rx = rawAnchorX();
    const ry = rawAnchorY();
    if (!isInteracting()) return { x: rx, y: ry };
    const minSafeX = botRadius() + 10;
    const maxSafeX = Math.max(minSafeX, stageW() - botRadius() - 10);
    const minSafeY = orbitalRadius() + 20;
    const maxSafeY = Math.max(minSafeY, stageH() - orbitalRadius() - 20);
    return {
      x: Math.min(maxSafeX, Math.max(minSafeX, rx)),
      y: Math.min(maxSafeY, Math.max(minSafeY, ry)),
    };
  });

  const cardShiftY = createMemo(() => {
    if (props.inWindow) return 0;
    const y = effectiveAnchor().y;
    const h = stageH();
    const minCardCenter = 166;
    const maxCardCenter = Math.max(minCardCenter, h - 166);
    if (y < minCardCenter) return Math.round(minCardCenter - y);
    if (y > maxCardCenter) return Math.round(maxCardCenter - y);
    return 0;
  });

  // Top-centered status/reply bubbles sit symmetrically right above the mascot; flip below only near top edge
  const topBubbleBelow = createMemo(() => {
    if (currentDockedEdge() === "top") return true;
    if (props.inWindow) {
      const vh = typeof window !== "undefined" ? window.innerHeight : 720;
      return vh - windowPos().y - botDiameter() < 120;
    }
    return effectiveAnchor().y < botRadius() + 124;
  });

  // Keep centered top bubbles 100% inside helper window horizontally when mascot rests near screen left/right edge
  const topBubbleShiftX = createMemo(() => {
    const halfWidth = shownReply()?.agentId === currentBot()?.agent.id ? 132 : 108;
    const margin = 12;
    if (props.inWindow) {
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const centerX = vw - windowPos().x - botRadius();
      if (centerX - halfWidth < margin) return Math.round(margin - (centerX - halfWidth));
      if (centerX + halfWidth > vw - margin) return Math.round(vw - margin - (centerX + halfWidth));
      return 0;
    }
    const x = effectiveAnchor().x;
    const w = stageW();
    if (x - halfWidth < margin) return Math.round(margin - (x - halfWidth));
    if (x + halfWidth > w - margin) return Math.round(w - margin - (x + halfWidth));
    return 0;
  });

  // 4 smooth orbital arc buttons biased away from the top/bottom bubble so they NEVER collide at any size (70%-140%).
  // Hide & size-scaling live in the right-click context menu on the mascot.
  const orbitalButtons = createMemo(() => {
    const step = 35 - sizeRatio() * 6;
    const below = topBubbleBelow();
    const centerDeg = expandLeft() ? (below ? 210 : 150) : below ? -30 : 30;
    const anglesDeg = expandLeft()
      ? [centerDeg - step * 1.5, centerDeg - step * 0.5, centerDeg + step * 0.5, centerDeg + step * 1.5]
      : [centerDeg + step * 1.5, centerDeg + step * 0.5, centerDeg - step * 0.5, centerDeg - step * 1.5];
    const radius = orbitalRadius();
    const specs = [
      { id: "bots" as const, label: "切换星友", delayMs: 0 },
      { id: "voice" as const, label: isRecording() ? "点击结束并发送" : "录音快聊", delayMs: 36 },
      { id: "models" as const, label: "切换模型", delayMs: 72 },
      { id: "usage" as const, label: "模型与上下文用量", delayMs: 108 },
    ];
    return specs.map((spec, idx) => {
      const deg = anglesDeg[idx] ?? 180;
      const rad = (deg * Math.PI) / 180;
      return {
        ...spec,
        tx: Math.round(Math.cos(rad) * radius),
        ty: Math.round(Math.sin(rad) * radius),
      };
    });
  });

  function enterHover(): void {
    clearTimeout(hoverLeaveTimer);
    if (draggingNow() || suppressHoverUntilLeave()) return;
    const wasOpen = arcVisible();
    setHovered(true);
    if (!wasOpen) {
      void playKawaiiCue("orbital-bloom", { subtle: true });
    }
  }

  function leaveHover(): void {
    clearTimeout(hoverLeaveTimer);
    setSuppressHoverUntilLeave(false);
    hoverLeaveTimer = setTimeout(() => {
      setHovered(false);
    }, 240);
  }

  function handleOrbPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    dragPointerId = e.pointerId;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    lastDragX = e.screenX;
    lastDragDir = 0;
    dragShakeFlips = 0;
    dragMoved = false;
    winStartRight = windowPos().x;
    winStartBottom = windowPos().y;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleOrbPointerMove(e: PointerEvent): void {
    if (dragPointerId !== e.pointerId) return;
    const dx = e.screenX - dragStartX;
    const dy = e.screenY - dragStartY;
    if (!dragMoved && Math.hypot(dx, dy) > 5) {
      dragMoved = true;
      setDraggingNow(true);
      setActivePanel(null);
      props.onDrag?.("start");
    }
    if (!dragMoved) return;
    // Detect rapid left-right shake while dragging to trigger adorable dizzy-swirl!
    const stepX = e.screenX - lastDragX;
    if (Math.abs(stepX) >= 14) {
      const dir = Math.sign(stepX);
      const now = performance.now();
      if (lastDragDir !== 0 && dir !== lastDragDir) {
        dragShakeFlips = now - lastDragFlipAt < 380 ? dragShakeFlips + 1 : 1;
        lastDragFlipAt = now;
        if (dragShakeFlips >= 3) {
          dragShakeFlips = 0;
          setDragDizzy(true);
          void playKawaiiCue("mascot-dizzy", { subtle: true });
          clearTimeout(dizzyTimer);
          dizzyTimer = setTimeout(() => setDragDizzy(false), 2_200);
        }
      }
      lastDragDir = dir;
      lastDragX = e.screenX;
    }
    if (props.inWindow) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = botRadius();
      const rawRight = winStartRight - dx;
      const rawBottom = winStartBottom - dy;
      const snap = Math.max(16, Math.round(r * 0.55));
      const distRight = rawRight + r;
      const distLeft = vw - (rawRight + r);
      const distBottom = rawBottom + r;
      const distTop = vh - (rawBottom + r);
      const candidates: Array<{ edge: AgentDockSnapEdge; dist: number }> = [
        { edge: "right", dist: distRight },
        { edge: "left", dist: distLeft },
        { edge: "bottom", dist: distBottom },
        { edge: "top", dist: distTop },
      ];
      candidates.sort((a, b) => a.dist - b.dist);
      const nearest = candidates[0];
      const nextEdge = nearest && nearest.dist <= snap ? nearest.edge : null;
      setInWindowDockedEdge(nextEdge);
      let nextRight = Math.min(Math.max(0, vw - r * 2), Math.max(0, rawRight));
      let nextBottom = Math.min(Math.max(0, vh - r * 2), Math.max(0, rawBottom));
      if (nextEdge === "right") nextRight = -r;
      else if (nextEdge === "left") nextRight = vw - r;
      else if (nextEdge === "bottom") nextBottom = -r;
      else if (nextEdge === "top") nextBottom = vh - r;
      setWindowPos({ x: nextRight, y: nextBottom });
    } else {
      props.onDrag?.("move");
    }
  }

  function handleOrbPointerUp(e: PointerEvent): void {
    if (dragPointerId !== e.pointerId) return;
    dragPointerId = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    if (dragMoved) {
      dragMoved = false;
      setDraggingNow(false);
      if (currentDockedEdge() !== null) {
        setHovered(false);
        setSuppressHoverUntilLeave(true);
      }
      props.onDrag?.("end");
      return;
    }
    setDraggingNow(false);
    setSuppressHoverUntilLeave(false);
    // Single tap on the floating bot: if reply bubble is open, open chat; otherwise toggle arc/chat
    const bot = currentBot();
    if (!bot) return;
    if (activePanel() !== null) {
      void playKawaiiCue("drawer-close", { subtle: true });
      setActivePanel(null);
    } else {
      const opening = !hovered();
      setHovered(opening);
      void playKawaiiCue(opening ? "orbital-bloom" : "drawer-close", { subtle: true });
    }
  }

  function handleToggleVoice(): void {
    const bot = currentBot();
    if (!bot) return;
    setActivePanel(null);
    if (props.voice.phase === "recording") {
      // Stop recording -> auto transcribe & send directly to bot!
      void playKawaiiCue("message-send", { subtle: true });
      setWaitingReplyForBotId(bot.agent.id);
      setBaselineReplyId(bot.latestReplyId);
      setDismissedReplyKey(null);
      props.voice.onSend();
      return;
    }
    if (props.voice.phase !== "idle") {
      props.voice.onCancel();
      return;
    }
    void playKawaiiCue("tap", { subtle: true });
    setVoiceDraftText("");
    setVoiceError(null);
    const targetBotId = bot.agent.id;
    const baselineId = bot.latestReplyId;
    props.voice.onStart({
      seatKey: targetBotId,
      draft: () => voiceDraftText(),
      setDraft: (val) => setVoiceDraftText(val),
      send: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setWaitingReplyForBotId(targetBotId);
        setBaselineReplyId(baselineId);
        setDismissedReplyKey(null);
        void props.onSendVoiceText(targetBotId, trimmed);
      },
      focus: () => {},
      showError: (msg) => {
        setWaitingReplyForBotId(null);
        clearTimeout(errorTimer);
        setVoiceError(msg);
        errorTimer = setTimeout(() => setVoiceError(null), 3_200);
      },
    });
  }

  function handleArcClick(id: "bots" | "voice" | "models" | "usage"): void {
    if (id === "voice") {
      handleToggleVoice();
      return;
    }
    void playKawaiiCue("drawer-open", { subtle: true });
    setActivePanel((prev) => (prev === id ? null : id));
  }

  return (
    <Show when={currentBot()}>
      {(bot) => {
        const usage = () => bot().usage;
        const contextPct = () =>
          usage().contextWindowTokens > 0
            ? Math.min(100, Math.round((usage().contextUsedTokens / usage().contextWindowTokens) * 100))
            : 0;

        return (
          <div
            class={`starbot-companion-stage${props.inWindow ? " is-in-window" : " is-screen-stage"}${draggingNow() ? " is-dragging" : ""}`}
            style={{
              ...(props.inWindow
                ? {
                    right: `${
                      isInteracting() && inWindowDockedEdge() === "right"
                        ? 8
                        : isInteracting() && inWindowDockedEdge() === "left"
                          ? window.innerWidth - botDiameter() - 8
                          : windowPos().x
                    }px`,
                    bottom: `${
                      isInteracting() && inWindowDockedEdge() === "bottom"
                        ? orbitalRadius()
                        : isInteracting() && inWindowDockedEdge() === "top"
                          ? window.innerHeight - botDiameter() - orbitalRadius()
                          : windowPos().y
                    }px`,
                  }
                : {}),
              "--bot-size": `${botDiameter()}px`,
              "--card-offset": `${sideCardOffset()}px`,
              "--card-shift-y": `${cardShiftY()}px`,
              "--bubble-shift-x": `${topBubbleShiftX()}px`,
            }}
          >
            <div
              class={`starbot-companion-anchor is-side-${expandLeft() ? "left" : "right"}${topBubbleBelow() ? " is-bubble-below" : ""}${isHalfHiddenResting() ? ` is-edge-half is-edge-${currentDockedEdge()}` : ""}`}
              style={
                props.inWindow
                  ? undefined
                  : {
                      left: `${effectiveAnchor().x}px`,
                      top: `${effectiveAnchor().y}px`,
                    }
              }
              onMouseEnter={enterHover}
              onMouseLeave={leaveHover}
            >
              {/* Invisible edge hover bridge so sliding out from a screen edge never drops pointer hover */}
              <Show when={!props.inWindow && isInteracting() && currentDockedEdge() !== null}>
                <span
                  class={`starbot-companion-edge-bridge is-bridge-${currentDockedEdge()}`}
                  data-companion-hit="true"
                  aria-hidden="true"
                />
              </Show>
              {/* 4 Circular Orbital Arc Action Buttons */}
              <div
                class={`starbot-companion-arc${arcVisible() ? " is-open" : ""}${activePanel() !== null ? " has-open-panel" : ""}`}
                data-companion-hit="true"
              >
                <For each={orbitalButtons()}>
                  {(btn) => {
                    const selected = () =>
                      (btn.id === "voice" && isRecording()) || (btn.id !== "voice" && activePanel() === btn.id);
                    return (
                      <button
                        type="button"
                        data-companion-hit="true"
                        class={`starbot-arc-btn is-${btn.id}${selected() ? " is-active" : ""}`}
                        style={{
                          "--arc-x": `${btn.tx}px`,
                          "--arc-y": `${btn.ty}px`,
                          "--arc-delay": `${btn.delayMs}ms`,
                        }}
                        title={btn.label}
                        aria-label={btn.label}
                        onClick={() => handleArcClick(btn.id)}
                      >
                        <Show when={btn.id === "bots"}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            aria-hidden="true"
                          >
                            <path d="M16 3h5v5" />
                            <path d="M8 21H3v-5" />
                            <path d="M21 3l-7 7" />
                            <path d="M3 21l7-7" />
                          </svg>
                        </Show>
                        <Show when={btn.id === "voice"}>
                          <Mic aria-hidden="true" />
                        </Show>
                        <Show when={btn.id === "models"}>
                          <Sparkles aria-hidden="true" />
                        </Show>
                        <Show when={btn.id === "usage"}>
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            aria-hidden="true"
                          >
                            <path d="M12 20V10" />
                            <path d="M18 20V4" />
                            <path d="M6 20v-6" />
                          </svg>
                        </Show>
                        <span class="starbot-arc-tooltip">{btn.label}</span>
                      </button>
                    );
                  }}
                </For>
              </div>

              {/* Floating Sub-Panels: Switch Bot / Switch Model / Usage Telemetry */}
              <Show when={activePanel() === "bots"}>
                <div class="starbot-companion-card" data-companion-hit="true">
                  <div class="starbot-companion-card-head">
                    <span>切换悬浮星友</span>
                    <button
                      type="button"
                      class="starbot-companion-card-close"
                      onClick={() => setActivePanel(null)}
                      aria-label="关闭"
                    >
                      <X />
                    </button>
                  </div>
                  <div class="starbot-companion-list">
                    <For each={props.bots}>
                      {(item) => {
                        const isCur = () => item.agent.id === bot().agent.id;
                        return (
                          <button
                            type="button"
                            class={`starbot-companion-row${isCur() ? " is-current" : ""}`}
                            onClick={() => {
                              void playKawaiiCue("tab-switch", { subtle: true });
                              props.onSelectBot(item.agent.id);
                              setActivePanel(null);
                            }}
                          >
                            <span class="starbot-companion-row-avatar">
                              <AgentAvatar agent={item.agent} motion="hover" mood={item.mood} />
                            </span>
                            <span class="starbot-companion-row-meta">
                              <strong>{item.agent.name}</strong>
                              <small>{item.modelLabel}</small>
                            </span>
                            <Show when={isCur()}>
                              <span class="starbot-companion-row-check">
                                <Check />
                              </span>
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </div>
              </Show>

              <Show when={activePanel() === "models"}>
                <div class="starbot-companion-card is-models" data-companion-hit="true">
                  <div class="starbot-companion-card-head">
                    <span>切换模型 · {bot().agent.name}</span>
                    <button
                      type="button"
                      class="starbot-companion-card-close"
                      onClick={() => setActivePanel(null)}
                      aria-label="关闭"
                    >
                      <X />
                    </button>
                  </div>
                  {/* Step 1: Filter by provider access mode (Local vs API) */}
                  <div class="starbot-model-source-tabs" role="tablist" aria-label="模型接入方式">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={modelSourceTab() === "local"}
                      class={`starbot-model-source-tab${modelSourceTab() === "local" ? " is-active" : ""}`}
                      onClick={() => {
                        void playKawaiiCue("tab-switch", { subtle: true });
                        setModelSourceTab("local");
                        setSelectedProviderLabel(groupedBySource().local[0]?.key ?? null);
                      }}
                    >
                      <span>本机模型</span>
                      <small>{groupedBySource().local.length}</small>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={modelSourceTab() === "api"}
                      class={`starbot-model-source-tab${modelSourceTab() === "api" ? " is-active" : ""}`}
                      onClick={() => {
                        void playKawaiiCue("tab-switch", { subtle: true });
                        setModelSourceTab("api");
                        setSelectedProviderLabel(groupedBySource().api[0]?.key ?? null);
                      }}
                    >
                      <span>API 模型</span>
                      <small>{groupedBySource().api.length}</small>
                    </button>
                  </div>
                  {/* Step 2: Select specific provider chip within chosen category */}
                  <Show when={visibleProviderGroups().length > 0}>
                    <div class="starbot-provider-chips" role="listbox" aria-label="服务商筛选">
                      <For each={visibleProviderGroups()}>
                        {(group) => {
                          const isSelected = () => activeProviderGroup()?.key === group.key;
                          const hasBotModel = () =>
                            group.items.some((i) => i.provider === bot().provider && i.model === bot().model);
                          return (
                            <button
                              type="button"
                              class={`starbot-provider-chip${isSelected() ? " is-active" : ""}${hasBotModel() ? " has-current" : ""}`}
                              onClick={() => {
                                void playKawaiiCue("tap", { subtle: true });
                                setSelectedProviderLabel(group.key);
                              }}
                            >
                              {group.providerLabel}
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </Show>
                  {/* Step 3: Clean focused model list for selected provider */}
                  <div class="starbot-companion-list">
                    <Show
                      when={activeProviderGroup()}
                      fallback={
                        <div class="starbot-companion-empty">
                          {modelSourceTab() === "api"
                            ? "暂未接入 API 模型，可在「设置 → 模型中心」添加"
                            : "暂未扫描到可用本机模型"}
                        </div>
                      }
                    >
                      {(group) => (
                        <div class="starbot-model-group-items">
                          <For each={group().items}>
                            {(choice) => {
                              const isCur = () => choice.provider === bot().provider && choice.model === bot().model;
                              return (
                                <button
                                  type="button"
                                  class={`starbot-companion-row is-model-row${isCur() ? " is-current" : ""}`}
                                  onClick={() => {
                                    void playKawaiiCue("tab-switch", { subtle: true });
                                    props.onSwitchModel(bot().agent.id, choice.provider, choice.model);
                                    setActivePanel(null);
                                  }}
                                >
                                  <span class="starbot-companion-row-meta">
                                    <strong>{choice.label}</strong>
                                  </span>
                                  <Show when={isCur()}>
                                    <span class="starbot-companion-row-check">
                                      <Check />
                                    </span>
                                  </Show>
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      )}
                    </Show>
                  </div>
                </div>
              </Show>

              <Show when={activePanel() === "usage"}>
                <div class="starbot-companion-card is-usage" data-companion-hit="true">
                  <div class="starbot-companion-card-head">
                    <span>用量看板 · {bot().agent.name}</span>
                    <button
                      type="button"
                      class="starbot-companion-card-close"
                      onClick={() => setActivePanel(null)}
                      aria-label="关闭"
                    >
                      <X />
                    </button>
                  </div>
                  <div class="starbot-usage-section">
                    <div class="starbot-usage-row-top">
                      <span>对话上下文用量</span>
                      <strong>{contextPct()}%</strong>
                    </div>
                    <div class="starbot-usage-bar">
                      <i style={{ width: `${Math.max(3, contextPct())}%` }} />
                    </div>
                    <div class="starbot-usage-sub">
                      <span>
                        {formatCompactTokens(usage().contextUsedTokens)} /{" "}
                        {formatCompactTokens(usage().contextWindowTokens)} tokens
                        {usage().contextEstimated ? " (预估)" : ""}
                      </span>
                      <span>{usage().messageCount} 条消息</span>
                    </div>
                  </div>
                  <div class="starbot-usage-section">
                    <div class="starbot-usage-row-top">
                      <span>模型用量</span>
                      <strong>{bot().modelLabel}</strong>
                    </div>
                    <Show
                      when={usage().quotaPercentUsed !== null}
                      fallback={
                        <div class="starbot-usage-sub">
                          <span>本会话共 {usage().turnCount} 轮回复</span>
                          <span>额度正常</span>
                        </div>
                      }
                    >
                      {(pct) => (
                        <>
                          <div class="starbot-usage-bar is-quota">
                            <i style={{ width: `${Math.max(3, Math.min(100, Math.round(pct())))}%` }} />
                          </div>
                          <div class="starbot-usage-sub">
                            <span>窗口配额已用 {Math.round(pct())}%</span>
                            <span>{usage().turnCount} 轮回复</span>
                          </div>
                        </>
                      )}
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Right-Click Quick Context Menu (Scale & Hide) */}
              <Show when={activePanel() === "context"}>
                <div class="starbot-companion-card is-context" data-companion-hit="true">
                  <div class="starbot-companion-card-head">
                    <span>星友快捷菜单</span>
                    <button
                      type="button"
                      class="starbot-companion-card-close"
                      onClick={() => setActivePanel(null)}
                      aria-label="关闭"
                    >
                      <X />
                    </button>
                  </div>
                  <div class="starbot-context-scale">
                    <div class="starbot-context-scale-head">
                      <span>大小比例</span>
                      <strong>{localSizePercent()}%</strong>
                    </div>
                    <input
                      type="range"
                      class="starbot-context-slider"
                      min={70}
                      max={140}
                      step={5}
                      value={localSizePercent()}
                      aria-label="调整悬浮星友大小比例"
                      onInput={(e) => {
                        applySizePercent(Number(e.currentTarget.value));
                      }}
                    />
                    <div class="starbot-context-presets">
                      {(
                        [
                          { label: "小", pct: 75 },
                          { label: "标准", pct: 100 },
                          { label: "大", pct: 130 },
                        ] as const
                      ).map((preset) => (
                        <button
                          type="button"
                          class={`starbot-context-preset${Math.abs(localSizePercent() - preset.pct) <= 3 ? " is-active" : ""}`}
                          onClick={() => {
                            void playKawaiiCue("tap", { subtle: true });
                            applySizePercent(preset.pct);
                          }}
                        >
                          {preset.label} {preset.pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div class="starbot-context-actions">
                    <button
                      type="button"
                      class="starbot-context-action"
                      onClick={() => {
                        void playKawaiiCue("tab-switch", { subtle: true });
                        setActivePanel(null);
                        props.onStarBotChat(bot().agent.id);
                      }}
                    >
                      打开当前对话
                    </button>
                    <Show when={props.onHide}>
                      <button
                        type="button"
                        class="starbot-context-action is-danger"
                        onClick={() => {
                          setActivePanel(null);
                          setHovered(false);
                          void playKawaiiCue("drawer-close", { subtle: true });
                          props.onHide?.();
                        }}
                      >
                        隐藏悬浮星友
                      </button>
                    </Show>
                  </div>
                </div>
              </Show>

              {/* Live Recording Status Pill right above floating bot */}
              <Show when={isRecording() && activePanel() === null}>
                <button
                  type="button"
                  data-companion-hit="true"
                  class="starbot-companion-rec-pill"
                  onClick={handleToggleVoice}
                  title="点击结束录音并自动发送"
                >
                  <span class="starbot-companion-rec-dot" />
                  <span class="starbot-companion-rec-copy">
                    <strong>
                      {props.voice.phase === "transcribing"
                        ? "正在转文字发送…"
                        : `录音中 ${formatTimer(props.voice.elapsedSeconds)} · 点击发送`}
                    </strong>
                    <Show when={props.voice.liveText}>
                      <small>{props.voice.liveText}</small>
                    </Show>
                  </span>
                </button>
              </Show>

              {/* Top-Centered Thinking Pill (brief 2.6s peek when thinking begins, then pure thinking animation) */}
              <Show
                when={
                  !isRecording() &&
                  activePanel() === null &&
                  isThinking() &&
                  thinkingPillVisible() &&
                  shownReply()?.agentId !== bot().agent.id
                }
              >
                <div
                  role="button"
                  tabIndex={0}
                  class="starbot-companion-thinking-pill"
                  data-companion-hit="true"
                  title="点击查看实时对话进度"
                  onClick={() => {
                    void playKawaiiCue("tab-switch", { subtle: true });
                    props.onStarBotChat(bot().agent.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      props.onStarBotChat(bot().agent.id);
                    }
                  }}
                >
                  <span class="starbot-thinking-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>{bot().agent.name} 正在思考…</span>
                </div>
              </Show>

              {/* Top-Centered Completion & Reply Preview Bubble (Click to jump straight into chat!) */}
              <Show
                when={
                  !isRecording() &&
                  activePanel() === null &&
                  (shownReply()?.agentId === bot().agent.id ? shownReply() : null)
                }
              >
                {(reply) => (
                  <div
                    role="button"
                    tabIndex={0}
                    data-companion-hit="true"
                    class={`starbot-companion-reply-bubble${reply().completedNotice && !reply().streaming ? " is-completed-notice" : ""}`}
                    onMouseEnter={() => {
                      setReplyBubbleHovered(true);
                      clearTimeout(replyAutoDismissTimer);
                    }}
                    onMouseLeave={() => {
                      setReplyBubbleHovered(false);
                      if (!reply().streaming) scheduleReplyAutoDismiss();
                    }}
                    onClick={() => {
                      void playKawaiiCue("tab-switch", { subtle: true });
                      if (reply().replyId) {
                        setDismissedReplyKey(`${reply().agentId}:${reply().replyId}`);
                      }
                      setShownReply(null);
                      props.onStarBotChat(reply().agentId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setShownReply(null);
                        props.onStarBotChat(reply().agentId);
                      }
                    }}
                  >
                    <div class="starbot-companion-reply-head">
                      <span class="starbot-companion-reply-author">
                        <Show
                          when={reply().completedNotice && !reply().streaming}
                          fallback={
                            <>
                              {reply().agentName}
                              <Show when={reply().streaming}>
                                <em> · 输出中…</em>
                              </Show>
                            </>
                          }
                        >
                          <span class="starbot-reply-done-badge" aria-hidden="true">
                            ✦
                          </span>
                          <span>思考已完成，已发送到对话</span>
                        </Show>
                      </span>
                      <button
                        type="button"
                        class="starbot-companion-reply-dismiss"
                        aria-label="收起提示"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (reply().replyId) {
                            setDismissedReplyKey(`${reply().agentId}:${reply().replyId}`);
                          }
                          setWaitingReplyForBotId(null);
                          setShownReply(null);
                        }}
                      >
                        <X />
                      </button>
                    </div>
                    <p class="starbot-companion-reply-body">{reply().text}</p>
                    <div class="starbot-companion-reply-foot">
                      <span>{reply().agentName}</span>
                      <span>点击查看完整对话 ↗</span>
                    </div>
                  </div>
                )}
              </Show>

              {/* Error Toast if voice fails */}
              <Show when={voiceError() && !isRecording()}>
                {(err) => (
                  <div class="starbot-companion-error-pill" data-companion-hit="true">
                    {err()}
                  </div>
                )}
              </Show>

              {/* Single Floating Bot Avatar Character */}
              <div
                data-companion-hit="true"
                class={`starbot-companion-orb${isRecording() ? " is-recording" : ""}${isThinking() ? " is-thinking" : ""}${!isThinking() && celebratePhase() !== null ? " is-completed" : ""}`}
                onPointerDown={handleOrbPointerDown}
                onPointerMove={handleOrbPointerMove}
                onPointerUp={handleOrbPointerUp}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void playKawaiiCue("drawer-open", { subtle: true });
                  setActivePanel((prev) => (prev === "context" ? null : "context"));
                }}
                title={
                  isHalfHiddenResting()
                    ? `${bot().agent.name}（半隐藏贴边 · 靠近展开，右键调大小或隐藏）`
                    : `${bot().agent.name}（按住全屏拖动，右键可调整大小比例或隐藏）`
                }
              >
                <span class="starbot-companion-aura" aria-hidden="true" />
                <span class="starbot-companion-avatar">
                  <AgentAvatar
                    agent={bot().agent}
                    motion="hover"
                    followPointer
                    mood={isThinking() ? "working" : celebratePhase() !== null ? "responded" : bot().mood}
                    cuteEmote={
                      (isRecording()
                        ? "music-groove"
                        : dragDizzy()
                          ? "dizzy-swirl"
                          : isThinking()
                            ? "curious-peek"
                            : celebratePhase() === "burst"
                              ? "combo-hearts"
                              : celebratePhase() === "starry"
                                ? "starry-eyes"
                                : null) satisfies ZodiacCuteEmote | null
                    }
                  />
                </span>
              </div>
            </div>
          </div>
        );
      }}
    </Show>
  );
}
