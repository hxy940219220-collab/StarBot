import { avatarMoodIsBusy } from "@openbot/brand/bloub-avatar-motion";
import { File } from "expo-file-system";
import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import FileText from "lucide-react-native/icons/file-text";
import Mic from "lucide-react-native/icons/mic";
import Plus from "lucide-react-native/icons/plus";
import Receipt from "lucide-react-native/icons/receipt";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useCSSVariable } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
import { BillingSheet } from "@/features/home-capsule/components/billing-sheet";
import { FavoriteAgentPickerSheet } from "@/features/home-capsule/components/favorite-agent-picker-sheet";
import { VoiceTranscriptSheet } from "@/features/home-capsule/components/voice-transcript-sheet";
import {
  hitTestAgentRow,
  type MeasuredAgentRow,
  measureRegisteredAgentRows,
} from "@/features/home-capsule/model/agent-row-registry";
import { setPinnedFavoriteAgent, useFavoriteAgent } from "@/features/home-capsule/model/favorite-agent";
import { formatCompactUsd, useHomeBilling } from "@/features/home-capsule/model/home-billing";
import { markVoiceFailed, markVoiceThinking } from "@/features/home-capsule/model/home-voice-status";
import { speechNative } from "@/features/voice/model/speech-native";
import { useAgentActivity } from "@/features/workspace/components/use-agent-activity";
import { type MobileAgent, useMobileWorkspaceReader } from "@/features/workspace/context/mobile-workspace-context";
import { agentActivityMood } from "@/features/workspace/model/agent-activity";
import { GlassCapsule } from "@/shared/components/glass-capsule";
import { SpringPressable } from "@/shared/components/spring-pressable";
import { haptics } from "@/shared/lib/haptics";
import { isIOS } from "@/shared/lib/platform";
import { speechRecognition } from "@/shared/lib/speech-recognition";
import { useText } from "@/shared/lib/text";
import { typeScale } from "@/shared/lib/type-scale";
import { setUiSoundsSuppressed, uiFeedback } from "@/shared/lib/ui-feedback";
import { useLiquidGlass } from "@/shared/lib/use-liquid-glass";

export const HOME_CAPSULE_HEIGHT = 56;
export const HOME_CAPSULE_BOTTOM_GAP = 8;

const BRAND_PURPLE = "#7c3aed";
const CANCEL_RED = "#ef4444";
const HOLD_THRESHOLD_MS = 200;
const MIN_RECORD_MS = 1_000;
const MAX_RECORD_MS = 60_000;
const COUNTDOWN_START_MS = 50_000;
const MORPH_SPRING = { duration: 210, dampingRatio: 0.78, reduceMotion: ReduceMotion.System } as const;
const WAVE_BARS = [
  { id: "b1", weight: 0.45 },
  { id: "b2", weight: 0.72 },
  { id: "b3", weight: 1 },
  { id: "b4", weight: 0.85 },
  { id: "b5", weight: 0.95 },
  { id: "b6", weight: 0.68 },
  { id: "b7", weight: 0.42 },
] as const;

type VoiceZone = "default" | "cancel" | "transcribe" | "agent" | "empty";

export interface HomeCapsuleBarProps {
  serverId: string;
  agents: readonly MobileAgent[];
  onRecordingShiftChange?: (shiftY: number) => void;
}

