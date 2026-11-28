import { bloubAvatarProfile } from "@starbot/brand/bloub-avatar";
import type { AvatarColor, AvatarHue } from "@starbot/contracts/ipc";
import { render } from "@solidjs/web";
import { flush } from "solid-js";
import { ZodiacClayAvatar } from "./features/agents/ZodiacClayAvatar";

export type AvatarMotion = "hover" | "always" | "idle";
export {
  AVATAR_COLOR_CHOICES,
  AVATAR_EXPRESSIONS,
  AVATAR_HUE_CHOICES,
  AVATAR_STYLES,
  type AvatarColorChoice,
  type AvatarStyle,
  avatarColorChoicesForSeed,
  avatarDefaultSeed,
  avatarHeadColor,
  avatarHueForColor,
  avatarHueSwatch,
  avatarSeedForFace,
  avatarStyleForSeed,
  type BloubAvatarProfile,
  bloubAvatarProfile,
  isAvatarColorChoice,
  SUPPORTED_AVATAR_SILHOUETTES,
  type SupportedAvatarSilhouetteId,
  ZODIAC_AVATAR_LIST,
  type ZodiacAvatarMeta,
  type ZodiacEyeSpec,
  type ZodiacId,
  zodiacForShape,
} from "@starbot/brand/bloub-avatar";
export {
  type AvatarMood,
  avatarMoodIsBusy,
  avatarMoodPresentation,
  SHAPE_SAFE_STATES,
  type ShapeSafeStateId,
} from "@starbot/brand/bloub-avatar-motion";

export function createStaticAvatarSvg(
  seed: string,
  hue: AvatarHue | null,
  color: AvatarColor | null = null,
): SVGSVGElement {
  const host = document.createElement("span");
  const dispose = mountStaticAvatar(host, seed, hue, color);
  const svg = host.querySelector("svg");
  if (!svg) {
    dispose();
    throw new Error("Bloub did not render an SVG avatar.");
  }
  const result = svg.cloneNode(true);
  if (!(result instanceof SVGSVGElement)) {
    dispose();
    throw new Error("Bloub did not clone an SVG avatar.");
  }
  dispose();
  return result;
}

function mountStaticAvatar(
  host: HTMLElement,
  seed: string,
  hue: AvatarHue | null,
  color: AvatarColor | null,
): () => void {
  const profile = bloubAvatarProfile(seed, hue, color);
  const customColor = hue !== null || color !== null ? profile.color : null;
  const dispose = render(
    () => (
      <ZodiacClayAvatar
        shape={profile.shape}
        customColor={customColor}
        expression={profile.expression}
        frozenAt={0}
        ariaLabel=""
      />
    ),
    host,
  );
  flush();
  const svg = host.querySelector("svg");
  if (!svg) {
    dispose();
    throw new Error("Bloub did not render an SVG avatar.");
  }
  svg.removeAttribute("role");
  svg.removeAttribute("aria-label");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  return dispose;
}
