import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import X from "lucide-react-native/icons/x";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useCSSVariable } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import {
  type BillingRangeId,
  billingDateRange,
  formatCompactTokens,
  formatCompactUsd,
  useHomeBilling,
} from "@/features/home-capsule/model/home-billing";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { useText } from "@/shared/lib/text";
import { uiFeedback } from "@/shared/lib/ui-feedback";

const BRAND_PURPLE = "#7c3aed";
const SHEET_SPRING = { duration: 320, dampingRatio: 0.84, reduceMotion: ReduceMotion.System } as const;

export function BillingSheet({
  visible,
  serverId,
  onClose,
}: {
  visible: boolean;
  serverId: string;
  onClose: () => void;
}) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [rangeId, setRangeId] = useState<BillingRangeId>("month");
  const billing = useHomeBilling(serverId, rangeId);
  const muted = String(useThemeColor("muted"));
  const sheetBg = String(useCSSVariable("--starbot-bg-sheet"));
  const cardBg = String(useCSSVariable("--starbot-bg-grouped"));
  const borderColor = String(useCSSVariable("--starbot-border-grouped"));

  const halfHeight = Math.round(screenHeight * 0.62);
  const fullHeight = Math.round(screenHeight * 0.91);
  const sheetHeight = useSharedValue(halfHeight);
  const dragStart = useSharedValue(halfHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      sheetHeight.set(halfHeight);
      backdropOpacity.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    } else {
      backdropOpacity.set(0);
    }
  }, [visible, halfHeight, sheetHeight, backdropOpacity]);

  const dismiss = () => {
    uiFeedback.close();
    onClose();
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragStart.set(sheetHeight.get());
    })
    .onUpdate((event) => {
      const next = Math.max(halfHeight * 0.55, Math.min(fullHeight, dragStart.get() - event.translationY));
      sheetHeight.set(next);
    })
    .onEnd((event) => {
      const current = sheetHeight.get();
      if (current < halfHeight * 0.78 || event.velocityY > 900) {
        scheduleOnRN(dismiss);
        return;
      }
      const expand = current > (halfHeight + fullHeight) / 2 || event.velocityY < -600;
      sheetHeight.set(withSpring(expand ? fullHeight : halfHeight, SHEET_SPRING));
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.get(),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const ranges: readonly { id: BillingRangeId; label: string }[] = [
    { id: "7d", label: t("mobile.app.capsule.range7d") },
    { id: "month", label: t("mobile.app.capsule.rangeMonth") },
    { id: "all", label: t("mobile.app.capsule.rangeAll") },
  ];

  const openAgentDetail = (agentId: string) => {
    uiFeedback.open();
    onClose();
    const dates = billingDateRange(rangeId);
    router.push({
      pathname: "/agent-info/[agentId]/usage",
      params: { agentId, serverId, ...dates },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 justify-end">
          <Animated.View
            style={[
              {
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.36)",
              },
              backdropStyle,
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={dismiss} />
          </Animated.View>

          <Animated.View
            style={[
              {
                backgroundColor: sheetBg,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: Math.max(insets.bottom, 16),
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.14,
                shadowRadius: 18,
                overflow: "hidden",
              },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View className="items-center pt-3 pb-2">
                <View className="h-1.5 w-10 rounded-full bg-foreground/20" />
                <View className="mt-3 w-full flex-row items-center justify-between px-5">
                  <Typography className="font-bold text-xl text-foreground">
                    {t("mobile.app.capsule.billingTitle")}
                  </Typography>
                  <SpringPressable
                    feedback="close"
                    accessibilityRole="button"
                    accessibilityLabel={t("common.close")}
                    className="size-8 items-center justify-center rounded-full bg-control"
                    onPress={onClose}
                  >
                    <X color={muted} size={17} strokeWidth={2.2} />
                  </SpringPressable>
                </View>
              </View>
            </GestureDetector>

            <View className="px-5 pt-1 pb-3">
              <View className="flex-row rounded-2xl bg-control p-1">
                {ranges.map((item) => {
                  const active = rangeId === item.id;
                  return (
                    <SpringPressable
                      key={item.id}
                      feedback="tick"
                      scaleTo={0.97}
                      className="flex-1 items-center justify-center rounded-xl py-2"
                      style={{
                        backgroundColor: active ? cardBg : "transparent",
                      }}
                      onPress={() => setRangeId(item.id)}
                    >
                      <Typography
                        className={
                          active ? "font-semibold text-sm text-foreground" : "font-medium text-sm text-text-secondary"
                        }
                      >
                        {item.label}
                      </Typography>
                    </SpringPressable>
                  );
                })}
              </View>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                className="flex-row items-center justify-between rounded-2xl px-4 py-4"
                style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
              >
                <View className="flex-1 items-center gap-1">
                  <Typography className="text-xs text-text-secondary">{t("mobile.app.capsule.totalSpend")}</Typography>
                  <Typography className="font-bold text-xl" style={{ color: BRAND_PURPLE }}>
                    {formatCompactUsd(billing.totalCostUsd)}
                  </Typography>
                </View>
                <View className="h-8 w-px bg-foreground/10" />
                <View className="flex-1 items-center gap-1">
                  <Typography className="text-xs text-text-secondary">{t("mobile.app.capsule.totalTokens")}</Typography>
                  <Typography className="font-bold text-xl text-foreground">
                    {formatCompactTokens(billing.totalTokens)}
                  </Typography>
                </View>
                <View className="h-8 w-px bg-foreground/10" />
                <View className="flex-1 items-center gap-1">
                  <Typography className="text-xs text-text-secondary">{t("mobile.app.capsule.totalTurns")}</Typography>
                  <Typography className="font-bold text-xl text-foreground">{billing.totalTurns}</Typography>
                </View>
              </View>

              <View className="gap-2.5">
                <Typography className="px-1 font-semibold text-sm text-text-secondary">
                  {t("mobile.app.capsule.agentRanking")}
                </Typography>

                <View
                  className="overflow-hidden rounded-2xl"
                  style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
                >
                  {billing.agents.length === 0 ? (
                    <View className="items-center py-10">
                      <Typography className="text-sm text-text-secondary">
                        {t("mobile.app.capsule.noUsageYet")}
                      </Typography>
                    </View>
                  ) : (
                    billing.agents.map((item, idx) => {
                      const pct = Math.round(item.share * 100);
                      return (
                        <SpringPressable
                          key={item.agentId}
                          feedback="none"
                          scaleTo={0.985}
                          onPress={() => openAgentDetail(item.agentId)}
                          className="px-4 py-3.5"
                          style={idx > 0 ? { borderTopWidth: 1, borderTopColor: borderColor } : undefined}
                        >
                          <View className="flex-row items-center gap-3">
                            {item.agent ? (
                              <BloubAvatar
                                agentId={item.agent.id}
                                serverId={item.agent.serverId}
                                hue={item.agent.avatarHue}
                                color={item.agent.avatarColor}
                                seed={item.agent.avatarSeed}
                                avatarUrl={item.agent.avatarUrl}
                                size={42}
                                animateIdle={false}
                              />
                            ) : (
                              <View className="size-10 items-center justify-center rounded-full bg-control">
                                <Typography className="font-semibold text-sm text-foreground">
                                  {item.name.slice(0, 1)}
                                </Typography>
                              </View>
                            )}
                            <View className="min-w-0 flex-1 gap-1.5">
                              <View className="flex-row items-center justify-between gap-2">
                                <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                                  <Typography className="font-semibold text-[15px] text-foreground" numberOfLines={1}>
                                    {item.name}
                                  </Typography>
                                  {item.model ? (
                                    <Typography
                                      className="rounded-md bg-control px-1.5 py-0.5 text-[11px] text-text-secondary"
                                      numberOfLines={1}
                                    >
                                      {item.model}
                                    </Typography>
                                  ) : null}
                                </View>
                                <View className="flex-row items-center gap-1">
                                  <Typography className="font-bold text-[15px] text-foreground">
                                    {formatCompactUsd(item.costUsd)}
                                  </Typography>
                                  <ChevronRight color={muted} size={15} />
                                </View>
                              </View>

                              <View className="flex-row items-center gap-2">
                                <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                                  <View
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.max(4, Math.min(100, pct))}%`,
                                      backgroundColor: BRAND_PURPLE,
                                    }}
                                  />
                                </View>
                                <Typography className="w-9 text-right font-medium text-xs text-text-secondary">
                                  {`${pct}%`}
                                </Typography>
                              </View>

                              <Typography className="text-xs text-text-secondary">
                                {`${formatCompactTokens(item.tokens)} Tokens · ${t("mobile.app.capsule.turnsCount", { count: item.turns })}`}
                              </Typography>
                            </View>
                          </View>
                        </SpringPressable>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
