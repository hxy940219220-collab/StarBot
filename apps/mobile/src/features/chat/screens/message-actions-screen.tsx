import { type AttachmentSummary, MESSAGE_REACTIONS, MORE_MESSAGE_REACTIONS } from "@openbot/contracts/ipc";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import Copy from "lucide-react-native/icons/copy";
import SmilePlus from "lucide-react-native/icons/face-slightly-smiling-plus";
import Forward from "lucide-react-native/icons/forward";
import GitFork from "lucide-react-native/icons/git-fork";
import Hash from "lucide-react-native/icons/hash";
import Pin from "lucide-react-native/icons/pin";
import PinOff from "lucide-react-native/icons/pin-off";
import Reply from "lucide-react-native/icons/reply";
import Square from "lucide-react-native/icons/square";
import TextCursor from "lucide-react-native/icons/text-cursor";
import Trash2 from "lucide-react-native/icons/trash";
import Volume2 from "lucide-react-native/icons/volume-2";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable, useUniwind } from "uniwind";
import { canReadAloud, toggleReadAloud, useReadingAloud } from "@/features/voice/model/message-reading";
import { CoveringMenuView } from "@/shared/components/covering-menu-view";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { useText } from "@/shared/lib/text";
import { MIRROR_IN_RTL } from "@/shared/lib/text-direction";
import { uiFeedback } from "@/shared/lib/ui-feedback";
import { MessageFileActions } from "../components/message-file-actions";
import { copyToClipboard } from "../components/use-copy-message";
import { MOBILE_LARGE_FILE_BYTES } from "../model/large-files";
import { releaseMessageActions, useMessageActionsRequest } from "../model/message-actions-sheet";

