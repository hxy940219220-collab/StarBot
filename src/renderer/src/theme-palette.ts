import type { AppThemePalette } from "@starbot/contracts/app-appearance";

function clear(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

function mix(color: string, other: string, percent: number): string {
  return `color-mix(in srgb, ${color}, ${other} ${percent}%)`;
}

function paletteTokens({ scheme, colors }: AppThemePalette): Record<string, string> {
  const raised = scheme === "light" ? mix(colors.canvas, "#ffffff", 70) : colors.surface;
  const tabsBar = scheme === "light" ? mix(colors.canvas, colors.surface, 30) : colors.surface;
  return {
    "--starbot-bg-canvas": colors.canvas,
    "--starbot-bg-canvas-clear": clear(colors.canvas, 0),
    "--starbot-bg-frame": colors.frame,
    "--starbot-bg-sidebar": colors.sidebar,
    "--starbot-bg-native-sidebar": colors.sidebar,
    "--starbot-bg-sheet": raised,
    "--starbot-bg-sheet-inset": colors.frame,
    "--starbot-bg-grouped": raised,
    "--starbot-bg-surface": raised,
    "--starbot-bg-surface-raised": mix(raised, colors.text, 3),
    "--starbot-bg-control": raised,
    "--starbot-bg-control-hover": mix(raised, colors.text, 4),
    "--starbot-bg-control-active": mix(raised, colors.text, 8),
    "--starbot-tabs-bar-bg": tabsBar,
    "--starbot-tabs-pill-bg": scheme === "light" ? raised : mix(colors.surface, colors.text, 8),
    "--starbot-marketplace-detail-bg": colors.frame,
    "--starbot-bg-overlay": clear(colors.canvas, 92),
    "--starbot-bg-glass": clear(raised, 76),
    "--starbot-scroll-edge-overlay": clear(colors.canvas, 72),

    "--starbot-border": clear(colors.border, 35),
    "--starbot-border-strong": clear(colors.border, 50),
    "--starbot-border-grouped": colors.border,
    "--starbot-dialog-ring": clear(colors.border, 70),
    "--starbot-image-outline": clear(colors.border, 60),
    "--starbot-hover": clear(colors.text, 5),

    "--starbot-text-primary": colors.text,
    "--starbot-text-secondary": mix(colors.text, colors.textMuted, 25),
    "--starbot-text-muted": colors.textMuted,
    "--starbot-text-dim": mix(colors.textMuted, colors.canvas, 30),
    "--starbot-text-placeholder": colors.textMuted,
    "--starbot-text-readable": colors.textMuted,
    "--starbot-text-grouped-secondary": colors.textMuted,
    "--starbot-settings-text-muted": colors.textMuted,

    "--starbot-surface-light": colors.text,
    "--starbot-text-on-light": colors.canvas,
    "--starbot-text-muted-on-light": clear(colors.canvas, 64),
    "--starbot-text-dim-on-light": clear(colors.canvas, 40),
    "--starbot-border-on-light": clear(colors.canvas, 16),

    "--starbot-accent": colors.accent,
    "--starbot-accent-hover": mix(colors.accent, colors.text, 15),
    "--starbot-accent-text": colors.accent,
    "--starbot-accent-soft": clear(colors.accent, 16),
    "--starbot-accent-strong": clear(colors.accent, 34),
    "--starbot-text-on-accent": colors.accentForeground,

    "--starbot-success": colors.success,
    "--starbot-success-text": colors.success,
    "--starbot-success-soft": clear(colors.success, 14),
    "--starbot-success-wash": clear(colors.success, 6),
    "--starbot-warning": colors.warning,
    "--starbot-warning-text": colors.warning,
    "--starbot-warning-soft": clear(colors.warning, 14),
    "--starbot-danger": colors.danger,
    "--starbot-danger-hover": mix(colors.danger, colors.text, 15),
    "--starbot-danger-text": colors.danger,
    "--starbot-danger-soft": clear(colors.danger, 14),
    "--starbot-danger-soft-hover": clear(colors.danger, 22),
    "--starbot-danger-focus": clear(colors.danger, 36),
    "--starbot-danger-border": clear(colors.danger, 45),
  };
}

let applied: string[] = [];

export function applyThemePalette(palette: AppThemePalette | null): void {
  const style = document.documentElement.style;
  for (const name of applied) style.removeProperty(name);
  applied = [];
  if (palette === null) return;
  for (const [name, value] of Object.entries(paletteTokens(palette))) {
    style.setProperty(name, value);
    applied.push(name);
  }
}
