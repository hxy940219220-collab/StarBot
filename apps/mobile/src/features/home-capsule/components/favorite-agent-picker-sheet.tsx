import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import Check from "lucide-react-native/icons/check";
import Sparkles from "lucide-react-native/icons/sparkles";
import X from "lucide-react-native/icons/x";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import type { MobileAgent } from "@/features/workspace/context/mobile-workspace-context";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { useText } from "@/shared/lib/text";
import { uiFeedback } from "@/shared/lib/ui-feedback";

const BRAND_PURPLE = "#7c3aed";

export function FavoriteAgentPickerSheet({
  visible,
  agents,
  pinnedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  agents: readonly MobileAgent[];
  pinnedId: string | null;
  onSelect: (agentId: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const muted = String(useThemeColor("muted"));
  const sheetBg = String(useCSSVariable("--openbot-bg-sheet"));
  const cardBg = String(useCSSVariable("--openbot-bg-grouped"));
  const borderColor = String(useCSSVariable("--openbot-border-grouped"));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/35">
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: "68%",
          }}
        >
          <View className="items-center pt-3 pb-2">
            <View className="h-1.5 w-10 rounded-full bg-foreground/20" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Typography className="font-bold text-lg text-foreground">
              {t("mobile.app.capsule.favoriteTitle")}
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

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
            <SpringPressable
              feedback="tick"
              scaleTo={0.98}
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              className="flex-row items-center justify-between rounded-2xl px-4 py-3.5"
              style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="size-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(124,58,237,0.12)" }}
                >
                  <Sparkles color={BRAND_PURPLE} size={18} />
                </View>
                <Typography className="font-medium text-[15px] text-foreground">
                  {t("mobile.app.capsule.favoriteAuto")}
                </Typography>
              </View>
              {pinnedId === null ? <Check color={BRAND_PURPLE} size={19} strokeWidth={2.4} /> : null}
            </SpringPressable>

            <View
              className="overflow-hidden rounded-2xl"
              style={{ backgroundColor: cardBg, borderWidth: 1, borderColor }}
            >
              {agents.map((agent, idx) => {
                const selected = pinnedId === agent.id;
                return (
                  <SpringPressable
                    key={agent.id}
                    feedback="none"
                    scaleTo={0.985}
                    onPress={() => {
                      uiFeedback.confirm();
                      onSelect(agent.id);
                      onClose();
                    }}
                    className="flex-row items-center justify-between px-4 py-3"
                    style={idx > 0 ? { borderTopWidth: 1, borderTopColor: borderColor } : undefined}
                  >
                    <View className="min-w-0 flex-1 flex-row items-center gap-3">
                      <BloubAvatar
                        agentId={agent.id}
                        serverId={agent.serverId}
                        hue={agent.avatarHue}
                        color={agent.avatarColor}
                        seed={agent.avatarSeed}
                        avatarUrl={agent.avatarUrl}
                        size={42}
                        animateIdle={false}
                      />
                      <View className="min-w-0 flex-1">
                        <Typography className="font-semibold text-[15px] text-foreground" numberOfLines={1}>
                          {agent.name}
                        </Typography>
                        {selected ? (
                          <Typography className="text-xs" style={{ color: BRAND_PURPLE }}>
                            {t("mobile.app.capsule.favoritePinned")}
                          </Typography>
                        ) : null}
                      </View>
                    </View>
                    {selected ? <Check color={BRAND_PURPLE} size={19} strokeWidth={2.4} /> : null}
                  </SpringPressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
