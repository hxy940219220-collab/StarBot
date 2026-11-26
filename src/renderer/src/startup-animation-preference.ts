import { createSignal } from "solid-js";

const LEGACY_STARTUP_ANIMATION_KEY = "openbot:startup-animation";
const STARTUP_ANIMATION_CONFIG_KEY = "starbot:startup-animation-config:v1";

export type StartupAnimationMode = "always" | "every_n_days" | "first_login_only" | "off";

export interface StartupAnimationConfig {
  readonly mode: StartupAnimationMode;
  readonly intervalDays: number;
  readonly lastPlayedAt: number | null;
  readonly firstLoginPlayed: boolean;
}

const DEFAULT_CONFIG: StartupAnimationConfig = {
  mode: "always",
  intervalDays: 3,
  lastPlayedAt: null,
  firstLoginPlayed: false,
};

function clampIntervalDays(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return 3;
  return Math.min(365, Math.round(num));
}

function readStartupAnimationConfig(): StartupAnimationConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STARTUP_ANIMATION_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<StartupAnimationConfig>;
    const mode: StartupAnimationMode =
      parsed.mode === "always" ||
      parsed.mode === "every_n_days" ||
      parsed.mode === "first_login_only" ||
      parsed.mode === "off"
        ? parsed.mode
        : "always";
    return {
      mode,
      intervalDays: clampIntervalDays(parsed.intervalDays),
      lastPlayedAt:
        typeof parsed.lastPlayedAt === "number" && Number.isFinite(parsed.lastPlayedAt) ? parsed.lastPlayedAt : null,
      firstLoginPlayed: parsed.firstLoginPlayed === true,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function persistStartupAnimationConfig(next: StartupAnimationConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STARTUP_ANIMATION_CONFIG_KEY, JSON.stringify(next));
    if (next.mode === "off") {
      window.localStorage.setItem(LEGACY_STARTUP_ANIMATION_KEY, "off");
    } else {
      window.localStorage.removeItem(LEGACY_STARTUP_ANIMATION_KEY);
    }
  } catch {}
}

const [startupConfig, setStartupConfig] = createSignal<StartupAnimationConfig>(readStartupAnimationConfig());
const [splashPreviewOpenSignal, setSplashPreviewOpenSignal] = createSignal(false);

function readStorageIntoSignal(event: StorageEvent): void {
  if (
    event.key !== null &&
    event.key !== STARTUP_ANIMATION_CONFIG_KEY &&
    event.key !== LEGACY_STARTUP_ANIMATION_KEY
  ) {
    return;
  }
  setStartupConfig(readStartupAnimationConfig());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", readStorageIntoSignal);
  import.meta.hot?.dispose(() => {
    window.removeEventListener("storage", readStorageIntoSignal);
  });
}

export function shouldPlayStartupSplashNow(config: StartupAnimationConfig = startupConfig()): boolean {
  switch (config.mode) {
    case "off":
      return false;
    case "always":
      return true;
    case "first_login_only":
      return !config.firstLoginPlayed;
    case "every_n_days": {
      if (!config.lastPlayedAt) return true;
      const elapsedMs = Date.now() - config.lastPlayedAt;
      return elapsedMs >= Math.max(1, config.intervalDays) * 86_400_000;
    }
  }
}

export function recordStartupSplashPlayed(): void {
  const next: StartupAnimationConfig = {
    ...startupConfig(),
    lastPlayedAt: Date.now(),
    firstLoginPlayed: true,
  };
  persistStartupAnimationConfig(next);
  setStartupConfig(next);
}

export function resetFirstLoginSplashFlag(): void {
  const current = startupConfig();
  if (!current.firstLoginPlayed) return;
  const next: StartupAnimationConfig = {
    ...current,
    firstLoginPlayed: false,
  };
  persistStartupAnimationConfig(next);
  setStartupConfig(next);
}

export function startupLoadingScene(): "pile" | "quiet" {
  return shouldPlayStartupSplashNow() ? "pile" : "quiet";
}

export function useStartupAnimation(): () => boolean {
  return () => startupConfig().mode !== "off";
}

export function useStartupAnimationConfig(): () => StartupAnimationConfig {
  return startupConfig;
}

export function updateStartupAnimationConfig(patch: Partial<StartupAnimationConfig>): void {
  const current = startupConfig();
  const next: StartupAnimationConfig = {
    ...current,
    ...patch,
    intervalDays: patch.intervalDays !== undefined ? clampIntervalDays(patch.intervalDays) : current.intervalDays,
  };
  persistStartupAnimationConfig(next);
  setStartupConfig(next);
}

export function setStartupAnimation(on: boolean): void {
  updateStartupAnimationConfig({ mode: on ? "always" : "off" });
}

export function splashPreviewOpen(): boolean {
  return splashPreviewOpenSignal();
}

export function triggerStartupSplashPreview(): void {
  setSplashPreviewOpenSignal(true);
}

export function closeStartupSplashPreview(): void {
  setSplashPreviewOpenSignal(false);
}