const ICON_SIZE = 19;
const NO_FILES: readonly AttachmentSummary[] = [];
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export function MessageActionsScreen() {
  const { t, format } = useText();
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const request = useMessageActionsRequest();
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const danger = String(useCSSVariable("--openbot-danger-text"));
  const surfaceBg = String(useCSSVariable("--openbot-bg-grouped") ?? "#ffffff");
  const borderColor = String(useCSSVariable("--openbot-border-grouped") ?? "rgba(0,0,0,0.08)");
  const [moreEmoji, setMoreEmoji] = useState(false);
  const reading = useReadingAloud(request?.readAloudId ?? "");
  const attachments = (request?.files?.attachments ?? NO_FILES).filter(
    (attachment) => attachment.size <= MOBILE_LARGE_FILE_BYTES,
  );
  const afterClose = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    uiFeedback.open();
  }, []);

  useEffect(
    () => () => {
      releaseMessageActions(request);
      afterClose.current?.();
      afterClose.current = undefined;
    },
    [request],
  );

  if (!request) return null;

  const close = () => {
    uiFeedback.close();
    router.back();
  };

  const run = (action: () => void) => {
    uiFeedback.confirm();
    action();
    router.back();
  };

  const iconColor = String(foreground);
  const readAloudId = request.copyText ? request.readAloudId : undefined;
  const sendToChannel = request.sendToChannel?.channels.length ? request.sendToChannel : undefined;
  const afterSheet = (action: () => void) => {
    afterClose.current = action;
    router.back();
  };
  const sent = request.createdAt
    ? format.date(new Date(request.createdAt), { dateStyle: "short", timeStyle: "short" })
    : undefined;

  const reactionList = moreEmoji
    ? [...new Set([...QUICK_EMOJIS, ...MESSAGE_REACTIONS, ...MORE_MESSAGE_REACTIONS])]
    : [...QUICK_EMOJIS];

  const handleForward = () => {
    const shareText = request.copyText?.trim();
    if (!shareText) return;
    afterSheet(() => {
      void Share.share({ message: shareText }).catch(() => undefined);
    });
  };

  return (
    <View className="flex-1">
      <Animated.View entering={FadeIn.duration(150)} style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={52}
          tint={theme === "dark" ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme === "dark" ? "rgba(0,0,0,0.34)" : "rgba(0,0,0,0.14)" },
          ]}
          onPress={close}
        />
      </Animated.View>

      <View
        pointerEvents="box-none"
        className="flex-1 justify-center px-5"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
      >
        <Animated.View
          entering={ZoomIn.duration(180).reduceMotion(ReduceMotion.System)}
          className="gap-3"
          pointerEvents="box-none"
        >
          {/* Floating single-row Emoji Reaction Pill */}
          {request.onReact ? (
            <View
              accessibilityRole="toolbar"
              accessibilityLabel={t("mobile.chat.message.addReaction")}
              className="self-start rounded-full px-2 py-1.5"
              style={{
                backgroundColor: surfaceBg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.14,
                shadowRadius: 16,
                maxWidth: "100%",
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: "center", gap: 4 }}
              >
                {reactionList.map((emoji) => {
                  const selected = emoji === request.ownReaction;
                  return (
                    <SpringPressable
                      key={emoji}
                      feedback="tick"
                      scaleTo={0.86}
                      accessibilityRole="button"
                      accessibilityLabel={
                        selected
                          ? t("mobile.chat.message.removeReaction", { emoji })
                          : t("mobile.chat.message.react", { emoji })
                      }
                      accessibilityState={{ selected }}
                      onPress={() => run(() => request.onReact?.(selected ? null : emoji))}
                      className="size-10 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: selected ? "rgba(124,58,237,0.16)" : "transparent",
                      }}
                    >
                      <Typography className="text-[22px]">{emoji}</Typography>
                    </SpringPressable>
                  );
                })}
                {!moreEmoji ? (
                  <SpringPressable
                    feedback="tick"
                    scaleTo={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={t("mobile.chat.message.moreEmoji")}
                    onPress={() => setMoreEmoji(true)}
                    className="size-9 items-center justify-center rounded-full bg-control"
                  >
                    <SmilePlus size={19} color={String(muted)} />
                  </SpringPressable>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {/* Highlighted Message Preview Bubble */}
          {request.copyText?.trim() ? (
            <View
              className="max-w-[88%] self-start rounded-2xl px-4 py-3"
              style={{
                backgroundColor: surfaceBg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 14,
              }}
            >
              <Typography className="text-[15px] leading-5 text-foreground" numberOfLines={5}>
                {request.copyText.trim()}
              </Typography>
            </View>
          ) : null}

          {attachments.length > 0 && request.files ? (
            <View
              className="w-64 overflow-hidden rounded-2xl"
              style={{
                backgroundColor: surfaceBg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 18,
              }}
            >
              <MessageFileActions
                serverId={request.files.serverId}
                attachments={attachments}
                iconColor={iconColor}
                afterSheet={afterSheet}
              />
            </View>
          ) : null}

          {/* Compact Floating Action Popover Card */}
          <View
            className="w-60 self-start overflow-hidden rounded-2xl"
            style={{
              backgroundColor: surfaceBg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.16,
              shadowRadius: 20,
            }}
          >
            {sent ? (
              <View className="px-4 pt-3 pb-1.5">
                <Typography className="text-xs text-muted">{sent}</Typography>
              </View>
            ) : null}

            {request.onReply ? (
              <PopoverRow
                icon={<Reply size={ICON_SIZE} color={iconColor} style={MIRROR_IN_RTL} />}
                label={t("mobile.app.chatQuote")}
                onPress={() => run(() => request.onReply?.())}
              />
            ) : null}

            {request.onTogglePin ? (
              <PopoverRow
                icon={
                  request.pinned ? (
                    <PinOff size={ICON_SIZE} color={iconColor} />
                  ) : (
                    <Pin size={ICON_SIZE} color={iconColor} />
                  )
                }
                label={request.pinned ? t("mobile.chat.pins.unpin") : t("mobile.chat.pins.pin")}
                onPress={() => run(() => request.onTogglePin?.())}
              />
            ) : null}

            {request.copyText ? (
              <PopoverRow
                icon={<Copy size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.chat.message.copy")}
                onPress={() => run(() => void copyToClipboard(request.copyText, "mobile.chat.message.copyFailed", t))}
              />
            ) : null}

            {request.copyText?.trim() ? (
              <PopoverRow
                icon={<Forward size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.app.chatForward")}
                onPress={handleForward}
              />
            ) : null}

            {sendToChannel ? (
              <CoveringMenuView
                accessibilityLabel={t("mobile.chat.message.sendToChannel")}
                title={t("mobile.chat.message.chooseChannel")}
                actions={sendToChannel.channels.map((channel) => ({ id: channel.id, title: channel.name }))}
                onPressAction={({ nativeEvent }) => {
                  const channelId = nativeEvent.event;
                  if (!sendToChannel.channels.some((channel) => channel.id === channelId)) return;
                  uiFeedback.confirm();
                  afterClose.current = () => sendToChannel.onSend(channelId);
                  router.back();
                }}
              >
                <View className="flex-row items-center gap-3 px-4 py-3">
                  <Hash size={ICON_SIZE} color={iconColor} />
                  <Typography className="text-[15px] text-foreground">
                    {t("mobile.chat.message.sendToChannel")}
                  </Typography>
                </View>
              </CoveringMenuView>
            ) : null}

            {request.onSelectText ? (
              <PopoverRow
                icon={<TextCursor size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.chat.message.selectText")}
                onPress={() => {
                  uiFeedback.tap();
                  afterClose.current = request.onSelectText;
                  router.back();
                }}
              />
            ) : null}

            {request.onBranch ? (
              <PopoverRow
                icon={<GitFork size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.chat.message.branch")}
                onPress={() => run(() => request.onBranch?.())}
              />
            ) : null}

            {readAloudId && canReadAloud ? (
              <PopoverRow
                icon={
                  reading ? (
                    <Square size={ICON_SIZE} color={iconColor} />
                  ) : (
                    <Volume2 size={ICON_SIZE} color={iconColor} />
                  )
                }
                label={reading ? t("mobile.chat.message.stopReading") : t("mobile.chat.message.readAloud")}
                onPress={() => run(() => toggleReadAloud(readAloudId, request.copyText))}
              />
            ) : null}

            {request.onDelete ? (
              <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }}>
                <PopoverRow
                  icon={<Trash2 size={ICON_SIZE} color={danger} />}
                  label={t("common.delete")}
                  danger
                  onPress={() => {
                    uiFeedback.recCancel();
                    afterClose.current = request.onDelete;
                    router.back();
                  }}
                />
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function PopoverRow({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3"
      style={({ pressed }) => ({
        backgroundColor: pressed ? "rgba(128,128,128,0.12)" : "transparent",
      })}
    >
      {icon}
      <Typography className={danger ? "text-[15px] text-danger-text" : "text-[15px] text-foreground"}>
        {label}
      </Typography>
    </Pressable>
  );
}
