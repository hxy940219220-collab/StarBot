import type { AppAppearancePreference, AppFontFamily } from "@starbot/contracts/app-appearance";
import { type Accessor, createSignal, onSettled } from "solid-js";
import { appPort } from "./app-port";

function quotedFontFamily(font: AppFontFamily): string {
  return `"${font}"`;
}

const FONT_PROPERTIES = [
  { property: "--starbot-font-sans", fallback: "var(--starbot-font-sans-default)", field: "interfaceFont" },
  { property: "--starbot-font-mono", fallback: "var(--starbot-font-mono-default)", field: "codeFont" },
] as const;

export function applyAppFonts(preference: Pick<AppAppearancePreference, "interfaceFont" | "codeFont">): void {
  const root = document.documentElement;
  for (const { property, fallback, field } of FONT_PROPERTIES) {
    const font = preference[field];
    if (font === null) root.style.removeProperty(property);
    else root.style.setProperty(property, `${quotedFontFamily(font)}, ${fallback}`);
  }
}

export function useInstalledFonts(): Accessor<readonly AppFontFamily[]> {
  const [fonts, setFonts] = createSignal<readonly AppFontFamily[]>([]);
  onSettled(() => {
    void appPort()
      .listInstalledFonts()
      .then((next) => setFonts(() => next))
      .catch(() => undefined);
  });
  return fonts;
}
