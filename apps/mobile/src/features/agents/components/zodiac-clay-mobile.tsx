import type { ExpressionId } from "@norbert_bodziony/bloub";
import {
  bloubAvatarProfile,
  type ZodiacAvatarMeta,
  type ZodiacEyeSpec,
  type ZodiacId,
  zodiacForShape,
} from "@starbot/brand/bloub-avatar";
import { type AvatarMood, avatarMoodIsBusy, avatarMoodPresentation } from "@starbot/brand/bloub-avatar-motion";
import type { AvatarColor, AvatarHue } from "@starbot/contracts/ipc";
import { Image, type ImageSource } from "expo-image";
import { memo, useEffect, useId } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";

const ZODIAC_BODY_IMAGES: Readonly<Record<ZodiacId, ImageSource>> = {
  aries: require("../../../../assets/zodiac/aries.webp"),
  taurus: require("../../../../assets/zodiac/taurus.webp"),
  gemini: require("../../../../assets/zodiac/gemini.webp"),
  cancer: require("../../../../assets/zodiac/cancer.webp"),
  leo: require("../../../../assets/zodiac/leo.webp"),
  virgo: require("../../../../assets/zodiac/virgo.webp"),
  libra: require("../../../../assets/zodiac/libra.webp"),
  scorpio: require("../../../../assets/zodiac/scorpio.webp"),
  sagittarius: require("../../../../assets/zodiac/sagittarius.webp"),
  capricorn: require("../../../../assets/zodiac/capricorn.webp"),
  aquarius: require("../../../../assets/zodiac/aquarius.webp"),
  pisces: require("../../../../assets/zodiac/pisces.webp"),
};

// Trim the generous transparent margins inside the 512x512 clay WebP frames so
// every character fills ~90% of its slot (matching mainstream companion avatars)
// while scaling the body image and SVG eye overlay in lockstep.
const ZODIAC_VISUAL_SCALE: Readonly<Record<ZodiacId, number>> = {
  aries: 1.32,
  taurus: 1.3,
  gemini: 1.38,
  cancer: 1.26,
  leo: 1.45,
  virgo: 1.44,
  libra: 1.54,
  scorpio: 1.4,
  sagittarius: 1.42,
  capricorn: 1.38,
  aquarius: 1.4,
  pisces: 1.66,
};

interface EyeShapePreset {
  w: number;
  h: number;
  tilt: number;
  arc: "happy" | "asleep" | null;
  blush?: boolean;
}

const DEFAULT_EYE: EyeShapePreset = { w: 0.54, h: 0.96, tilt: 0, arc: null, blush: true };

const EXPRESSION_EYES: Partial<Record<ExpressionId, readonly [EyeShapePreset, EyeShapePreset]>> = {
  neutre: [DEFAULT_EYE, DEFAULT_EYE],
  attentif: [
    { w: 0.62, h: 1.05, tilt: 0, arc: null, blush: true },
    { w: 0.62, h: 1.05, tilt: 0, arc: null, blush: true },
  ],
  surpris: [
    { w: 0.76, h: 0.86, tilt: 0, arc: null },
    { w: 0.76, h: 0.86, tilt: 0, arc: null },
  ],
  excite: [
    { w: 0.7, h: 1.02, tilt: -7, arc: null, blush: true },
    { w: 0.7, h: 1.02, tilt: 7, arc: null, blush: true },
  ],
  heureux: [
    { w: 0.66, h: 0.52, tilt: 0, arc: "happy", blush: true },
    { w: 0.66, h: 0.52, tilt: 0, arc: "happy", blush: true },
  ],
  hilare: [
    { w: 0.72, h: 0.48, tilt: 6, arc: "happy", blush: true },
    { w: 0.72, h: 0.48, tilt: -6, arc: "happy", blush: true },
  ],
  colere: [
    { w: 0.66, h: 0.52, tilt: 20, arc: null },
    { w: 0.66, h: 0.52, tilt: -20, arc: null },
  ],
  triste: [
    { w: 0.54, h: 0.86, tilt: -20, arc: null },
    { w: 0.54, h: 0.86, tilt: 20, arc: null },
  ],
  effraye: [
    { w: 0.74, h: 1.06, tilt: 0, arc: null },
    { w: 0.74, h: 1.06, tilt: 0, arc: null },
  ],
  mefiant: [
    { w: 0.56, h: 0.94, tilt: 0, arc: null },
    { w: 0.6, h: 0.48, tilt: 0, arc: null },
  ],
  confus: [
    { w: 0.52, h: 0.98, tilt: -10, arc: null },
    { w: 0.66, h: 0.54, tilt: 10, arc: null },
  ],
  curieux: [
    { w: 0.62, h: 1.06, tilt: -5, arc: null },
    { w: 0.46, h: 0.76, tilt: -5, arc: null },
  ],
  fier: [
    { w: 0.66, h: 0.5, tilt: 12, arc: "happy", blush: true },
    { w: 0.66, h: 0.5, tilt: -12, arc: "happy", blush: true },
  ],
  timide: [
    { w: 0.48, h: 0.78, tilt: 0, arc: null, blush: true },
    { w: 0.48, h: 0.78, tilt: 0, arc: null, blush: true },
  ],
  blase: [
    { w: 0.64, h: 0.42, tilt: 0, arc: null },
    { w: 0.64, h: 0.42, tilt: 0, arc: null },
  ],
  somnolent: [
    { w: 0.58, h: 0.44, tilt: 0, arc: "asleep" },
    { w: 0.58, h: 0.44, tilt: 0, arc: "asleep" },
  ],
};

