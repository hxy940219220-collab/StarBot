import { createRequire } from "node:module";
import { createOpenBotLogger, toLogValue } from "@openbot/logging";
import type * as Koffi from "koffi";

const logger = createOpenBotLogger("double-tap-shortcut");
const requireModule = createRequire(import.meta.url);

export type DoubleTapModifier = "Alt" | "Control" | "Shift" | "Command";

const POLL_INTERVAL_MS = 24;
const MAX_HOLD_MS = 280;
const DOUBLE_TAP_WINDOW_MS = 400;

// macOS CGEventFlags masks (CoreGraphics)
const CG_FLAG_SHIFT = 0x00020000;
const CG_FLAG_CONTROL = 0x00040000;
const CG_FLAG_ALTERNATE = 0x00080000;
const CG_FLAG_COMMAND = 0x00100000;
const CG_ALL_MODIFIERS = CG_FLAG_SHIFT | CG_FLAG_CONTROL | CG_FLAG_ALTERNATE | CG_FLAG_COMMAND;
const CG_EVENT_KEY_DOWN = 10;

// Windows Virtual-Key codes (user32.dll)
const VK_SHIFT = 0x10;
const VK_CONTROL = 0x11;
const VK_MENU = 0x12; // Alt
const VK_LWIN = 0x5b;
const VK_RWIN = 0x5c;

interface ModifierProbe {
  readState: (target: DoubleTapModifier) => { pressed: boolean; otherModifier: boolean; recentRegularKey: boolean };
}

let cachedProbe: ModifierProbe | null | undefined;

function getModifierProbe(): ModifierProbe | null {
  if (cachedProbe !== undefined) return cachedProbe;
  try {
    const koffi: typeof Koffi = requireModule("koffi");
    if (process.platform === "darwin") {
      const cg = koffi.load("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics");
      const flagsState = cg.func("CGEventSourceFlagsState", "uint64", ["int32"]) as (
        stateId: number,
      ) => number | bigint;
      const secondsSinceEvent = cg.func("CGEventSourceSecondsSinceLastEventType", "double", ["int32", "uint32"]) as (
        stateId: number,
        eventType: number,
      ) => number;
      const maskOf = (target: DoubleTapModifier): number => {
        switch (target) {
          case "Alt":
            return CG_FLAG_ALTERNATE;
          case "Control":
            return CG_FLAG_CONTROL;
          case "Shift":
            return CG_FLAG_SHIFT;
          case "Command":
            return CG_FLAG_COMMAND;
        }
      };
      cachedProbe = {
        readState(target) {
          const raw = Number(flagsState(0)) & CG_ALL_MODIFIERS;
          const mask = maskOf(target);
          const pressed = (raw & mask) !== 0;
          const otherModifier = (raw & ~mask) !== 0;
          const sinceKeyDown = secondsSinceEvent(0, CG_EVENT_KEY_DOWN);
          return {
            pressed,
            otherModifier,
            recentRegularKey: Number.isFinite(sinceKeyDown) && sinceKeyDown >= 0 && sinceKeyDown < 0.18,
          };
        },
      };
      return cachedProbe;
    }
    if (process.platform === "win32") {
      const user32 = koffi.load("user32.dll");
      const getAsyncKeyState = user32.func("GetAsyncKeyState", "short", ["int"]) as (vk: number) => number;
      const isDown = (vk: number) => (getAsyncKeyState(vk) & 0x8000) !== 0;
      cachedProbe = {
        readState(target) {
          const alt = isDown(VK_MENU);
          const ctrl = isDown(VK_CONTROL);
          const shift = isDown(VK_SHIFT);
          const win = isDown(VK_LWIN) || isDown(VK_RWIN);
          const pressed = target === "Alt" ? alt : target === "Control" ? ctrl : target === "Shift" ? shift : win;
          const activeCount = [alt, ctrl, shift, win].filter(Boolean).length;
          return {
            pressed,
            otherModifier: pressed ? activeCount > 1 : activeCount > 0,
            recentRegularKey: false,
          };
        },
      };
      return cachedProbe;
    }
  } catch (error) {
    logger.warn("Unable to initialize native modifier double-tap probe:", toLogValue(error));
  }
  cachedProbe = null;
  return null;
}

export function parseDoubleTapModifier(shortcut: string): DoubleTapModifier | null {
  if (!shortcut.startsWith("DoubleTap:")) return null;
  const key = shortcut.slice("DoubleTap:".length).trim();
  if (key === "Alt" || key === "Option") return "Alt";
  if (key === "Control" || key === "Ctrl") return "Control";
  if (key === "Shift") return "Shift";
  if (key === "Command" || key === "Meta" || key === "Super" || key === "CommandOrControl") return "Command";
  return null;
}

export class DoubleTapShortcutController {
  #timer: ReturnType<typeof setInterval> | undefined;
  #activeShortcut: string | null = null;

  register(
    shortcut: string,
    onTrigger: () => void,
    fallbackGlobalRegister?: (accelerator: string, cb: () => void) => boolean,
  ): boolean {
    this.unregister();
    const mod = parseDoubleTapModifier(shortcut);
    if (mod) {
      const probe = getModifierProbe();
      if (!probe) return false;
      let wasPressed = false;
      let pressStartedAt = 0;
      let tainted = false;
      let lastTapEndedAt = 0;
      this.#activeShortcut = shortcut;
      this.#timer = setInterval(() => {
        const { pressed, otherModifier, recentRegularKey } = probe.readState(mod);
        const now = Date.now();
        if (pressed) {
          if (!wasPressed) {
            wasPressed = true;
            pressStartedAt = now;
            tainted = otherModifier || recentRegularKey;
          } else if (otherModifier || recentRegularKey || now - pressStartedAt > MAX_HOLD_MS) {
            tainted = true;
          }
          return;
        }
        if (wasPressed) {
          wasPressed = false;
          const duration = now - pressStartedAt;
          if (!tainted && !otherModifier && !recentRegularKey && duration >= 12 && duration <= MAX_HOLD_MS) {
            if (lastTapEndedAt > 0 && now - lastTapEndedAt <= DOUBLE_TAP_WINDOW_MS) {
              lastTapEndedAt = 0;
              onTrigger();
            } else {
              lastTapEndedAt = now;
            }
          } else {
            lastTapEndedAt = 0;
          }
          tainted = false;
        }
      }, POLL_INTERVAL_MS);
      return true;
    }

    // DoubleTap:<RegularKey> (e.g. DoubleTap:F1) via Electron globalShortcut two-tap window
    if (shortcut.startsWith("DoubleTap:") && fallbackGlobalRegister) {
      const baseKey = shortcut.slice("DoubleTap:".length).trim();
      if (!baseKey) return false;
      let lastAt = 0;
      const ok = fallbackGlobalRegister(baseKey, () => {
        const now = Date.now();
        if (lastAt > 0 && now - lastAt <= DOUBLE_TAP_WINDOW_MS) {
          lastAt = 0;
          onTrigger();
        } else {
          lastAt = now;
        }
      });
      if (ok) this.#activeShortcut = shortcut;
      return ok;
    }

    return false;
  }

  unregister(fallbackGlobalUnregister?: (accelerator: string) => void): void {
    if (this.#timer !== undefined) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
    if (this.#activeShortcut?.startsWith("DoubleTap:") && !parseDoubleTapModifier(this.#activeShortcut)) {
      const baseKey = this.#activeShortcut.slice("DoubleTap:".length).trim();
      if (baseKey) {
        try {
          fallbackGlobalUnregister?.(baseKey);
        } catch {}
      }
    }
    this.#activeShortcut = null;
  }
}
