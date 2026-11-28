import { isDeepStrictEqual } from "node:util";
import type {
  AgentDockAction,
  AgentDockDisplayInfo,
  AgentDockDragPhase,
  AgentDockExtent,
  AgentDockInputRect,
  AgentDockPresentation,
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
const COMPANION_EDGE_MARGIN_X = 52;
const COMPANION_EDGE_MARGIN_Y = 58;

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
  #offsets = new Map<number, { xOffset: number; offset: number }>();
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
        (presentation?.offsets ?? []).map(({ displayId, offset, xOffset }) => [
          displayId,
          { xOffset: xOffset ?? DEFAULT_COMPANION_X_OFFSET, offset },
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
    const bounds = this.#placedBounds(entry, display);
    if (!isDeepStrictEqual(entry.window.getBounds(), bounds)) entry.window.setBounds(bounds, false);
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
      const rect = start ? this.#boundsFor(start) : entry.window.getBounds();
      this.#drag = {
        rendererId,
        pointerX: cursor.x,
        pointerY: cursor.y,
        centerX: rect.x + rect.width / 2,
        centerY: rect.y + rect.height / 2,
      };
      return;
    }
    const drag = this.#drag;
    if (drag?.rendererId !== rendererId) return;
    const display = this.#displayOf(entry);
    if (display) {
      const area = display.workArea;
      const minX = area.x + COMPANION_EDGE_MARGIN_X;
      const maxX = Math.max(minX, area.x + area.width - COMPANION_EDGE_MARGIN_X);
      const minY = area.y + COMPANION_EDGE_MARGIN_Y;
      const maxY = Math.max(minY, area.y + area.height - COMPANION_EDGE_MARGIN_Y);
      const nextCx = Math.min(maxX, Math.max(minX, drag.centerX + cursor.x - drag.pointerX));
      const nextCy = Math.min(maxY, Math.max(minY, drag.centerY + cursor.y - drag.pointerY));
      const xOffset = maxX > minX ? (nextCx - minX) / (maxX - minX) : DEFAULT_COMPANION_X_OFFSET;
      const offset = maxY > minY ? (nextCy - minY) / (maxY - minY) : DEFAULT_COMPANION_Y_OFFSET;
      this.#offsets.set(entry.displayId, { xOffset, offset });
      const bounds = this.#placedBounds(entry, display);
      if (!isDeepStrictEqual(entry.window.getBounds(), bounds)) entry.window.setBounds(bounds, false);
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
        ...(display && { bounds: display.bounds }),
      });
    }
  }

  #draggedDisplayId(): number | null {
    const drag = this.#drag;
    if (!drag) return null;
    return this.#liveWindows().find((item) => item.rendererId === drag.rendererId)?.displayId ?? null;
  }

  #displayOf(entry: DockWindow): Display | undefined {
    return this.#options.screen.getAllDisplays().find((display) => display.id === entry.displayId);
  }

  #boundsFor(display: Display): Rectangle {
    const pos = this.#positionFor(display);
    return companionWindowBounds(display, pos.xOffset, pos.offset, this.#zoom());
  }

  #placedBounds(_entry: DockWindow, display: Display): Rectangle {
    return this.#boundsFor(display);
  }

  #positionFor(display: Display): { xOffset: number; offset: number } {
    const saved = this.#offsets.get(display.id);
    if (saved !== undefined) return saved;
    const connected = new Set(this.#options.screen.getAllDisplays().map(({ id }) => id));
    const renamed = (this.#presentation?.offsets ?? []).findLast(
      (item) => !connected.has(item.displayId) && sameAgentDockDisplayBounds(item.bounds, display.bounds),
    );
    return {
      xOffset: renamed?.xOffset ?? DEFAULT_COMPANION_X_OFFSET,
      offset: renamed?.offset ?? DEFAULT_COMPANION_Y_OFFSET,
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
            const bounds = this.#placedBounds(current, display);
            if (!isDeepStrictEqual(current.window.getBounds(), bounds)) current.window.setBounds(bounds, false);
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

function companionWindowBounds(
  display: Pick<Display, "workArea">,
  xOffset: number,
  yOffset: number,
  zoom: number,
): Rectangle {
  const area = display.workArea;
  const width = Math.round(AGENT_DOCK_WINDOW_SIZE.width * Math.max(1, zoom));
  const height = Math.round(AGENT_DOCK_WINDOW_SIZE.height * Math.max(1, zoom));
  const minX = area.x + COMPANION_EDGE_MARGIN_X;
  const maxX = Math.max(minX, area.x + area.width - COMPANION_EDGE_MARGIN_X);
  const minY = area.y + COMPANION_EDGE_MARGIN_Y;
  const maxY = Math.max(minY, area.y + area.height - COMPANION_EDGE_MARGIN_Y);
  const cx = minX + (maxX - minX) * Math.min(1, Math.max(0, xOffset));
  const cy = minY + (maxY - minY) * Math.min(1, Math.max(0, yOffset));
  return {
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2),
    width,
    height,
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
