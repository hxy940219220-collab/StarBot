import { isDeepStrictEqual } from "node:util";
import type {
  AgentDockAction,
  AgentDockDisplayInfo,
  AgentDockDragPhase,
  AgentDockExtent,
  AgentDockInputRect,
  AgentDockOffset,
  AgentDockPresentation,
  AgentDockSnapEdge,
  SetAgentDockInteractiveInput,
} from "@openbot/contracts/ipc";
import {
  AGENT_DOCK_LIMITS,
  AGENT_DOCK_SIZE_LIMITS,
  IPC_ENDPOINTS,
  sameAgentDockDisplayBounds,
} from "@openbot/contracts/ipc";
import { sourceText } from "@openbot/i18n/source";
import { createOpenBotLogger, type Logger, toLogValue } from "@openbot/logging";
import { Deferred, Effect, Schema, Semaphore } from "effect";
import type { BrowserWindow, Display, Rectangle, Screen } from "electron";
import { causeHelpers } from "../backend/effect-boundary";
import { forceActivateX11Window } from "./linux-x11-activation";
import { letPointerThrough, type PointerForwardingGate } from "./pointer-forwarding-gate";
import { sendToRenderer } from "./renderer-ipc";
import type { WindowsTopmostKeeper } from "./windows-topmost-keeper";

const logger = createOpenBotLogger("agent-dock-window");

const AGENT_DOCK_WINDOW_SIZE = { width: 860, height: 560 } as const;
const DEFAULT_COMPANION_X_OFFSET = 0.91;
const DEFAULT_COMPANION_Y_OFFSET = 0.74;

interface CompanionStoredPosition {
  xOffset: number;
  offset: number;
  dockedEdge: AgentDockSnapEdge | null;
}

interface CompanionPlacement {
  bounds: Rectangle;
  centerX: number;
  centerY: number;
  anchorX: number;
  anchorY: number;
  dockedEdge: AgentDockSnapEdge | null;
}

const DOCK_REOPEN_MAX = 3;
const DOCK_REOPEN_WINDOW_MS = 60_000;

export type AgentDockSendAction = Extract<AgentDockAction, { type: "send" }>;

export class AgentDockFailed extends Schema.TaggedError<AgentDockFailed>()("AgentDockFailed", {
  cause: Schema.Defect(),
}) {}

export const { rewrap: toAgentDockFailed } = causeHelpers(AgentDockFailed);

type AgentDockWindowKind = "panel" | "tool" | "x11";

export interface AgentDockWindowControllerOptions {
  windowKind: AgentDockWindowKind | null;
  createWindow: (bounds: Rectangle) => BrowserWindow;
  loadWindow: (window: BrowserWindow) => Promise<void>;
  screen: Pick<Screen, "getAllDisplays" | "getPrimaryDisplay" | "getDisplayMatching" | "getCursorScreenPoint">;
  getMainWindow: () => BrowserWindow | null;
  ensureMainWindow?: () => Promise<BrowserWindow>;
  presentMainWindow: (window: BrowserWindow) => void;
  sendMessage: (action: AgentDockSendAction) => Effect.Effect<void, AgentDockFailed>;
  pointerForwarding?: PointerForwardingGate | null;
  topmost?: WindowsTopmostKeeper | null;
  registerShortcut?: (shortcut: string, onTrigger: () => void) => boolean;
  unregisterShortcut?: (shortcut: string) => void;
  logger?: Logger;
}

interface DockWindow {
  window: BrowserWindow;
  rendererId: number;
  displayId: number;
  shape?: AgentDockInputRect[];
  extent?: AgentDockExtent | null;
  reportedExtent?: AgentDockExtent | null;
  interactive?: boolean;
  keyboard?: boolean;
}

export class AgentDockWindowController {
  readonly #options: AgentDockWindowControllerOptions;
  #presentation: AgentDockPresentation | null = null;
  #windows: DockWindow[] = [];
  #chatOwner: number | null = null;
  readonly #sends = new Map<string, Deferred.Deferred<void, AgentDockFailed>>();
  readonly #reconciliation = Semaphore.makeUnsafe(1);
  #offsets = new Map<number, CompanionStoredPosition>();
  #drag: { rendererId: number; pointerX: number; pointerY: number; centerX: number; centerY: number } | null = null;
  readonly #followedWindows = new WeakSet<BrowserWindow>();
  #reopens: number[] = [];
  #registeredShortcut: string | null = null;
  #destroyed = false;

