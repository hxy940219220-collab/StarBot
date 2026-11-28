import { type KawaiiCue, playKawaiiCue, unlockKawaiiAudio } from "@starbot/ui/features/agents/starbot-kawaii-audio";
import { SOUND_THEMES, type SoundChoice, type SoundTheme } from "@starbot/ui/features/settings/app-settings";
import type { PlayOptions, SoundName } from "cuelume";

const ACTION_SOUNDS_STORAGE_KEY = "starbot:action-sounds-enabled";
const ACTION_SOUNDS_THEME_STORAGE_KEY = "starbot:action-sounds-theme";

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

const SEMANTIC_INTERACTIVE_SELECTOR =
  'button, a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], [role="radio"], summary';

function bindKawaiiDomInteractions(): void {
  if (typeof document === "undefined") return;

  document.addEventListener(
    "pointerdown",
    (event) => {
      unlockKawaiiAudio();
      if (event.button !== 0 || !isActionSoundEnabled()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      // Avoid double-firing when poking an interactive zodiac mascot SVG
      if (target.closest(".bloub-avatar-svg")) return;

      const el = target.closest(CLICK_SELECTOR);
      if (el) {
        if (el.matches(":disabled, [aria-disabled='true']")) return;
        const subtle = el.getAttribute("data-cuelume-emphasis") === "subtle";
        if (el.hasAttribute("data-cuelume-toggle")) {
          const checked = (el instanceof HTMLInputElement && el.checked) || el.getAttribute("aria-checked") === "true";
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
        return;
      }

      // Semantic fallback so all StarBot tabs, switches, modals, copy/delete & custom buttons sound alive!
      const interactive = target.closest(SEMANTIC_INTERACTIVE_SELECTOR);
      if (!interactive || interactive.matches(":disabled, [aria-disabled='true'], [data-starbot-silent]")) return;

      const role = interactive.getAttribute("role");
      const ariaLabel = (interactive.getAttribute("aria-label") ?? "").toLowerCase();
      if (role === "switch") {
        const checked = interactive.getAttribute("aria-checked") === "true";
        void playKawaiiCue(checked ? "toggle-off" : "toggle-on");
        return;
      }
      if (role === "tab" || interactive.classList.contains("starbot-tour-dot")) {
        void playKawaiiCue("tab-switch");
        return;
      }
      if (role === "menuitem" || role === "option" || role === "radio") {
        void playKawaiiCue("select", { subtle: true });
        return;
      }
      if (ariaLabel.includes("复制") || ariaLabel.includes("copy") || interactive.hasAttribute("data-copy")) {
        void playKawaiiCue("copy");
        return;
      }
      if (ariaLabel.includes("删除") || ariaLabel.includes("移除") || ariaLabel.includes("delete")) {
        void playKawaiiCue("delete");
        return;
      }
      if (
        ariaLabel.includes("关闭") ||
        ariaLabel.includes("close") ||
        interactive.classList.contains("starbot-inspector-close") ||
        interactive.classList.contains("starbot-tour-floating-close")
      ) {
        void playKawaiiCue("drawer-close");
        return;
      }
      void playKawaiiCue("tap", { subtle: true });
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
