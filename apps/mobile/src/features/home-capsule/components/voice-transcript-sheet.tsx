import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import Send from "lucide-react-native/icons/send";
import X from "lucide-react-native/icons/x";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import type { MobileAgent } from "@/features/workspace/context/mobile-workspace-context";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { useText } from "@/shared/lib/text";

const BRAND_PURPLE = "#7c3aed";

export function VoiceTranscriptSheet({
  visible,
  initialText,
  agents,
  defaultAgentId,
  onSend,
  onClose,
}: {
  visible: boolean;
  initialText: string;
  agents: readonly MobileAgent[];
  defaultAgentId: string | null;
  onSend: (agent: MobileAgent, text: string) => void;
  onClose: () => void;
}) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const sheetBg = String(useCSSVariable("--openbot-bg-sheet"));
  const cardBg = String(useCSSVariable("--openbot-bg-grouped"));
  const borderColor = String(useCSSVariable("--openbot-border-grouped"));

  const [text, setText] = useState(initialText);
  const [selectedId, setSelectedId] = useState<string | null>(defaultAgentId);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setSelectedId(defaultAgentId ?? agents[0]?.id ?? null);
    }
  }, [visible, initialText, defaultAgentId, agents]);

  const target = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;
  const canSend = Boolean(target && text.trim().length > 0);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/35"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: sheetBg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            paddingHorizontal: 20,
            paddingTop: 14,
            gap: 14,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Typography className="font-bold text-lg text-foreground">
              {t("mobile.app.capsule.transcriptTitle")}
            </Typography>
            <SpringPressable
              feedback="close"
              accessibilityRole="button"
              accessibilityLabel={t("common.close")}
              className="size-8 items-center justify-center rounded-full bg-control"
              onPress={onClose}
            >
              <X color={String(muted)} size={17} strokeWidth={2.2} />
            </SpringPressable>
          </View>

          <View className="gap-2">
            <Typography className="text-xs text-text-secondary">{t("mobile.app.capsule.sendToLabel")}</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {agents.map((agent) => {
                const active = target?.id === agent.id;
                return (
                  <SpringPressable
                    key={agent.id}
                    feedback="tick"
                    scaleTo={0.96}
                    onPress={() => setSelectedId(agent.id)}
                    className="flex-row items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2"
                    style={{
                      backgroundColor: active ? "rgba(124,58,237,0.14)" : cardBg,
                      borderWidth: 1.5,
                      borderColor: active ? BRAND_PURPLE : borderColor,
                    }}
                  >
                    <BloubAvatar
                      agentId={agent.id}
                      serverId={agent.serverId}
                      hue={agent.avatarHue}
                      color={agent.avatarColor}
                      seed={agent.avatarSeed}
                      avatarUrl={agent.avatarUrl}
                      size={28}
                      animateIdle={false}
                    />
                    <Typography
                      className="font-medium text-sm"
                      style={{ color: active ? BRAND_PURPLE : String(foreground) }}
                    >
                      {agent.name}
                    </Typography>
                  </SpringPressable>
                );
              })}
            </ScrollView>
          </View>

          <TextInput
            autoFocus
            multiline
            value={text}
            onChangeText={setText}
            placeholder={t("mobile.app.capsule.transcriptPlaceholder")}
            placeholderTextColor={String(muted)}
            className="min-h-24 rounded-2xl p-3.5 text-base text-foreground"
            style={{
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor,
              textAlignVertical: "top",
            }}
          />

          <View className="flex-row justify-end gap-2.5">
            <SpringPressable
              feedback="close"
              onPress={onClose}
              className="items-center justify-center rounded-full bg-control px-5 py-2.5"
            >
              <Typography className="font-medium text-sm text-foreground">{t("common.cancel")}</Typography>
            </SpringPressable>
            <SpringPressable
              feedback="none"
              disabled={!canSend}
              onPress={() => {
                if (!target || !text.trim()) return;
                onSend(target, text.trim());
                onClose();
              }}
              className="flex-row items-center gap-1.5 rounded-full px-5 py-2.5"
              style={{
                backgroundColor: BRAND_PURPLE,
                opacity: canSend ? 1 : 0.4,
              }}
            >
              <Send color="#ffffff" size={15} strokeWidth={2.2} />
              <Typography className="font-semibold text-sm" style={{ color: "#ffffff" }}>
                {t("mobile.app.capsule.sendNow")}
              </Typography>
            </SpringPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