  constructor(options: AgentDockWindowControllerOptions) {
    this.#options = options;
  }

  get presentation(): AgentDockPresentation | null {
    return this.#presentation;
  }

  get mainRendererIds(): ReadonlySet<number> {
    const window = this.#options.getMainWindow();
    return new Set(window && !window.isDestroyed() ? [window.webContents.id] : []);
  }

  get dockRendererIds(): ReadonlySet<number> {
    return new Set(this.#liveWindows().map(({ rendererId }) => rendererId));
  }

  #liveWindows(): DockWindow[] {
    return this.#windows.filter(({ window }) => !window.isDestroyed());
  }

  publish(presentation: AgentDockPresentation | null): Effect.Effect<void> {
    return Effect.suspend(() => {
      this.#followMainWindow();
      if (isDeepStrictEqual(this.#presentation, presentation)) return Effect.void;
      const previous = this.#presentation;
      this.#presentation = presentation;
      for (const { window } of this.#liveWindows()) {
        sendToRenderer(window, IPC_ENDPOINTS.agentDock.presentation, presentation);
      }
      const dragged = this.#draggedDisplayId();
      const dragOffset = dragged === null ? undefined : this.#offsets.get(dragged);
      this.#offsets = new Map(
        (presentation?.offsets ?? []).map(({ displayId, offset, xOffset, dockedEdge }) => [
          displayId,
          {
            xOffset: xOffset ?? DEFAULT_COMPANION_X_OFFSET,
            offset,
            dockedEdge: dockedEdge ?? null,
          },
        ]),
      );
      if (dragged !== null && dragOffset !== undefined) this.#offsets.set(dragged, dragOffset);
      const moved =
        (previous === null) !== (presentation === null) ||
        !isDeepStrictEqual(previous?.display, presentation?.display) ||
        previous?.edge !== presentation?.edge ||
        previous?.sizePercent !== presentation?.sizePercent ||
        !isDeepStrictEqual(previous?.offsets, presentation?.offsets);
      return moved ? this.reconcileWindow() : Effect.void;
    });
  }

  listDisplays(): AgentDockDisplayInfo[] {
    const primary = this.#options.screen.getPrimaryDisplay();
    return this.#options.screen
      .getAllDisplays()
      .slice(0, AGENT_DOCK_LIMITS.displays)
      .map((display) => ({
        id: display.id,
        label: display.label.slice(0, AGENT_DOCK_LIMITS.displayLabel),
        primary: display.id === primary.id,
        internal: display.internal,
      }));
  }

  #targetDisplays(): Display[] {
    const { screen } = this.#options;
    const choice = this.#presentation?.display;
    if (choice?.kind === "all") return screen.getAllDisplays().slice(0, AGENT_DOCK_LIMITS.displays);
    if (choice?.kind === "primary") return [screen.getPrimaryDisplay()];
    if (choice?.kind === "display") {
      const chosen = screen.getAllDisplays().find((display) => display.id === choice.id);
      if (chosen) return [chosen];
    }
    const main = this.#options.getMainWindow();
    return [main && !main.isDestroyed() ? screen.getDisplayMatching(main.getBounds()) : screen.getPrimaryDisplay()];
  }

