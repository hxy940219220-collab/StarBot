import {
  type KawaiiCue,
  playKawaiiCue,
  unlockKawaiiAudio,
} from "@openbot/ui/features/agents/starbot-kawaii-audio";
import { SOUND_THEMES, type SoundChoice, type SoundTheme } from "@openbot/ui/features/settings/app-settings";
import type { PlayOptions, SoundName } from "cuelume";

const ACTION_SOUNDS_STORAGE_KEY = "openbot:action-sounds-enabled";
const ACTION_SOUNDS_THEME_STORAGE_KEY = "openbot:action-sounds-theme";

type PreferenceStorage = Pick<Storage, "getItem">;

let unsavedPreference: boolean | undefined;
let unsavedTheme: SoundTheme | undefined;
let started = false;

export function isActionSoundEnabled(storage?: PreferenceStorage): boolean {
  if (unsavedPreference !== undefined) return unsavedPreference;
  try {
    const raw = (storage ?? window.localStorage).getItem(ACTION_SOUNDS_STORAGE_KEY);
    // Enabled by default in StarBot so cute feedback works immediately unless explicitly turned off
    return raw !== "false";
  } catch {
    return true;
  }
}

export function readActionSoundTheme(storage?: PreferenceStorage): SoundTheme {
  if (unsavedTheme !== undefined) return unsavedTheme;
  try {
    const saved = (storage ?? window.localStorage).getItem(ACTION_SOUNDS_THEME_STORAGE_KEY);
    return SOUND_THEMES.find((theme) => theme === saved) ?? "default";
  } catch {
    return "default";
  }
}

export function readActionSoundChoice(): SoundChoice {
  return isActionSoundEnabled() ? readActionSoundTheme() : "off";
}

function savePreference(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function setActionSoundChoice(choice: SoundChoice): void {
  const enabled = choice !== "off";
  unsavedPreference = savePreference(ACTION_SOUNDS_STORAGE_KEY, String(enabled)) ? undefined : enabled;
  if (!enabled) {
    void playKawaiiCue("close", { force: true });
    return;
  }
  unsavedTheme = savePreference(ACTION_SOUNDS_THEME_STORAGE_KEY, choice) ? undefined : choice;
  void playKawaiiCue("success", { theme: choice, force: true });
}

function mapSoundNameToKawaiiCue(sound: SoundName | string): KawaiiCue {
  switch (sound) {
    case "open":
      return "open";
    case "close":
      return "close";
    case "select":
      return "select";
    case "navigate":
      return "navigate";
    case "toggle":
      return "toggle-on";
    case "type":
      return "type";
    case "loading":
      return "loading";
    case "attention":
      return "attention";
    case "success":
      return "success";
    case "error":
      return "error";
    default:
      return "tap";
  }
}

const CLICK_ATTRS = [
  "data-cuelume-tap",
  "data-cuelume-select",
  "data-cuelume-toggle",
  "data-cuelume-open",
  "data-cuelume-close",
  "data-cuelume-navigate",
] as const;

const CLICK_SELECTOR = CLICK_ATTRS.map((a) => `[${a}]`).join(",");

function bindKawaiiDomInteractions(): void {
  if (typeof document === "undefined") return;

  document.addEventListener(
    "pointerdown",
    (event) => {
      unlockKawaiiAudio();
      if (event.button !== 0 || !isActionSoundEnabled()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const el = target.closest(CLICK_SELECTOR);
      if (!el || el.matches(":disabled, [aria-disabled='true']")) return;

      const subtle = el.getAttribute("data-cuelume-emphasis") === "subtle";
      if (el.hasAttribute("data-cuelume-toggle")) {
        const checked =
          (el instanceof HTMLInputElement && el.checked) || el.getAttribute("aria-checked") === "true";
        void playKawaiiCue(checked ? "toggle-off" : "toggle-on", { subtle });
        return;
      }
      if (el.hasAttribute("data-cuelume-open")) {
        const val = el.getAttribute("data-cuelume-open");
        void playKawaiiCue(val === "close" ? "close" : "open", { subtle });
        return;
      }
      if (el.hasAttribute("data-cuelume-close")) {
        void playKawaiiCue("close", { subtle });
        return;
      }
      if (el.hasAttribute("data-cuelume-select")) {
        void playKawaiiCue("select", { subtle });
        return;
      }
      if (el.hasAttribute("data-cuelume-navigate")) {
        void playKawaiiCue("navigate", { subtle });
        return;
      }
      const tapKind = el.getAttribute("data-cuelume-tap") || "tap";
      void playKawaiiCue(mapSoundNameToKawaiiCue(tapKind), { subtle });
    },
    { capture: true },
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isActionSoundEnabled() || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.hasAttribute("data-cuelume-type") && !target.closest("[contenteditable='true']")) return;
      if (event.key.length === 1 || event.key === "Backspace" || event.key === "Enter") {
        void playKawaiiCue("type", { subtle: true });
      }
    },
    { capture: true },
  );
}

export function startActionSounds(): void {
  if (started) return;
  started = true;
  bindKawaiiDomInteractions();
}

export function playActionSound(sound: SoundName, options?: PlayOptions): void {
  if (!isActionSoundEnabled()) return;
  const theme = (options?.theme as SoundTheme | undefined) ?? readActionSoundTheme();
  const subtle = options?.emphasis === "subtle";
  void playKawaiiCue(mapSoundNameToKawaiiCue(sound), { theme, subtle });
}
