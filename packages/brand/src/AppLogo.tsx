import { createEffect, createSignal, createUniqueId, flush, onCleanup } from "solid-js";
import { APP_LOGO_CORNER, APP_LOGO_SIZE } from "./app-logo-shape";

export type AppLogoAnimation = "none" | "blink" | "look-around" | "surprised";
export type AppLogoVariant = "production" | "dev" | "preview";

export interface AppLogoProps {
  variant: AppLogoVariant;
  animation?: AppLogoAnimation;
  interactive?: boolean;
  pointerArea?: HTMLElement | undefined;
  class?: string;
}

const EYE_RANGE = { x: 2.4, y: 1.8 };
const AREA_EYE_RANGE = { x: 9, y: 7 };
const BLINK_PERIOD = 4_800;
const BLINK_DURATION = 192;
const FIRST_BLINK_DELAY = 2_112;

export function AppLogo(props: AppLogoProps) {
  const uid = `sclogo-${createUniqueId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [clickReaction, setClickReaction] = createSignal(false);
  const [easterEgg, setEasterEgg] = createSignal(false);
  const [blinking, setBlinking] = createSignal(false);
  const className = () => ["app-logo", props.class].filter(Boolean).join(" ");
  const animation = () => props.animation ?? "none";
  let clickReactionTimer: number | undefined;
  let easterEggTimer: number | undefined;
  let logoElement: SVGSVGElement | undefined;
  let rapidClicks: number[] = [];

  function shouldReduceMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  function setEyePosition(x: number, y: number): void {
    const range = props.pointerArea ? AREA_EYE_RANGE : EYE_RANGE;
    logoElement?.style.setProperty("--app-logo-eye-x", `${x * range.x}%`);
    logoElement?.style.setProperty("--app-logo-eye-y", `${y * range.y}%`);
  }

  function resetEyePosition(): void {
    setEyePosition(0, 0);
  }

  function lookAt(event: PointerEvent, area: Element): void {
    if (!props.interactive || shouldReduceMotion()) return;
    if (event.pointerType && event.pointerType !== "mouse") return;
    const logo = logoElement?.getBoundingClientRect();
    if (!logo) return;
    const bounds = area.getBoundingClientRect();
    const centerX = logo.left + logo.width / 2;
    const centerY = logo.top + logo.height / 2;
    const reachX = Math.max(centerX - bounds.left, bounds.right - centerX);
    const reachY = Math.max(centerY - bounds.top, bounds.bottom - centerY);
    const x = Math.max(-1, Math.min(1, (event.clientX - centerX) / reachX));
    const y = Math.max(-1, Math.min(1, (event.clientY - centerY) / reachY));
    setEyePosition(x, y);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!props.pointerArea && logoElement) lookAt(event, logoElement);
  }

  function handlePointerLeave(): void {
    if (!props.pointerArea) resetEyePosition();
  }

  function triggerClickReaction(): void {
    if (!props.interactive || shouldReduceMotion()) return;
    window.clearTimeout(clickReactionTimer);
    flush(() => setClickReaction(false));
    void logoElement?.getBoundingClientRect();
    flush(() => setClickReaction(true));
    clickReactionTimer = window.setTimeout(() => setClickReaction(false), 360);
  }

  function registerRapidClick(): void {
    if (!props.interactive || shouldReduceMotion()) return;
    const now = performance.now();
    rapidClicks = [...rapidClicks.filter((time) => now - time < 900), now];
    if (rapidClicks.length < 5) return;

    rapidClicks = [];
    window.clearTimeout(easterEggTimer);
    flush(() => setEasterEgg(false));
    void logoElement?.getBoundingClientRect();
    flush(() => setEasterEgg(true));
    easterEggTimer = window.setTimeout(() => setEasterEgg(false), 1200);
  }

  function handleClick(): void {
    triggerClickReaction();
    registerRapidClick();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    triggerClickReaction();
  }

  createEffect(
    () => props.pointerArea,
    (area) => {
      if (!area) return;
      const handleAreaPointerMove = (event: PointerEvent) => lookAt(event, area);
      const handleAreaClick = (event: MouseEvent) => {
        if (event.target instanceof Node && logoElement?.contains(event.target)) return;
        handleClick();
      };
      area.addEventListener("pointermove", handleAreaPointerMove);
      area.addEventListener("pointerleave", resetEyePosition);
      area.addEventListener("click", handleAreaClick);
      return () => {
        area.removeEventListener("pointermove", handleAreaPointerMove);
        area.removeEventListener("pointerleave", resetEyePosition);
        area.removeEventListener("click", handleAreaClick);
      };
    },
  );

  createEffect(
    () => animation() === "blink",
    (blinks) => {
      if (!blinks) return;
      let blinkEndTimer: number | undefined;
      let blinkInterval: number | undefined;
      const blink = () => {
        if (shouldReduceMotion()) return;
        setBlinking(true);
        blinkEndTimer = window.setTimeout(() => setBlinking(false), BLINK_DURATION);
      };
      const firstBlinkTimer = window.setTimeout(() => {
        blink();
        blinkInterval = window.setInterval(blink, BLINK_PERIOD);
      }, FIRST_BLINK_DELAY);
      return () => {
        window.clearTimeout(firstBlinkTimer);
        window.clearInterval(blinkInterval);
        window.clearTimeout(blinkEndTimer);
        setBlinking(false);
      };
    },
  );

  onCleanup(() => {
    globalThis.clearTimeout(clickReactionTimer);
    globalThis.clearTimeout(easterEggTimer);
  });

  return (
    <svg
      ref={(element) => (logoElement = element)}
      class={className()}
      data-animation={animation()}
      data-blink={blinking() ? "" : undefined}
      data-click-reaction={clickReaction() ? "wink" : undefined}
      data-easter-egg={easterEgg() ? "party" : undefined}
      data-interactive={props.interactive ? "true" : undefined}
      data-variant={props.variant}
      viewBox={`0 0 ${APP_LOGO_SIZE} ${APP_LOGO_SIZE}`}
      aria-hidden={props.interactive ? undefined : "true"}
      aria-label={props.interactive ? "星友 StarBot Logo" : undefined}
      role={props.interactive ? "button" : undefined}
      tabindex={props.interactive ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <defs>
        <linearGradient id={`${uid}-sheen`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2b1978" stop-opacity="0.48" />
          <stop offset="48%" stop-color="#6e50e5" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#f3d8ff" stop-opacity="0.34" />
        </linearGradient>
        <radialGradient id={`${uid}-clay`} cx="36%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="68%" stop-color="#fff4ec" />
          <stop offset="100%" stop-color="#d2c1e8" />
        </radialGradient>
        <radialGradient id={`${uid}-gold`} cx="35%" cy="28%" r="70%">
          <stop offset="0%" stop-color="#fff4b8" />
          <stop offset="52%" stop-color="#ffd24c" />
          <stop offset="100%" stop-color="#cf8714" />
        </radialGradient>
        <radialGradient id={`${uid}-eye`} cx="36%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#483b54" />
          <stop offset="55%" stop-color="#201926" />
          <stop offset="100%" stop-color="#120d17" />
        </radialGradient>
        <radialGradient id={`${uid}-blush`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(255,112,152,0.58)" />
          <stop offset="100%" stop-color="rgba(255,112,152,0)" />
        </radialGradient>
      </defs>

      {/* Rounded Starry Squircle Base (respects Settings Logo Color!) */}
      <rect
        class="app-logo-background"
        width={APP_LOGO_SIZE}
        height={APP_LOGO_SIZE}
        rx={APP_LOGO_CORNER}
        ry={APP_LOGO_CORNER}
      />
      <rect
        width={APP_LOGO_SIZE}
        height={APP_LOGO_SIZE}
        rx={APP_LOGO_CORNER}
        ry={APP_LOGO_CORNER}
        fill={`url(#${uid}-sheen)`}
        pointer-events="none"
      />

      {/* Ambient micro-stars */}
      <path
        d="M52 38 C53.8 48 56 50.2 66 52 C56 53.8 53.8 56 52 66 C50.2 56 48 53.8 38 52 C48 50.2 50.2 48 52 38 Z"
        fill="#fff8e8"
        opacity="0.92"
        pointer-events="none"
      />
      <circle cx="38" cy="80" r="4.2" fill="#fff8e8" opacity="0.65" pointer-events="none" />
      <circle cx="48" cy="186" r="3.6" fill="#fff8e8" opacity="0.52" pointer-events="none" />
      <circle cx="198" cy="182" r="4.2" fill="#fff8e8" opacity="0.55" pointer-events="none" />

      {/* Blind-box matte polymer clay star-blob buddy */}
      <rect x="52" y="75" width="132" height="118" rx="48" fill="rgba(28,16,58,0.22)" pointer-events="none" />
      <rect x="52" y="70" width="132" height="118" rx="48" fill={`url(#${uid}-clay)`} pointer-events="none" />
      <ellipse cx="83" cy="147" rx="16" ry="9" fill={`url(#${uid}-blush)`} pointer-events="none" />
      <ellipse cx="151" cy="147" rx="16" ry="9" fill={`url(#${uid}-blush)`} pointer-events="none" />

      {/* Satin-gold sculpted 4-point star charm */}
      <g transform="translate(166 76) rotate(-14)" pointer-events="none">
        <path
          d="M0 -35 C7 -13 13 -7 35 0 C13 7 7 13 0 35 C-7 13 -13 7 -35 0 C-13 -7 -7 -13 0 -35 Z"
          fill={`url(#${uid}-gold)`}
          stroke="#ffd452"
          stroke-width="3"
          stroke-linejoin="round"
        />
      </g>
      <circle cx="196" cy="108" r="7" fill={`url(#${uid}-gold)`} pointer-events="none" />

      {/* Interactive glossy enamel vertical capsule eyes (preserve blink, gaze, wink & party!) */}
      <g class="app-logo-eye-motion">
        <g class="app-logo-eye app-logo-eye-left">
          <rect x="90" y="114" width="17" height="31" rx="8.5" fill={`url(#${uid}-eye)`} />
          <circle cx="95.4" cy="123" r="3.2" fill="#fffdf9" opacity="0.95" />
          <circle cx="101.2" cy="135.8" r="1.4" fill="#fffdf9" opacity="0.5" />
        </g>
      </g>
      <g class="app-logo-eye-motion">
        <g class="app-logo-eye app-logo-eye-right">
          <rect x="128" y="114" width="17" height="31" rx="8.5" fill={`url(#${uid}-eye)`} />
          <circle cx="133.4" cy="123" r="3.2" fill="#fffdf9" opacity="0.95" />
          <circle cx="139.2" cy="135.8" r="1.4" fill="#fffdf9" opacity="0.5" />
        </g>
      </g>
    </svg>
  );
}
