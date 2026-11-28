import type { ExpressionId } from "@norbert_bodziony/bloub";
import type { PlushState } from "@norbert_bodziony/bloub/plush";
import {
  type SupportedAvatarSilhouetteId,
  type ZodiacAvatarMeta,
  type ZodiacEyeSpec,
  type ZodiacId,
  zodiacForShape,
} from "@starbot/brand/bloub-avatar";
import type { JSX } from "@solidjs/web";
import { createEffect, createMemo, createUniqueId, onCleanup, onSettled, Show } from "solid-js";
// Articulated multi-part clay WebPs (back-to-front per zodiac)
import aquariusBase from "../../assets/zodiac/parts/aquarius-base.webp";
import aquariusLeft from "../../assets/zodiac/parts/aquarius-left.webp";
import aquariusRight from "../../assets/zodiac/parts/aquarius-right.webp";
import ariesBase from "../../assets/zodiac/parts/aries-base.webp";
import ariesLeft from "../../assets/zodiac/parts/aries-left.webp";
import ariesRight from "../../assets/zodiac/parts/aries-right.webp";
import cancerBase from "../../assets/zodiac/parts/cancer-base.webp";
import cancerLeft from "../../assets/zodiac/parts/cancer-left.webp";
import cancerRight from "../../assets/zodiac/parts/cancer-right.webp";
import capricornBack from "../../assets/zodiac/parts/capricorn-back.webp";
import capricornBase from "../../assets/zodiac/parts/capricorn-base.webp";
import geminiLeft from "../../assets/zodiac/parts/gemini-left.webp";
import geminiRight from "../../assets/zodiac/parts/gemini-right.webp";
import leoBack from "../../assets/zodiac/parts/leo-back.webp";
import leoBase from "../../assets/zodiac/parts/leo-base.webp";
import libraBase from "../../assets/zodiac/parts/libra-base.webp";
import libraTop from "../../assets/zodiac/parts/libra-top.webp";
import piscesLeft from "../../assets/zodiac/parts/pisces-left.webp";
import piscesRight from "../../assets/zodiac/parts/pisces-right.webp";
import sagittariusBase from "../../assets/zodiac/parts/sagittarius-base.webp";
import sagittariusTop from "../../assets/zodiac/parts/sagittarius-top.webp";
import scorpioBack from "../../assets/zodiac/parts/scorpio-back.webp";
import scorpioBase from "../../assets/zodiac/parts/scorpio-base.webp";
import scorpioLeft from "../../assets/zodiac/parts/scorpio-left.webp";
import scorpioRight from "../../assets/zodiac/parts/scorpio-right.webp";
import taurusBase from "../../assets/zodiac/parts/taurus-base.webp";
import taurusLeft from "../../assets/zodiac/parts/taurus-left.webp";
import taurusRight from "../../assets/zodiac/parts/taurus-right.webp";
import virgoBase from "../../assets/zodiac/parts/virgo-base.webp";
import virgoLeft from "../../assets/zodiac/parts/virgo-left.webp";
import virgoRight from "../../assets/zodiac/parts/virgo-right.webp";
import virgoTop from "../../assets/zodiac/parts/virgo-top.webp";
import { playKawaiiCue } from "./starbot-kawaii-audio";

type PartSlot = "back" | "left" | "right" | "base" | "top";

interface ZodiacPartAssets {
  back?: string;
  left?: string;
  right?: string;
  base?: string;
  top?: string;
}

const ZODIAC_PARTS: Readonly<Record<ZodiacId, ZodiacPartAssets>> = {
  aries: { left: ariesLeft, right: ariesRight, base: ariesBase },
  taurus: { left: taurusLeft, right: taurusRight, base: taurusBase },
  gemini: { left: geminiLeft, right: geminiRight },
  cancer: { left: cancerLeft, right: cancerRight, base: cancerBase },
  leo: { back: leoBack, base: leoBase },
  virgo: { left: virgoLeft, right: virgoRight, base: virgoBase, top: virgoTop },
  libra: { base: libraBase, top: libraTop },
  scorpio: { back: scorpioBack, left: scorpioLeft, right: scorpioRight, base: scorpioBase },
  sagittarius: { base: sagittariusBase, top: sagittariusTop },
  capricorn: { back: capricornBack, base: capricornBase },
  aquarius: { base: aquariusBase, left: aquariusLeft, right: aquariusRight },
  pisces: { left: piscesLeft, right: piscesRight },
};

interface PartPose {
  px: number;
  py: number;
  dx?: number;
  dy?: number;
  rot?: number;
  sx?: number;
  sy?: number;
}

interface FrameRigPoses {
  bodyDx: number;
  bodyDy: number;
  bodyRot: number;
  bodySx: number;
  bodySy: number;
  parts: Partial<Record<PartSlot, PartPose>>;
  eyeGroupOffsets?: readonly [{ dx: number; dy: number; rot: number }, { dx: number; dy: number; rot: number }];
}

function formatPartTransform(pose: PartPose | undefined): string {
  if (!pose) return "";
  const dx = pose.dx ?? 0;
  const dy = pose.dy ?? 0;
  const rot = pose.rot ?? 0;
  const sx = pose.sx ?? 1;
  const sy = pose.sy ?? 1;
  if (
    Math.abs(dx) < 0.02 &&
    Math.abs(dy) < 0.02 &&
    Math.abs(rot) < 0.02 &&
    Math.abs(sx - 1) < 0.0005 &&
    Math.abs(sy - 1) < 0.0005
  ) {
    return "";
  }
  return `translate(${(pose.px + dx).toFixed(2)},${(pose.py + dy).toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${sx.toFixed(4)},${sy.toFixed(4)}) translate(${(-pose.px).toFixed(2)},${(-pose.py).toFixed(2)})`;
}

function computeRigPoses(
  zodiacId: ZodiacId,
  phase: number,
  tSec: number,
  state: PlushState,
  exprId: ExpressionId,
  near: number,
  snap: boolean,
): FrameRigPoses {
  if (snap) {
    return { bodyDx: 0, bodyDy: 0, bodyRot: 0, bodySx: 1, bodySy: 1, parts: {} };
  }

  const isHappy = exprId === "heureux" || exprId === "excite" || exprId === "hilare" || state === "wink";
  const isAsleep = state === "asleep";
  const isThinking = state === "thinking";
  const isWide = state === "wide";
  const isFailed = state === "failed";

  // Smooth amplitude envelope ONLY (phase is integrated monotonically per-frame -> ZERO frequency-modulation jitter!)
  const amp = isAsleep ? 0.28 : isHappy ? 1.38 : isWide ? 1.25 : isThinking ? 1.1 : 1 + near * 0.28;
  const t = phase;

  // Soft clay breathing & playful bounce
  const breath = Math.sin(t * 2.15);
  const hop = isHappy ? Math.abs(Math.sin(t * 3.6)) * -2.8 : isWide ? -1.2 : 0;
  const bodyDy = breath * (isAsleep ? 1.3 : 1.65) + hop;
  const bodyDx = isFailed ? Math.sin(tSec * 14) * 2.4 : 0;
  const bodyRot = isThinking
    ? Math.sin(t * 1.4) * 2.2 - 1.4
    : isHappy
      ? Math.sin(t * 3.6) * 2.3
      : Math.sin(t * 1.15) * 1.0 * (isAsleep ? 0.4 : 1);
  const squish = breath * (isAsleep ? 0.015 : 0.013);
  const bodySx = 1 - squish;
  const bodySy = 1 + squish;

  const parts: Partial<Record<PartSlot, PartPose>> = {};
  let eyeGroupOffsets: FrameRigPoses["eyeGroupOffsets"];

  switch (zodiacId) {
    case "aries": {
      // Cute sheep ear twitch (periodic double-twitch + gentle idle flutter)
      const twitchBurst = Math.max(0, Math.sin(t * 1.1)) ** 10 * Math.sin(t * 16) * 8.5;
      const flutter = Math.sin(t * 2.6) * 3.4;
      const lift = (flutter + twitchBurst) * amp;
      parts.left = { px: -44, py: -1, rot: lift };
      parts.right = { px: 44, py: -1, rot: -lift * 0.92 - Math.cos(t * 2.6) * 1.4 * amp };
      break;
    }
    case "taurus": {
      // Relaxed ear flap with occasional happy bounce
      const flapL = (Math.sin(t * 2.2) * 5.2 + Math.max(0, Math.sin(t * 0.85)) ** 8 * 6.5) * amp;
      const flapR = (Math.sin(t * 2.2 + 0.45) * 5.2 + Math.max(0, Math.sin(t * 0.85)) ** 8 * 6.5) * amp;
      parts.left = { px: -46, py: -6, rot: flapL };
      parts.right = { px: 46, py: -6, rot: -flapR };
      break;
    }
    case "gemini": {
      // Twin blobs counter-phase bouncing & leaning playfully together
      const dyL = Math.sin(t * 2.8) * 3.0 * amp;
      const dyR = Math.sin(t * 2.8 + Math.PI) * 3.0 * amp;
      const rotL = Math.sin(t * 2.1) * 3.4 * amp;
      const rotR = Math.sin(t * 2.1 + 2.4) * 3.4 * amp;
      parts.left = { px: -29, py: 32, dy: dyL, rot: rotL };
      parts.right = { px: 29, py: 32, dy: dyR, rot: rotR };
      eyeGroupOffsets = [
        { dx: rotL * 0.25, dy: dyL, rot: rotL * 0.55 },
        { dx: rotR * 0.25, dy: dyR, rot: rotR * 0.55 },
      ];
      break;
    }
    case "cancer": {
      // Joyful waving crab claws! Alternating snip-wave + excited perk on hover
      const waveL = (Math.sin(t * 3.2) * 9.5 + near * 4.5) * amp;
      const waveR = (Math.sin(t * 3.2 + 1.15) * 9.5 + near * 4.5) * amp;
      const bobL = Math.cos(t * 3.2) * 1.6 * amp;
      const bobR = Math.cos(t * 3.2 + 1.15) * 1.6 * amp;
      parts.left = { px: -40, py: -4, dy: -Math.abs(bobL), rot: waveL };
      parts.right = { px: 40, py: -4, dy: -Math.abs(bobR), rot: -waveR };
      break;
    }
    case "leo": {
      // Sunflower mane radiant pulse & gentle halo sway
      const pulse = 1 + Math.sin(t * 2.5) * 0.032 * amp;
      const sway = Math.sin(t * 1.45) * 4.2 * amp;
      parts.back = { px: 0, py: 4, rot: sway, sx: pulse, sy: pulse };
      break;
    }
    case "virgo": {
      // Soft swaying braids + nodding flower crown
      const sway = Math.sin(t * 2.1) * 5.6 * amp;
      const daisyNod = Math.sin(t * 2.7 + 0.6) * 7.8 * amp;
      const daisyPop = 1 + Math.sin(t * 2.7) * 0.035 * amp;
      parts.left = { px: -44, py: 12, rot: sway };
      parts.right = { px: 44, py: 12, rot: -sway * 0.92 };
      parts.top = { px: -24, py: -34, rot: daisyNod, sx: daisyPop, sy: daisyPop };
      break;
    }
    case "libra": {
      // Classic gentle golden balance seesaw tilt (weighs ideas faster when thinking!)
      const tilt = Math.sin(t * (isThinking ? 3.2 : 1.75)) * (isThinking ? 9.5 : 6.8) * amp;
      parts.top = { px: 0, py: -44, rot: tilt };
      break;
    }
    case "scorpio": {
      // Iconic lively curling scorpion tail wag + snappy shoulder pincer bob!
      const tailWag = (Math.sin(t * 3.4) * 9.0 + Math.sin(t * 6.8) * 1.8) * amp;
      const pincerL = Math.sin(t * 3.0) * 6.8 * amp;
      const pincerR = Math.sin(t * 3.0 + 1.0) * 6.8 * amp;
      parts.back = { px: 26, py: 32, rot: tailWag };
      parts.left = { px: -38, py: 0, rot: pincerL };
      parts.right = { px: 24, py: 0, rot: -pincerR };
      break;
    }
    case "sagittarius": {
      // Golden bow & arrow energetic aiming sway + subtle draw pulse
      const aimRot = Math.sin(t * 2.3) * 5.8 * amp;
      const draw = Math.sin(t * 2.3 - 0.5) * 2.2 * amp;
      parts.top = { px: 22, py: 4, dx: draw, dy: -draw * 0.7, rot: aimRot };
      break;
    }
    case "capricorn": {
      // Joyful aqua mermaid tail swish!
      const swish = (Math.sin(t * 3.1) * 10.5 + Math.sin(t * 6.2) * 1.6) * amp;
      parts.back = { px: 20, py: 34, rot: swish };
      break;
    }
    case "aquarius": {
      // Glossy water droplets bobbing & squishing out-of-phase above the jar
      const y1 = Math.sin(t * 2.9) * 5.2 * amp;
      const y2 = Math.sin(t * 2.9 + 1.9) * 4.6 * amp;
      const sq1 = Math.cos(t * 2.9) * 0.06 * amp;
      const sq2 = Math.cos(t * 2.9 + 1.9) * 0.06 * amp;
      parts.left = { px: -14, py: -57, dy: y2, rot: Math.sin(t * 2.1) * 4.5 * amp, sx: 1 - sq2, sy: 1 + sq2 };
      parts.right = { px: 14, py: -60, dy: y1, rot: -Math.sin(t * 2.1 + 1) * 4.5 * amp, sx: 1 - sq1, sy: 1 + sq1 };
      break;
    }
    case "pisces": {
      // Twin koi fish swimming gracefully in gentle opposing waves
      const dx1 = Math.sin(t * 2.2) * 3.6 * amp;
      const dy1 = Math.cos(t * 2.2) * 2.3 * amp;
      const rot1 = Math.sin(t * 3.3) * 3.8 * amp;
      const dx2 = Math.sin(t * 2.2 + Math.PI) * 3.6 * amp;
      const dy2 = Math.cos(t * 2.2 + Math.PI) * 2.3 * amp;
      const rot2 = Math.sin(t * 3.3 + Math.PI) * 3.8 * amp;
      parts.left = { px: 0, py: -22, dx: dx1, dy: dy1, rot: rot1 };
      parts.right = { px: 0, py: 22, dx: dx2, dy: dy2, rot: rot2 };
      eyeGroupOffsets = [
        { dx: dx1, dy: dy1, rot: rot1 * 0.6 },
        { dx: dx2, dy: dy2, rot: rot2 * 0.6 },
      ];
      break;
    }
  }

  return { bodyDx, bodyDy, bodyRot, bodySx, bodySy, parts, eyeGroupOffsets };
}

