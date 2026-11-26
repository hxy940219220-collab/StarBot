import type { PropsWithChildren } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { type UiSoundKind, uiFeedback } from "@/shared/lib/ui-feedback";

const PRESS_SPRING = { duration: 220, dampingRatio: 0.72, reduceMotion: ReduceMotion.System } as const;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface SpringPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  className?: string;
  scaleTo?: number;
  feedback?: UiSoundKind | "none";
}

export function SpringPressable({
  children,
  style,
  className,
  scaleTo = 0.96,
  feedback = "tap",
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PropsWithChildren<SpringPressableProps>) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      className={className}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, PRESS_SPRING));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, PRESS_SPRING));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback !== "none") {
          uiFeedback[feedback]();
        }
        onPress?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
