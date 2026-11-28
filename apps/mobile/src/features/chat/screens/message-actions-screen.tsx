import { type AttachmentSummary, MESSAGE_REACTIONS, MORE_MESSAGE_REACTIONS } from "@starbot/contracts/ipc";
import { BlurView } from "expo-blur";
import { Typography } from "heroui-native";
import Copy from "lucide-react-native/icons/copy";
import SmilePlus from "lucide-react-native/icons/face-slightly-smiling-plus";
import Forward from "lucide-react-native/icons/forward";
import GitFork from "lucide-react-native/icons/git-fork";
import Hash from "lucide-react-native/icons/hash";
import Reply from "lucide-react-native/icons/reply";
import Square from "lucide-react-native/icons/square";
import TextCursor from "lucide-react-native/icons/text-cursor";
import Trash2 from "lucide-react-native/icons/trash";
import Volume2 from "lucide-react-native/icons/volume-2";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, ReduceMotion, ZoomIn } from "react-native-reanimated";
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
import { closeMessageActions, useMessageActionsRequest } from "../model/message-actions-sheet";

const ICON_SIZE = 17;
const NO_FILES: readonly AttachmentSummary[] = [];
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

function pad2(num: number): string {
  return String(num).padStart(2, "0");
}

export function MessageActionsOverlay() {
  const { t, format } = useText();
  const insets = useSafeAreaInsets();
  const { theme } = useUniwind();
  const dark = theme === "dark";
  const request = useMessageActionsRequest();
  const danger = String(useCSSVariable("--starbot-danger-text") ?? "#ef4444");

  // Crisp pure card surface + defined edge border & multi-layer elevation shadow (matching Cue reference!)
  const cardSurface = dark ? "#24242c" : "#ffffff";
  const cardBorder = dark ? "rgba(255, 255, 255, 0.14)" : "rgba(15, 23, 42, 0.09)";
  const dividerColor = dark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.06)";
  const iconColor = dark ? "#f4f4f5" : "#18181b";
  const mutedText = dark ? "#a1a1aa" : "#8e8e93";

  const [moreEmoji, setMoreEmoji] = useState(false);
  const reading = useReadingAloud(request?.readAloudId ?? "");

  useEffect(() => {
    if (!request) {
      setMoreEmoji(false);
      return;
    }
    uiFeedback.open();
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      uiFeedback.close();
      closeMessageActions();
      return true;
    });
    return () => sub.remove();
  }, [request]);

  if (!request) return null;

  const attachments = (request.files?.attachments ?? NO_FILES).filter(
    (attachment) => attachment.size <= MOBILE_LARGE_FILE_BYTES,
  );

  const close = () => {
    uiFeedback.close();
    closeMessageActions();
  };

  const runAfterClose = (action: () => void, feedback: "confirm" | "tap" | "cancel" = "confirm") => {
    if (feedback === "confirm") uiFeedback.confirm();
    else if (feedback === "cancel") uiFeedback.recCancel();
    else uiFeedback.tap();
    closeMessageActions();
    setTimeout(action, 40);
  };

  const readAloudId = request.copyText ? request.readAloudId : undefined;
  const sendToChannel = request.sendToChannel?.channels.length ? request.sendToChannel : undefined;

  // Smart human-friendly relative timestamp ("今天, 08:44" / "昨天, 21:43")
  const sentLabel = (() => {
    if (!request.createdAt) return undefined;
    const d = new Date(request.createdAt);
    if (Number.isNaN(d.getTime())) return undefined;
    const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (isToday) return t("mobile.app.chatTimeToday", { time: hhmm });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();
    if (isYesterday) return t("mobile.app.chatTimeYesterday", { time: hhmm });
    return `${format.date(d, { month: "short", day: "numeric" })}, ${hhmm}`;
  })();

  const expandedEmojis = [...new Set([...QUICK_EMOJIS, ...MESSAGE_REACTIONS, ...MORE_MESSAGE_REACTIONS])].slice(0, 18);
  const isEnd = request.align === "end";

  const handleForward = () => {
    const shareText = request.copyText?.trim();
    if (!shareText) return;
    runAfterClose(() => {
      void Share.share({ message: shareText }).catch(() => undefined);
    }, "tap");
  };

  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      exiting={FadeOut.duration(120)}
      style={[StyleSheet.absoluteFill, { zIndex: 999 }]}
      pointerEvents="box-none"
    >
      {/* Crisp Frosted Backdrop */}
      <View style={StyleSheet.absoluteFill}>
        <BlurView
          intensity={50}
          tint={dark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: dark ? "rgba(0, 0, 0, 0.42)" : "rgba(241, 243, 249, 0.42)",
            },
          ]}
          onPress={close}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 18,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View
          pointerEvents="box-none"
          style={{
            gap: 8,
            alignItems: isEnd ? "flex-end" : "flex-start",
          }}
        >
          {/* 1. Crisp Elevated Emoji Reaction Pill */}
          {request.onReact ? (
            <Animated.View
              entering={ZoomIn.springify().damping(19).stiffness(280).reduceMotion(ReduceMotion.System)}
              accessibilityRole="toolbar"
              accessibilityLabel={t("mobile.chat.message.addReaction")}
              style={{
                backgroundColor: cardSurface,
                borderRadius: moreEmoji ? 24 : 26,
                paddingHorizontal: 9,
                paddingVertical: 5,
                maxWidth: 320,
                borderWidth: 1,
                borderColor: cardBorder,
                shadowColor: "#0f172a",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: dark ? 0.36 : 0.12,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {!moreEmoji ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 38 }}>
                  {QUICK_EMOJIS.map((emoji) => {
                    const selected = emoji === request.ownReaction;
                    return (
                      <SpringPressable
                        key={emoji}
                        feedback="tick"
                        scaleTo={0.82}
                        accessibilityRole="button"
                        accessibilityLabel={
                          selected
                            ? t("mobile.chat.message.removeReaction", { emoji })
                            : t("mobile.chat.message.react", { emoji })
                        }
                        accessibilityState={{ selected }}
                        onPress={() => runAfterClose(() => request.onReact?.(selected ? null : emoji))}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? "rgba(124,58,237,0.15)" : "transparent",
                        }}
                      >
                        <Typography className="text-[23px]">{emoji}</Typography>
                      </SpringPressable>
                    );
                  })}
                  <SpringPressable
                    feedback="tick"
                    scaleTo={0.86}
                    accessibilityRole="button"
                    accessibilityLabel={t("mobile.chat.message.moreEmoji")}
                    onPress={() => setMoreEmoji(true)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 2,
                      backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: cardBorder,
                    }}
                  >
                    <SmilePlus size={18} color={iconColor} />
                  </SpringPressable>
                </View>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, width: 276, justifyContent: "center" }}>
                  {expandedEmojis.map((emoji) => {
                    const selected = emoji === request.ownReaction;
                    return (
                      <SpringPressable
                        key={emoji}
                        feedback="tick"
                        scaleTo={0.85}
                        accessibilityRole="button"
                        onPress={() => runAfterClose(() => request.onReact?.(selected ? null : emoji))}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? "rgba(124,58,237,0.16)" : "transparent",
                        }}
                      >
                        <Typography className="text-[22px]">{emoji}</Typography>
                      </SpringPressable>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          ) : null}

          {/* 2. Highlighted Message Preview Bubble with Crisp Rim & Shadow */}
          {request.copyText?.trim() ? (
            <Animated.View
              entering={ZoomIn.springify().damping(21).stiffness(300).reduceMotion(ReduceMotion.System)}
              style={{
                maxWidth: "88%",
                backgroundColor: cardSurface,
                borderRadius: 20,
                paddingHorizontal: 15,
                paddingVertical: 11,
                borderWidth: 1,
                borderColor: cardBorder,
                shadowColor: "#0f172a",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: dark ? 0.34 : 0.11,
                shadowRadius: 18,
                elevation: 8,
              }}
            >
              <Typography className="text-[15px] leading-5.5 text-foreground" numberOfLines={6}>
                {request.copyText.trim()}
              </Typography>
            </Animated.View>
          ) : null}

          {attachments.length > 0 && request.files ? (
            <View
              style={{
                width: 224,
                overflow: "hidden",
                borderRadius: 20,
                backgroundColor: cardSurface,
                borderWidth: 1,
                borderColor: cardBorder,
                shadowColor: "#0f172a",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: dark ? 0.34 : 0.12,
                shadowRadius: 18,
              }}
            >
              <MessageFileActions
                serverId={request.files.serverId}
                attachments={attachments}
                iconColor={iconColor}
                afterSheet={(action) => runAfterClose(action, "tap")}
              />
            </View>
          ) : null}

          {/* 3. Compact, Crisp Action Menu Card (Cue-style rounded card + subtle border + shadow) */}
          <Animated.View
            entering={FadeInDown.springify().damping(20).stiffness(290).reduceMotion(ReduceMotion.System)}
            style={{
              width: 196,
              overflow: "hidden",
              borderRadius: 22,
              backgroundColor: cardSurface,
              borderWidth: 1,
              borderColor: cardBorder,
              paddingVertical: 4,
              shadowColor: "#0f172a",
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: dark ? 0.4 : 0.14,
              shadowRadius: 24,
              elevation: 11,
            }}
          >
            {sentLabel ? (
              <View className="px-4 pt-2.5 pb-1.5">
                <Typography className="font-medium text-[12px]" style={{ color: mutedText }}>
                  {sentLabel}
                </Typography>
              </View>
            ) : null}

            {request.onReply ? (
              <PopoverRow
                icon={<Reply size={ICON_SIZE} color={iconColor} style={MIRROR_IN_RTL} />}
                label={t("mobile.app.chatQuote")}
                onPress={() => runAfterClose(() => request.onReply?.())}
              />
            ) : null}

            {request.copyText?.trim() ? (
              <PopoverRow
                icon={<Forward size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.app.chatForward")}
                onPress={handleForward}
              />
            ) : null}

            {request.copyText ? (
              <PopoverRow
                icon={<Copy size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.app.chatCopyMessage")}
                onPress={() =>
                  runAfterClose(() => void copyToClipboard(request.copyText, "mobile.chat.message.copyFailed", t))
                }
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
                  runAfterClose(() => sendToChannel.onSend(channelId));
                }}
              >
                <View className="flex-row items-center gap-3 px-4 py-2.5">
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
                onPress={() => runAfterClose(() => request.onSelectText?.(), "tap")}
              />
            ) : null}

            {request.onBranch ? (
              <PopoverRow
                icon={<GitFork size={ICON_SIZE} color={iconColor} />}
                label={t("mobile.chat.message.branch")}
                onPress={() => runAfterClose(() => request.onBranch?.())}
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
                onPress={() => runAfterClose(() => toggleReadAloud(readAloudId, request.copyText))}
              />
            ) : null}

            {request.onMultiDelete || request.onDelete ? (
              <View
                style={{
                  marginTop: 2,
                  paddingTop: 2,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: dividerColor,
                }}
              >
                <PopoverRow
                  icon={<Trash2 size={ICON_SIZE} color={danger} />}
                  label={t(request.onMultiDelete ? "mobile.app.chatMultiDelete" : "common.delete")}
                  danger
                  onPress={() =>
                    runAfterClose(
                      () => {
                        if (request.onMultiDelete) request.onMultiDelete();
                        else request.onDelete?.();
                      },
                      request.onMultiDelete ? "tap" : "cancel",
                    )
                  }
                />
              </View>
            ) : null}
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

export function MessageActionsScreen() {
  return <MessageActionsOverlay />;
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
      className="mx-1.5 flex-row items-center gap-3 rounded-xl px-2.5 py-2"
      style={({ pressed }) => ({
        backgroundColor: pressed ? "rgba(128,128,128,0.12)" : "transparent",
      })}
    >
      {icon}
      <Typography
        className={danger ? "font-medium text-[15px] text-danger-text" : "font-medium text-[15px] text-foreground"}
      >
        {label}
      </Typography>
    </Pressable>
  );
}