export function HomeCapsuleBar({ serverId, agents, onRecordingShiftChange }: HomeCapsuleBarProps) {
  const { t } = useText();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const liquidGlass = useLiquidGlass();
  const workspace = useMobileWorkspaceReader();
  const [foreground, muted] = useThemeColor(["foreground", "muted"]);
  const capsuleBg = String(useCSSVariable("--openbot-bg-chrome-glass") ?? "#ffffff");
  const capsuleBorder = String(useCSSVariable("--openbot-border-chrome-glass") ?? "rgba(0,0,0,0.08)");
  const cardBg = String(useCSSVariable("--openbot-bg-grouped") ?? "#ffffff");

  const billingMonth = useHomeBilling(serverId, "month");
  const billing7d = useHomeBilling(serverId, "7d");
  const { favorite, pinnedId } = useFavoriteAgent(serverId, agents, billing7d.messageCounts7d);

  const [billingOpen, setBillingOpen] = useState(false);
  const [favoritePickerOpen, setFavoritePickerOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shortTapHint, setShortTapHint] = useState(false);

  // Voice recording UI state
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [zone, setZone] = useState<VoiceZone>("default");
  const [hoveredRow, setHoveredRow] = useState<MeasuredAgentRow | null>(null);
  const [fingerPos, setFingerPos] = useState<{ x: number; y: number } | null>(null);
  const [listShiftY, setListShiftY] = useState(0);

  const recordingRef = useRef(false);
  const pressActiveRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartedAtRef = useRef(0);
  const measuredRowsRef = useRef<MeasuredAgentRow[]>([]);
  const listShiftRef = useRef(0);
  const zoneRef = useRef<VoiceZone>("default");
  const hoveredAgentIdRef = useRef<string | null>(null);
  const transcriptRef = useRef("");
  const audioUriRef = useRef<string | undefined>(undefined);
  const initialTouchRef = useRef<{ x: number; y: number }>({ x: screenWidth / 2, y: screenHeight - 60 });

  // Shared values for animations
  const morphProgress = useSharedValue(0);
  const audioLevel = useSharedValue(0.18);
  const cancelScale = useSharedValue(1);
  const transcribeScale = useSharedValue(1);

  const capsuleBottom = Math.max(insets.bottom, 8) + HOME_CAPSULE_BOTTOM_GAP;
  const capsuleTopY = screenHeight - capsuleBottom - HOME_CAPSULE_HEIGHT;
  const capsuleWidth = Math.max(240, screenWidth - 32);

  const showToast = useCallback((message: string, duration = 2000) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), duration);
  }, []);

  const showShortHint = useCallback(() => {
    uiFeedback.tap();
    setShortTapHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShortTapHint(false), 2000);
  }, []);

  const sendVoiceToAgent = useCallback(
    async (target: MobileAgent, rawText: string, audioUri?: string) => {
      const text = rawText.trim();
      if (!text) return;
      const baselinePreview = target.preview;
      const baselineUpdatedAt = target.updatedAt;
      markVoiceThinking(target.id, { text, audioUri, baselinePreview, baselineUpdatedAt });

      try {
        const attachmentIds: string[] = [];
        if (audioUri) {
          try {
            const file = new File(audioUri);
            if (file.exists) {
              const base64 = await file.base64();
              const uploaded = await workspace().uploadAttachment(
                target.id,
                { name: `voice-${Date.now()}.m4a`, mimeType: "audio/mp4", base64 },
                target.serverId,
              );
              if (uploaded?.id) attachmentIds.push(uploaded.id);
            }
          } catch {
            // Audio attachment upload is best-effort; still deliver transcribed text
          }
        }
        await workspace().sendMessage(target.id, text, attachmentIds, null, target.serverId);
      } catch {
        uiFeedback.error();
        markVoiceFailed(target.id, { text, audioUri, baselinePreview, baselineUpdatedAt });
      }
    },
    [workspace],
  );

  // Listen to speech recognition events
  useEffect(() => {
    if (!speechRecognition) return;
    const subs = [
      speechRecognition.addListener("result", (event) => {
        if (!recordingRef.current) return;
        const text = event.results?.[0]?.transcript ?? "";
        if (text) transcriptRef.current = text;
      }),
      speechRecognition.addListener("volumechange", (event) => {
        if (!recordingRef.current) return;
        const normalized = Math.max(0.12, Math.min(1, ((event.value ?? -2) + 2) / 10));
        audioLevel.set(withTiming(normalized, { duration: 90 }));
      }),
      speechRecognition.addListener("audioend", (event) => {
        if (event.uri) audioUriRef.current = event.uri;
      }),
    ];
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, [audioLevel]);

  const resetRecordingVisuals = useCallback(() => {
    recordingRef.current = false;
    setRecording(false);
    setElapsedMs(0);
    setZone("default");
    zoneRef.current = "default";
    setHoveredRow(null);
    hoveredAgentIdRef.current = null;
    setFingerPos(null);
    listShiftRef.current = 0;
    setListShiftY(0);
    onRecordingShiftChange?.(0);
    morphProgress.set(withSpring(0, MORPH_SPRING));
    cancelScale.set(withSpring(1, MORPH_SPRING));
    transcribeScale.set(withSpring(1, MORPH_SPRING));
    audioLevel.set(0.18);
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    setUiSoundsSuppressed(false);
  }, [audioLevel, cancelScale, morphProgress, onRecordingShiftChange, transcribeScale]);

  const abortRecording = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    pressActiveRef.current = false;
    if (!recordingRef.current) return;
    try {
      speechRecognition?.abort();
    } catch {}
    resetRecordingVisuals();
  }, [resetRecordingVisuals]);

  // Cancel & discard on incoming call / app backgrounding
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && (recordingRef.current || pressActiveRef.current)) {
        abortRecording();
      }
    });
    return () => sub.remove();
  }, [abortRecording]);

  // Clean up timers and audio suppression on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      setUiSoundsSuppressed(false);
    };
  }, []);

  const finalizeRecording = useCallback(
    async (forcedZone?: VoiceZone) => {
      if (!recordingRef.current) return;
      const finalZone = forcedZone ?? zoneRef.current;
      const finalHoveredId = hoveredAgentIdRef.current;
      const durationMs = Date.now() - recordStartedAtRef.current;

      resetRecordingVisuals();

      if (finalZone === "cancel") {
        try {
          speechRecognition?.abort();
        } catch {}
        uiFeedback.recCancel();
        return;
      }

      if (finalZone === "empty") {
        try {
          speechRecognition?.abort();
        } catch {}
        uiFeedback.recCancel();
        showToast(t("mobile.app.capsule.noTargetCancelled"));
        return;
      }

      if (durationMs < MIN_RECORD_MS) {
        try {
          speechRecognition?.abort();
        } catch {}
        uiFeedback.recCancel();
        showToast(t("mobile.app.capsule.tooShort"));
        return;
      }

      // Stop recognition gracefully so final transcript + persisted audio flush
      try {
        speechRecognition?.stop();
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 260));

      const recognized = transcriptRef.current.trim();
      const recordedUri = audioUriRef.current;

      if (finalZone === "transcribe") {
        uiFeedback.open();
        setTranscriptDraft(recognized);
        setTranscriptOpen(true);
        return;
      }

      // Strictly only send to the explicit recipient shown on the floating label
      const recipient =
        finalZone === "agent"
          ? (agents.find((agent) => agent.id === finalHoveredId) ?? null)
          : finalZone === "default"
            ? favorite
            : null;

      if (!recipient) {
        uiFeedback.recCancel();
        showToast(t("mobile.app.capsule.noTargetCancelled"));
        return;
      }

      if (!recognized) {
        // Open editable transcript sheet if speech recognition returned empty text
        uiFeedback.open();
        setTranscriptDraft("");
        setTranscriptOpen(true);
        return;
      }

      uiFeedback.recSend();
      void sendVoiceToAgent(recipient, recognized, recordedUri);
    },
    [agents, favorite, resetRecordingVisuals, sendVoiceToAgent, showToast, t],
  );

  const beginRecording = useCallback(async () => {
    if (!pressActiveRef.current || recordingRef.current) return;

    // First-time microphone permission check: request permission ONLY, do NOT start recording on this press
    if (speechRecognition) {
      try {
        const perm = await speechRecognition.getPermissionsAsync();
        if (!perm.granted) {
          pressActiveRef.current = false;
          if (perm.canAskAgain) {
            await speechRecognition.requestPermissionsAsync();
          } else {
            Alert.alert(t("mobile.app.capsule.micPermissionTitle"), t("mobile.app.capsule.micPermissionBody"), [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("mobile.app.capsule.openSettings"),
                onPress: () => void Linking.openSettings().catch(() => undefined),
              },
            ]);
          }
          return;
        }
      } catch {
        // Fallback cleanly
      }
    }

    if (!pressActiveRef.current) return;

    // Measure agent rows right as recording activates, then compute smooth downward shift
    const rows = await measureRegisteredAgentRows();
    if (!pressActiveRef.current) return;
    measuredRowsRef.current = rows;

    let computedShift = 0;
    const lastRow = rows.at(-1);
    if (lastRow) {
      const targetBottom = capsuleTopY - 14;
      const gap = targetBottom - lastRow.bottom;
      if (gap > 12) {
        computedShift = Math.min(gap, Math.round(screenHeight * 0.48));
      }
    }
    listShiftRef.current = computedShift;
    setListShiftY(computedShift);
    onRecordingShiftChange?.(computedShift);

    transcriptRef.current = "";
    audioUriRef.current = undefined;
    recordStartedAtRef.current = Date.now();
    recordingRef.current = true;
    setRecording(true);
    setElapsedMs(0);
    const defaultZone: VoiceZone = favorite ? "default" : "empty";
    zoneRef.current = defaultZone;
    setZone(defaultZone);
    setFingerPos(initialTouchRef.current);

    morphProgress.set(withSpring(1, MORPH_SPRING));
    speechNative?.allowHapticsWhileRecording?.();
    setUiSoundsSuppressed(true);
    void haptics.impact("medium");

    try {
      speechRecognition?.start({
        lang: "zh-CN",
        interimResults: true,
        continuous: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
        recordingOptions: { persist: true },
      });
    } catch {
      // Speech recognition unavailable on simulator/device; still allow recording lifecycle
    }

    tickTimerRef.current = setInterval(() => {
      if (!recordingRef.current) return;
      const elapsed = Date.now() - recordStartedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORD_MS) {
        void finalizeRecording();
      }
    }, 100);
  }, [capsuleTopY, favorite, finalizeRecording, morphProgress, onRecordingShiftChange, screenHeight, t]);

  const handleTouchBegin = useCallback(
    (absX: number, absY: number) => {
      pressActiveRef.current = true;
      initialTouchRef.current = { x: absX, y: absY };
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null;
        void beginRecording();
      }, HOLD_THRESHOLD_MS);
    },
    [beginRecording],
  );

  const handleTouchMove = useCallback(
    (absX: number, absY: number) => {
      initialTouchRef.current = { x: absX, y: absY };
      if (!recordingRef.current) return;
      setFingerPos({ x: absX, y: absY });

      const prevZone = zoneRef.current;
      const prevHoveredId = hoveredAgentIdRef.current;
      let nextZone: VoiceZone = favorite ? "default" : "empty";
      let nextHovered: MeasuredAgentRow | null = null;

      if (absY >= capsuleTopY - 28) {
        const relX = (absX - 16) / capsuleWidth;
        if (relX < 0.32) nextZone = "cancel";
        else if (relX > 0.68) nextZone = "transcribe";
        else nextZone = favorite ? "default" : "empty";
      } else {
        const hit = hitTestAgentRow(measuredRowsRef.current, absY, listShiftRef.current, prevHoveredId);
        if (hit) {
          nextZone = "agent";
          nextHovered = hit;
        } else {
          nextZone = "empty";
        }
      }

      if (nextZone !== prevZone || nextHovered?.agentId !== prevHoveredId) {
        zoneRef.current = nextZone;
        hoveredAgentIdRef.current = nextHovered?.agentId ?? null;
        setZone(nextZone);
        setHoveredRow(nextHovered);

        cancelScale.set(withSpring(nextZone === "cancel" ? 1.18 : 1, MORPH_SPRING));
        transcribeScale.set(withSpring(nextZone === "transcribe" ? 1.18 : 1, MORPH_SPRING));

        if (nextZone === "cancel") void haptics.notification("warning");
        else if (nextZone === "agent" || nextZone === "transcribe") void haptics.impact("light");
      }
    },
    [cancelScale, capsuleTopY, capsuleWidth, favorite, transcribeScale],
  );

  const handleTouchEnd = useCallback(() => {
    const wasHeld = recordingRef.current;
    pressActiveRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!wasHeld) {
      showShortHint();
      return;
    }
    void finalizeRecording();
  }, [finalizeRecording, showShortHint]);

  const voiceGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          scheduleOnRN(handleTouchBegin, event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          scheduleOnRN(handleTouchMove, event.absoluteX, event.absoluteY);
        })
        .onFinalize(() => {
          scheduleOnRN(handleTouchEnd);
        }),
    [handleTouchBegin, handleTouchMove, handleTouchEnd],
  );

  const hoveredAgent = useMemo(
    () => (hoveredRow ? (agents.find((agent) => agent.id === hoveredRow.agentId) ?? null) : null),
    [agents, hoveredRow],
  );

  const floatingLabelText = useMemo(() => {
    if (zone === "cancel") return t("mobile.app.capsule.releaseCancel");
    if (zone === "transcribe") return t("mobile.app.capsule.releaseTranscribe");
    if (zone === "agent" && hoveredAgent) return t("mobile.app.capsule.sendTo", { name: hoveredAgent.name });
    if (zone === "default" && favorite) return t("mobile.app.capsule.releaseSendTo", { name: favorite.name });
    return t("mobile.app.capsule.moveToAgent");
  }, [favorite, hoveredAgent, t, zone]);

  const timerLabel = useMemo(() => {
    if (elapsedMs >= COUNTDOWN_START_MS) {
      const remain = Math.max(1, Math.ceil((MAX_RECORD_MS - elapsedMs) / 1000));
      return t("mobile.app.capsule.countdown", { seconds: remain });
    }
    const sec = Math.floor(elapsedMs / 1000);
    const mm = Math.floor(sec / 60);
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedMs, t]);

  const isCountdown = elapsedMs >= COUNTDOWN_START_MS;

  const idleSlotStyle = useAnimatedStyle(() => ({
    opacity: 1 - morphProgress.get(),
    transform: [{ scale: 1 - morphProgress.get() * 0.14 }],
  }));

  const recordSlotStyle = useAnimatedStyle(() => ({
    opacity: morphProgress.get(),
    transform: [{ scale: 0.86 + morphProgress.get() * 0.14 }],
  }));

  const cancelButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cancelScale.get() }],
  }));

  const transcribeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: transcribeScale.get() }],
  }));

  return (
    <>
      {/* 35% dark scrim + elevated hovered row + floating release label while recording */}
      {recording ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { zIndex: 40 }]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.35)" }]} />

          {hoveredRow && hoveredAgent ? (
            <Animated.View
              entering={FadeIn.duration(100)}
              style={{
                position: "absolute",
                top: hoveredRow.top + listShiftY,
                left: 12,
                right: 12,
                minHeight: hoveredRow.height,
                borderRadius: 20,
                backgroundColor: cardBg,
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                transform: [{ scale: 1.03 }],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.24,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              <BloubAvatar
                agentId={hoveredAgent.id}
                serverId={hoveredAgent.serverId}
                hue={hoveredAgent.avatarHue}
                color={hoveredAgent.avatarColor}
                seed={hoveredAgent.avatarSeed}
                avatarUrl={hoveredAgent.avatarUrl}
                size={62}
                animateIdle={false}
              />
              <View className="min-w-0 flex-1 gap-0.5">
                <Typography.Paragraph
                  className="font-semibold text-foreground"
                  numberOfLines={1}
                  style={typeScale.rowTitle}
                >
                  {hoveredAgent.name}
                </Typography.Paragraph>
                <Typography.Paragraph className="text-text-secondary" numberOfLines={1} style={typeScale.preview}>
                  {hoveredAgent.preview || hoveredAgent.title}
                </Typography.Paragraph>
              </View>
            </Animated.View>
          ) : null}

          {fingerPos ? (
            <View
              style={{
                position: "absolute",
                top: Math.max(insets.top + 14, fingerPos.y - 68),
                left: 0,
                right: 0,
                alignItems: "center",
              }}
            >
              <View
                className="rounded-full px-4 py-2"
                style={{
                  backgroundColor:
                    zone === "cancel"
                      ? CANCEL_RED
                      : zone === "transcribe" || zone === "agent"
                        ? BRAND_PURPLE
                        : "rgba(24, 24, 27, 0.88)",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.22,
                  shadowRadius: 10,
                }}
              >
                <Typography className="font-semibold text-[13px]" style={{ color: "#ffffff" }}>
                  {floatingLabelText}
                </Typography>
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Short tap hint & toast bubble above capsule */}
      {shortTapHint || toastMessage ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            bottom: capsuleBottom + HOME_CAPSULE_HEIGHT + 12,
            alignItems: "center",
            zIndex: 55,
          }}
        >
          <View
            className="rounded-full px-4 py-2"
            style={{
              backgroundColor: "rgba(24, 24, 27, 0.88)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.16,
              shadowRadius: 10,
            }}
          >
            <Typography className="font-medium text-xs" style={{ color: "#ffffff" }}>
              {toastMessage ?? t("mobile.app.capsule.voiceShortTapHint")}
            </Typography>
          </View>
        </Animated.View>
      ) : null}

      {/* Main Bottom Capsule Action Bar */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: capsuleBottom,
          zIndex: 50,
        }}
      >
        <View
          style={{
            borderRadius: HOME_CAPSULE_HEIGHT / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: capsuleBorder,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <GlassCapsule
            liquidGlass={liquidGlass}
            fallbackBackground={capsuleBg}
            height={HOME_CAPSULE_HEIGHT}
            animateGlass
          >
            <View className="flex-1 flex-row items-center justify-between px-3">
              {/* LEFT SLOT: Idle = Favorite Bot Avatar | Recording = Cancel */}
              <View className="w-24 items-start justify-center">
                <Animated.View
                  pointerEvents={recording ? "none" : "auto"}
                  style={[idleSlotStyle, { position: recording ? "absolute" : "relative" }]}
                >
                  {favorite ? (
                    <FavoriteAgentAvatarButton
                      agent={favorite}
                      label={t("mobile.app.capsule.favoriteLabel", { name: favorite.name })}
                      onPress={() => {
                        uiFeedback.botTap();
                        router.push({ pathname: "/chat/[agentId]", params: { agentId: favorite.id } });
                      }}
                      onLongPress={() => {
                        uiFeedback.open();
                        setFavoritePickerOpen(true);
                      }}
                    />
                  ) : (
                    <SpringPressable
                      feedback="tap"
                      accessibilityRole="button"
                      accessibilityLabel={t("mobile.app.capsule.addAgent")}
                      onPress={() => router.push("/add-agent")}
                      className="size-9 items-center justify-center rounded-full bg-control"
                    >
                      <Plus color={String(foreground)} size={20} strokeWidth={2.2} />
                    </SpringPressable>
                  )}
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[recordSlotStyle, cancelButtonStyle, { position: recording ? "relative" : "absolute" }]}
                >
                  <View
                    className="size-9 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: zone === "cancel" ? CANCEL_RED : "rgba(239,68,68,0.14)",
                    }}
                  >
                    <X color={zone === "cancel" ? "#ffffff" : CANCEL_RED} size={18} strokeWidth={2.4} />
                  </View>
                </Animated.View>
              </View>

              {/* CENTER SLOT: Idle = Brand Purple Voice Orb | Recording = Waveform + Timer */}
              <View className="flex-1 items-center justify-center">
                <GestureDetector gesture={voiceGesture}>
                  <View
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t("mobile.app.capsule.voiceLabel")}
                    className="h-12 min-w-12 items-center justify-center"
                  >
                    {!recording ? (
                      <Animated.View
                        style={[
                          idleSlotStyle,
                          {
                            width: 46,
                            height: 46,
                            borderRadius: 23,
                            backgroundColor: BRAND_PURPLE,
                            alignItems: "center",
                            justifyContent: "center",
                            shadowColor: BRAND_PURPLE,
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.34,
                            shadowRadius: 8,
                          },
                        ]}
                      >
                        <Mic color="#ffffff" size={21} strokeWidth={2.2} />
                      </Animated.View>
                    ) : (
                      <Animated.View style={[recordSlotStyle]} className="flex-row items-center gap-2.5">
                        <VoiceWaveformBars level={audioLevel} color={isCountdown ? CANCEL_RED : BRAND_PURPLE} />
                        <Typography
                          className="font-semibold text-sm tabular-nums"
                          style={{ color: isCountdown ? CANCEL_RED : String(foreground), minWidth: 38 }}
                        >
                          {timerLabel}
                        </Typography>
                      </Animated.View>
                    )}
                  </View>
                </GestureDetector>
              </View>

              {/* RIGHT SLOT: Idle = Billing Pill | Recording = Transcribe */}
              <View className="w-24 items-end justify-center">
                <Animated.View
                  pointerEvents={recording ? "none" : "auto"}
                  style={[idleSlotStyle, { position: recording ? "absolute" : "relative" }]}
                >
                  <SpringPressable
                    feedback="open"
                    scaleTo={0.94}
                    accessibilityRole="button"
                    accessibilityLabel={t("mobile.app.capsule.billingLabel", {
                      amount: formatCompactUsd(billingMonth.totalCostUsd),
                    })}
                    onPress={() => setBillingOpen(true)}
                    className="relative flex-row items-center gap-1 rounded-full bg-control/75 px-2.5 py-1.5"
                  >
                    <Receipt color={String(muted)} size={15} strokeWidth={2} />
                    <Typography className="font-semibold text-xs text-foreground tabular-nums" numberOfLines={1}>
                      {formatCompactUsd(billingMonth.totalCostUsd)}
                    </Typography>
                    {billingMonth.hasQuotaAlert ? (
                      <View
                        className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-background"
                        style={{ backgroundColor: CANCEL_RED }}
                      />
                    ) : null}
                  </SpringPressable>
                </Animated.View>

                <Animated.View
                  pointerEvents="none"
                  style={[recordSlotStyle, transcribeButtonStyle, { position: recording ? "relative" : "absolute" }]}
                >
                  <View
                    className="size-9 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: zone === "transcribe" ? BRAND_PURPLE : "rgba(124,58,237,0.14)",
                    }}
                  >
                    <FileText color={zone === "transcribe" ? "#ffffff" : BRAND_PURPLE} size={17} strokeWidth={2.2} />
                  </View>
                </Animated.View>
              </View>
            </View>
          </GlassCapsule>
        </View>
      </View>

      <BillingSheet visible={billingOpen} serverId={serverId} onClose={() => setBillingOpen(false)} />

      <FavoriteAgentPickerSheet
        visible={favoritePickerOpen}
        agents={agents}
        pinnedId={pinnedId}
        onSelect={(agentId) => setPinnedFavoriteAgent(serverId, agentId)}
        onClose={() => setFavoritePickerOpen(false)}
      />

      <VoiceTranscriptSheet
        visible={transcriptOpen}
        initialText={transcriptDraft}
        agents={agents}
        defaultAgentId={favorite?.id ?? null}
        onSend={(agent, text) => {
          uiFeedback.recSend();
          void sendVoiceToAgent(agent, text, audioUriRef.current);
        }}
        onClose={() => setTranscriptOpen(false)}
      />
    </>
  );
}