  #followMainWindow(): void {
    const main = this.#options.getMainWindow();
    if (!main || main.isDestroyed() || this.#followedWindows.has(main)) return;
    this.#followedWindows.add(main);
    const follow = () => {
      if (this.#windows.length === 0 || this.#presentation?.display.kind !== "window") return;
      void Effect.runPromise(this.reconcileWindow());
    };
    main.on("moved", follow);
    main.on("resized", follow);
    main.on("enter-full-screen", follow);
    main.on("leave-full-screen", follow);
    main.webContents.on("did-finish-load", () => {
      const owner = this.#liveWindows().find((entry) => entry.rendererId === this.#chatOwner);
      this.#chatOwner = null;
      if (owner) sendToRenderer(owner.window, IPC_ENDPOINTS.agentDock.closeChat);
    });
  }

  setInteractive(rendererId: number, input: SetAgentDockInteractiveInput): void {
    const entry = this.#liveWindows().find((item) => item.rendererId === rendererId);
    if (!entry) return;
    const { window } = entry;
    entry.interactive = input.interactive;
    if (this.#options.windowKind !== "x11") this.#letPointerThrough(entry);
    const keyboard = input.keyboard === true;
    window.setFocusable(keyboard);
    if (keyboard && !entry.keyboard && !window.isFocused()) {
      window.focus();
      if (this.#options.windowKind === "x11") forceActivateX11Window(window);
    }
    entry.keyboard = keyboard;
  }

  setInputRegion(rendererId: number, rects: AgentDockInputRect[]): void {
    const entry = this.#liveWindows().find((item) => item.rendererId === rendererId);
    if (!entry) return;
    entry.shape = rects;
    this.#applyShape(entry);
  }

  setExtent(rendererId: number, extent: AgentDockExtent | null): void {
    if (this.#options.windowKind !== "panel") return;
    const entry = this.#liveWindows().find((item) => item.rendererId === rendererId);
    if (!entry) return;
    entry.reportedExtent = extent;
    if (extent === null && this.#drag?.rendererId === rendererId) return;
    this.#fit(entry, extent);
  }

  #fit(entry: DockWindow, extent: AgentDockExtent | null): void {
    entry.extent = extent;
    const display = this.#displayOf(entry);
    if (!display) return;
    const placement = this.#placementFor(display);
    if (!isDeepStrictEqual(entry.window.getBounds(), placement.bounds)) {
      entry.window.setBounds(placement.bounds, false);
    }
    this.#sendPlacementToWindow(entry, display, placement);
  }

  #applyShape(entry: DockWindow): void {
    if (!entry.shape) return;
    const rects = entry.shape.map((rect) => zoomedRect(rect, this.#zoom()));
    if (this.#options.windowKind === "x11") entry.window.setShape(rects);
    if (this.#options.windowKind !== "tool") return;
    if (rects.length > 0) entry.window.setShape(rects);
    this.#letPointerThrough(entry);
    if (rects.length === 0) entry.window.setShape([]);
  }

  #letPointerThrough(entry: DockWindow): void {
    const fixedRegion = this.#options.windowKind === "tool" && (entry.shape?.length ?? 0) > 0;
    letPointerThrough(this.#options.pointerForwarding, entry.window, !fixedRegion && entry.interactive !== true);
  }

  drag(rendererId: number, phase: AgentDockDragPhase): void {
    const entry = this.#liveWindows().find((item) => item.rendererId === rendererId);
    if (!entry) return;
    const cursor = this.#options.screen.getCursorScreenPoint();
    if (phase === "start") {
      const start = this.#displayOf(entry);
      if (start) {
        const current = this.#placementFor(start);
        this.#drag = {
          rendererId,
          pointerX: cursor.x,
          pointerY: cursor.y,
          centerX: current.centerX,
          centerY: current.centerY,
        };
      } else {
        const rect = entry.window.getBounds();
        this.#drag = {
          rendererId,
          pointerX: cursor.x,
          pointerY: cursor.y,
          centerX: rect.x + rect.width / 2,
          centerY: rect.y + rect.height / 2,
        };
      }
      return;
    }
    const drag = this.#drag;
    if (drag?.rendererId !== rendererId) return;
    const display = this.#displayOf(entry);
    if (display) {
      const area = companionScreenArea(display);
      const radius = companionBotRadius(this.#presentation?.sizePercent);
      const minX = area.x + radius;
      const maxX = Math.max(minX, area.x + area.width - radius);
      const minY = area.y + radius;
      const maxY = Math.max(minY, area.y + area.height - radius);
      const rawCx = drag.centerX + cursor.x - drag.pointerX;
      const rawCy = drag.centerY + cursor.y - drag.pointerY;

      const snapThreshold = Math.max(16, Math.round(radius * 0.55));
      const edgeCandidates: Array<{ edge: AgentDockSnapEdge; dist: number }> = [
        { edge: "left", dist: rawCx - area.x },
        { edge: "right", dist: area.x + area.width - rawCx },
        { edge: "top", dist: rawCy - area.y },
        { edge: "bottom", dist: area.y + area.height - rawCy },
      ];
      edgeCandidates.sort((a, b) => a.dist - b.dist);
      const nearest = edgeCandidates[0];
      const dockedEdge: AgentDockSnapEdge | null = nearest && nearest.dist <= snapThreshold ? nearest.edge : null;

      const nextCx = Math.min(maxX, Math.max(minX, rawCx));
      const nextCy = Math.min(maxY, Math.max(minY, rawCy));
      const xOffset = maxX > minX ? (nextCx - minX) / (maxX - minX) : DEFAULT_COMPANION_X_OFFSET;
      const offset = maxY > minY ? (nextCy - minY) / (maxY - minY) : DEFAULT_COMPANION_Y_OFFSET;
      this.#offsets.set(entry.displayId, { xOffset, offset, dockedEdge });

      const placement = this.#placementFor(display);
      if (!isDeepStrictEqual(entry.window.getBounds(), placement.bounds)) {
        entry.window.setBounds(placement.bounds, false);
      }
      this.#sendPlacementToWindow(entry, display, placement);
    }
    if (phase !== "end") return;
    this.#drag = null;
    const pos = this.#offsets.get(entry.displayId);
    const main = this.#options.getMainWindow();
    if (pos !== undefined && main && !main.isDestroyed()) {
      sendToRenderer(main, IPC_ENDPOINTS.agentDock.moved, {
        displayId: entry.displayId,
        offset: pos.offset,
        xOffset: pos.xOffset,
        dockedEdge: pos.dockedEdge,
        ...(display && { bounds: display.bounds }),
      });
    }
  }

  #sendPlacementToWindow(entry: DockWindow, display: Display, placement: CompanionPlacement): void {
    if (entry.window.isDestroyed()) return;
    const pos = this.#positionFor(display);
    const payload: AgentDockOffset = {
      displayId: display.id,
      offset: pos.offset,
      xOffset: pos.xOffset,
      dockedEdge: placement.dockedEdge,
      anchorX: placement.anchorX,
      anchorY: placement.anchorY,
      windowWidth: placement.bounds.width,
      windowHeight: placement.bounds.height,
      bounds: display.bounds,
    };
    sendToRenderer(entry.window, IPC_ENDPOINTS.agentDock.moved, payload);
  }

  #draggedDisplayId(): number | null {
    const drag = this.#drag;
    if (!drag) return null;
    return this.#liveWindows().find((item) => item.rendererId === drag.rendererId)?.displayId ?? null;
  }

  #displayOf(entry: DockWindow): Display | undefined {
    return this.#options.screen.getAllDisplays().find((display) => display.id === entry.displayId);
  }

  #placementFor(display: Display): CompanionPlacement {
    const pos = this.#positionFor(display);
    return companionWindowPlacement(display, pos, this.#presentation?.sizePercent, this.#zoom());
  }

  #boundsFor(display: Display): Rectangle {
    return this.#placementFor(display).bounds;
  }

  #placedBounds(_entry: DockWindow, display: Display): Rectangle {
    return this.#boundsFor(display);
  }

  #positionFor(display: Display): CompanionStoredPosition {
    const saved = this.#offsets.get(display.id);
    if (saved !== undefined) return saved;
    const connected = new Set(this.#options.screen.getAllDisplays().map(({ id }) => id));
    const renamed = (this.#presentation?.offsets ?? []).findLast(
      (item) => !connected.has(item.displayId) && sameAgentDockDisplayBounds(item.bounds, display.bounds),
    );
    return {
      xOffset: renamed?.xOffset ?? DEFAULT_COMPANION_X_OFFSET,
      offset: renamed?.offset ?? DEFAULT_COMPANION_Y_OFFSET,
      dockedEdge: renamed?.dockedEdge ?? null,
    };
  }

  #zoom(): number {
    // Keep helper window at 100% zoom so orbital action buttons, icons, and cards stay crisp fixed-size;
    // sizePercent scales ONLY the floating StarBot character inside StarBotFloatingCompanion.
    return 1;
  }