const DEG = Math.PI / 180;
const BASE_SPLIT = 17.5;
const SVG_NS = "http://www.w3.org/2000/svg";

// Shared global pointer state with instantaneous velocity estimate to damp chaotic mouse shaking
const sharedPointer = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, lastT: 0, active: false };
let pointerListeners = 0;

function onGlobalPointerMove(event: PointerEvent): void {
  if (event.pointerType === "touch") return;
  const now = performance.now();
  if (sharedPointer.active && sharedPointer.lastT > 0) {
    const dtMs = Math.max(4, now - sharedPointer.lastT);
    const instSpeed = (Math.hypot(event.clientX - sharedPointer.x, event.clientY - sharedPointer.y) / dtMs) * 1000;
    sharedPointer.speed = sharedPointer.speed * 0.72 + instSpeed * 0.28;
  }
  sharedPointer.x = event.clientX;
  sharedPointer.y = event.clientY;
  sharedPointer.lastT = now;
  sharedPointer.active = true;
}

function onGlobalPointerLeave(): void {
  sharedPointer.active = false;
}

function retainPointerListener(): () => void {
  if (typeof window === "undefined") return () => {};
  if (pointerListeners === 0) {
    window.addEventListener("pointermove", onGlobalPointerMove, { passive: true });
    document.addEventListener("pointerleave", onGlobalPointerLeave);
  }
  pointerListeners += 1;
  return () => {
    pointerListeners = Math.max(0, pointerListeners - 1);
    if (pointerListeners === 0) {
      window.removeEventListener("pointermove", onGlobalPointerMove);
      document.removeEventListener("pointerleave", onGlobalPointerLeave);
    }
  };
}

type ArcKind = "happy" | "wink" | "asleep" | null;

interface EyeTarget {
  w: number;
  h: number;
  tilt: number;
  arc: ArcKind;
}

interface ExpressionPreset {
  yaw: number;
  pitch: number;
  roll: number;
  splitDelta: number;
  blush?: boolean;
  pair: readonly [EyeTarget, EyeTarget];
  single: EyeTarget;
}

const REST_EYE: EyeTarget = { w: 0.54, h: 0.96, tilt: 0, arc: null };

const EXPRESSION_PRESETS: Readonly<Record<ExpressionId, ExpressionPreset>> = {
  neutre: {
    yaw: 0,
    pitch: 0,
    roll: 0,
    splitDelta: 0,
    pair: [REST_EYE, REST_EYE],
    single: REST_EYE,
  },
  attentif: {
    yaw: 4,
    pitch: 4,
    roll: -4,
    splitDelta: 1.2,
    pair: [
      { w: 0.62, h: 1.05, tilt: 0, arc: null },
      { w: 0.62, h: 1.05, tilt: 0, arc: null },
    ],
    single: { w: 0.62, h: 1.05, tilt: 0, arc: null },
  },
  surpris: {
    yaw: 2,
    pitch: 3,
    roll: 0,
    splitDelta: 2.2,
    pair: [
      { w: 0.78, h: 0.84, tilt: 0, arc: null },
      { w: 0.78, h: 0.84, tilt: 0, arc: null },
    ],
    single: { w: 0.8, h: 0.84, tilt: 0, arc: null },
  },
  excite: {
    yaw: 5,
    pitch: 7,
    roll: 0,
    splitDelta: 2.0,
    blush: true,
    pair: [
      { w: 0.72, h: 1.02, tilt: -7, arc: null },
      { w: 0.72, h: 1.02, tilt: 7, arc: null },
    ],
    single: { w: 0.74, h: 1.0, tilt: -6, arc: null },
  },
  heureux: {
    yaw: 3,
    pitch: 5,
    roll: 0,
    splitDelta: 1.0,
    blush: true,
    pair: [
      { w: 0.66, h: 0.52, tilt: 0, arc: "happy" },
      { w: 0.66, h: 0.52, tilt: 0, arc: "happy" },
    ],
    single: { w: 0.66, h: 0.52, tilt: 0, arc: "happy" },
  },
  hilare: {
    yaw: 3,
    pitch: 8,
    roll: 0,
    splitDelta: 1.4,
    blush: true,
    pair: [
      { w: 0.72, h: 0.48, tilt: 6, arc: "happy" },
      { w: 0.72, h: 0.48, tilt: -6, arc: "happy" },
    ],
    single: { w: 0.72, h: 0.48, tilt: 4, arc: "happy" },
  },
  colere: {
    yaw: 3,
    pitch: 4,
    roll: 0,
    splitDelta: 0.8,
    pair: [
      { w: 0.68, h: 0.5, tilt: 22, arc: null },
      { w: 0.68, h: 0.5, tilt: -22, arc: null },
    ],
    single: { w: 0.68, h: 0.5, tilt: 18, arc: null },
  },
  triste: {
    yaw: 2,
    pitch: -8,
    roll: 0,
    splitDelta: 0.4,
    pair: [
      { w: 0.54, h: 0.86, tilt: -22, arc: null },
      { w: 0.54, h: 0.86, tilt: 22, arc: null },
    ],
    single: { w: 0.56, h: 0.86, tilt: -18, arc: null },
  },
  effraye: {
    yaw: 0,
    pitch: -10,
    roll: 0,
    splitDelta: 2.6,
    pair: [
      { w: 0.74, h: 1.06, tilt: 0, arc: null },
      { w: 0.74, h: 1.06, tilt: 0, arc: null },
    ],
    single: { w: 0.74, h: 1.06, tilt: 0, arc: null },
  },
  mefiant: {
    yaw: 11,
    pitch: 4,
    roll: -6,
    splitDelta: 0.5,
    pair: [
      { w: 0.56, h: 0.96, tilt: 0, arc: null },
      { w: 0.6, h: 0.48, tilt: 0, arc: null },
    ],
    single: { w: 0.6, h: 0.56, tilt: -4, arc: null },
  },
  confus: {
    yaw: -11,
    pitch: 3,
    roll: 10,
    splitDelta: 0.8,
    pair: [
      { w: 0.52, h: 1.0, tilt: -10, arc: null },
      { w: 0.66, h: 0.54, tilt: 10, arc: null },
    ],
    single: { w: 0.64, h: 0.6, tilt: 10, arc: null },
  },
  curieux: {
    yaw: 12,
    pitch: 4,
    roll: -10,
    splitDelta: 1.0,
    pair: [
      { w: 0.62, h: 1.08, tilt: -5, arc: null },
      { w: 0.45, h: 0.76, tilt: -5, arc: null },
    ],
    single: { w: 0.62, h: 1.04, tilt: -6, arc: null },
  },
  fier: {
    yaw: 4,
    pitch: 9,
    roll: 0,
    splitDelta: 1.0,
    blush: true,
    pair: [
      { w: 0.66, h: 0.48, tilt: 14, arc: null },
      { w: 0.66, h: 0.48, tilt: -14, arc: null },
    ],
    single: { w: 0.66, h: 0.48, tilt: 10, arc: null },
  },
  timide: {
    yaw: -14,
    pitch: -9,
    roll: -6,
    splitDelta: -1.4,
    blush: true,
    pair: [
      { w: 0.48, h: 0.78, tilt: 0, arc: null },
      { w: 0.48, h: 0.78, tilt: 0, arc: null },
    ],
    single: { w: 0.48, h: 0.78, tilt: 0, arc: null },
  },
  blase: {
    yaw: -15,
    pitch: 0,
    roll: 0,
    splitDelta: 0.4,
    pair: [
      { w: 0.64, h: 0.42, tilt: 0, arc: null },
      { w: 0.64, h: 0.42, tilt: 0, arc: null },
    ],
    single: { w: 0.64, h: 0.42, tilt: 0, arc: null },
  },
  somnolent: {
    yaw: 4,
    pitch: -8,
    roll: -3,
    splitDelta: 0,
    pair: [
      { w: 0.54, h: 0.44, tilt: 0, arc: null },
      { w: 0.54, h: 0.44, tilt: 0, arc: null },
    ],
    single: { w: 0.54, h: 0.44, tilt: 0, arc: null },
  },
};

function rot2(
  u: [number, number, number],
  v: [number, number, number],
  rad: number,
): [[number, number, number], [number, number, number]] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s],
  ];
}

interface ProjectedEye {
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
  d: number;
  depth: number;
}