function FavoriteAgentAvatarButton({
  agent,
  label,
  onPress,
  onLongPress,
}: {
  agent: MobileAgent;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const activity = useAgentActivity(agent.id);
  const busy = avatarMoodIsBusy(agentActivityMood(activity));
  const ringOpacity = useSharedValue(0.35);
  const ringScale = useSharedValue(1);

  useEffect(() => {
    if (!busy) {
      ringOpacity.set(withTiming(0, { duration: 200 }));
      ringScale.set(withTiming(1, { duration: 200 }));
      return;
    }
    ringOpacity.set(
      withRepeat(
        withSequence(
          withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    ringScale.set(
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.98, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
  }, [busy, ringOpacity, ringScale]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.get(),
    transform: [{ scale: ringScale.get() }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      delayLongPress={360}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={6}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <View className="size-10 items-center justify-center">
        {busy ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: BRAND_PURPLE,
              },
              haloStyle,
            ]}
          />
        ) : null}
        <BloubAvatar
          agentId={agent.id}
          serverId={agent.serverId}
          hue={agent.avatarHue}
          color={agent.avatarColor}
          seed={agent.avatarSeed}
          avatarUrl={agent.avatarUrl}
          size={isIOS ? 36 : 34}
          animateIdle={false}
        />
      </View>
    </Pressable>
  );
}

function VoiceWaveformBars({ level, color }: { level: SharedValue<number>; color: string }) {
  return (
    <View className="h-6 flex-row items-center gap-1">
      {WAVE_BARS.map((bar) => (
        <WaveBar key={bar.id} weight={bar.weight} level={level} color={color} />
      ))}
    </View>
  );
}

function WaveBar({ weight, level, color }: { weight: number; level: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const height = Math.max(5, Math.min(22, 6 + level.get() * 18 * weight));
    return { height };
  });
  return <Animated.View style={[{ width: 3.2, borderRadius: 2, backgroundColor: color }, style]} />;
}
