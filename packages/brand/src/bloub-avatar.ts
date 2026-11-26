import {
  COLOR_BY_ID,
  type ColorId,
  EXPRESSIONS,
  type ExpressionId,
  SHAPES,
  type ShapeId,
} from "@norbert_bodziony/bloub";
import { type AvatarColor, type AvatarHue, nearestAvatarHue } from "@openbot/contracts/ipc";

export type SupportedAvatarSilhouetteId = Exclude<ShapeId, "goutte">;

export type ZodiacId =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export interface ZodiacEyeSpec {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly tilt: number;
  readonly group: number;
}

export interface ZodiacAvatarMeta {
  readonly id: ZodiacId;
  readonly shape: SupportedAvatarSilhouetteId;
  readonly nameZh: string;
  readonly shortNameZh: string;
  readonly elementZh: "火象" | "土象" | "风象" | "水象";
  readonly nicknameZh: string;
  readonly nameEn: string;
  readonly symbol: string;
  readonly color: `#${string}`;
  readonly baseHue: number;
  readonly eyes: readonly ZodiacEyeSpec[];
}

export const ZODIAC_AVATAR_LIST: readonly ZodiacAvatarMeta[] = [
  {
    id: "aries",
    shape: "cercle",
    nameZh: "白羊座",
    shortNameZh: "白羊",
    elementZh: "火象",
    nicknameZh: "卷角珊瑚羊",
    nameEn: "Aries",
    symbol: "♈",
    color: "#FF7352",
    baseHue: 12,
    eyes: [
      { x: -0.132, y: 0.08, scale: 0.184, tilt: 3.0, group: 0 },
      { x: 0.132, y: 0.08, scale: 0.184, tilt: -3.0, group: 0 },
    ],
  },
  {
    id: "taurus",
    shape: "squircle",
    nameZh: "金牛座",
    shortNameZh: "金牛",
    elementZh: "土象",
    nicknameZh: "抹茶奶角牛",
    nameEn: "Taurus",
    symbol: "♉",
    color: "#52CC82",
    baseHue: 144,
    eyes: [
      { x: -0.145, y: 0.09, scale: 0.184, tilt: 0.0, group: 0 },
      { x: 0.145, y: 0.09, scale: 0.184, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "gemini",
    shape: "galet",
    nameZh: "双子座",
    shortNameZh: "双子",
    elementZh: "风象",
    nicknameZh: "贴贴双子豆",
    nameEn: "Gemini",
    symbol: "♊",
    color: "#FFD24C",
    baseHue: 46,
    eyes: [
      { x: -0.382, y: 0.08, scale: 0.142, tilt: 3.0, group: 0 },
      { x: -0.198, y: 0.075, scale: 0.142, tilt: 2.0, group: 0 },
      { x: 0.198, y: 0.075, scale: 0.142, tilt: -2.0, group: 1 },
      { x: 0.382, y: 0.08, scale: 0.142, tilt: -3.0, group: 1 },
    ],
  },
  {
    id: "cancer",
    shape: "capsule",
    nameZh: "巨蟹座",
    shortNameZh: "巨蟹",
    elementZh: "水象",
    nicknameZh: "举钳樱花蟹",
    nameEn: "Cancer",
    symbol: "♋",
    color: "#FF8AA6",
    baseHue: 346,
    eyes: [
      { x: -0.136, y: 0.12, scale: 0.184, tilt: 0.0, group: 0 },
      { x: 0.136, y: 0.12, scale: 0.184, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "leo",
    shape: "hexagone",
    nameZh: "狮子座",
    shortNameZh: "狮子",
    elementZh: "火象",
    nicknameZh: "太阳花小狮",
    nameEn: "Leo",
    symbol: "♌",
    color: "#FF8B22",
    baseHue: 28,
    eyes: [
      { x: -0.128, y: 0.055, scale: 0.18, tilt: 0.0, group: 0 },
      { x: 0.128, y: 0.055, scale: 0.18, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "virgo",
    shape: "nuage",
    nameZh: "处女座",
    shortNameZh: "处女",
    elementZh: "土象",
    nicknameZh: "小花双辫团",
    nameEn: "Virgo",
    symbol: "♍",
    color: "#FFC2CE",
    baseHue: 348,
    eyes: [
      { x: -0.132, y: 0.085, scale: 0.184, tilt: 0.0, group: 0 },
      { x: 0.132, y: 0.085, scale: 0.184, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "libra",
    shape: "pentagone",
    nameZh: "天秤座",
    shortNameZh: "天秤",
    elementZh: "风象",
    nicknameZh: "小天平丁香团",
    nameEn: "Libra",
    symbol: "♎",
    color: "#CD8AF7",
    baseHue: 276,
    eyes: [
      { x: -0.132, y: 0.145, scale: 0.184, tilt: 0.0, group: 0 },
      { x: 0.132, y: 0.145, scale: 0.184, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "scorpio",
    shape: "losange",
    nameZh: "天蝎座",
    shortNameZh: "天蝎",
    elementZh: "水象",
    nicknameZh: "翘尾小蝎团",
    nameEn: "Scorpio",
    symbol: "♏",
    color: "#8652F0",
    baseHue: 260,
    eyes: [
      { x: -0.192, y: 0.135, scale: 0.178, tilt: 5.0, group: 0 },
      { x: 0.052, y: 0.135, scale: 0.178, tilt: -5.0, group: 0 },
    ],
  },
  {
    id: "sagittarius",
    shape: "triangle",
    nameZh: "射手座",
    shortNameZh: "射手",
    elementZh: "火象",
    nicknameZh: "小弓箭蓝团",
    nameEn: "Sagittarius",
    symbol: "♐",
    color: "#4A9EFF",
    baseHue: 212,
    eyes: [
      { x: -0.205, y: 0.085, scale: 0.184, tilt: 3.0, group: 0 },
      { x: 0.045, y: 0.085, scale: 0.184, tilt: -3.0, group: 0 },
    ],
  },
  {
    id: "capricorn",
    shape: "carre",
    nameZh: "摩羯座",
    shortNameZh: "摩羯",
    elementZh: "土象",
    nicknameZh: "羊角鱼尾团",
    nameEn: "Capricorn",
    symbol: "♑",
    color: "#CF9263",
    baseHue: 26,
    eyes: [
      { x: -0.232, y: 0.105, scale: 0.178, tilt: 0.0, group: 0 },
      { x: 0.012, y: 0.105, scale: 0.178, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "aquarius",
    shape: "fantome",
    nameZh: "水瓶座",
    shortNameZh: "水瓶",
    elementZh: "风象",
    nicknameZh: "啵啵水瓶团",
    nameEn: "Aquarius",
    symbol: "♒",
    color: "#3CD9D5",
    baseHue: 178,
    eyes: [
      { x: -0.136, y: 0.18, scale: 0.184, tilt: 0.0, group: 0 },
      { x: 0.136, y: 0.18, scale: 0.184, tilt: 0.0, group: 0 },
    ],
  },
  {
    id: "pisces",
    shape: "meduse",
    nameZh: "双鱼座",
    shortNameZh: "双鱼",
    elementZh: "水象",
    nicknameZh: "双鱼豆豆团",
    nameEn: "Pisces",
    symbol: "♓",
    color: "#75A3FF",
    baseHue: 220,
    eyes: [
      { x: -0.225, y: -0.22, scale: 0.14, tilt: 0.0, group: 0 },
      { x: 0.225, y: 0.22, scale: 0.14, tilt: 0.0, group: 1 },
    ],
  },
];

const ZODIAC_BY_SHAPE = new Map<ShapeId, ZodiacAvatarMeta>(ZODIAC_AVATAR_LIST.map((item) => [item.shape, item]));

export function zodiacForShape(shape: ShapeId): ZodiacAvatarMeta {
  return ZODIAC_BY_SHAPE.get(shape) ?? ZODIAC_AVATAR_LIST[11]!;
}

export interface BloubAvatarProfile {
  shape: SupportedAvatarSilhouetteId;
  color: string;
  expression: ExpressionId;
}

const AUTOMATIC_COLORS = ["rouge", "orange", "ambre", "vert", "turquoise", "bleu", "violet", "rose"] as const;
const UNSUPPORTED_AVATAR_SILHOUETTE = "goutte" as const satisfies ShapeId;
function isSupportedSilhouette<Silhouette extends ShapeId>(
  silhouette: Silhouette,
): silhouette is Exclude<Silhouette, typeof UNSUPPORTED_AVATAR_SILHOUETTE> {
  return silhouette !== UNSUPPORTED_AVATAR_SILHOUETTE;
}
// Exactly 12 zodiac clay silhouettes in chronological zodiac order (Aries -> Pisces)
export const SUPPORTED_AVATAR_SILHOUETTES: readonly SupportedAvatarSilhouetteId[] = ZODIAC_AVATAR_LIST.map(
  (item) => item.shape,
);
const _LEGACY_SHAPES_COUNT = SHAPES.length;
void _LEGACY_SHAPES_COUNT;
const SEEDED_AVATAR_SILHOUETTES = [
  "cercle",
  "galet",
  "squircle",
  "capsule",
  "triangle",
  "hexagone",
  "nuage",
  "goutte",
  "carre",
  "losange",
  "pentagone",
] as const satisfies readonly ShapeId[];
type SeededSilhouette = (typeof SEEDED_AVATAR_SILHOUETTES)[number];
type SeededSupportedSilhouette = Exclude<SeededSilhouette, typeof UNSUPPORTED_AVATAR_SILHOUETTE>;
type NamedSilhouette = Exclude<ShapeId, SeededSilhouette>;
const SEEDED_SUPPORTED_SILHOUETTES = SEEDED_AVATAR_SILHOUETTES.filter(isSupportedSilhouette);
const NAMED_SILHOUETTE_LOOKALIKES: Readonly<Record<NamedSilhouette, SeededSupportedSilhouette>> = {
  fantome: "squircle",
  meduse: "galet",
  poulpe: "nuage",
};
const NAMED_SILHOUETTE_SEED_PATTERN = /:([a-z]+):(?:face|flat):\d+$/;

function isNamedSilhouette(silhouette: string): silhouette is NamedSilhouette {
  return Object.hasOwn(NAMED_SILHOUETTE_LOOKALIKES, silhouette);
}

function namedSilhouette(seed: string): NamedSilhouette | null {
  const silhouette = NAMED_SILHOUETTE_SEED_PATTERN.exec(seed)?.[1];
  return silhouette !== undefined && isNamedSilhouette(silhouette) ? silhouette : null;
}

function seededSilhouette(seed: string): SeededSupportedSilhouette {
  const silhouette = requiredItem(
    SEEDED_AVATAR_SILHOUETTES,
    stableIndex(`${seed}:shape`, SEEDED_AVATAR_SILHOUETTES.length),
  );
  return silhouette === UNSUPPORTED_AVATAR_SILHOUETTE
    ? requiredItem(
        SEEDED_SUPPORTED_SILHOUETTES,
        stableIndex(`${seed}:shape:replacement`, SEEDED_SUPPORTED_SILHOUETTES.length),
      )
    : silhouette;
}

function seededLookalike(silhouette: SupportedAvatarSilhouetteId): SeededSupportedSilhouette {
  return isNamedSilhouette(silhouette) ? NAMED_SILHOUETTE_LOOKALIKES[silhouette] : silhouette;
}

function seededExpression(seed: string): ExpressionId {
  return requiredItem(EXPRESSIONS, stableIndex(`${seed}:expression`, EXPRESSIONS.length)).id;
}

const HUE_COLORS: Readonly<Record<AvatarHue, string>> = {
  0: colorHex("rouge"),
  30: colorHex("orange"),
  55: colorHex("ambre"),
  100: "#8ece34",
  150: colorHex("vert"),
  185: "#24c8dc",
  215: colorHex("bleu"),
  245: "#5d67ee",
  280: colorHex("violet"),
  320: colorHex("rose"),
};

export const AVATAR_EXPRESSIONS: readonly ExpressionId[] = EXPRESSIONS.map((option) => option.id);

export const AVATAR_HUE_CHOICES: ReadonlyArray<{ hue: AvatarHue; label: string }> = [
  { hue: 0, label: "Red" },
  { hue: 30, label: "Orange" },
  { hue: 55, label: "Yellow" },
  { hue: 100, label: "Lime" },
  { hue: 150, label: "Green" },
  { hue: 185, label: "Cyan" },
  { hue: 215, label: "Blue" },
  { hue: 245, label: "Indigo" },
  { hue: 280, label: "Violet" },
  { hue: 320, label: "Magenta" },
];

export const AVATAR_COLOR_PRESETS = {
  pink: "#f797ba",
  sky: "#38bdf8",
  navy: "#34479c",
  wine: "#a8324e",
  brown: "#8b5e3c",
  sand: "#d6b98c",
  grey: "#a3a3a3",
} as const satisfies Record<string, AvatarColor>;
export type AvatarColorPresetId = keyof typeof AVATAR_COLOR_PRESETS;

export type AvatarColorChoice =
  | { kind: "hue"; hue: AvatarHue; color: null; swatch: string }
  | { kind: "preset"; preset: AvatarColorPresetId; hue: AvatarHue | null; color: AvatarColor; swatch: string };

function hueChoice(hue: AvatarHue): AvatarColorChoice {
  return { kind: "hue", hue, color: null, swatch: HUE_COLORS[hue] };
}

function presetChoice(preset: AvatarColorPresetId): AvatarColorChoice {
  const color = AVATAR_COLOR_PRESETS[preset];
  return { kind: "preset", preset, hue: nearestAvatarHue(color), color, swatch: color };
}

// Curated glaze palette with zero perceptual duplicates across the color wheel
export const AVATAR_COLOR_CHOICES: readonly AvatarColorChoice[] = [
  hueChoice(0),
  hueChoice(30),
  hueChoice(55),
  hueChoice(100),
  hueChoice(150),
  hueChoice(185),
  hueChoice(215),
  presetChoice("navy"),
  hueChoice(280),
  hueChoice(320),
  presetChoice("pink"),
  presetChoice("brown"),
  presetChoice("sand"),
  presetChoice("grey"),
];

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return { h, s, l };
}

function isPerceptuallySimilarColor(hexA: string, hexB: string): boolean {
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return hexA.toLowerCase() === hexB.toLowerCase();
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  const rMean = (a[0] + b[0]) * 0.5;
  const redmeanDist = Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
  if (redmeanDist < 74) return true;
  const hslA = rgbToHsl(a[0], a[1], a[2]);
  const hslB = rgbToHsl(b[0], b[1], b[2]);
  if (hslA.s >= 0.25 && hslB.s >= 0.25) {
    const hueDiff = Math.min(Math.abs(hslA.h - hslB.h), 360 - Math.abs(hslA.h - hslB.h));
    if (hueDiff <= 18 && Math.abs(hslA.l - hslB.l) <= 0.16 && Math.abs(hslA.s - hslB.s) <= 0.35) return true;
  }
  return false;
}

/**
 * Returns a deduplicated list of alternate glaze color choices for a given avatar seed,
 * guaranteeing no swatch duplicates or visually overlaps the character's native default color
 * or any other swatch in the list.
 */
export function avatarColorChoicesForSeed(seed: string): AvatarColorChoice[] {
  const nativeHex = avatarHeadColor(seed, null);
  const kept: AvatarColorChoice[] = [];
  for (const choice of AVATAR_COLOR_CHOICES) {
    if (isPerceptuallySimilarColor(nativeHex, choice.swatch)) continue;
    if (kept.some((existing) => isPerceptuallySimilarColor(existing.swatch, choice.swatch))) continue;
    kept.push(choice);
  }
  return kept;
}

export function isAvatarColorChoice(
  choice: AvatarColorChoice,
  hue: AvatarHue | null,
  color: AvatarColor | null | undefined,
): boolean {
  return choice.color === null ? (color ?? null) === null && hue === choice.hue : color === choice.color;
}

export function bloubAvatarProfile(
  seed: string,
  hue: AvatarHue | null,
  color: AvatarColor | null = null,
): BloubAvatarProfile {
  const silhouette = namedSilhouette(seed) ?? seededSilhouette(seed);
  const expression = seededExpression(seed);

  return {
    shape: silhouette,
    expression,
    color: color ?? (hue === null ? zodiacForShape(silhouette).color : HUE_COLORS[hue]),
  };
}

export function avatarHueSwatch(hue: AvatarHue): string {
  return HUE_COLORS[hue];
}

export function avatarHeadColor(seed: string, hue: AvatarHue | null, color: AvatarColor | null = null): string {
  return bloubAvatarProfile(seed, hue, color).color;
}

export type ServerPlushColor = (typeof AUTOMATIC_COLORS)[number];

export function serverPlushColor(serverId: string): ServerPlushColor {
  if (!serverId || serverId === "local" || serverId.startsWith("local:")) return "violet";
  return automaticColor(serverId);
}

export function serverPlushHex(serverId: string, color: string | null | undefined): string {
  return (color ?? colorHex(automaticColor(serverId))).toLowerCase();
}

function automaticColor(seed: string): ServerPlushColor {
  return requiredItem(AUTOMATIC_COLORS, stableIndex(`${seed}:color`, AUTOMATIC_COLORS.length));
}

export function avatarCandidateSeeds(agentId: string, currentSeed: string, batch: number): string[] {
  const candidates = [currentSeed];
  const firstProfile = bloubAvatarProfile(currentSeed, null);
  const unseenSilhouetteIds = new Set<SupportedAvatarSilhouetteId>(SEEDED_SUPPORTED_SILHOUETTES);
  const usedExpressions = new Set<ExpressionId>([firstProfile.expression]);
  unseenSilhouetteIds.delete(firstProfile.shape);
  let index = 1;

  while (unseenSilhouetteIds.size > 0) {
    const candidate = `${agentId}:avatar:${batch}:${index}`;
    index += 1;
    if (candidates.includes(candidate)) continue;
    const profile = bloubAvatarProfile(candidate, null);
    if (!unseenSilhouetteIds.delete(profile.shape)) continue;
    candidates.push(candidate);
    usedExpressions.add(profile.expression);
  }

  while (candidates.length < 12) {
    const candidate = `${agentId}:avatar:${batch}:${index}`;
    index += 1;
    if (candidates.includes(candidate)) continue;
    const profile = bloubAvatarProfile(candidate, null);
    if (usedExpressions.has(profile.expression)) continue;
    candidates.push(candidate);
    usedExpressions.add(profile.expression);
  }

  return candidates;
}

const FACE_SEED_TRIES = 10_000;

export type AvatarStyle = "plush" | "flat";

export const AVATAR_STYLES: readonly AvatarStyle[] = ["plush", "flat"];

const STYLE_SEED_SEGMENT: Readonly<Record<AvatarStyle, string>> = { plush: "face", flat: "flat" };

const FLAT_SEED_PATTERN = /:flat:\d+$/;

export function avatarStyleForSeed(seed: string): AvatarStyle {
  return FLAT_SEED_PATTERN.test(seed) ? "flat" : "plush";
}

export function avatarDefaultSeed(agentId: string, style: AvatarStyle): string {
  if (style === "plush") return agentId;
  const face = bloubAvatarProfile(agentId, null);
  return avatarSeedForFace(agentId, { shape: face.shape, expression: face.expression }, style);
}

export function avatarSeedForFace(
  agentId: string,
  face: { shape: SupportedAvatarSilhouetteId; expression: ExpressionId },
  style: AvatarStyle = "plush",
): string {
  const named = isNamedSilhouette(face.shape) ? face.shape : null;
  const prefix = named ? `${agentId}:${named}` : agentId;
  const seededShape = seededLookalike(face.shape);
  for (let index = 0; index < FACE_SEED_TRIES; index += 1) {
    const candidate = `${prefix}:${STYLE_SEED_SEGMENT[style]}:${index}`;
    if (
      namedSilhouette(candidate) === named &&
      seededSilhouette(candidate) === seededShape &&
      seededExpression(candidate) === face.expression
    ) {
      return candidate;
    }
  }
  throw new Error("No avatar seed draws this face.");
}

export function avatarHueForColor(color: string): AvatarHue | null {
  return AVATAR_HUE_CHOICES.find((option) => HUE_COLORS[option.hue] === color)?.hue ?? null;
}

function stableIndex(value: string, length: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % length;
}

function colorHex(color: ColorId): string {
  const value = COLOR_BY_ID.get(color)?.hex;
  if (!value) throw new Error(`Bloub did not return a color for ${color}.`);
  return value;
}

function requiredItem<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error("Bloub avatar options are empty.");
  return item;
}
