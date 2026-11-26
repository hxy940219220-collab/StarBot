import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { AppLogoAnimation } from "@/features/auth/components/use-app-logo-motion";
import { useText } from "@/shared/lib/text";

const STARBOT_BADGE = require("../../../../assets/zodiac/starbot-badge.webp");

export interface AppLogoProps {
  animation?: AppLogoAnimation;
  interactive?: boolean;
  size?: number;
}

export function AppLogo({ interactive = false, size = 240 }: AppLogoProps) {
  const { t } = useText();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  const logo = (
    <Animated.View
      style={[{ height: size, width: size }, animatedStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        accessible={false}
        source={STARBOT_BADGE}
        contentFit="contain"
        cachePolicy="memory"
        style={{ width: size, height: size }}
      />
    </Animated.View>
  );

  if (!interactive) {
    return <View style={{ height: size, width: size }}>{logo}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("mobile.auth.logo.animate")}
      accessibilityHint={t("mobile.auth.logo.animateHint")}
      onPressIn={() => {
        scale.set(0.9);
      }}
      onPressOut={() => {
        scale.set(withSpring(1, { duration: 420, dampingRatio: 0.52 }));
      }}
      pressRetentionOffset={12}
    >
      {logo}
    </Pressable>
  );
}