function projectSphereEyes(
  yawDeg: number,
  pitchDeg: number,
  rollDeg: number,
  radius: number,
  splitDeg: number,
  sides: readonly number[],
): ProjectedEye[] {
  let F: [number, number, number] = [0, 0, 1];
  let U: [number, number, number] = [1, 0, 0];
  let V: [number, number, number] = [0, 1, 0];
  [F, U] = rot2(F, U, yawDeg * DEG);
  [V, F] = rot2(V, F, pitchDeg * DEG);
  [U, V] = rot2(U, V, rollDeg * DEG);
  return sides.map((side) => {
    const [pos, tx] = rot2(F, U, splitDeg * side * DEG);
    return {
      x: pos[0] * radius,
      y: pos[1] * radius,
      a: tx[0],
      b: tx[1],
      c: V[0],
      d: V[1],
      depth: pos[2],
    };
  });
}

function wave(t: number, period: number, phase: number): number {
  return Math.sin((t / period) * Math.PI * 2 + phase);
}

interface EyeGroup {
  gId: number;
  isPair: boolean;
  cx: number;
  cy: number;
  R: number;
  sides: readonly number[];
  eyes: readonly ZodiacEyeSpec[];
}

function buildEyeGroups(meta: ZodiacAvatarMeta): EyeGroup[] {
  const byGroup = new Map<number, ZodiacEyeSpec[]>();
  for (const eye of meta.eyes) {
    const list = byGroup.get(eye.group) ?? [];
    list.push(eye);
    byGroup.set(eye.group, list);
  }
  const groups: EyeGroup[] = [];
  for (const [gId, list] of byGroup) {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    if (sorted.length >= 2) {
      const e0 = sorted[0]!;
      const e1 = sorted[1]!;
      const cx = (e0.x + e1.x) * 50;
      const cy = (e0.y + e1.y) * 50;
      const halfDist = Math.max(4, Math.abs(e1.x - e0.x) * 50);
      groups.push({
        gId,
        isPair: true,
        cx,
        cy,
        R: halfDist / Math.sin(BASE_SPLIT * DEG),
        sides: [-1, 1],
        eyes: sorted,
      });
    } else {
      const e0 = sorted[0]!;
      groups.push({
        gId,
        isPair: false,
        cx: e0.x * 100,
        cy: e0.y * 100,
        R: 15.5,
        sides: [0],
        eyes: sorted,
      });
    }
  }
  return groups;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

function computeBodyTintFilter(customColor: string | null | undefined, baseHue: number): string | undefined {
  if (!customColor) return undefined;
  const hsl = hexToHsl(customColor);
  if (!hsl) return undefined;
  if (hsl.s < 0.14) return "grayscale(1) brightness(1.06)";
  const delta = Math.round(((hsl.h - baseHue + 540) % 360) - 180);
  if (hsl.s < 0.42 && hsl.l > 0.62) {
    return `hue-rotate(${delta}deg) saturate(0.58) brightness(1.06)`;
  }
  const sat = hsl.l < 0.42 ? 1.15 : 1.04;
  const bri = hsl.l < 0.42 ? 0.86 : 1.0;
  return `hue-rotate(${delta}deg) saturate(${sat}) brightness(${bri})`;
}

export type ZodiacCuteEmote =
  | "jelly-tilt"
  | "starry-eyes"
  | "shy-peek"
  | "sleepy-bubble"
  | "dizzy-swirl"
  | "music-groove"
  | "curious-peek"
  | "combo-hearts";

interface EyeDomNode {
  grp: EyeGroup;
  gIdx: number;
  localIdx: number;
  eye: ZodiacEyeSpec;
  unit: number;
  g: SVGGElement;
  openG: SVGGElement;
  sh: SVGRectElement;
  body: SVGRectElement;
  g1: SVGCircleElement;
  g2: SVGCircleElement;
  arc: SVGPathElement;
  star: SVGPathElement;
  swirl: SVGPathElement;
  curW: number;
  curH: number;
  curTilt: number;
}

interface CheekDomNode {
  el: SVGEllipseElement;
  gIdx: number;
  baseCx: number;
  baseCy: number;
}

export interface ZodiacClayAvatarProps {
  shape: SupportedAvatarSilhouetteId;
  expression?: ExpressionId | undefined;
  state?: PlushState | undefined;
  cuteEmote?: ZodiacCuteEmote | null | undefined;
  customColor?: string | null | undefined;
  follow?: boolean | undefined;
  hoverFollow?: boolean | undefined;
  paused?: boolean | undefined;
  frozenAt?: number | undefined;
  initialPhase?: number | undefined;
  eyeScale?: number | undefined;
  ariaLabel?: string | undefined;
  class?: string | undefined;
  style?: JSX.CSSProperties | Record<string, string> | undefined;
}

export function ZodiacClayAvatar(props: ZodiacClayAvatarProps): JSX.Element {
  const uid = `zc-${createUniqueId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  let svgEl: SVGSVGElement | undefined;
  let rigGroup: SVGGElement | undefined;
  let partBackG: SVGGElement | undefined;
  let partLeftG: SVGGElement | undefined;
  let partRightG: SVGGElement | undefined;
  let partBaseG: SVGGElement | undefined;
  let partTopG: SVGGElement | undefined;
  let cheeksLayer: SVGGElement | undefined;
  let eyesLayer: SVGGElement | undefined;
  let thinkingGroup: SVGGElement | undefined;
  let asleepGroup: SVGGElement | undefined;
  let wideGroup: SVGGElement | undefined;
  let notifyGroup: SVGGElement | undefined;
  let dot0: SVGCircleElement | undefined;
  let dot1: SVGCircleElement | undefined;
  let dot2: SVGCircleElement | undefined;
  let z1El: SVGTextElement | undefined;
  let z2El: SVGTextElement | undefined;
  let spk1El: SVGPathElement | undefined;
  let spk2El: SVGPathElement | undefined;
  let petPopGroup: SVGGElement | undefined;
  let petHeartEl: SVGTextElement | undefined;
  let petNoteEl: SVGTextElement | undefined;
  // 8 approved cute animation SVG effect layers (pre-mounted, zero per-frame allocations)
  let auraCircleEl: SVGCircleElement | undefined;
  let grooveRing1El: SVGCircleElement | undefined;
  let grooveRing2El: SVGCircleElement | undefined;
  let jellySparkleEl: SVGPathElement | undefined;
  let starryMote0El: SVGPathElement | undefined;
  let starryMote1El: SVGPathElement | undefined;
  let starryMote2El: SVGPathElement | undefined;
  let shyGroupEl: SVGGElement | undefined;
  let shyHeartEl: SVGTextElement | undefined;
  let sleepBubbleGroupEl: SVGGElement | undefined;
  let sleepBubbleCircleEl: SVGCircleElement | undefined;
  let sleepBubbleGlintEl: SVGEllipseElement | undefined;
  let sleepBubblePopEl: SVGGElement | undefined;
  let dizzyGroupEl: SVGGElement | undefined;
  let dizzyStar0El: SVGPathElement | undefined;
  let dizzyStar1El: SVGPathElement | undefined;
  let dizzyStar2El: SVGPathElement | undefined;
  let grooveNotesGroupEl: SVGGElement | undefined;
  let grooveNote1El: SVGTextElement | undefined;
  let grooveNote2El: SVGTextElement | undefined;
  let curiousGlassEl: SVGGElement | undefined;
  let comboGroupEl: SVGGElement | undefined;
  let comboP0El: SVGTextElement | undefined;
  let comboP1El: SVGTextElement | undefined;
  let comboP2El: SVGTextElement | undefined;
  let comboP3El: SVGTextElement | undefined;
  let comboP4El: SVGTextElement | undefined;
  let longHoverTimer: ReturnType<typeof setTimeout> | undefined;

  const meta = createMemo(() => zodiacForShape(props.shape));
  const parts = createMemo(() => ZODIAC_PARTS[meta().id]);
  const bodyFilter = createMemo(() => computeBodyTintFilter(props.customColor, meta().baseHue));
  const eyeScaleFactor = createMemo(() => {
    const raw = props.eyeScale ?? 1;
    return Math.min(1.12, Math.max(0.85, raw));
  });

  let groups: EyeGroup[] = [];
  let eyeNodes: EyeDomNode[] = [];
  let cheekNodes: CheekDomNode[] = [];

  const anim = {
    yaw: 0,
    pitch: 0,
    roll: 0,
    splitDelta: 0,
    near: 0,
    smoothNx: 0,
    smoothNy: 0,
    phase: (props.initialPhase ?? 0) * 2.1,
    rectCx: 0,
    rectCy: 0,
    rectW: 0,
    rectH: 0,
    rectAt: 0,
    blinkOpen: 1,
    blinkStart: null as number | null,
    nextBlink: 0,
    doubleBlinkPending: false,
    seedPhase: (props.initialPhase ?? 0) * 2.1,
    initialized: false,
    pokeAt: 0,
    perkAt: 0,
    purrActive: false,
    purrAt: 0,
    shyActive: false,
    shyAt: 0,
    hoverReactionCount: 0,
    pokeCombo: 0,
    comboUntil: 0,
    dizzyUntil: 0,
    lastDizzySoundAt: 0,
    bubblePopAt: 0,
    autoIdleEmote: null as ZodiacCuteEmote | null,
    autoIdleUntil: 0,
    nextAutoIdleAt: 0,
    lastUserInteractionAt: 0,
  };

  function rebuildEyesDom(currentMeta: ZodiacAvatarMeta): void {
    if (!cheeksLayer || !eyesLayer) return;
    cheeksLayer.replaceChildren();
    eyesLayer.replaceChildren();
    groups = buildEyeGroups(currentMeta);
    eyeNodes = [];
    cheekNodes = [];

    groups.forEach((grp, gIdx) => {
      grp.eyes.forEach((eye, localIdx) => {
        const unit = eye.scale * 114;
        const cheek = document.createElementNS(SVG_NS, "ellipse");
        const sideSign = grp.isPair ? (localIdx === 0 ? -1 : 1) : eye.x >= 0 ? 1 : -1;
        const baseCx = eye.x * 100 + sideSign * unit * 0.45;
        const baseCy = eye.y * 100 + unit * 0.85;
        cheek.setAttribute("cx", baseCx.toFixed(1));
        cheek.setAttribute("cy", baseCy.toFixed(1));
        cheek.setAttribute("rx", (unit * 0.62).toFixed(1));
        cheek.setAttribute("ry", (unit * 0.36).toFixed(1));
        cheek.setAttribute("fill", `url(#${uid}-cheek)`);
        cheek.setAttribute("opacity", "0");
        cheeksLayer?.appendChild(cheek);
        cheekNodes.push({ el: cheek, gIdx, baseCx, baseCy });

        const g = document.createElementNS(SVG_NS, "g");
        const openG = document.createElementNS(SVG_NS, "g");
        const sh = document.createElementNS(SVG_NS, "rect");
        sh.setAttribute("fill", "#231926");
        sh.setAttribute("opacity", "0.26");
        sh.setAttribute("filter", `url(#${uid}-sh)`);

        const body = document.createElementNS(SVG_NS, "rect");
        body.setAttribute("fill", `url(#${uid}-eye)`);

        const g1 = document.createElementNS(SVG_NS, "circle");
        g1.setAttribute("fill", "#fffdf9");
        g1.setAttribute("opacity", "0.96");

        const g2 = document.createElementNS(SVG_NS, "circle");
        g2.setAttribute("fill", "#fffdf9");
        g2.setAttribute("opacity", "0.52");

        openG.appendChild(sh);
        openG.appendChild(body);
        openG.appendChild(g1);
        openG.appendChild(g2);

        const arc = document.createElementNS(SVG_NS, "path");
        arc.setAttribute("fill", "none");
        arc.setAttribute("stroke", "#231c29");
        arc.setAttribute("stroke-linecap", "round");
        arc.setAttribute("opacity", "0");

        const star = document.createElementNS(SVG_NS, "path");
        star.setAttribute(
          "d",
          "M0 -10 C1.8 -3 3 -1.8 10 0 C3 1.8 1.8 3 0 10 C-1.8 3 -3 1.8 -10 0 C-3 -1.8 -1.8 -3 0 -10 Z",
        );
        star.setAttribute("fill", "#ffe45e");
        star.setAttribute("stroke", "#fff8d6");
        star.setAttribute("stroke-width", "0.9");
        star.setAttribute("opacity", "0");

        const swirl = document.createElementNS(SVG_NS, "path");
        swirl.setAttribute("d", "M0 0 C2 -3 6 -2 6 2 C6 7 -1 9 -6 6 C-11 3 -10 -6 -4 -9 C3 -12 11 -7 11 1");
        swirl.setAttribute("fill", "none");
        swirl.setAttribute("stroke", "#241b2c");
        swirl.setAttribute("stroke-width", "2.6");
        swirl.setAttribute("stroke-linecap", "round");
        swirl.setAttribute("opacity", "0");

        g.appendChild(openG);
        g.appendChild(arc);
        g.appendChild(star);
        g.appendChild(swirl);
        eyesLayer?.appendChild(g);

        eyeNodes.push({
          grp,
          gIdx,
          localIdx,
          eye,
          unit,
          g,
          openG,
          sh,
          body,
          g1,
          g2,
          arc,
          star,
          swirl,
          curW: REST_EYE.w,
          curH: REST_EYE.h,
          curTilt: eye.tilt,
        });
      });
    });
    anim.initialized = false;
  }

  function renderFrame(now: number, dt: number, snap: boolean): void {
    const state: PlushState = props.state ?? "idle";
    const exprId: ExpressionId = props.expression ?? "neutre";
    const preset = EXPRESSION_PRESETS[exprId] ?? EXPRESSION_PRESETS.neutre;
    const tSec = now * 0.001 + anim.seedPhase;
    // Plush, weighty spring smoothing: absorbs fast mouse jitter without feeling laggy
    const easePointer = snap ? 1 : 1 - Math.exp(-dt / 145);
    const easeGaze = snap ? 1 : 1 - Math.exp(-dt / 115);
    const easeShape = snap ? 1 : 1 - Math.exp(-dt / 110);
    const easeNear = snap ? 1 : 1 - Math.exp(-dt / 220);
    const scaleMul = eyeScaleFactor();

    // Decay global pointer speed when mouse stops moving
    if (sharedPointer.lastT > 0 && now - sharedPointer.lastT > 48) {
      sharedPointer.speed *= Math.exp(-dt / 90);
    }

    const trackPointer = !snap && (props.follow === true || props.hoverFollow === true);
    let tYaw = preset.yaw;
    let tPitch = preset.pitch;
    let tRoll = preset.roll;
    let tSplit = preset.splitDelta;
    let tNear = 0;

    if (state === "thinking") {
      tYaw = 22 + (snap ? 0 : Math.sin(tSec * 1.9) * 5.2);
      tPitch = 17 + (snap ? 0 : Math.cos(tSec * 1.5) * 3.4);
      tRoll = -6 + (snap ? 0 : Math.sin(tSec * 1.3) * 1.8);
      tSplit = 0.5;
    } else if (state === "asleep") {
      tYaw = snap ? 0 : wave(tSec, 11.3, 0.4) * 1.4;
      tPitch = -10;
      tRoll = -2;
      tSplit = 0;
    } else if (state === "failed") {
      tYaw = snap ? 0 : Math.sin(tSec * 12) * 11;
      tPitch = -7;
      tRoll = 0;
      tSplit = 0.4;
    } else {
      const wanderAmp = snap ? 0 : trackPointer && sharedPointer.active ? 0.25 : 0.7;
      const wYaw = (wave(tSec, 11.3, 0.4) * 4.8 + wave(tSec, 3.7, 2.1) * 1.4) * wanderAmp;
      const wPitch = (wave(tSec, 9.1, 1.3) * 3.4 + wave(tSec, 4.3, 0.7) * 1.0) * wanderAmp;
      const wRoll = wave(tSec, 13.7, 3.2) * 1.8 * wanderAmp;

      if (trackPointer && sharedPointer.active && svgEl) {
        if (anim.rectW <= 0 || now - anim.rectAt > 120) {
          const b = svgEl.getBoundingClientRect();
          anim.rectW = b.width;
          anim.rectH = b.height;
          anim.rectCx = b.left + b.width / 2;
          anim.rectCy = b.top + b.height / 2;
          anim.rectAt = now;
        }
        if (anim.rectW > 0 && anim.rectH > 0) {
          const dx = sharedPointer.x - anim.rectCx;
          const dy = sharedPointer.y - anim.rectCy;
          const rangeX = Math.max(180, anim.rectW * 1.45);
          const rangeY = Math.max(180, anim.rectH * 1.45);
          // Damp chaotic rapid mouse shaking (> 900 px/s) so eyes glide calmly instead of vibrating
          const shakeDamp = 1 / (1 + Math.max(0, sharedPointer.speed - 450) / 1100);
          const rawNx = Math.max(-1, Math.min(1, dx / rangeX)) * shakeDamp;
          const rawNy = Math.max(-1, Math.min(1, dy / rangeY)) * shakeDamp;
          anim.smoothNx += (rawNx - anim.smoothNx) * easePointer;
          anim.smoothNy += (rawNy - anim.smoothNy) * easePointer;

          const faceR = Math.max(80, anim.rectW * 0.85);
          const dist = Math.hypot(dx, dy);
          tNear = Math.max(0, 1 - dist / faceR) * shakeDamp;
          const yawGain = props.hoverFollow ? 24 : 22;
          const pitchGain = props.hoverFollow ? 17 : 15;
          tYaw = preset.yaw * 0.35 + anim.smoothNx * yawGain + wYaw;
          tPitch = preset.pitch * 0.35 - anim.smoothNy * pitchGain + wPitch;
          tRoll = preset.roll + anim.smoothNx * anim.smoothNy * -4.5 - anim.smoothNx * tNear * 2.5 + wRoll;
        }
      } else {
        anim.smoothNx += (0 - anim.smoothNx) * easePointer;
        anim.smoothNy += (0 - anim.smoothNy) * easePointer;
        tYaw = preset.yaw + wYaw;
        tPitch = preset.pitch + wPitch;
        tRoll = preset.roll + wRoll;
      }

      if (state === "wink") {
        tRoll -= 7;
        tSplit += 1.2;
      } else if (state === "wide") {
        tSplit += 2.4;
        tPitch += 3;
      }
    }

    anim.yaw += (tYaw - anim.yaw) * easeGaze;
    anim.pitch += (tPitch - anim.pitch) * easeGaze;
    anim.roll += (tRoll - anim.roll) * easeGaze;
    anim.splitDelta += (tSplit - anim.splitDelta) * easeShape;
    anim.near += (tNear - anim.near) * easeNear;

    // Monotonic phase integration: changing speed smoothly alters rate without EVER jumping phase!
    const isHappy = exprId === "heureux" || exprId === "excite" || exprId === "hilare" || state === "wink";
    const phaseRate =
      state === "asleep"
        ? 0.45
        : isHappy
          ? 1.28
          : state === "wide"
            ? 1.2
            : state === "thinking"
              ? 1.12
              : 1 + anim.near * 0.18;
    if (!snap) {
      anim.phase += dt * 0.001 * phaseRate;
    }

    // Articulated body breathing & zodiac-specific moving limbs/tails/accessories!
    const pokeElapsed = anim.pokeAt > 0 ? now - anim.pokeAt : 99999;
    const perkElapsed = anim.perkAt > 0 ? now - anim.perkAt : 99999;
    const isPoked = !snap && pokeElapsed < 620;
    const isPerked = !snap && !isPoked && perkElapsed < 340;
    const isPetting = !snap && (isPoked || anim.purrActive);
    const largeEnoughForFx = !snap && (anim.rectW === 0 || anim.rectW >= 34);

    // Trigger dizzy-swirl automatically if the user rapidly shakes the mouse right over a medium/large mascot!
    if (
      largeEnoughForFx &&
      sharedPointer.active &&
      sharedPointer.speed > 1250 &&
      anim.near > 0.55 &&
      state === "idle" &&
      now > anim.dizzyUntil - 600
    ) {
      anim.dizzyUntil = now + 2_200;
      if (now - anim.lastDizzySoundAt > 2_600) {
        anim.lastDizzySoundAt = now;
        void playKawaiiCue("mascot-dizzy", { zodiac: meta().id, subtle: true });
      }
    }

    // Gentle autonomous idle cute moments on medium/large idle mascots (jelly-tilt, shy-peek, sleepy-bubble)
    if (largeEnoughForFx && state === "idle" && !props.cuteEmote && !isPoked && !anim.purrActive && !anim.shyActive) {
      if (anim.lastUserInteractionAt === 0) anim.lastUserInteractionAt = now;
      if (anim.nextAutoIdleAt === 0) anim.nextAutoIdleAt = now + 6_500 + Math.random() * 5_500;
      if (now >= anim.nextAutoIdleAt && now > anim.autoIdleUntil) {
        const idleSince = now - anim.lastUserInteractionAt;
        if (idleSince > 24_000 && Math.random() < 0.42) {
          anim.autoIdleEmote = "sleepy-bubble";
          anim.autoIdleUntil = now + 4_600;
        } else if (Math.random() < 0.65) {
          anim.autoIdleEmote = "jelly-tilt";
          anim.autoIdleUntil = now + 2_600;
        } else {
          anim.autoIdleEmote = "shy-peek";
          anim.autoIdleUntil = now + 2_600;
        }
        anim.nextAutoIdleAt = anim.autoIdleUntil + 7_500 + Math.random() * 7_500;
      }
    } else if (state !== "idle") {
      anim.autoIdleEmote = null;
      anim.autoIdleUntil = 0;
    }

    // Resolve active cute emote across all 8 approved animations
    let activeEmote: ZodiacCuteEmote | null = null;
    if (!snap) {
      if (now < anim.comboUntil) activeEmote = "combo-hearts";
      else if (now < anim.dizzyUntil || state === "failed") activeEmote = "dizzy-swirl";
      else if (props.cuteEmote) activeEmote = props.cuteEmote;
      else if (anim.shyActive || exprId === "timide") activeEmote = "shy-peek";
      else if (state === "asleep" || exprId === "somnolent") activeEmote = "sleepy-bubble";
      else if (exprId === "excite" || exprId === "hilare") activeEmote = "starry-eyes";
      else if (isPerked) activeEmote = "jelly-tilt";
      else if (now < anim.autoIdleUntil && anim.autoIdleEmote) activeEmote = anim.autoIdleEmote;
    }

    const rig = computeRigPoses(
      meta().id,
      anim.phase,
      tSec,
      state,
      isPetting || activeEmote === "combo-hearts" || activeEmote === "music-groove" ? "heureux" : exprId,
      Math.max(anim.near, isPetting ? 0.85 : 0),
      snap,
    );

    let extraDx = 0;
    let extraDy = 0;
    let extraRot = 0;
    let extraSx = 1;
    let extraSy = 1;
    if (activeEmote === "combo-hearts") {
      const hop = Math.abs(Math.sin(tSec * 7.2));
      extraDy = -hop * 16;
      extraRot = Math.sin(tSec * 7.2) * 8.5;
      extraSx = 1 + (1 - hop) * 0.13;
      extraSy = 1 - (1 - hop) * 0.11;
    } else if (activeEmote === "dizzy-swirl") {
      extraDx = Math.sin(tSec * 4.4) * 6.5;
      extraDy = Math.sin(tSec * 8.8) * 3;
      extraRot = Math.sin(tSec * 4.4) * 11;
    } else if (activeEmote === "music-groove") {
      const beat = tSec * 4.0 * Math.PI;
      const bounce = Math.abs(Math.sin(beat * 0.5));
      extraDy = -bounce * 9.5;
      extraRot = Math.sin(beat * 0.25) * 10;
      extraSx = 1 + (1 - bounce) * 0.085;
      extraSy = 1 - (1 - bounce) * 0.075;
    } else if (activeEmote === "curious-peek") {
      const lean = 0.5 + 0.5 * Math.sin(tSec * 2.2);
      const sc = 1.05 + lean * 0.08;
      extraSx = sc;
      extraSy = sc;
      extraDy = -lean * 5;
      extraRot = -6.5 + Math.sin(tSec * 2.2) * 5.5;
    } else if (activeEmote === "starry-eyes") {
      extraDy = -2.5 - Math.abs(Math.sin(tSec * 3.8)) * 5.5;
      extraRot = Math.sin(tSec * 3.8) * 4;
      extraSx = 1 - Math.sin(tSec * 7.6) * 0.03;
      extraSy = 1 + Math.sin(tSec * 7.6) * 0.03;
    } else if (activeEmote === "shy-peek") {
      const sway = Math.sin(tSec * 2.0);
      extraDy = 7.5 + Math.sin(tSec * 4.0) * 1.8;
      extraDx = sway * 4.2;
      extraRot = sway * 7.5;
      extraSx = 1.04;
      extraSy = 0.94;
    } else if (activeEmote === "sleepy-bubble") {
      const popElapsed = anim.bubblePopAt > 0 ? now - anim.bubblePopAt : 99999;
      if (popElapsed < 420) {
        const u = popElapsed / 420;
        extraDy = -13 * Math.sin(u * Math.PI);
        extraSx = 1 - 0.07 * Math.sin(u * Math.PI);
        extraSy = 1 + 0.09 * Math.sin(u * Math.PI);
      } else {
        const breath = Math.sin(tSec * 1.9);
        extraDy = 3.5 + breath * 2.8;
        extraRot = -4.5 + Math.sin(tSec * 1.1) * 2.5;
        extraSx = 1.02 - breath * 0.022;
        extraSy = 0.98 + breath * 0.022;
      }
    } else if (activeEmote === "jelly-tilt") {
      const cyc = (tSec * 0.65) % 1;
      const wobble = Math.sin(cyc * Math.PI * 5) * Math.exp(-cyc * 2.2);
      extraRot = Math.sin(tSec * 2.4) * 12.5 + wobble * 5.5;
      extraSx = 1 + wobble * 0.11 + Math.sin(tSec * 4.8) * 0.025;
      extraSy = 1 - wobble * 0.11 - Math.sin(tSec * 4.8) * 0.025;
      extraDy = -Math.abs(Math.sin(tSec * 2.4)) * 5.5;
    } else if (isPoked) {
      const u = pokeElapsed / 620;
      const bounce = Math.sin(u * Math.PI) * (1 - u * 0.35);
      extraDy = -16 * bounce;
      extraSx = 1 + Math.sin(u * Math.PI * 3) * 0.09 * (1 - u);
      extraSy = 1 - Math.sin(u * Math.PI * 3) * 0.09 * (1 - u);
      extraRot = Math.sin(u * Math.PI * 2) * 6.5 * (1 - u);
    } else if (anim.purrActive) {
      extraDy = Math.sin(tSec * 4.2) * 2.2;
      extraRot = Math.sin(tSec * 3.1) * 4.2;
      extraSx = 1 + Math.sin(tSec * 6.4) * 0.022;
      extraSy = 1 - Math.sin(tSec * 6.4) * 0.022;
    }

    if (rigGroup) {
      if (snap) {
        rigGroup.removeAttribute("transform");
      } else {
        rigGroup.setAttribute(
          "transform",
          `translate(${(rig.bodyDx + extraDx).toFixed(2)},${(42 + rig.bodyDy + extraDy).toFixed(2)}) rotate(${(rig.bodyRot + extraRot).toFixed(2)}) scale(${(rig.bodySx * extraSx).toFixed(4)},${(rig.bodySy * extraSy).toFixed(4)}) translate(0,-42)`,
        );
      }
    }
    const applySlot = (el: SVGGElement | undefined, slot: PartSlot) => {
      if (!el) return;
      const tf = formatPartTransform(rig.parts[slot]);
      if (tf) el.setAttribute("transform", tf);
      else el.removeAttribute("transform");
    };
    applySlot(partBackG, "back");
    applySlot(partLeftG, "left");
    applySlot(partRightG, "right");
    applySlot(partBaseG, "base");
    applySlot(partTopG, "top");

    // Natural blink with 18% double-blink chance
    const canBlink = !snap && (state === "idle" || state === "thinking" || state === "wide" || state === "notify");
    if (canBlink) {
      if (anim.nextBlink === 0) anim.nextBlink = now + 1200 + Math.random() * 2600;
      if (anim.blinkStart === null && now >= anim.nextBlink) anim.blinkStart = now;
      if (anim.blinkStart !== null) {
        const p = (now - anim.blinkStart) / 175;
        if (p >= 1) {
          anim.blinkStart = null;
          anim.blinkOpen = 1;
          if (anim.doubleBlinkPending) {
            anim.doubleBlinkPending = false;
            anim.nextBlink = now + 2200 + Math.random() * 3200;
          } else if (Math.random() < 0.18) {
            anim.doubleBlinkPending = true;
            anim.nextBlink = now + 180;
          } else {
            anim.nextBlink = now + 2100 + Math.random() * 3000;
          }
        } else {
          anim.blinkOpen = p < 0.45 ? 1 - (p / 0.45) * 0.92 : 0.08 + ((p - 0.45) / 0.55) * 0.92;
        }
      }
    } else {
      anim.blinkOpen = 1;
      anim.blinkStart = null;
    }

    const showBlush =
      state === "wink" ||
      preset.blush === true ||
      isPetting ||
      activeEmote === "jelly-tilt" ||
      activeEmote === "starry-eyes" ||
      activeEmote === "shy-peek" ||
      activeEmote === "music-groove" ||
      activeEmote === "combo-hearts";
    for (let k = 0; k < cheekNodes.length; k += 1) {
      const ck = cheekNodes[k];
      if (!ck) continue;
      ck.el.setAttribute("opacity", showBlush ? "1" : "0");
      const grpOff = rig.eyeGroupOffsets?.[ck.gIdx];
      ck.el.setAttribute("cx", (ck.baseCx + (grpOff?.dx ?? 0)).toFixed(1));
      ck.el.setAttribute("cy", (ck.baseCy + (grpOff?.dy ?? 0)).toFixed(1));
    }

    let nodeIdx = 0;
    for (let gIdx = 0; gIdx < groups.length; gIdx += 1) {
      const grp = groups[gIdx]!;
      const grpOff = rig.eyeGroupOffsets?.[gIdx];
      const proj = projectSphereEyes(anim.yaw, anim.pitch, anim.roll, grp.R, BASE_SPLIT + anim.splitDelta, grp.sides);
      for (let li = 0; li < grp.eyes.length; li += 1) {
        const node = eyeNodes[nodeIdx++];
        const pr = proj[li];
        if (!node || !pr) continue;

        let tw = REST_EYE.w;
        let th = REST_EYE.h;
        let tt = node.eye.tilt;
        let arcType: ArcKind = null;
        let showStarEye = false;
        let showSwirlEye = false;

        if (activeEmote === "dizzy-swirl") {
          showSwirlEye = true;
        } else if (activeEmote === "combo-hearts" || activeEmote === "music-groove") {
          arcType = "happy";
        } else if (activeEmote === "sleepy-bubble") {
          const popElapsed = anim.bubblePopAt > 0 ? now - anim.bubblePopAt : 99999;
          if (popElapsed < 420) {
            tw = 0.78;
            th = 0.88;
            tt = 0;
          } else {
            arcType = "asleep";
          }
        } else if (activeEmote === "starry-eyes") {
          tw = 0.68;
          th = 0.96;
          tt = 0;
          showStarEye = true;
        } else if (activeEmote === "curious-peek") {
          const isBig = grp.isPair ? li === 0 : node.gIdx === 0;
          tw = isBig ? 0.74 : 0.54;
          th = isBig ? 1.04 : 0.62;
          tt = isBig ? -3 : 6;
        } else if (activeEmote === "shy-peek") {
          tw = 0.5;
          th = 0.78;
          tt = node.eye.tilt;
        } else if (state === "asleep") {
          arcType = "asleep";
        } else if (state === "wink") {
          const isWinkEye = grp.isPair ? li === 1 : node.gIdx === 1;
          if (isWinkEye) {
            arcType = "wink";
          } else {
            tw = 0.62;
            th = 1.04;
            tt = node.eye.tilt - 3;
          }
        } else if (state === "wide") {
          const shimmer = snap ? 0 : Math.sin(tSec * 7.5) * 0.022;
          tw = 0.8 + shimmer;
          th = 0.86 + shimmer;
          tt = 0;
        } else if (state === "thinking") {
          const isRight = grp.isPair ? li === 1 : node.gIdx === 1;
          const pulse = snap ? 0 : Math.sin(tSec * 3.8) * 0.032;
          if (isRight) {
            tw = 0.62 + pulse;
            th = 0.62 + pulse;
            tt = -7;
          } else {
            tw = 0.48;
            th = 0.96 - pulse * 0.35;
            tt = 6;
          }
        } else if (state === "failed") {
          const sign = grp.isPair ? (li === 0 ? -1 : 1) : -1;
          tw = 0.56;
          th = 0.82;
          tt = sign * 22;
        } else {
          const spec = grp.isPair ? preset.pair[li]! : preset.single;
          tw = spec.w;
          th = spec.h;
          tt = node.eye.tilt + spec.tilt;
          arcType = isPetting ? "happy" : spec.arc;

          if (!arcType && anim.near > 0.01) {
            tw *= 1 + anim.near * 0.07;
            th *= 1 + anim.near * 0.05;
          }
        }

        if (snap || !anim.initialized) {
          node.curW = tw;
          node.curH = th;
          node.curTilt = tt;
        } else {
          node.curW += (tw - node.curW) * easeShape;
          node.curH += (th - node.curH) * easeShape;
          node.curTilt += (tt - node.curTilt) * easeShape;
        }

        const depthClamped = Math.max(0.15, pr.depth);
        const persp = (0.76 + 0.28 * depthClamped) * scaleMul;
        const tRad = -(node.curTilt + (grpOff?.rot ?? 0)) * DEG;
        const ct = Math.cos(tRad);
        const st = Math.sin(tRad);

        const ma = (pr.a * ct + pr.c * st) * persp;
        const mb = (pr.b * ct + pr.d * st) * persp;
        const mc = (-pr.a * st + pr.c * ct) * persp;
        const md = (-pr.b * st + pr.d * ct) * persp;
        const tx = grp.cx + pr.x + (grpOff?.dx ?? 0);
        const ty = grp.cy + pr.y + (grpOff?.dy ?? 0);

        node.g.setAttribute(
          "transform",
          `matrix(${ma.toFixed(4)},${mb.toFixed(4)},${mc.toFixed(4)},${md.toFixed(4)},${tx.toFixed(2)},${ty.toFixed(2)})`,
        );
        node.g.setAttribute("opacity", Math.min(1, Math.max(0, pr.depth / 0.14)).toFixed(3));

        if (showSwirlEye) {
          node.openG.setAttribute("opacity", "0");
          node.arc.setAttribute("opacity", "0");
          node.star.setAttribute("opacity", "0");
          node.swirl.setAttribute("opacity", "1");
          const sc = (node.unit / 23).toFixed(2);
          const rot = (tSec * 330 * (li % 2 === 0 ? 1 : -1)).toFixed(0);
          node.swirl.setAttribute("transform", `rotate(${rot}) scale(${sc})`);
        } else if (arcType) {
          node.openG.setAttribute("opacity", "0");
          node.star.setAttribute("opacity", "0");
          node.swirl.setAttribute("opacity", "0");
          node.arc.setAttribute("opacity", "1");
          const aw = node.unit * 0.36;
          const strokeW = node.unit * 0.148;
          let ay = 0;
          let qy = 0;
          if (arcType === "asleep") {
            ay = -aw * 0.12;
            qy = aw * 0.72;
          } else if (arcType === "happy") {
            ay = aw * 0.24;
            qy = -aw * 0.78;
          } else {
            ay = aw * 0.18;
            qy = -aw * 0.62;
          }
          node.arc.setAttribute(
            "d",
            `M ${(-aw).toFixed(2)} ${ay.toFixed(2)} Q 0 ${qy.toFixed(2)} ${aw.toFixed(2)} ${ay.toFixed(2)}`,
          );
          node.arc.setAttribute("stroke-width", strokeW.toFixed(2));
        } else {
          node.openG.setAttribute("opacity", "1");
          node.arc.setAttribute("opacity", "0");
          node.swirl.setAttribute("opacity", "0");

          const open = showStarEye ? 1 : anim.blinkOpen;
          const ew = node.unit * node.curW * (1 + (1 - open) * 0.12);
          const eh = Math.max(node.unit * 0.11, node.unit * node.curH * open);
          const rx = Math.min(ew, eh) / 2;

          node.body.setAttribute("x", (-ew / 2).toFixed(2));
          node.body.setAttribute("y", (-eh / 2).toFixed(2));
          node.body.setAttribute("width", ew.toFixed(2));
          node.body.setAttribute("height", eh.toFixed(2));
          node.body.setAttribute("rx", rx.toFixed(2));

          node.sh.setAttribute("x", (-ew / 2 + 0.45).toFixed(2));
          node.sh.setAttribute("y", (-eh / 2 + 1.35).toFixed(2));
          node.sh.setAttribute("width", ew.toFixed(2));
          node.sh.setAttribute("height", eh.toFixed(2));
          node.sh.setAttribute("rx", rx.toFixed(2));

          if (showStarEye) {
            node.g1.setAttribute("opacity", "0");
            node.g2.setAttribute("opacity", "0");
            node.star.setAttribute("opacity", "1");
            const sc = ((node.unit / 23) * (0.9 + Math.sin(tSec * 7 + li) * 0.14)).toFixed(2);
            const rot = (Math.sin(tSec * 4) * 20).toFixed(1);
            node.star.setAttribute("transform", `rotate(${rot}) scale(${sc})`);
          } else {
            node.star.setAttribute("opacity", "0");
            const glOp = Math.max(0, Math.min(1, (open - 0.35) / 0.65));
            const minDim = Math.min(ew, eh);
            const g1x = -ew * 0.17 + (anim.yaw / 35) * ew * 0.1;
            const g1y = -eh * 0.21 - (anim.pitch / 25) * eh * 0.08;
            const g1r = minDim * 0.195;
            const g2x = ew * 0.15 + (anim.yaw / 35) * ew * 0.05;
            const g2y = eh * 0.2 - (anim.pitch / 25) * eh * 0.04;
            const g2r = minDim * 0.088;

            node.g1.setAttribute("cx", g1x.toFixed(2));
            node.g1.setAttribute("cy", g1y.toFixed(2));
            node.g1.setAttribute("r", g1r.toFixed(2));
            node.g1.setAttribute("opacity", (0.96 * glOp).toFixed(2));

            node.g2.setAttribute("cx", g2x.toFixed(2));
            node.g2.setAttribute("cy", g2y.toFixed(2));
            node.g2.setAttribute("r", g2r.toFixed(2));
            node.g2.setAttribute("opacity", (0.52 * glOp).toFixed(2));
          }
        }
      }
    }

    thinkingGroup?.setAttribute("opacity", state === "thinking" ? "1" : "0");
    asleepGroup?.setAttribute("opacity", state === "asleep" ? "1" : "0");
    wideGroup?.setAttribute("opacity", state === "wide" ? "1" : "0");
    notifyGroup?.setAttribute("opacity", state === "notify" ? "1" : "0");

    if (petPopGroup) {
      if (isPoked) {
        const u = Math.min(1, pokeElapsed / 620);
        const op = u < 0.7 ? 1 : (1 - u) / 0.3;
        petPopGroup.setAttribute("opacity", op.toFixed(2));
        petHeartEl?.setAttribute(
          "transform",
          `translate(52 ${(-58 - u * 26).toFixed(1)}) scale(${(0.85 + Math.sin(u * Math.PI) * 0.3).toFixed(2)})`,
        );
        petNoteEl?.setAttribute("opacity", "0");
      } else if (anim.purrActive) {
        const p = ((now - anim.purrAt) * 0.0009) % 1;
        const op = Math.sin(p * Math.PI);
        petPopGroup.setAttribute("opacity", "1");
        petHeartEl?.setAttribute("transform", "translate(52 -999)");
        petNoteEl?.setAttribute("opacity", op.toFixed(2));
        petNoteEl?.setAttribute(
          "transform",
          `translate(${(46 + Math.sin(p * Math.PI * 2) * 7).toFixed(1)} ${(-54 - p * 24).toFixed(1)})`,
        );
      } else {
        petPopGroup.setAttribute("opacity", "0");
      }
    }

    if (state === "thinking") {
      const dots = [dot0, dot1, dot2];
      dots.forEach((dot, idx) => {
        if (!dot) return;
        const phase = snap ? (idx === 1 ? 0.5 : 0) : (tSec * 2.2 - idx * 0.28) % 1;
        const bounce = Math.max(0, Math.sin(phase * Math.PI * 2));
        dot.setAttribute("cy", (-70 - bounce * 4.5).toFixed(1));
        dot.setAttribute("opacity", (0.55 + bounce * 0.45).toFixed(2));
      });
    } else if (state === "asleep") {
      const p1 = snap ? 0.45 : (tSec * 0.44) % 1;
      const p2 = snap ? 0.72 : (tSec * 0.44 + 0.42) % 1;
      const op1 = Math.sin(p1 * Math.PI);
      const op2 = Math.sin(p2 * Math.PI);
      z1El?.setAttribute("transform", `translate(${(p1 * 6).toFixed(1)},${(-p1 * 12).toFixed(1)})`);
      z1El?.setAttribute("opacity", op1.toFixed(2));
      z2El?.setAttribute("transform", `translate(${(p2 * 7).toFixed(1)},${(-p2 * 14).toFixed(1)})`);
      z2El?.setAttribute("opacity", op2.toFixed(2));
    } else if (state === "wide") {
      const s1 = snap ? 1 : 0.84 + Math.sin(tSec * 5.8) * 0.18;
      const s2 = snap ? 1 : 0.84 + Math.cos(tSec * 5.8) * 0.18;
      spk1El?.setAttribute("transform", `translate(-62 -64) scale(${s1.toFixed(2)})`);
      spk2El?.setAttribute("transform", `translate(66 -62) scale(${s2.toFixed(2)})`);
    }

    // Update the 8 cute animation overlay effects (only on medium/large interactive avatars for crisp small icons)
    const showFx = largeEnoughForFx && activeEmote !== null;
    if (auraCircleEl) {
      if (showFx && (activeEmote === "starry-eyes" || activeEmote === "combo-hearts")) {
        auraCircleEl.setAttribute("opacity", "1");
        auraCircleEl.setAttribute("r", (72 + Math.sin(tSec * 6) * 5).toFixed(1));
        auraCircleEl.setAttribute(
          "fill",
          activeEmote === "combo-hearts" ? "rgba(255,112,174,0.18)" : "rgba(255,220,104,0.14)",
        );
      } else {
        auraCircleEl.setAttribute("opacity", "0");
      }
    }
    if (grooveRing1El && grooveRing2El) {
      if (showFx && activeEmote === "music-groove") {
        const rp1 = (tSec * 1.1) % 1;
        const rp2 = (tSec * 1.1 + 0.5) % 1;
        grooveRing1El.setAttribute("r", (56 + rp1 * 36).toFixed(1));
        grooveRing1El.setAttribute("opacity", ((1 - rp1) * 0.55).toFixed(2));
        grooveRing2El.setAttribute("r", (56 + rp2 * 36).toFixed(1));
        grooveRing2El.setAttribute("opacity", ((1 - rp2) * 0.55).toFixed(2));
      } else {
        grooveRing1El.setAttribute("opacity", "0");
        grooveRing2El.setAttribute("opacity", "0");
      }
    }
    if (jellySparkleEl) {
      if (showFx && activeEmote === "jelly-tilt") {
        const sc = (0.75 + 0.3 * Math.sin(tSec * 3.6)).toFixed(2);
        const op = (0.45 + 0.55 * Math.abs(Math.sin(tSec * 3.6))).toFixed(2);
        jellySparkleEl.setAttribute("opacity", op);
        jellySparkleEl.setAttribute("transform", `translate(62 -56) scale(${sc})`);
      } else {
        jellySparkleEl.setAttribute("opacity", "0");
      }
    }
    const starryMotes = [starryMote0El, starryMote1El, starryMote2El];
    const starryConfigs: readonly [number, number, number, number][] = [
      [0, -64, -10, 0.92],
      [0.35, 66, -22, 0.78],
      [0.7, 16, -54, 0.86],
    ];
    starryMotes.forEach((el, idx) => {
      if (!el) return;
      if (showFx && activeEmote === "starry-eyes") {
        const [off, bx, by, sc] = starryConfigs[idx]!;
        const p = (tSec * 0.72 + off) % 1;
        el.setAttribute("opacity", Math.sin(p * Math.PI).toFixed(2));
        el.setAttribute(
          "transform",
          `translate(${bx} ${(by - p * 40).toFixed(1)}) rotate(${(p * 180).toFixed(0)}) scale(${sc})`,
        );
      } else {
        el.setAttribute("opacity", "0");
      }
    });
    if (shyGroupEl && shyHeartEl) {
      if (showFx && activeEmote === "shy-peek") {
        const hp = (tSec * 0.65) % 1;
        shyGroupEl.setAttribute("opacity", "1");
        shyHeartEl.setAttribute("opacity", Math.sin(hp * Math.PI).toFixed(2));
        shyHeartEl.setAttribute("transform", `translate(52 ${(-42 - hp * 24).toFixed(1)})`);
      } else {
        shyGroupEl.setAttribute("opacity", "0");
      }
    }
    if (sleepBubbleGroupEl && sleepBubbleCircleEl && sleepBubbleGlintEl && sleepBubblePopEl) {
      const popElapsed = anim.bubblePopAt > 0 ? now - anim.bubblePopAt : 99999;
      if (showFx && popElapsed < 420) {
        const u = popElapsed / 420;
        sleepBubbleGroupEl.setAttribute("opacity", "0");
        sleepBubblePopEl.setAttribute("opacity", Math.max(0, 1 - u * 1.15).toFixed(2));
        sleepBubblePopEl.setAttribute("transform", `translate(34 22) scale(${(0.7 + u * 0.9).toFixed(2)})`);
      } else if (showFx && activeEmote === "sleepy-bubble") {
        const cyc = (tSec * 0.32) % 1;
        const r = 10 + cyc * 17 + Math.sin(tSec * 4.5) * 1.6;
        sleepBubblePopEl.setAttribute("opacity", "0");
        sleepBubbleGroupEl.setAttribute("opacity", "1");
        sleepBubbleCircleEl.setAttribute("cx", (r * 0.52).toFixed(1));
        sleepBubbleCircleEl.setAttribute("r", r.toFixed(1));
        sleepBubbleGlintEl.setAttribute("cx", (r * 0.24).toFixed(1));
        sleepBubbleGlintEl.setAttribute("cy", (-r * 0.3).toFixed(1));
        sleepBubbleGlintEl.setAttribute("rx", (r * 0.26).toFixed(1));
        sleepBubbleGlintEl.setAttribute("ry", (r * 0.15).toFixed(1));
      } else {
        sleepBubbleGroupEl.setAttribute("opacity", "0");
        sleepBubblePopEl.setAttribute("opacity", "0");
      }
    }
    if (dizzyGroupEl) {
      if (showFx && activeEmote === "dizzy-swirl") {
        dizzyGroupEl.setAttribute("opacity", "1");
        [dizzyStar0El, dizzyStar1El, dizzyStar2El].forEach((el, k) => {
          if (!el) return;
          const ang = tSec * 3.8 + k * ((Math.PI * 2) / 3);
          const sx = (Math.cos(ang) * 50).toFixed(1);
          const sy = (-72 + Math.sin(ang) * 13).toFixed(1);
          const sc = (0.7 + (0.35 * (Math.sin(ang) + 1)) / 2).toFixed(2);
          el.setAttribute("transform", `translate(${sx} ${sy}) scale(${sc})`);
        });
      } else {
        dizzyGroupEl.setAttribute("opacity", "0");
      }
    }
    if (grooveNotesGroupEl && grooveNote1El && grooveNote2El) {
      if (showFx && activeEmote === "music-groove") {
        const n1 = (tSec * 0.78) % 1;
        const n2 = (tSec * 0.78 + 0.5) % 1;
        grooveNotesGroupEl.setAttribute("opacity", "1");
        grooveNote1El.setAttribute("opacity", Math.sin(n1 * Math.PI).toFixed(2));
        grooveNote1El.setAttribute(
          "transform",
          `translate(${(-60 - Math.sin(n1 * 6) * 5).toFixed(1)} ${(-20 - n1 * 42).toFixed(1)})`,
        );
        grooveNote2El.setAttribute("opacity", Math.sin(n2 * Math.PI).toFixed(2));
        grooveNote2El.setAttribute(
          "transform",
          `translate(${(62 + Math.sin(n2 * 6) * 5).toFixed(1)} ${(-26 - n2 * 40).toFixed(1)})`,
        );
      } else {
        grooveNotesGroupEl.setAttribute("opacity", "0");
      }
    }
    if (curiousGlassEl) {
      if (showFx && activeEmote === "curious-peek") {
        curiousGlassEl.setAttribute("opacity", "1");
        curiousGlassEl.setAttribute("transform", `translate(56 -50) rotate(${(Math.sin(tSec * 3) * 11).toFixed(1)})`);
      } else {
        curiousGlassEl.setAttribute("opacity", "0");
      }
    }
    if (comboGroupEl) {
      if (showFx && activeEmote === "combo-hearts") {
        comboGroupEl.setAttribute("opacity", "1");
        [comboP0El, comboP1El, comboP2El, comboP3El, comboP4El].forEach((el, k) => {
          if (!el) return;
          const p = (tSec * 0.98 + k * 0.2) % 1;
          const x = (-50 + k * 25 + Math.sin(p * 6 + k) * 8).toFixed(1);
          const y = (-26 - p * 66).toFixed(1);
          el.setAttribute("opacity", Math.sin(p * Math.PI).toFixed(2));
          el.setAttribute("transform", `translate(${x} ${y})`);
        });
      } else {
        comboGroupEl.setAttribute("opacity", "0");
      }
    }

    anim.initialized = true;
  }

  createEffect(meta, (currentMeta) => {
    rebuildEyesDom(currentMeta);
    renderFrame(performance.now(), 16, true);
  });

  createEffect(
    () => [props.expression, props.state, props.eyeScale, props.frozenAt] as const,
    () => {
      if (props.paused || props.frozenAt !== undefined) {
        renderFrame(performance.now(), 16, true);
      }
    },
  );

  createEffect(
    () => (props.follow === true || props.hoverFollow === true) && !props.paused && props.frozenAt === undefined,
    (wantsPointer) => {
      if (!wantsPointer) return;
      return retainPointerListener();
    },
  );

  let rafId = 0;
  function stopLoop(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  createEffect(
    () => !props.paused && props.frozenAt === undefined,
    (running) => {
      stopLoop();
      if (!running) {
        renderFrame(performance.now(), 16, true);
        return;
      }
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(64, Math.max(1, now - last));
        last = now;
        renderFrame(now, dt, false);
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
      return stopLoop;
    },
  );

  onSettled(() => {
    rebuildEyesDom(meta());
    renderFrame(performance.now(), 16, true);
  });

  onCleanup(() => {
    stopLoop();
    clearTimeout(longHoverTimer);
  });

  let lastPokeSoundAt = 0;

  function isInteractiveSize(): boolean {
    if (!svgEl || props.paused || props.frozenAt !== undefined) return false;
    return svgEl.getBoundingClientRect().width >= 26;
  }

  function handlePointerEnter(): void {
    if (!isInteractiveSize()) return;
    const now = performance.now();
    const zodiacId = meta().id;
    // If sleeping with a bubble, wake up with a cute bubble pop!
    if (anim.autoIdleEmote === "sleepy-bubble" && now < anim.autoIdleUntil) {
      anim.bubblePopAt = now;
      anim.autoIdleEmote = null;
      anim.autoIdleUntil = 0;
      void playKawaiiCue("mascot-bubble-pop", { zodiac: zodiacId, subtle: true });
    } else {
      anim.perkAt = now;
      void playKawaiiCue("mascot-hover", { zodiac: zodiacId });
    }
    anim.lastUserInteractionAt = now;
    clearTimeout(longHoverTimer);
    longHoverTimer = setTimeout(() => {
      anim.hoverReactionCount += 1;
      if (anim.hoverReactionCount % 2 === 0) {
        anim.shyActive = true;
        anim.shyAt = performance.now();
        void playKawaiiCue("mascot-purr", { zodiac: meta().id, subtle: true });
      } else {
        anim.purrActive = true;
        anim.purrAt = performance.now();
        void playKawaiiCue("mascot-purr", { zodiac: meta().id });
      }
    }, 1500);
  }

  function handlePointerLeave(): void {
    clearTimeout(longHoverTimer);
    longHoverTimer = undefined;
    anim.purrActive = false;
    anim.shyActive = false;
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 || !isInteractiveSize()) return;
    const now = performance.now();
    anim.lastUserInteractionAt = now;
    if (anim.autoIdleEmote === "sleepy-bubble" && now < anim.autoIdleUntil) {
      anim.bubblePopAt = now;
      anim.autoIdleEmote = null;
      anim.autoIdleUntil = 0;
    }
    const isRapid = now - lastPokeSoundAt < 720;
    anim.pokeCombo = isRapid ? anim.pokeCombo + 1 : 1;
    lastPokeSoundAt = now;
    anim.pokeAt = now;
    if (anim.pokeCombo >= 3) {
      anim.comboUntil = now + 2_200;
      void playKawaiiCue("mascot-double-poke", { zodiac: meta().id });
    } else {
      void playKawaiiCue(anim.pokeCombo === 2 ? "mascot-double-poke" : "mascot-poke", {
        zodiac: meta().id,
      });
    }
  }

  return (
    <svg
      ref={(el) => (svgEl = el)}
      class={props.class ?? "bloub-avatar-svg"}
      style={{ "pointer-events": "auto", ...props.style }}
      viewBox="-100 -100 200 200"
      role={props.ariaLabel ? "img" : undefined}
      aria-label={props.ariaLabel || undefined}
      aria-hidden={props.ariaLabel ? undefined : "true"}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <defs>
        <radialGradient id={`${uid}-eye`} cx="36%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#483b54" />
          <stop offset="52%" stop-color="#221b28" />
          <stop offset="100%" stop-color="#140f19" />
        </radialGradient>
        <radialGradient id={`${uid}-cheek`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(255,108,148,0.72)" />
          <stop offset="100%" stop-color="rgba(255,108,148,0)" />
        </radialGradient>
        <radialGradient id={`${uid}-bubble`} cx="32%" cy="28%" r="70%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.95)" />
          <stop offset="45%" stop-color="rgba(182,235,255,0.58)" />
          <stop offset="85%" stop-color="rgba(216,180,254,0.42)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.75)" />
        </radialGradient>
        <filter id={`${uid}-sh`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.15" />
        </filter>
      </defs>

      {/* Back FX layer (aura & rhythm soundwave rings) */}
      <g style={{ "pointer-events": "none" }}>
        <circle ref={(el) => (auraCircleEl = el)} cx="0" cy="0" r="72" fill="rgba(255,220,104,0.14)" opacity="0" />
        <circle
          ref={(el) => (grooveRing1El = el)}
          cx="0"
          cy="4"
          r="64"
          fill="none"
          stroke="#f472b6"
          stroke-width="3"
          opacity="0"
        />
        <circle
          ref={(el) => (grooveRing2El = el)}
          cx="0"
          cy="4"
          r="64"
          fill="none"
          stroke="#a78bfa"
          stroke-width="3"
          opacity="0"
        />
      </g>

      <g ref={(el) => (rigGroup = el)}>
        <g style={bodyFilter() ? { filter: bodyFilter() } : undefined}>
          <g ref={(el) => (partBackG = el)}>
            <Show when={parts().back}>
              {(src) => (
                <image href={src()} x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
              )}
            </Show>
          </g>
          <g ref={(el) => (partLeftG = el)}>
            <Show when={parts().left}>
              {(src) => (
                <image href={src()} x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
              )}
            </Show>
          </g>
          <g ref={(el) => (partRightG = el)}>
            <Show when={parts().right}>
              {(src) => (
                <image href={src()} x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
              )}
            </Show>
          </g>
          <g ref={(el) => (partBaseG = el)}>
            <Show when={parts().base}>
              {(src) => (
                <image href={src()} x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
              )}
            </Show>
          </g>
          <g ref={(el) => (partTopG = el)}>
            <Show when={parts().top}>
              {(src) => (
                <image href={src()} x="-100" y="-100" width="200" height="200" preserveAspectRatio="xMidYMid meet" />
              )}
            </Show>
          </g>
        </g>

        <g ref={(el) => (cheeksLayer = el)} />
        <g ref={(el) => (eyesLayer = el)} />
      </g>

      <g ref={(el) => (thinkingGroup = el)} opacity="0">
        <rect
          x="26"
          y="-86"
          width="60"
          height="32"
          rx="16"
          fill="rgba(255,253,249,0.95)"
          stroke="rgba(40,32,48,0.16)"
          stroke-width="2"
        />
        <circle ref={(el) => (dot0 = el)} cx="41" cy="-70" r="5.2" fill="#2d2534" />
        <circle ref={(el) => (dot1 = el)} cx="56" cy="-70" r="5.2" fill="#2d2534" />
        <circle ref={(el) => (dot2 = el)} cx="71" cy="-70" r="5.2" fill="#2d2534" />
      </g>

      <g ref={(el) => (asleepGroup = el)} opacity="0">
        <text
          ref={(el) => (z1El = el)}
          x="38"
          y="-42"
          font-family="-apple-system,BlinkMacSystemFont,sans-serif"
          font-weight="900"
          font-size="28"
          fill={meta().color}
          stroke="#fffdf9"
          stroke-width="6"
          paint-order="stroke"
          stroke-linejoin="round"
        >
          z
        </text>
        <text
          ref={(el) => (z2El = el)}
          x="56"
          y="-62"
          font-family="-apple-system,BlinkMacSystemFont,sans-serif"
          font-weight="900"
          font-size="36"
          fill={meta().color}
          stroke="#fffdf9"
          stroke-width="7"
          paint-order="stroke"
          stroke-linejoin="round"
        >
          Z
        </text>
      </g>

      <g ref={(el) => (wideGroup = el)} opacity="0">
        <path
          ref={(el) => (spk1El = el)}
          transform="translate(-62 -64)"
          d="M0 -19 C2 -6 6 -2 19 0 C6 2 2 6 0 19 C-2 6 -6 2 -19 0 C-6 -2 -2 -6 0 -19 Z"
          fill="#ffcf3d"
          stroke="#fffdf9"
          stroke-width="3.5"
          stroke-linejoin="round"
        />
        <path
          ref={(el) => (spk2El = el)}
          transform="translate(66 -62)"
          d="M0 -14 C1.5 -4.5 4.5 -1.5 14 0 C4.5 1.5 1.5 4.5 0 14 C-1.5 4.5 -4.5 1.5 -14 0 C-4.5 -1.5 -1.5 -4.5 0 -14 Z"
          fill="#ff9e3d"
          stroke="#fffdf9"
          stroke-width="3.2"
          stroke-linejoin="round"
        />
      </g>

      <g ref={(el) => (notifyGroup = el)} opacity="0">
        <circle cx="64" cy="-64" r="16" fill="#2496e8" stroke="#fffdf9" stroke-width="4" />
      </g>

      <g ref={(el) => (petPopGroup = el)} opacity="0" style={{ "pointer-events": "none" }}>
        <text
          ref={(el) => (petHeartEl = el)}
          x="0"
          y="0"
          font-family="-apple-system,BlinkMacSystemFont,sans-serif"
          font-weight="900"
          font-size="30"
          fill="#ff6b9d"
          stroke="#fffdf9"
          stroke-width="5"
          paint-order="stroke"
          text-anchor="middle"
        >
          ♥
        </text>
        <text
          ref={(el) => (petNoteEl = el)}
          x="0"
          y="0"
          opacity="0"
          font-family="-apple-system,BlinkMacSystemFont,sans-serif"
          font-weight="900"
          font-size="30"
          fill="#ffb830"
          stroke="#fffdf9"
          stroke-width="5"
          paint-order="stroke"
          text-anchor="middle"
        >
          ♪
        </text>
      </g>

      {/* 8 Approved Cute Animation Foreground FX Layers */}
      <g style={{ "pointer-events": "none" }}>
        {/* 1. Jelly-tilt sparkle */}
        <path
          ref={(el) => (jellySparkleEl = el)}
          opacity="0"
          d="M0 -13 C2 -4 4 -2 13 0 C4 2 2 4 0 13 C-2 4 -4 2 -13 0 C-4 -2 -2 -4 0 -13 Z"
          fill="#ffe27a"
          stroke="#fffdf9"
          stroke-width="2.2"
        />
        {/* 2. Starry-eyes floating motes */}
        <path
          ref={(el) => (starryMote0El = el)}
          opacity="0"
          d="M0 -12 C2 -4 4 -2 12 0 C4 2 2 4 0 12 C-2 4 -4 2 -12 0 C-4 -2 -2 -4 0 -12 Z"
          fill="#ffe45e"
        />
        <path
          ref={(el) => (starryMote1El = el)}
          opacity="0"
          d="M0 -12 C2 -4 4 -2 12 0 C4 2 2 4 0 12 C-2 4 -4 2 -12 0 C-4 -2 -2 -4 0 -12 Z"
          fill="#ff9ed2"
        />
        <path
          ref={(el) => (starryMote2El = el)}
          opacity="0"
          d="M0 -12 C2 -4 4 -2 12 0 C4 2 2 4 0 12 C-2 4 -4 2 -12 0 C-4 -2 -2 -4 0 -12 Z"
          fill="#7ef7e6"
        />
        {/* 3. Shy-peek blush marks & floating heart */}
        <g ref={(el) => (shyGroupEl = el)} opacity="0">
          <g stroke="#ff74a8" stroke-width="2.6" stroke-linecap="round">
            <line x1="-66" y1="-34" x2="-58" y2="-44" />
            <line x1="-59" y1="-32" x2="-51" y2="-42" />
          </g>
          <text
            ref={(el) => (shyHeartEl = el)}
            x="0"
            y="0"
            font-family="-apple-system,BlinkMacSystemFont,sans-serif"
            font-weight="900"
            font-size="22"
            fill="#ff7eb6"
            stroke="#fffdf9"
            stroke-width="3.6"
            paint-order="stroke"
            text-anchor="middle"
          >
            ♥
          </text>
        </g>
        {/* 4. Sleepy-bubble iridescent bubble & pop lines */}
        <g ref={(el) => (sleepBubbleGroupEl = el)} opacity="0" transform="translate(22 24)">
          <circle
            ref={(el) => (sleepBubbleCircleEl = el)}
            cx="8"
            cy="0"
            r="14"
            fill={`url(#${uid}-bubble)`}
            stroke="rgba(255,255,255,0.85)"
            stroke-width="2"
          />
          <ellipse
            ref={(el) => (sleepBubbleGlintEl = el)}
            cx="4"
            cy="-4"
            rx="4"
            ry="2.2"
            fill="rgba(255,255,255,0.9)"
          />
        </g>
        <g ref={(el) => (sleepBubblePopEl = el)} opacity="0" stroke="#c4f1ff" stroke-width="3" stroke-linecap="round">
          <line x1="0" y1="-22" x2="0" y2="-13" />
          <line x1="22" y1="0" x2="13" y2="0" />
          <line x1="0" y1="22" x2="0" y2="13" />
          <line x1="-22" y1="0" x2="-13" y2="0" />
          <line x1="15" y1="-15" x2="9" y2="-9" />
        </g>
        {/* 5. Dizzy-swirl orbiting star halo */}
        <g ref={(el) => (dizzyGroupEl = el)} opacity="0">
          <ellipse
            cx="0"
            cy="-72"
            rx="50"
            ry="13"
            fill="none"
            stroke="rgba(255,224,112,0.38)"
            stroke-width="2"
            stroke-dasharray="6 5"
          />
          <path
            ref={(el) => (dizzyStar0El = el)}
            d="M0 -11 C1.8 -3.5 3.5 -1.8 11 0 C3.5 1.8 1.8 3.5 0 11 C-1.8 3.5 -3.5 1.8 -11 0 C-3.5 -1.8 -1.8 -3.5 0 -11 Z"
            fill="#ffd84d"
            stroke="#fffdf9"
            stroke-width="1.8"
          />
          <path
            ref={(el) => (dizzyStar1El = el)}
            d="M0 -11 C1.8 -3.5 3.5 -1.8 11 0 C3.5 1.8 1.8 3.5 0 11 C-1.8 3.5 -3.5 1.8 -11 0 C-3.5 -1.8 -1.8 -3.5 0 -11 Z"
            fill="#ffd84d"
            stroke="#fffdf9"
            stroke-width="1.8"
          />
          <path
            ref={(el) => (dizzyStar2El = el)}
            d="M0 -11 C1.8 -3.5 3.5 -1.8 11 0 C3.5 1.8 1.8 3.5 0 11 C-1.8 3.5 -3.5 1.8 -11 0 C-3.5 -1.8 -1.8 -3.5 0 -11 Z"
            fill="#ffd84d"
            stroke="#fffdf9"
            stroke-width="1.8"
          />
        </g>
        {/* 6. Music-groove floating notes */}
        <g ref={(el) => (grooveNotesGroupEl = el)} opacity="0">
          <text
            ref={(el) => (grooveNote1El = el)}
            x="0"
            y="0"
            font-family="-apple-system,BlinkMacSystemFont,sans-serif"
            font-weight="900"
            font-size="24"
            fill="#ff8ac4"
            stroke="#fffdf9"
            stroke-width="3.6"
            paint-order="stroke"
            text-anchor="middle"
          >
            ♪
          </text>
          <text
            ref={(el) => (grooveNote2El = el)}
            x="0"
            y="0"
            font-family="-apple-system,BlinkMacSystemFont,sans-serif"
            font-weight="900"
            font-size="25"
            fill="#6ef3df"
            stroke="#fffdf9"
            stroke-width="3.6"
            paint-order="stroke"
            text-anchor="middle"
          >
            ♫
          </text>
        </g>
        {/* 7. Curious-peek detective magnifying glass */}
        <g ref={(el) => (curiousGlassEl = el)} opacity="0">
          <circle cx="0" cy="0" r="15" fill="rgba(110,243,223,0.22)" stroke="#7ef7e6" stroke-width="3.4" />
          <line x1="10.5" y1="10.5" x2="21" y2="21" stroke="#7ef7e6" stroke-width="4.2" stroke-linecap="round" />
          <path d="M-6 -4 Q-2.5 -8.5 3 -5.5" fill="none" stroke="#fffdf9" stroke-width="2.2" stroke-linecap="round" />
        </g>
        {/* 8. Combo-hearts fountain particles */}
        <g ref={(el) => (comboGroupEl = el)} opacity="0">
          <text
            ref={(el) => (comboP0El = el)}
            x="0"
            y="0"
            font-size="22"
            font-weight="900"
            fill="#ff6b9d"
            stroke="#fffdf9"
            stroke-width="3.2"
            paint-order="stroke"
            text-anchor="middle"
          >
            ♥
          </text>
          <text
            ref={(el) => (comboP1El = el)}
            x="0"
            y="0"
            font-size="18"
            font-weight="900"
            fill="#ffd24c"
            stroke="#fffdf9"
            stroke-width="3"
            paint-order="stroke"
            text-anchor="middle"
          >
            ✦
          </text>
          <text
            ref={(el) => (comboP2El = el)}
            x="0"
            y="0"
            font-size="23"
            font-weight="900"
            fill="#ff6b9d"
            stroke="#fffdf9"
            stroke-width="3.2"
            paint-order="stroke"
            text-anchor="middle"
          >
            ♥
          </text>
          <text
            ref={(el) => (comboP3El = el)}
            x="0"
            y="0"
            font-size="18"
            font-weight="900"
            fill="#ffd24c"
            stroke="#fffdf9"
            stroke-width="3"
            paint-order="stroke"
            text-anchor="middle"
          >
            ✦
          </text>
          <text
            ref={(el) => (comboP4El = el)}
            x="0"
            y="0"
            font-size="22"
            font-weight="900"
            fill="#ff6b9d"
            stroke="#fffdf9"
            stroke-width="3.2"
            paint-order="stroke"
            text-anchor="middle"
          >
            ♥
          </text>
        </g>
      </g>
    </svg>
  );
}