function renderEye(eye: ZodiacEyeSpec, preset: EyeShapePreset, eyeGradId: string) {
  const key = `eye-${eye.group}-${eye.x}-${eye.y}`;
  const cx = eye.x * 100;
  const cy = eye.y * 100;
  const unit = eye.scale * 114;
  const w = unit * preset.w;
  const h = unit * preset.h;
  const rot = eye.tilt + preset.tilt;

  if (preset.arc) {
    const span = unit * 0.34;
    const arch = preset.arc === "happy" ? -unit * 0.28 : unit * 0.22;
    const d = `M ${(-span).toFixed(1)} 0 Q 0 ${arch.toFixed(1)} ${span.toFixed(1)} 0`;
    return (
      <G key={key} transform={`translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
        <Path d={d} fill="none" stroke="#221b28" strokeWidth={Math.max(2.6, unit * 0.16)} strokeLinecap="round" />
      </G>
    );
  }

  const rx = w / 2;
  return (
    <G key={key} transform={`translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) rotate(${rot.toFixed(1)})`}>
      <Rect x={-w / 2} y={-h / 2 + 1.1} width={w} height={h} rx={rx} ry={rx} fill="#231926" opacity={0.22} />
      <Rect x={-w / 2} y={-h / 2} width={w} height={h} rx={rx} ry={rx} fill={`url(#${eyeGradId})`} />
      <Circle cx={-w * 0.16} cy={-h * 0.22} r={Math.max(1.4, w * 0.22)} fill="#fffdf9" opacity={0.96} />
      <Circle cx={w * 0.16} cy={h * 0.2} r={Math.max(0.8, w * 0.11)} fill="#fffdf9" opacity={0.55} />
    </G>
  );
}

function renderCheeks(meta: ZodiacAvatarMeta, cheekGradId: string) {
  return meta.eyes.map((eye) => {
    const unit = eye.scale * 114;
    const side = eye.x < 0 ? -1 : 1;
    const cx = eye.x * 100 + side * unit * 0.45;
    const cy = eye.y * 100 + unit * 0.82;
    return (
      <Ellipse
        key={`cheek-${eye.group}-${eye.x}-${eye.y}`}
        cx={cx}
        cy={cy}
        rx={unit * 0.62}
        ry={unit * 0.36}
        fill={`url(#${cheekGradId})`}
      />
    );
  });
}

export interface ZodiacClayMobileProps {
  seed: string;
  hue?: AvatarHue | null;
  color?: AvatarColor | null;
  size: number;
  mood?: AvatarMood;
  animate?: boolean;
  disconnected?: boolean;
}

export const ZodiacClayMobile = memo(function ZodiacClayMobile({
  seed,
  size,
  mood = "idle",
  animate = false,
  disconnected = false,
}: ZodiacClayMobileProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const eyeGradId = `zc-eye-${rawId}`;
  const cheekGradId = `zc-cheek-${rawId}`;

  const { shape, expression } = bloubAvatarProfile(seed, null);
  const meta = zodiacForShape(shape);
  const source = ZODIAC_BODY_IMAGES[meta.id];
  const visualScale = ZODIAC_VISUAL_SCALE[meta.id];
  const busy = avatarMoodIsBusy(mood);
  const asleep = mood === "asleep" || expression === "somnolent";
  const activeExpression = avatarMoodPresentation(mood).expression ?? expression;
  const ASLEEP_PAIR: readonly [EyeShapePreset, EyeShapePreset] = [
    { w: 0.58, h: 0.44, tilt: 0, arc: "asleep" },
    { w: 0.58, h: 0.44, tilt: 0, arc: "asleep" },
  ];
  const pair: readonly [EyeShapePreset, EyeShapePreset] = asleep
    ? ASLEEP_PAIR
    : (EXPRESSION_EYES[activeExpression] ?? [DEFAULT_EYE, DEFAULT_EYE]);
  const showBlush = !asleep && Boolean(pair[0].blush);

  const breath = useSharedValue(0);
  useEffect(() => {
    if (!animate || disconnected) {
      breath.set(withTiming(0, { duration: 240 }));
      return;
    }
    const duration = busy ? 750 : 1450;
    const easing = Easing.inOut(Easing.sin);
    breath.set(
      withSequence(
        withTiming(-1, { duration: duration / 2, easing }),
        withRepeat(withTiming(1, { duration, easing }), -1, true),
      ),
    );
  }, [animate, breath, busy, disconnected]);

  const rigStyle = useAnimatedStyle(() => {
    const v = breath.get();
    const squish = v * (busy ? 0.022 : 0.014);
    const dy = v * (busy ? -2.2 : 1.4);
    return {
      transform: [{ translateY: dy }, { scaleX: visualScale * (1 - squish) }, { scaleY: visualScale * (1 + squish) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: size,
          height: size,
          opacity: disconnected ? 0.55 : 1,
        },
        rigStyle,
      ]}
    >
      <Image
        accessible={false}
        source={source}
        contentFit="contain"
        cachePolicy="memory"
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size} viewBox="-100 -100 200 200">
          <Defs>
            <RadialGradient id={eyeGradId} cx="36%" cy="28%" r="72%">
              <Stop offset="0%" stopColor="#483b54" />
              <Stop offset="52%" stopColor="#221b28" />
              <Stop offset="100%" stopColor="#140f19" />
            </RadialGradient>
            <RadialGradient id={cheekGradId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ff6c94" stopOpacity={0.62} />
              <Stop offset="100%" stopColor="#ff6c94" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {showBlush ? renderCheeks(meta, cheekGradId) : null}
          {meta.eyes.map((eye, idx) => renderEye(eye, pair[idx % 2] ?? DEFAULT_EYE, eyeGradId))}
          {busy ? (
            <G>
              <Rect
                x={24}
                y={-86}
                width={62}
                height={32}
                rx={16}
                ry={16}
                fill="#fffdf9"
                fillOpacity={0.95}
                stroke="#282030"
                strokeOpacity={0.14}
                strokeWidth={2}
              />
              <Circle cx={39} cy={-70} r={5} fill="#2d2534" />
              <Circle cx={55} cy={-70} r={5} fill="#2d2534" />
              <Circle cx={71} cy={-70} r={5} fill="#2d2534" />
            </G>
          ) : null}
          {asleep ? (
            <G>
              <Path
                d="M 40 -56 L 52 -56 L 40 -44 L 52 -44"
                fill="none"
                stroke={meta.color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M 56 -80 L 72 -80 L 56 -64 L 72 -64"
                fill="none"
                stroke={meta.color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          ) : null}
        </Svg>
      </View>
    </Animated.View>
  );
});
