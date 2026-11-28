import { ATTACHMENT_LIMITS, INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type {
  AppVariant,
  AttachmentDataInput,
  DynamicIslandAction,
  DynamicIslandAgentIdentity,
  DynamicIslandPreference,
  DynamicIslandPresentation,
} from "@openbot/contracts/ipc";
import { DEFAULT_DYNAMIC_ISLAND_PREFERENCE, IDLE_DYNAMIC_ISLAND_PRESENTATION } from "@openbot/contracts/ipc";
import type { DynamicIslandNotchSize, DynamicIslandStateChangeReason, DynamicIslandViewState } from "@openbot/ui";
import { AgentAvatar } from "@openbot/ui/features/agents/AgentAvatar";
import { OpenBotDynamicIsland } from "@openbot/ui/features/dynamic-island/OpenBotDynamicIsland";
import { useText } from "@openbot/ui/text";
import { errorReference, type UserErrorDetails } from "@openbot/user-errors";
import { createEffect, createMemo, createSignal, For, onSettled, Show } from "solid-js";
import { currentDevicePlatform } from "../../send-shortcut-preference";
import { windowShape } from "../../window-shape";
import { dynamicIslandPort } from "./dynamic-island-port";

const DEFAULT_NOTCH_WIDTH = 192;
const DEFAULT_NOTCH_HEIGHT = 32;
const SHAPED_WINDOW = currentDevicePlatform() === "linux";
const SHAPE_PARTS = ".dynamic-island-shell, .dynamic-island-hover-zone";
const SHAPE_TARGET = ".dynamic-island-shell .dynamic-island-size-target";
const MOTION_ROOM = 2;

type ShapeBox = { x: number; y: number; width: number; height: number };

function boxAround(boxes: readonly ShapeBox[]): ShapeBox {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function DynamicIslandSurface() {
  const { t } = useText();
  const query = new URLSearchParams(window.location.search);
  const displayMode = query.get("display") === "island" ? "island" : "notch";
  const variant = readAppVariant(query.get("variant"));
  const queryNotchWidth = query.get("notch-width");
  const initialNotchSize: DynamicIslandNotchSize | undefined =
    queryNotchWidth === null
      ? undefined
      : {
          width: readPositivePixelValue(queryNotchWidth, DEFAULT_NOTCH_WIDTH),
          height: readPositivePixelValue(query.get("notch-height"), DEFAULT_NOTCH_HEIGHT),
        };
  const [notchSize, setNotchSize] = createSignal<DynamicIslandNotchSize | undefined>(initialNotchSize);
  const [presentation, setPresentation] = createSignal(IDLE_DYNAMIC_ISLAND_PRESENTATION);
  const [preference, setPreference] = createSignal<DynamicIslandPreference>({
    ...DEFAULT_DYNAMIC_ISLAND_PREFERENCE,
  });
  const [viewState, setViewState] = createSignal<DynamicIslandViewState>("compact");
  const [actionError, setActionError] = createSignal<UserErrorDetails>();
  const [gravityDragging, setGravityDragging] = createSignal(false);
  const [gravityTargetId, setGravityTargetId] = createSignal<string | null>(null);
  const [gravityToast, setGravityToast] = createSignal<{ agent: DynamicIslandAgentIdentity; label: string } | null>(
    null,
  );
  const [notchPeek, setNotchPeek] = createSignal(false);
  const [panelClosing, setPanelClosing] = createSignal(false);
  let dragDepth = 0;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let peekHideTimer: ReturnType<typeof setTimeout> | undefined;
  let panelCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let actionGeneration = 0;
  let pointerInside = false;
  let focusInside = false;
  let keyboardInside = false;
  let queuedPresentation: DynamicIslandPresentation | undefined;
  let anchor: HTMLFieldSetElement | undefined;
  let sentShape: string | undefined;
  let motionBox: ShapeBox | undefined;
  const followedMotions = new WeakSet<Animation>();
  let shapeStopped = false;
  const shapeObserver = SHAPED_WINDOW ? new MutationObserver(() => followShape()) : undefined;
  // Idle hides automatically, pops out smoothly on notch proximity/activity, and stays mounted until close animation finishes
  const visible = () =>
    presentation().mode !== "idle" ||
    Boolean(presentation().recording) ||
    notchPeek() ||
    viewState() !== "compact" ||
    panelClosing();

  function markPanelClosing(): void {
    clearTimeout(panelCloseTimer);
    setPanelClosing(true);
    panelCloseTimer = setTimeout(() => {
      setPanelClosing(false);
      if (!pointerInside && !focusInside && viewState() === "compact" && !gravityDragging()) {
        if (presentation().mode === "idle" && !presentation().recording) {
          setNotchPeek(false);
        }
      }
      void syncInteractive();
    }, 580);
  }

  function schedulePeekHide(delayMs = 280): void {
    clearTimeout(peekHideTimer);
    peekHideTimer = setTimeout(() => {
      if (!pointerInside && !focusInside && viewState() === "compact" && !panelClosing() && !gravityDragging()) {
        setNotchPeek(false);
      }
    }, delayMs);
  }

  function sendShape(parts: readonly ShapeBox[]): void {
    const shape = windowShape(parts);
    const key = JSON.stringify(shape);
    if (key === sentShape) return;
    sentShape = key;
    void dynamicIslandPort()
      .dynamicIsland.setInputRegion(shape)
      .catch(() => undefined);
  }

  function followShape(): void {
    if (!shapeObserver || shapeStopped) return;
    const parts = visible() && anchor?.isConnected ? [...anchor.querySelectorAll(SHAPE_PARTS)] : [];
    const still: ShapeBox[] = [];
    const moving: ShapeBox[] = [];
    for (const part of parts) {
      const motions = part.getAnimations().filter((motion) => motion.playState === "running");
      (motions.length > 0 ? moving : still).push(part.getBoundingClientRect());
      for (const motion of motions) {
        if (followedMotions.has(motion)) continue;
        followedMotions.add(motion);
        motion.finished.then(followShape, followShape);
      }
    }
    if (moving.length === 0) {
      motionBox = undefined;
      sendShape(still);
      return;
    }
    const target = anchor?.querySelector(SHAPE_TARGET)?.getBoundingClientRect();
    motionBox = boxAround([...(motionBox ? [motionBox] : []), ...moving, ...(target ? [target] : [])]);
    sendShape([
      ...still,
      {
        x: motionBox.x - MOTION_ROOM,
        y: motionBox.y - MOTION_ROOM,
        width: motionBox.width + MOTION_ROOM * 2,
        height: motionBox.height + MOTION_ROOM * 2,
      },
    ]);
  }

  function observeShape(element: HTMLFieldSetElement): void {
    anchor = element;
    if (!shapeObserver) return;
    shapeObserver.disconnect();
    shapeObserver.observe(element, { attributes: true, childList: true, subtree: true });
    queueMicrotask(followShape);
  }
  createEffect(visible, () => queueMicrotask(followShape));

  function applyPresentation(next: DynamicIslandPresentation): void {
    if (
      interactionLocksPresentation(
        presentation(),
        next,
        pointerInside || focusInside || viewState() === "expanded",
        keyboardInside,
      )
    ) {
      queuedPresentation = next;
      return;
    }
    commitPresentation(next);
  }

  function commitPresentation(next: DynamicIslandPresentation): void {
    if (presentationIdentity(next) !== presentationIdentity(presentation())) clearActionError();
    setPresentation(next);
    if (next.mode === "idle" && !next.recording && !notchPeek()) {
      setViewState("compact");
      closeInteraction();
    }
  }

  function applyPreference(next: DynamicIslandPreference): void {
    setPreference(next);
    if (presentation().mode === "idle" && !presentation().recording && !notchPeek()) {
      setViewState("compact");
      closeInteraction();
    }
  }

  function changeViewState(next: DynamicIslandViewState, reason: DynamicIslandStateChangeReason): void {
    if (reason === "hover-exit" && keyboardInside && isTextField(document.activeElement)) return;
    if (reason === "pointer" || reason === "keyboard" || reason === "escape") performHaptic();
    const wasExpanded = viewState() !== "compact";
    setViewState(next);
    if (next !== "compact") {
      clearTimeout(panelCloseTimer);
      clearTimeout(peekHideTimer);
      setPanelClosing(false);
    } else if (wasExpanded) {
      markPanelClosing();
    }
    if (next === "compact" && keyboardInside) {
      keyboardInside = false;
    }
    if (next === "compact") clearActionError();
    if (next === "compact" && !pointerInside && !focusInside) applyQueuedPresentation();
    void syncInteractive();
  }

  function applyQueuedPresentation(): void {
    const next = queuedPresentation;
    queuedPresentation = undefined;
    if (next) commitPresentation(next);
  }

  function syncInteractive(): Promise<void> {
    const expanded = viewState() !== "compact";
    const interactive =
      pointerInside || focusInside || expanded || panelClosing() || gravityDragging() || Boolean(gravityToast());
    const wantsKeyboard = interactive && (keyboardInside || expanded);
    return dynamicIslandPort().dynamicIsland.setInteractive({ interactive, keyboard: wantsKeyboard });
  }

  const dropTargets = createMemo<DynamicIslandAgentIdentity[]>(() => {
    const list = presentation().agents ?? [];
    if (list.length > 0) return list.slice(0, 5);
    const active = presentation().activeAgent;
    return active ? [active] : [];
  });

  function handleSurfaceDragEnter(event: DragEvent): void {
    if (dropTargets().length === 0) return;
    event.preventDefault();
    dragDepth += 1;
    if (!gravityDragging()) {
      performHaptic();
      setGravityDragging(true);
      setGravityTargetId(presentation().activeAgent?.id ?? dropTargets()[0]?.id ?? null);
      void syncInteractive();
    }
  }

  function handleSurfaceDragOver(event: DragEvent): void {
    if (dropTargets().length === 0) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    if (!gravityDragging()) {
      setGravityDragging(true);
      setGravityTargetId(presentation().activeAgent?.id ?? dropTargets()[0]?.id ?? null);
      void syncInteractive();
    }
  }

  function handleSurfaceDragLeave(event: DragEvent): void {
    if (!gravityDragging()) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0 || event.relatedTarget === null) {
      dragDepth = 0;
      setGravityDragging(false);
      void syncInteractive();
    }
  }

  async function handleSurfaceDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dragDepth = 0;
    const targets = dropTargets();
    const chosen =
      targets.find((item) => item.id === gravityTargetId()) ?? presentation().activeAgent ?? targets[0] ?? null;
    setGravityDragging(false);
    if (!chosen) {
      void syncInteractive();
      return;
    }
    const dt = event.dataTransfer;
    const files = Array.from(dt?.files ?? []).slice(0, INPUT_LIMITS.attachments);
    const plainText = (dt?.getData("text/plain") || "").trim();
    if (files.length === 0 && !plainText) {
      void syncInteractive();
      return;
    }
    performHaptic();
    const serverId = presentation().serverId;
    try {
      let attachmentDraftIds: string[] = [];
      if (files.length > 0) {
        const validFiles = files.filter((f) => f.size <= ATTACHMENT_LIMITS.fileBytes);
        const data: AttachmentDataInput[] = await Promise.all(
          validFiles.map(async (file) => ({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            bytes: new Uint8Array(await file.arrayBuffer()),
          })),
        );
        if (data.length > 0) {
          const staged = await dynamicIslandPort().agent.importAttachmentData(data, serverId);
          attachmentDraftIds = staged.map((item) => item.id);
        }
      }
      const promptText =
        plainText ||
        (files.length === 1 ? `请帮我阅读并分析这份文件：${files[0]?.name ?? ""}` : "请帮我分析这些文件内容");
      await dynamicIslandPort().dynamicIsland.performAction({
        type: "drop-feed",
        serverId,
        agentId: chosen.id,
        text: promptText.slice(0, INPUT_LIMITS.directMessageText),
        attachmentDraftIds,
        clientMessageId: crypto.randomUUID(),
      });
      const label =
        files.length > 0
          ? files.length === 1
            ? `已收下 ${files[0]?.name ?? "文件"}，开始精读`
            : `已收下 ${files.length} 个文件，开始分析`
          : "已收下投喂文本，开始思考";
      clearTimeout(toastTimer);
      setGravityToast({ agent: chosen, label });
      toastTimer = setTimeout(() => setGravityToast(null), 2_400);
    } catch {
      clearTimeout(toastTimer);
      setGravityToast({ agent: chosen, label: "投喂失败，请重试" });
      toastTimer = setTimeout(() => setGravityToast(null), 2_000);
    } finally {
      void syncInteractive();
    }
  }

  function beginPointerInteraction(): void {
    clearTimeout(peekHideTimer);
    pointerInside = true;
    void syncInteractive();
  }

  function endPointerInteraction(): void {
    pointerInside = false;
    if (viewState() === "compact" && !focusInside) applyQueuedPresentation();
    if (notchPeek() && presentation().mode === "idle" && !presentation().recording) {
      schedulePeekHide(260);
    }
    void syncInteractive();
  }

  function beginFocusInteraction(): void {
    focusInside = true;
    void syncInteractive();
  }

  function endFocusInteraction(): void {
    focusInside = false;
    if (viewState() === "compact" && !pointerInside) applyQueuedPresentation();
    void syncInteractive();
  }

  function closeInteraction(): void {
    pointerInside = false;
    focusInside = false;
    keyboardInside = false;
    if (viewState() === "compact") applyQueuedPresentation();
    void syncInteractive();
  }

  function enterInteraction(event: MouseEvent & { currentTarget: HTMLFieldSetElement }): void {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    if (!pointerInside) performHaptic();
    beginPointerInteraction();
  }

  function leaveInteraction(event: MouseEvent & { currentTarget: HTMLFieldSetElement }): void {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    endPointerInteraction();
  }

  function leaveFocusInteraction(event: FocusEvent & { currentTarget: HTMLFieldSetElement }): void {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    keyboardInside = false;
    endFocusInteraction();
  }

  async function requestKeyboard(event: PointerEvent): Promise<void> {
    const field = event.target;
    if (!isTextField(field)) return;
    if (!keyboardInside) {
      keyboardInside = true;
      await syncInteractive();
    }
    if (keyboardInside && document.activeElement !== field) field.focus();
  }

  function clearActionError(): number {
    setActionError(undefined);
    return ++actionGeneration;
  }

  async function perform(action: DynamicIslandAction): Promise<boolean> {
    performHaptic();
    const generation = clearActionError();
    try {
      await dynamicIslandPort().dynamicIsland.performAction(action);
    } catch (error) {
      if (generation === actionGeneration)
        setActionError({ message: t("island.action.failed"), reference: errorReference(error) });
      return false;
    }
    pointerInside = false;
    focusInside = false;
    keyboardInside = false;
    if (viewState() !== "compact") {
      setViewState("compact");
      markPanelClosing();
    }
    applyQueuedPresentation();
    await syncInteractive();
    return true;
  }

  function performHaptic(): void {
    void dynamicIslandPort()
      .dynamicIsland.performHaptic()
      .catch(() => undefined);
  }

  onSettled(() => {
    void dynamicIslandPort()
      .dynamicIsland.getPresentation()
      .then(applyPresentation)
      .catch(() => undefined);
    void dynamicIslandPort()
      .dynamicIsland.getPreference()
      .then(applyPreference)
      .catch(() => undefined);
    const stopPreference = dynamicIslandPort().dynamicIsland.onPreference(applyPreference);
    const stopPresentation = dynamicIslandPort().dynamicIsland.onPresentation(applyPresentation);
    const stopGeometry = dynamicIslandPort().dynamicIsland.onGeometry((next) => setNotchSize(next ?? undefined));
    const close = () => {
      clearTimeout(peekHideTimer);
      pointerInside = false;
      focusInside = false;
      keyboardInside = false;
      if (viewState() !== "compact") {
        setViewState("compact");
        markPanelClosing();
      } else {
        setNotchPeek(false);
      }
      clearActionError();
      applyQueuedPresentation();
      void syncInteractive();
    };
    const onPointerDownOutside = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".dynamic-island-shell, .starbot-gravity-drop-tray, .starbot-gravity-confirm-pill")) {
        return;
      }
      if (viewState() !== "compact" || notchPeek()) {
        if (viewState() !== "compact") performHaptic();
        close();
      }
    };
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (viewState() !== "compact" || notchPeek())) {
        event.preventDefault();
        performHaptic();
        close();
      }
    };
    const onCursorLeftWindow = () => {
      pointerInside = false;
      if (viewState() === "compact" && !focusInside) {
        applyQueuedPresentation();
        if (notchPeek() && presentation().mode === "idle" && !presentation().recording) {
          schedulePeekHide(160);
        }
      }
      void syncInteractive();
    };
    const onNotchPeek = (event: Event) => {
      const peeking = event instanceof CustomEvent && event.detail === true;
      if (peeking) {
        clearTimeout(peekHideTimer);
        if (!notchPeek() && presentation().mode === "idle" && !presentation().recording) {
          performHaptic();
        }
        setNotchPeek(true);
      } else {
        schedulePeekHide(260);
      }
    };
    window.addEventListener("pointerdown", onPointerDownOutside, true);
    window.addEventListener("keydown", onGlobalKeyDown, true);
    window.addEventListener("starbot-cursor-left-window", onCursorLeftWindow);
    window.addEventListener("starbot-notch-peek", onNotchPeek);
    window.addEventListener("blur", close);
    window.addEventListener("resize", followShape);
    return () => {
      stopPreference();
      stopPresentation();
      stopGeometry();
      clearTimeout(toastTimer);
      clearTimeout(peekHideTimer);
      clearTimeout(panelCloseTimer);
      window.removeEventListener("pointerdown", onPointerDownOutside, true);
      window.removeEventListener("keydown", onGlobalKeyDown, true);
      window.removeEventListener("starbot-cursor-left-window", onCursorLeftWindow);
      window.removeEventListener("starbot-notch-peek", onNotchPeek);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", followShape);
      shapeStopped = true;
      shapeObserver?.disconnect();
    };
  });
  return (
    <main
      class="dynamic-island-surface"
      aria-label={notchSize() ? t("island.surface.label") : t("island.surface.labelIsland")}
      onDragEnter={handleSurfaceDragEnter}
      onDragOver={handleSurfaceDragOver}
      onDragLeave={handleSurfaceDragLeave}
      onDrop={(e) => void handleSurfaceDrop(e)}
    >
      <Show when={visible() || gravityDragging() || gravityToast()}>
        <fieldset
          ref={observeShape}
          class="dynamic-island-surface-anchor"
          aria-label={t("island.surface.interactionArea")}
          onMouseOver={enterInteraction}
          onMouseOut={leaveInteraction}
          onFocus={beginFocusInteraction}
          onFocusIn={beginFocusInteraction}
          onBlur={leaveFocusInteraction}
          onFocusOut={leaveFocusInteraction}
          onPointerDown={(event) => void requestKeyboard(event)}
        >
          <Show
            when={gravityDragging()}
            fallback={
              <Show
                when={gravityToast()}
                fallback={
                  <OpenBotDynamicIsland
                    presentation={presentation()}
                    state={viewState()}
                    displayMode={displayMode}
                    variant={variant}
                    notchSize={displayMode === "notch" ? notchSize() : undefined}
                    widthPercent={preference().widthPercent}
                    heightPercent={preference().heightPercent}
                    extendedHoverArea
                    idleInsideNotch={false}
                    inlineReply
                    onStateChange={changeViewState}
                    onAction={perform}
                    actionError={actionError()}
                    onHaptic={performHaptic}
                  />
                }
              >
                {(toastData) => (
                  <div class="starbot-gravity-confirm-pill">
                    <span class="starbot-gravity-confirm-avatar">
                      <AgentAvatar agent={toastData().agent} motion="hover" mood="working" />
                    </span>
                    <span class="starbot-gravity-confirm-text">{toastData().label}</span>
                    <span class="starbot-gravity-confirm-sparkle" aria-hidden="true">
                      ✦
                    </span>
                  </div>
                )}
              </Show>
            }
          >
            <div class="starbot-gravity-drop-tray">
              <div class="starbot-gravity-ripples" aria-hidden="true">
                <i />
                <i />
              </div>
              <div class="starbot-gravity-header">松手投喂给星座星友</div>
              <div class="starbot-gravity-bots">
                <For each={dropTargets()}>
                  {(bot) => {
                    const isHot = () => gravityTargetId() === bot.id;
                    return (
                      <div
                        class={`starbot-gravity-bot${isHot() ? " is-hot" : ""}`}
                        onDragEnter={() => {
                          if (gravityTargetId() !== bot.id) {
                            performHaptic();
                            setGravityTargetId(bot.id);
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (gravityTargetId() !== bot.id) setGravityTargetId(bot.id);
                        }}
                      >
                        <span class="starbot-gravity-bot-ring">
                          <AgentAvatar agent={bot} motion="hover" mood={isHot() ? "working" : "idle"} />
                        </span>
                        <span class="starbot-gravity-bot-name">{bot.name}</span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </Show>
        </fieldset>
      </Show>
    </main>
  );
}

function isTextField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function readAppVariant(value: string | null): AppVariant {
  return value === "dev" || value === "preview" ? value : "production";
}

function readPositivePixelValue(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function interactionLocksPresentation(
  current: DynamicIslandPresentation,
  next: DynamicIslandPresentation,
  interacting: boolean,
  typing: boolean,
): boolean {
  if (!interacting || !(typing || isCriticalPresentation(current))) return false;
  return presentationIdentity(current) !== presentationIdentity(next);
}

function isCriticalPresentation(presentation: DynamicIslandPresentation): boolean {
  return (
    presentation.mode === "approval" ||
    presentation.mode === "question" ||
    presentation.mode === "takeover" ||
    presentation.mode === "failed"
  );
}

function presentationIdentity(presentation: DynamicIslandPresentation): string {
  if (presentation.mode === "approval" || presentation.mode === "question" || presentation.mode === "takeover") {
    return `${presentation.serverId}:${presentation.mode}:${String(presentation.item.requestId)}`;
  }
  if (presentation.mode === "failed") {
    return `${presentation.serverId}:${presentation.mode}:${presentation.item.turnId}`;
  }
  if (presentation.mode === "message") {
    return `${presentation.serverId}:${presentation.mode}:${presentation.message.messageId}`;
  }
  return `${presentation.serverId}:${presentation.mode}`;
}
