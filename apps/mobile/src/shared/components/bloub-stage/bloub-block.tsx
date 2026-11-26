import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReducedMotion } from "@/shared/lib/motion";
import { EYES_HEIGHT } from "./bloub-eyes";
import { BLOUB_MOVE, BLOUB_RADIUS, bloubEyesFrame, bloubGradient, useBloubColors } from "./bloub-look";

const STARBOT_BLOCK_MASCOT = require("../../../../assets/zodiac/starbot-badge.webp");

export type BloubEdge = "cover" | "gone" | number;

export function BloubBlock({ edge, dimmed }: { edge: BloubEdge; dimmed: boolean }) {
  const window = useWindowDimensions();
  const [height, setHeight] = useState(window.height);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const colors = useBloubColors();
  const span = height + BLOUB_RADIUS;
  const target = edge === "cover" ? span : edge === "gone" ? 0 : edge;
  const position = useSharedValue(span);
  useEffect(() => {
    position.set(reduced ? target : withTiming(target, BLOUB_MOVE));
  }, [position, reduced, target]);

  const top = insets.top;
  const blockStyle = useAnimatedStyle(() => ({ transform: [{ translateY: position.get() - span }] }));
  const lightStyle = useAnimatedStyle(() => ({ transform: [{ translateY: span - position.get() }] }));
  const mascotStyle = useAnimatedStyle(() => {
    const frame = bloubEyesFrame(position.get(), height, top);
    return {
      opacity: frame.opacity,
      transform: [{ translateY: frame.center - EYES_HEIGHT / 2 }, { scale: frame.scale }],
    };
  });
  const body = dimmed ? colors.dimBody : colors.body;
  const light = dimmed ? colors.dimLight : colors.light;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      onLayout={({ nativeEvent: { layout } }) => setHeight(layout.height)}
    >
      <Animated.View style={[styles.block, { height: span }, blockStyle]}>
        <View style={[styles.clip, { backgroundColor: body }]}>
          <Animated.View
            style={[styles.light, { height, experimental_backgroundImage: bloubGradient(light, body) }, lightStyle]}
          />
        </View>
      </Animated.View>
      <Animated.View style={[styles.mascotWrap, { left: (window.width - 132) / 2 }, mascotStyle]}>
        <Image source={STARBOT_BLOCK_MASCOT} contentFit="contain" style={styles.mascot} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { position: "absolute", left: 0, right: 0, top: 0 },
  clip: {
    flex: 1,
    overflow: "hidden",
    borderBottomLeftRadius: BLOUB_RADIUS,
    borderBottomRightRadius: BLOUB_RADIUS,
    borderCurve: "continuous",
  },
  light: { position: "absolute", left: 0, right: 0, top: 0 },
  mascotWrap: { position: "absolute", top: 0, width: 132, height: 132 },
  mascot: { width: 132, height: 132 },
});