  #applyZoom(entry: DockWindow): void {
    if (entry.window.webContents.getZoomFactor() === 1) return;
    entry.window.webContents.setZoomFactor(1);
    this.#applyShape(entry);
  }

  performAction(rendererId: number, action: AgentDockAction): Effect.Effect<void, AgentDockFailed> {
    return Effect.suspend(() => {
      if (action.type === "send") return this.#send(action);
      if (action.type === "open-chat") {
        if (action.seat === null && this.#chatOwner !== rendererId) return Effect.void;
        const previous = this.#liveWindows().find((entry) => entry.rendererId === this.#chatOwner);
        if (previous && previous.rendererId !== rendererId) {
          sendToRenderer(previous.window, IPC_ENDPOINTS.agentDock.closeChat);
        }
        this.#chatOwner = action.seat === null ? null : rendererId;
      }
      return Effect.gen({ self: this }, function* () {
        const window = yield* this.#ensureMainWindow();
        if (
          action.type === "open-agent" ||
          action.type === "open-browser-takeover" ||
          action.type === "open-channel" ||
          action.type === "open-settings"
        ) {
          this.#options.presentMainWindow(window);
        }
        // Note: select-companion, switch-model, and voice-sync forward quietly to main renderer without stealing focus!
        if (!sendToRenderer(window, IPC_ENDPOINTS.agentDock.action, action)) {
          return yield* new AgentDockFailed({
            cause: new Error(sourceText("error.backend.windowTemporarilyUnavailable")),
          });
        }
      });
    });
  }

  #send(action: AgentDockSendAction): Effect.Effect<void, AgentDockFailed> {
    const key = [action.serverId, action.seat.kind, action.seat.id, action.clientMessageId].join("\u0000");
    const existing = this.#sends.get(key);
    if (existing) return Deferred.await(existing);
    const done = Deferred.makeUnsafe<void, AgentDockFailed>();
    this.#sends.set(key, done);
    return this.#options.sendMessage(action).pipe(
      Effect.onExit((exit) => {
        if (this.#sends.get(key) === done) this.#sends.delete(key);
        return Deferred.done(done, exit);
      }),
    );
  }

  #ensureMainWindow(): Effect.Effect<BrowserWindow, AgentDockFailed> {
    return Effect.gen({ self: this }, function* () {
      const current = this.#options.getMainWindow();
      if (current && !current.isDestroyed()) return current;
      const ensureMainWindow = this.#options.ensureMainWindow;
      const created = ensureMainWindow
        ? yield* Effect.tryPromise({
            try: () => ensureMainWindow(),
            catch: (cause) => new AgentDockFailed({ cause }),
          })
        : undefined;
      if (!created || created.isDestroyed()) {
        return yield* new AgentDockFailed({ cause: new Error(sourceText("error.backend.windowUnavailable")) });
      }
      return created;
    });
  }

  reconcileWindow(): Effect.Effect<void> {
    return this.#reconciliation
      .withPermit(
        Effect.suspend(() => {
          if (this.#destroyed || this.#options.windowKind === null) {
            this.#destroyWindow();
            return Effect.void;
          }
          this.#windows = this.#liveWindows();
          if (this.#presentation === null) {
            for (const { window } of this.#windows) window.hide();
            return Effect.void;
          }
          const targets = this.#targetDisplays();
          const targetIds = new Set(targets.map((display) => display.id));
          const spare = this.#windows.filter((entry) => !targetIds.has(entry.displayId));
          const opens: Display[] = [];
          for (const display of targets) {
            const current = this.#windows.find((entry) => entry.displayId === display.id) ?? spare.shift();
            if (!current) {
              opens.push(display);
              continue;
            }
            current.displayId = display.id;
            this.#applyZoom(current);
            const placement = this.#placementFor(display);
            if (!isDeepStrictEqual(current.window.getBounds(), placement.bounds)) {
              current.window.setBounds(placement.bounds, false);
            }
            this.#sendPlacementToWindow(current, display, placement);
            if (!current.window.isVisible()) this.#show(current.window);
          }
          for (const entry of spare) this.#closeWindow(entry.window);
          return Effect.forEach(opens, (display) =>
            this.#openWindow(display).pipe(
              Effect.catch((error) =>
                Effect.sync(() =>
                  (this.#options.logger ?? logger).error("Unable to load the agent dock:", toLogValue(error.cause)),
                ),
              ),
            ),
          );
        }),
      )
      .pipe(Effect.asVoid);
  }

  #openWindow(display: Display): Effect.Effect<void, AgentDockFailed> {
    return Effect.try({
      try: () => {
        const window = this.#options.createWindow(this.#boundsFor(display));
        const entry: DockWindow = { window, rendererId: window.webContents.id, displayId: display.id };
        this.#windows.push(entry);
        const owned = () => this.#windows.includes(entry) && !window.isDestroyed();
        window.setHasShadow(false);
        window.setAlwaysOnTop(true, this.#options.windowKind === "panel" ? "floating" : "normal");
        this.#options.topmost?.keep(window);
        if (this.#options.windowKind === "panel") {
          window.excludedFromShownWindowsMenu = true;
          window.setWindowButtonVisibility(false);
          window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
          window.setHiddenInMissionControl(true);
        }
        if (this.#options.windowKind === "x11") {
          window.setShape([]);
        } else {
          letPointerThrough(this.#options.pointerForwarding, window, true);
        }
        window.setFocusable(false);
        window.webContents.on("did-navigate", () => {
          if (owned()) this.#applyZoom(entry);
        });
        window.webContents.on("did-finish-load", () => {
          if (!owned()) return;
          this.#release(entry);
          entry.reportedExtent = null;
          this.#fit(entry, null);
          sendToRenderer(window, IPC_ENDPOINTS.agentDock.presentation, this.#presentation);
        });
        window.webContents.on("render-process-gone", () => {
          if (!owned()) return;
          this.#closeWindow(window);
          if (this.#mayReopen()) void Effect.runPromise(this.reconcileWindow());
        });
        window.once("ready-to-show", () => {
          if (!owned() || this.#presentation === null) return;
          this.#show(window);
        });
        window.on("blur", () => {
          if (!owned()) return;
          if (entry.keyboard) {
            entry.keyboard = false;
            window.setFocusable(false);
          }
          sendToRenderer(window, IPC_ENDPOINTS.agentDock.closeChat);
        });
        window.on("move", () => {
          if (!owned() || this.#drag?.rendererId === entry.rendererId) return;
          const display = this.#displayOf(entry);
          if (!display) return;
          const expected = this.#placedBounds(entry, display);
          const { x, y } = window.getBounds();
          if (x !== expected.x || y !== expected.y) window.setBounds(expected, false);
        });
        window.on("closed", () => {
          this.#forget(window);
        });
        return window;
      },
      catch: (cause) => new AgentDockFailed({ cause }),
    }).pipe(
      Effect.flatMap((window) =>
        Effect.tryPromise({
          try: () => this.#options.loadWindow(window),
          catch: (cause) => new AgentDockFailed({ cause }),
        }).pipe(Effect.tapError(() => Effect.sync(() => this.#closeWindow(window)))),
      ),
    );
  }

  #mayReopen(): boolean {
    const now = Date.now();
    this.#reopens = this.#reopens.filter((time) => now - time < DOCK_REOPEN_WINDOW_MS);
    if (this.#reopens.length >= DOCK_REOPEN_MAX) return false;
    this.#reopens.push(now);
    return true;
  }

  #show(window: BrowserWindow): void {
    window.showInactive();
    if (this.#options.windowKind === "x11") window.setVisibleOnAllWorkspaces(true);
  }

  destroy(): void {
    this.#destroyed = true;
    this.setShortcut(null);
    this.#destroyWindow();
  }

  setShortcut(shortcut: string | null): void {
    const clean = shortcut?.trim() || null;
    if (this.#registeredShortcut === clean) return;
    if (this.#registeredShortcut) {
      try {
        this.#options.unregisterShortcut?.(this.#registeredShortcut);
      } catch {}
      this.#registeredShortcut = null;
    }
    if (this.#destroyed || !clean || !this.#options.registerShortcut) return;
    try {
      const ok = this.#options.registerShortcut(clean, () => {
        const main = this.#options.getMainWindow();
        if (main && !main.isDestroyed()) {
          sendToRenderer(main, IPC_ENDPOINTS.agentDock.action, { type: "toggle" });
          return;
        }
        if (this.#options.ensureMainWindow) {
          void this.#options
            .ensureMainWindow()
            .then((win) => {
              if (!win.isDestroyed()) {
                sendToRenderer(win, IPC_ENDPOINTS.agentDock.action, { type: "toggle" });
              }
            })
            .catch(() => undefined);
        }
      });
      if (ok) this.#registeredShortcut = clean;
    } catch {}
  }

  #destroyWindow(): void {
    for (const { window } of this.#windows) this.#closeWindow(window);
  }

  #closeWindow(window: BrowserWindow): void {
    this.#forget(window);
    if (!window.isDestroyed()) window.destroy();
  }

  #forget(window: BrowserWindow): void {
    const entry = this.#windows.find((item) => item.window === window);
    if (!entry) return;
    this.#windows = this.#windows.filter((item) => item !== entry);
    this.#release(entry);
  }

  #release(entry: DockWindow): void {
    entry.keyboard = false;
    if (this.#drag?.rendererId === entry.rendererId) this.#drag = null;
    if (this.#chatOwner !== entry.rendererId) return;
    this.#chatOwner = null;
    const main = this.#options.getMainWindow();
    const serverId = this.#presentation?.serverId;
    if (main && !main.isDestroyed() && serverId !== undefined) {
      sendToRenderer(main, IPC_ENDPOINTS.agentDock.action, { type: "open-chat", serverId, seat: null });
    }
  }
}

function companionBotRadius(sizePercent: number | undefined): number {
  const pct = Math.max(AGENT_DOCK_SIZE_LIMITS.min, Math.min(AGENT_DOCK_SIZE_LIMITS.max, sizePercent ?? 100));
  const ratio = (pct - 70) / 70;
  const diameter = Math.round(48 + ratio * 48);
  return Math.max(24, Math.round(diameter / 2));
}

function companionScreenArea(display: Pick<Display, "bounds" | "workArea">): Rectangle {
  const full = display.bounds;
  const work = display.workArea;
  // On macOS, floating panels cannot be positioned above the menu bar (workArea.y),
  // while left, right, and bottom physical screen edges are 100% reachable for half-hidden docking.
  const top = Math.max(full.y, work.y);
  const bottom = full.y + full.height;
  return {
    x: full.x,
    y: top,
    width: full.width,
    height: Math.max(120, bottom - top),
  };
}

function companionWindowPlacement(
  display: Pick<Display, "bounds" | "workArea">,
  pos: CompanionStoredPosition,
  sizePercent: number | undefined,
  zoom: number,
): CompanionPlacement {
  const area = companionScreenArea(display);
  const width = Math.min(area.width, Math.round(AGENT_DOCK_WINDOW_SIZE.width * Math.max(1, zoom)));
  const height = Math.min(area.height, Math.round(AGENT_DOCK_WINDOW_SIZE.height * Math.max(1, zoom)));
  const radius = companionBotRadius(sizePercent);

  const minX = area.x + radius;
  const maxX = Math.max(minX, area.x + area.width - radius);
  const minY = area.y + radius;
  const maxY = Math.max(minY, area.y + area.height - radius);

  let cx = minX + (maxX - minX) * Math.min(1, Math.max(0, pos.xOffset));
  let cy = minY + (maxY - minY) * Math.min(1, Math.max(0, pos.offset));

  if (pos.dockedEdge === "left") cx = area.x;
  else if (pos.dockedEdge === "right") cx = area.x + area.width;
  else if (pos.dockedEdge === "top") cy = area.y;
  else if (pos.dockedEdge === "bottom") cy = area.y + area.height;

  const maxWinX = Math.max(area.x, area.x + area.width - width);
  const maxWinY = Math.max(area.y, area.y + area.height - height);
  const wx = Math.min(maxWinX, Math.max(area.x, Math.round(cx - width / 2)));
  const wy = Math.min(maxWinY, Math.max(area.y, Math.round(cy - height / 2)));

  return {
    bounds: { x: wx, y: wy, width, height },
    centerX: Math.round(cx),
    centerY: Math.round(cy),
    anchorX: Math.round(cx - wx),
    anchorY: Math.round(cy - wy),
    dockedEdge: pos.dockedEdge,
  };
}

function zoomedRect(rect: AgentDockInputRect, zoom: number): AgentDockInputRect {
  const x = Math.floor(rect.x * zoom);
  const y = Math.floor(rect.y * zoom);
  return {
    x,
    y,
    width: Math.ceil((rect.x + rect.width) * zoom) - x,
    height: Math.ceil((rect.y + rect.height) * zoom) - y,
  };
}

export function requireAgentDockSender(actualId: number, expectedIds: ReadonlySet<number>, name: string): void {
  if (!expectedIds.has(actualId)) {
    throw new Error(`Rejected agent dock IPC request outside the ${name}.`);
  }
}
