import { avatarMoodIsBusy } from "@openbot/brand/bloub-avatar-motion";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Spinner, Typography } from "heroui-native";
import { useThemeColor } from "heroui-native/hooks";
import BookBookmark from "lucide-react-native/icons/book-bookmark";
import CalendarClock from "lucide-react-native/icons/calendar-clock";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Mic from "lucide-react-native/icons/mic";
import Plus from "lucide-react-native/icons/plus";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
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
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { useCSSVariable, useUniwind } from "uniwind";
import { BloubAvatar } from "@/features/agents/components/bloub-avatar";
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
export const HOME_CAPSULE_BOTTOM_GAP = 10;
const MIC_ORB_SIZE = 66;
const MIC_PROTRUDE_TOP = 10;

const BRAND_PURPLE = "#7c3aed";
const CANCEL_RED = "#ef4444";
const SUCCESS_GREEN = "#10b981";
const HOLD_THRESHOLD_MS = 200;
const MIN_RECORD_MS = 850;
const MAX_RECORD_MS = 60_000;
const COUNTDOWN_START_MS = 50_000;
const MORPH_SPRING = { duration: 220, dampingRatio: 0.78, reduceMotion: ReduceMotion.System } as const;

const ORB_WAVE_BARS = [
  { id: "o1", phase: 0.2, weight: 0.55 },
  { id: "o2", phase: 1.3, weight: 0.92 },
  { id: "o3", phase: 2.5, weight: 1.0 },
  { id: "o4", phase: 3.7, weight: 0.9 },
  { id: "o5", phase: 4.9, weight: 0.52 },
] as const;

type VoiceZone = "default" | "cancel" | "transcribe" | "agent" | "empty";

interface SentDeliveryState {
  agent: MobileAgent;
  text: string;
  phase: "sending" | "delivered" | "failed";
}

export interface HomeCapsuleBarProps {
  serverId: string;
  agents: readonly MobileAgent[];
  topSafeInset?: number;
  onVoiceAutoScroll?: (deltaY: number) => boolean;
}

export function HomeCapsuleBar({ serverId, agents, topSafeInset, onVoiceAutoScroll }: HomeCapsuleBarProps) {
  const { t } = useText();
  const { theme } = useUniwind();
  const dark = theme === "dark";
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const liquidGlass = useLiquidGlass();
  const workspace = useMobileWorkspaceReader();
  const [foreground] = useThemeColor(["foreground"]);
  const capsuleBg = String(
    useCSSVariable("--openbot-bg-chrome-glass") ?? (dark ? "rgba(32,32,38,0.88)" : "rgba(255,255,255,0.88)"),
  );
  const sheetBg = String(useCSSVariable("--openbot-bg-sheet") ?? "#ffffff");

  const billingMonth = useHomeBilling(serverId, "month");
  const billing7d = useHomeBilling(serverId, "7d");
  const { favorite, pinnedId } = useFavoriteAgent(serverId, agents, billing7d.messageCounts7d);

  const [favoritePickerOpen, setFavoritePickerOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shortTapHint, setShortTapHint] = useState(false);
  const [sentDelivery, setSentDelivery] = useState<SentDeliveryState | null>(null);

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [zone, setZone] = useState<VoiceZone>("default");
  const [hoveredRow, setHoveredRow] = useState<MeasuredAgentRow | null>(null);

  const recordingRef = useRef(false);
  const pressActiveRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartedAtRef = useRef(0);
  const measuredRowsRef = useRef<MeasuredAgentRow[]>([]);
  const measuringRef = useRef(false);
  const zoneRef = useRef<VoiceZone>("default");
  const hoveredAgentIdRef = useRef<string | null>(null);
  const transcriptRef = useRef("");

  // Strict Safe-Area Geometry (guaranteed zero overlap with Dynamic Island, header buttons, or Home indicator!)
  const capsuleBottom = Math.max(insets.bottom, 8) + HOME_CAPSULE_BOTTOM_GAP;
  const listSafeTop = Math.max(topSafeInset ?? 0, insets.top + 58);
  const bottomActionCeilingY = screenHeight - Math.max(insets.bottom, 16) - 124;
  const orbMinY = listSafeTop + MIC_ORB_SIZE / 2 + 4;
  const orbMaxY = screenHeight - Math.max(insets.bottom, 16) - MIC_ORB_SIZE / 2 - 12;
  const orbMinX = MIC_ORB_SIZE / 2 + 16;
  const orbMaxX = screenWidth - MIC_ORB_SIZE / 2 - 16;
  const restOrbX = screenWidth / 2;
  const restOrbY = screenHeight - capsuleBottom - HOME_CAPSULE_HEIGHT + MIC_ORB_SIZE / 2 - MIC_PROTRUDE_TOP;

  const initialTouchRef = useRef<{ x: number; y: number }>({ x: restOrbX, y: restOrbY });

  // UI-Thread Shared Values for 120fps Draggable Living Voice Orb
  const recordingSV = useSharedValue(0);
  const orbX = useSharedValue(restOrbX);
  const orbY = useSharedValue(restOrbY);
  const audioLevel = useSharedValue(0.24);
  const waveClock = useSharedValue(0);
  const rippleScale = useSharedValue(1);
  const rippleOpacity = useSharedValue(0);
  const cancelPillScale = useSharedValue(1);
  const transcribePillScale = useSharedValue(1);

  const showToast = useCallback((message: string, duration = 2200) => {
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

  // PURE TEXT SENDING ONLY — zero .m4a attachment + crisp delivery feedback banner!
  const sendVoiceTextToAgent = useCallback(
    async (target: MobileAgent, rawText: string) => {
      const text = rawText.trim();
      if (!text) return;
      const baselinePreview = target.preview;
      const baselineUpdatedAt = target.updatedAt;
      markVoiceThinking(target.id, { text, baselinePreview, baselineUpdatedAt });

      if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
      setSentDelivery({ agent: target, text, phase: "sending" });

      try {
        await workspace().sendMessage(target.id, text, [], null, target.serverId);
        uiFeedback.confirm();
        setSentDelivery({ agent: target, text, phase: "delivered" });
        deliveryTimerRef.current = setTimeout(() => setSentDelivery(null), 4200);
      } catch {
        uiFeedback.error();
        markVoiceFailed(target.id, { text, baselinePreview, baselineUpdatedAt });
        setSentDelivery({ agent: target, text, phase: "failed" });
        deliveryTimerRef.current = setTimeout(() => setSentDelivery(null), 5000);
      }
    },
    [workspace],
  );

  // Live speech recognition listener
  useEffect(() => {
    if (!speechRecognition) return;
    const subs = [
      speechRecognition.addListener("result", (event) => {
        const text = event.results?.[0]?.transcript?.trim() ?? "";
        if (!text) return;
        transcriptRef.current = text;
        if (recordingRef.current) {
          setLiveTranscript(text);
        }
      }),
      speechRecognition.addListener("volumechange", (event) => {
        if (!recordingRef.current) return;
        const normalized = Math.max(0.14, Math.min(1, ((event.value ?? -2) + 2) / 9));
        audioLevel.set(withTiming(normalized, { duration: 75 }));
      }),
    ];
    return () => {
      for (const sub of subs) sub.remove();
    };
  }, [audioLevel]);

  const evaluateFingerZone = useCallback(
    (absX: number, absY: number, emitHaptic: boolean) => {
      const prevZone = zoneRef.current;
      const prevHoveredId = hoveredAgentIdRef.current;
      let nextZone: VoiceZone = favorite ? "default" : "empty";
      let nextHovered: MeasuredAgentRow | null = null;

      if (absY >= bottomActionCeilingY) {
        const relX = absX / screenWidth;
        if (relX < 0.36) nextZone = "cancel";
        else if (relX > 0.64) nextZone = "transcribe";
        else nextZone = favorite ? "default" : "empty";
      } else {
        const clampedY = Math.max(listSafeTop, Math.min(bottomActionCeilingY - 2, absY));
        const hit = hitTestAgentRow(measuredRowsRef.current, clampedY, listSafeTop, bottomActionCeilingY);
        if (hit) {
          nextZone = "agent";
          nextHovered = hit;
        } else {
          nextZone = "empty";
        }
      }

      const rowRectChanged =
        nextHovered !== null &&
        hoveredRow !== null &&
        nextHovered.agentId === hoveredRow.agentId &&
        Math.abs(nextHovered.top - hoveredRow.top) > 0.5;

      if (nextZone !== prevZone || nextHovered?.agentId !== prevHoveredId || rowRectChanged) {
        zoneRef.current = nextZone;
        hoveredAgentIdRef.current = nextHovered?.agentId ?? null;
        setZone(nextZone);
        setHoveredRow(nextHovered);

        cancelPillScale.set(withSpring(nextZone === "cancel" ? 1.09 : 1, MORPH_SPRING));
        transcribePillScale.set(withSpring(nextZone === "transcribe" ? 1.09 : 1, MORPH_SPRING));

        if (emitHaptic && (nextZone !== prevZone || nextHovered?.agentId !== prevHoveredId)) {
          if (nextZone === "cancel") void haptics.notification("warning");
          else if (nextZone === "agent" || nextZone === "transcribe") void haptics.impact("light");
        }
      }
    },
    [bottomActionCeilingY, cancelPillScale, favorite, hoveredRow, listSafeTop, screenWidth, transcribePillScale],
  );

  const resetRecordingVisuals = useCallback(() => {
    recordingRef.current = false;
    recordingSV.set(0);
    setRecording(false);
    setElapsedMs(0);
    setLiveTranscript("");
    setZone("default");
    zoneRef.current = "default";
    setHoveredRow(null);
    hoveredAgentIdRef.current = null;
    orbX.set(withSpring(restOrbX, MORPH_SPRING));
    orbY.set(withSpring(restOrbY, MORPH_SPRING));
    cancelPillScale.set(withSpring(1, MORPH_SPRING));
    transcribePillScale.set(withSpring(1, MORPH_SPRING));
    audioLevel.set(0.24);
    rippleOpacity.set(0);
    rippleScale.set(1);
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
    setUiSoundsSuppressed(false);
  }, [
    audioLevel,
    cancelPillScale,
    orbX,
    orbY,
    recordingSV,
    restOrbX,
    restOrbY,
    rippleOpacity,
    rippleScale,
    transcribePillScale,
  ]);

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

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && (recordingRef.current || pressActiveRef.current)) {
        abortRecording();
      }
    });
    return () => sub.remove();
  }, [abortRecording]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (deliveryTimerRef.current) clearTimeout(deliveryTimerRef.current);
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

      try {
        speechRecognition?.stop();
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 340));

      const recognized = transcriptRef.current.trim();

      if (finalZone === "transcribe") {
        uiFeedback.open();
        setTranscriptDraft(recognized);
        setTranscriptOpen(true);
        return;
      }

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
        uiFeedback.open();
        setTranscriptDraft("");
        setTranscriptOpen(true);
        return;
      }

      uiFeedback.recSend();
      void sendVoiceTextToAgent(recipient, recognized);
    },
    [agents, favorite, resetRecordingVisuals, sendVoiceTextToAgent, showToast, t],
  );

  const beginRecording = useCallback(async () => {
    if (!pressActiveRef.current || recordingRef.current) return;

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
      } catch {}
    }

    if (!pressActiveRef.current) return;

    const rows = await measureRegisteredAgentRows();
    if (!pressActiveRef.current) return;
    measuredRowsRef.current = rows;

    transcriptRef.current = "";
    setLiveTranscript("");
    recordStartedAtRef.current = Date.now();
    recordingRef.current = true;
    recordingSV.set(1);
    setRecording(true);
    setElapsedMs(0);

    const pos = initialTouchRef.current;
    orbX.set(Math.max(orbMinX, Math.min(orbMaxX, pos.x)));
    orbY.set(Math.max(orbMinY, Math.min(orbMaxY, pos.y)));
    evaluateFingerZone(pos.x, pos.y, false);

    waveClock.set(withRepeat(withTiming(Math.PI * 20, { duration: 8500, easing: Easing.linear }), -1, false));
    rippleScale.set(
      withRepeat(
        withSequence(
          withTiming(1.0, { duration: 1 }),
          withTiming(1.62, { duration: 1150, easing: Easing.out(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );
    rippleOpacity.set(
      withRepeat(
        withSequence(
          withTiming(0.45, { duration: 1 }),
          withTiming(0, { duration: 1150, easing: Easing.out(Easing.cubic) }),
        ),
        -1,
        false,
      ),
    );

    speechNative?.allowHapticsWhileRecording?.();
    setUiSoundsSuppressed(true);
    void haptics.impact("medium");

    try {
      speechRecognition?.start({
        lang: "zh-CN",
        interimResults: true,
        continuous: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
      });
    } catch {}

    // Smooth ~45fps velocity-proportional auto-scroll when dragging near top/bottom edges of overflowing Bot list
    tickTimerRef.current = setInterval(() => {
      if (!recordingRef.current) return;
      const elapsed = Date.now() - recordStartedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= MAX_RECORD_MS) {
        void finalizeRecording();
        return;
      }

      if (onVoiceAutoScroll && !measuringRef.current) {
        const finger = initialTouchRef.current;
        const edgeBand = 80;
        const topZoneEnd = listSafeTop + edgeBand;
        const bottomZoneStart = bottomActionCeilingY - edgeBand;
        let scrollDelta = 0;

        if (finger.y < topZoneEnd) {
          const depth = Math.min(1, Math.max(0.15, (topZoneEnd - finger.y) / edgeBand));
          scrollDelta = -(2.5 + depth * 8.5);
        } else if (finger.y >= bottomZoneStart && finger.y < bottomActionCeilingY) {
          const depth = Math.min(1, Math.max(0.15, (finger.y - bottomZoneStart) / edgeBand));
          scrollDelta = 2.5 + depth * 8.5;
        }

        if (scrollDelta !== 0 && onVoiceAutoScroll(scrollDelta)) {
          measuringRef.current = true;
          void measureRegisteredAgentRows()
            .then((freshRows) => {
              measuredRowsRef.current = freshRows;
              if (recordingRef.current) {
                const latest = initialTouchRef.current;
                evaluateFingerZone(latest.x, latest.y, true);
              }
            })
            .finally(() => {
              measuringRef.current = false;
            });
        }
      }
    }, 22);
  }, [
    bottomActionCeilingY,
    evaluateFingerZone,
    finalizeRecording,
    listSafeTop,
    onVoiceAutoScroll,
    orbMaxX,
    orbMaxY,
    orbMinX,
    orbMinY,
    orbX,
    orbY,
    recordingSV,
    rippleOpacity,
    rippleScale,
    t,
    waveClock,
  ]);

  const handleTouchBegin = useCallback(
    (absX: number, absY: number) => {
      pressActiveRef.current = true;
      initialTouchRef.current = { x: absX, y: absY };
      void measureRegisteredAgentRows().then((rows) => {
        if (pressActiveRef.current) measuredRowsRef.current = rows;
      });
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
      evaluateFingerZone(absX, absY, true);
    },
    [evaluateFingerZone],
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

  // 120fps UI-thread finger tracking + clamped safe bounds inside the worklet!
  const voiceGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          orbX.set(Math.max(orbMinX, Math.min(orbMaxX, event.absoluteX)));
          orbY.set(Math.max(orbMinY, Math.min(orbMaxY, event.absoluteY)));
          scheduleOnRN(handleTouchBegin, event.absoluteX, event.absoluteY);
        })
        .onUpdate((event) => {
          if (recordingSV.get() === 1) {
            orbX.set(Math.max(orbMinX, Math.min(orbMaxX, event.absoluteX)));
            orbY.set(Math.max(orbMinY, Math.min(orbMaxY, event.absoluteY)));
          }
          scheduleOnRN(handleTouchMove, event.absoluteX, event.absoluteY);
        })
        .onFinalize(() => {
          scheduleOnRN(handleTouchEnd);
        }),
    [handleTouchBegin, handleTouchEnd, handleTouchMove, orbMaxX, orbMaxY, orbMinX, orbMinY, orbX, orbY, recordingSV],
  );

  const hoveredAgent = useMemo(
    () => (hoveredRow ? (agents.find((agent) => agent.id === hoveredRow.agentId) ?? null) : null),
    [agents, hoveredRow],
  );

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

  const orbStatusLabel = useMemo(() => {
    if (zone === "cancel") return t("mobile.app.capsule.releaseCancel");
    if (zone === "transcribe") return t("mobile.app.capsule.releaseTranscribe");
    if (zone === "agent" && hoveredAgent) {
      return `${t("mobile.app.capsule.sendTo", { name: hoveredAgent.name })} · ${timerLabel}`;
    }
    if (zone === "default" && favorite) {
      if (liveTranscript) {
        const snippet = liveTranscript.length > 14 ? `${liveTranscript.slice(0, 14)}…` : liveTranscript;
        return `“${snippet}” · ${favorite.name}`;
      }
      return `${t("mobile.app.capsule.releaseSendTo", { name: favorite.name })} · ${timerLabel}`;
    }
    return t("mobile.app.capsule.moveToAgent");
  }, [favorite, hoveredAgent, liveTranscript, t, timerLabel, zone]);

  // Smoothly tracks finger on UI thread; label auto-flips below orb if near top safe boundary!
  const floatingOrbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: orbX.get() - MIC_ORB_SIZE / 2 }, { translateY: orbY.get() - MIC_ORB_SIZE / 2 }],
  }));

  const floatingPillPositionStyle = useAnimatedStyle(() => {
    const y = orbY.get();
    const flipBelow = y < listSafeTop + 96;
    return {
      top: flipBelow ? y + MIC_ORB_SIZE / 2 + 12 : y - MIC_ORB_SIZE / 2 - 44,
    };
  });

  const rippleAnimStyle = useAnimatedStyle(() => {
    const boost = 1 + audioLevel.get() * 0.25;
    return {
      opacity: rippleOpacity.get(),
      transform: [{ scale: rippleScale.get() * boost }],
    };
  });

  const cancelWingStyle = useAnimatedStyle(() => {
    const delta = cancelPillScale.get() - 1;
    return {
      transform: [{ translateY: -delta * 72 }, { scale: 1 + delta * 0.32 }],
    };
  });

  const transcribeWingStyle = useAnimatedStyle(() => {
    const delta = transcribePillScale.get() - 1;
    return {
      transform: [{ translateY: -delta * 72 }, { scale: 1 + delta * 0.32 }],
    };
  });

  const iconColor = String(foreground);
  const orbActiveColor = zone === "cancel" || isCountdown ? CANCEL_RED : BRAND_PURPLE;

  // Strictly clamped Bot highlight top coordinate (GUARANTEED never hits Dynamic Island or bottom actions!)
  const clampedHoveredTop = hoveredRow
    ? Math.max(listSafeTop + 2, Math.min(bottomActionCeilingY - hoveredRow.height - 6, hoveredRow.top))
    : listSafeTop;

  // True geometric circular thumb-arc wings for Cancel (left) and To-Text (right)
  const arcGeometry = useMemo(() => {
    const stageH = 122;
    const rOut = screenWidth * 1.15;
    const thick = 56;
    const rCap = thick / 2;
    const rIn = rOut - thick;
    const rMid = rOut - rCap;
    const cx = screenWidth / 2;
    const cy = 16 + rOut;

    const innerSin = Math.min(0.42, (11 + rCap) / rMid);
    const outerSin = Math.min(0.62, Math.max(innerSin + 0.14, (screenWidth / 2 - 18 - rCap) / rMid));
    const aInner = Math.asin(innerSin);
    const aOuter = Math.asin(outerSin);

    const buildWing = (a1: number, a2: number) => {
      const ox1 = cx + rOut * Math.sin(a1);
      const oy1 = cy - rOut * Math.cos(a1);
      const ox2 = cx + rOut * Math.sin(a2);
      const oy2 = cy - rOut * Math.cos(a2);
      const ix2 = cx + rIn * Math.sin(a2);
      const iy2 = cy - rIn * Math.cos(a2);
      const ix1 = cx + rIn * Math.sin(a1);
      const iy1 = cy - rIn * Math.cos(a1);
      const aMid = (a1 + a2) / 2;
      const mx = cx + rMid * Math.sin(aMid);
      const my = cy - rMid * Math.cos(aMid);
      const deg = (aMid * 180) / Math.PI;
      const d = [
        `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
        `A ${rOut.toFixed(2)} ${rOut.toFixed(2)} 0 0 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
        `A ${rCap.toFixed(2)} ${rCap.toFixed(2)} 0 0 1 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
        `A ${rIn.toFixed(2)} ${rIn.toFixed(2)} 0 0 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
        `A ${rCap.toFixed(2)} ${rCap.toFixed(2)} 0 0 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)} Z`,
      ].join(" ");
      return { d, mx, my, deg };
    };

    return {
      stageH,
      left: buildWing(-aOuter, -aInner),
      right: buildWing(aInner, aOuter),
    };
  }, [screenWidth]);

  return (
    <>
      {/* MINIMALIST DRAGGABLE LIVING VOICE ORB OVERLAY (zIndex 65, zero duplicate bottom bar!) */}
      {recording ? (
        <Animated.View
          entering={FadeIn.duration(110)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { zIndex: 65 }]}
        >
          {/* Calm scrim so Bot list stays crisp & readable while dragging */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: dark ? "rgba(0, 0, 0, 0.52)" : "rgba(15, 23, 42, 0.30)" },
            ]}
          />

          {/* Safe-Clamped Highlighted Target Bot Card (NEVER overlaps Dynamic Island!) */}
          {hoveredRow && hoveredAgent ? (
            <View
              key={hoveredAgent.id}
              style={{
                position: "absolute",
                top: clampedHoveredTop,
                left: 12,
                right: 12,
                minHeight: hoveredRow.height,
                borderRadius: 22,
                backgroundColor: dark ? "rgba(32, 32, 40, 0.96)" : "rgba(255, 255, 255, 0.97)",
                borderWidth: 1.5,
                borderColor: "rgba(124, 58, 237, 0.5)",
                paddingHorizontal: 14,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                transform: [{ scale: 1.02 }],
                shadowColor: BRAND_PURPLE,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.22,
                shadowRadius: 18,
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
                <Typography.Paragraph
                  className="font-medium"
                  numberOfLines={1}
                  style={[typeScale.preview, { color: BRAND_PURPLE }]}
                >
                  {liveTranscript ? `“${liveTranscript}”` : t("mobile.app.capsule.sendTo", { name: hoveredAgent.name })}
                </Typography.Paragraph>
              </View>
            </View>
          ) : null}

          {/* Sculpted Concentric Curved-Arc Bottom Action Wings (Cancel & To-Text) */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: Math.max(insets.bottom, 14) + 6,
              height: arcGeometry.stageH,
            }}
          >
            {/* Left Curved Wing: Cancel */}
            <Animated.View style={[StyleSheet.absoluteFill, cancelWingStyle]}>
              <Svg width={screenWidth} height={arcGeometry.stageH}>
                <Defs>
                  <LinearGradient id="voiceCancelGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={zone === "cancel" ? "#fb7185" : "#3a3a46"} stopOpacity={0.94} />
                    <Stop offset="1" stopColor={zone === "cancel" ? "#dc2626" : "#22222b"} stopOpacity={0.92} />
                  </LinearGradient>
                </Defs>
                <Path
                  d={arcGeometry.left.d}
                  fill="url(#voiceCancelGrad)"
                  stroke={zone === "cancel" ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.22)"}
                  strokeWidth={1.2}
                />
              </Svg>
              <View
                style={{
                  position: "absolute",
                  left: arcGeometry.left.mx - 64,
                  top: arcGeometry.left.my - 14,
                  width: 128,
                  height: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transform: [{ rotate: `${arcGeometry.left.deg.toFixed(1)}deg` }],
                }}
              >
                <X color="#ffffff" size={16} strokeWidth={2.5} />
                <Typography style={{ color: "#ffffff", fontSize: 14, fontWeight: "600", letterSpacing: 0.3 }}>
                  {t("mobile.app.capsule.cancel")}
                </Typography>
              </View>
            </Animated.View>

            {/* Right Curved Wing: To Text */}
            <Animated.View style={[StyleSheet.absoluteFill, transcribeWingStyle]}>
              <Svg width={screenWidth} height={arcGeometry.stageH}>
                <Defs>
                  <LinearGradient id="voiceTextGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={zone === "transcribe" ? "#a78bfa" : "#3a3a46"} stopOpacity={0.94} />
                    <Stop offset="1" stopColor={zone === "transcribe" ? "#6d28d9" : "#22222b"} stopOpacity={0.92} />
                  </LinearGradient>
                </Defs>
                <Path
                  d={arcGeometry.right.d}
                  fill="url(#voiceTextGrad)"
                  stroke={zone === "transcribe" ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.22)"}
                  strokeWidth={1.2}
                />
              </Svg>
              <View
                style={{
                  position: "absolute",
                  left: arcGeometry.right.mx - 64,
                  top: arcGeometry.right.my - 14,
                  width: 128,
                  height: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transform: [{ rotate: `${arcGeometry.right.deg.toFixed(1)}deg` }],
                }}
              >
                <Typography style={{ color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "700" }}>
                  {t("mobile.app.capsule.transcribeGlyph")}
                </Typography>
                <Typography style={{ color: "#ffffff", fontSize: 14, fontWeight: "600", letterSpacing: 0.3 }}>
                  {t("mobile.app.capsule.transcribe")}
                </Typography>
              </View>
            </Animated.View>
          </View>

          {/* Compact Floating Pill Following the Orb (Auto-flips below orb near top safe boundary!) */}
          <Animated.View
            style={[
              floatingPillPositionStyle,
              {
                position: "absolute",
                left: 24,
                right: 24,
                alignItems: "center",
              },
            ]}
          >
            <View
              style={{
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 7,
                backgroundColor:
                  zone === "cancel"
                    ? CANCEL_RED
                    : zone === "transcribe" || zone === "agent"
                      ? BRAND_PURPLE
                      : "rgba(24, 24, 27, 0.86)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.24,
                shadowRadius: 10,
              }}
            >
              <Typography style={{ color: "#ffffff", fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                {orbStatusLabel}
              </Typography>
            </View>
          </Animated.View>

          {/* THE SINGLE DRAGGABLE LIVING VOICE ORB (Clean solid brand orb — zero fake gloss bar!) */}
          <Animated.View
            style={[
              floatingOrbStyle,
              {
                position: "absolute",
                top: 0,
                left: 0,
                width: MIC_ORB_SIZE,
                height: MIC_ORB_SIZE,
                alignItems: "center",
                justifyContent: "center",
              },
            ]}
          >
            {/* Voice-Reactive Expanding Liquid Ripple */}
            <Animated.View
              style={[
                rippleAnimStyle,
                {
                  position: "absolute",
                  width: MIC_ORB_SIZE,
                  height: MIC_ORB_SIZE,
                  borderRadius: MIC_ORB_SIZE / 2,
                  backgroundColor: orbActiveColor,
                },
              ]}
            />
            <View
              style={{
                width: MIC_ORB_SIZE,
                height: MIC_ORB_SIZE,
                borderRadius: MIC_ORB_SIZE / 2,
                backgroundColor: orbActiveColor,
                borderWidth: 2.5,
                borderColor: "rgba(255, 255, 255, 0.92)",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: orbActiveColor,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.45,
                shadowRadius: 18,
                elevation: 14,
              }}
            >
              {zone === "cancel" ? (
                <X color="#ffffff" size={28} strokeWidth={2.6} />
              ) : zone === "transcribe" ? (
                <Typography style={{ color: "#ffffff", fontSize: 22, fontWeight: "800" }}>
                  {t("mobile.app.capsule.transcribeGlyph")}
                </Typography>
              ) : (
                <OrbLiveWave level={audioLevel} clock={waveClock} />
              )}
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* EXPLICIT VOICE DELIVERY STATUS BANNER */}
      {!recording && sentDelivery ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOut.duration(180)}
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: capsuleBottom + HOME_CAPSULE_HEIGHT + 16,
            zIndex: 56,
          }}
        >
          <SpringPressable
            feedback="open"
            scaleTo={0.98}
            onPress={() => {
              setSentDelivery(null);
              router.push({ pathname: "/chat/[agentId]", params: { agentId: sentDelivery.agent.id } });
            }}
            style={{
              borderRadius: 22,
              overflow: "hidden",
              borderWidth: 1,
              borderColor:
                sentDelivery.phase === "failed"
                  ? "rgba(239, 68, 68, 0.35)"
                  : dark
                    ? "rgba(255, 255, 255, 0.18)"
                    : "rgba(124, 58, 237, 0.22)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.14,
              shadowRadius: 18,
              elevation: 8,
            }}
          >
            <BlurView
              intensity={68}
              tint={dark ? "systemThickMaterialDark" : "systemThickMaterialLight"}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 11,
              }}
            >
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: dark ? "rgba(28, 28, 34, 0.78)" : "rgba(255, 255, 255, 0.85)" },
                ]}
              />
              <BloubAvatar
                agentId={sentDelivery.agent.id}
                serverId={sentDelivery.agent.serverId}
                hue={sentDelivery.agent.avatarHue}
                color={sentDelivery.agent.avatarColor}
                seed={sentDelivery.agent.avatarSeed}
                avatarUrl={sentDelivery.agent.avatarUrl}
                size={38}
                animateIdle={false}
              />
              <View className="min-w-0 flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Typography className="font-bold text-xs text-foreground">
                    {t("mobile.app.capsule.sentBannerTitle", { name: sentDelivery.agent.name })}
                  </Typography>
                  {sentDelivery.phase === "sending" ? (
                    <Spinner size="sm" color={BRAND_PURPLE} />
                  ) : sentDelivery.phase === "delivered" ? (
                    <View
                      className="size-4 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.16)" }}
                    >
                      <Check color={SUCCESS_GREEN} size={11} strokeWidth={3} />
                    </View>
                  ) : null}
                  <Typography
                    className="text-[11px]"
                    style={{
                      color:
                        sentDelivery.phase === "failed"
                          ? CANCEL_RED
                          : sentDelivery.phase === "delivered"
                            ? SUCCESS_GREEN
                            : BRAND_PURPLE,
                    }}
                  >
                    {sentDelivery.phase === "failed"
                      ? t("mobile.app.capsule.sendFailedRetry")
                      : sentDelivery.phase === "delivered"
                        ? t("mobile.app.capsule.sentDelivered")
                        : t("mobile.app.capsule.sentReplying")}
                  </Typography>
                </View>
                <Typography className="text-xs text-text-secondary" numberOfLines={1}>
                  {`“${sentDelivery.text}”`}
                </Typography>
              </View>
              <ChevronRight color={iconColor} size={16} />
            </BlurView>
          </SpringPressable>
        </Animated.View>
      ) : null}

      {/* Short tap hint & toast bubble above capsule */}
      {!sentDelivery && (shortTapHint || toastMessage) ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            bottom: capsuleBottom + HOME_CAPSULE_HEIGHT + 16,
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
              shadowOpacity: 0.18,
              shadowRadius: 12,
            }}
          >
            <Typography className="font-medium text-xs" style={{ color: "#ffffff" }}>
              {toastMessage ?? t("mobile.app.capsule.voiceShortTapHint")}
            </Typography>
          </View>
        </Animated.View>
      ) : null}

      {/* Main 3D Liquid-Glass 5-Slot Bottom Capsule Action Bar (completely unmounted visually while recording!) */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: capsuleBottom,
          zIndex: 50,
          overflow: "visible",
        }}
      >
        {!recording ? (
          <View
            style={{
              borderRadius: HOME_CAPSULE_HEIGHT / 2,
              borderWidth: 1,
              borderColor: dark ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.88)",
              shadowColor: dark ? "#000" : "#3b1d8f",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: dark ? 0.36 : 0.12,
              shadowRadius: 22,
              elevation: 9,
            }}
          >
            <GlassCapsule
              liquidGlass={liquidGlass}
              fallbackBackground={capsuleBg}
              height={HOME_CAPSULE_HEIGHT}
              animateGlass
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: HOME_CAPSULE_HEIGHT / 2,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: dark ? "rgba(255,255,255,0.12)" : "rgba(124, 58, 237, 0.14)",
                }}
              />

              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 14,
                }}
              >
                {/* Slot 1: Favorite Bot */}
                <View className="w-11 items-center justify-center">
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
                      className="size-10 items-center justify-center rounded-full bg-control/80"
                    >
                      <Plus color={iconColor} size={20} strokeWidth={2.2} />
                    </SpringPressable>
                  )}
                </View>

                {/* Slot 2: Schedule Calendar */}
                <SpringPressable
                  feedback="open"
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t("mobile.app.capsule.scheduleLabel")}
                  onPress={() => router.push({ pathname: "/server-routines", params: { serverId } })}
                  className="size-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.045)",
                  }}
                >
                  <CalendarClock color={iconColor} size={19} strokeWidth={2} />
                </SpringPressable>

                {/* Slot 3: Spacer for protruding center Mic Orb */}
                <View style={{ width: MIC_ORB_SIZE + 8 }} pointerEvents="none" />

                {/* Slot 4: Personal Memory Vault (记忆库) */}
                <SpringPressable
                  feedback="open"
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t("mobile.app.capsule.memoryVaultLabel")}
                  onPress={() => router.push("/memory-vault")}
                  className="size-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.045)",
                  }}
                >
                  <BookBookmark color={iconColor} size={19} strokeWidth={2} />
                </SpringPressable>

                {/* Slot 5: Full-Screen Usage & Billing Page */}
                <SpringPressable
                  feedback="open"
                  scaleTo={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={t("mobile.app.capsule.billingLabel", {
                    amount: formatCompactUsd(billingMonth.totalCostUsd),
                  })}
                  onPress={() => router.push({ pathname: "/server-usage", params: { serverId } })}
                  className="relative size-10 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.045)",
                  }}
                >
                  <AnalyticsBarsIcon color={iconColor} />
                  {billingMonth.hasQuotaAlert ? (
                    <View
                      className="absolute top-1.5 right-1.5 size-2 rounded-full border border-background"
                      style={{ backgroundColor: CANCEL_RED }}
                    />
                  ) : null}
                </SpringPressable>
              </View>
            </GlassCapsule>
          </View>
        ) : (
          <View style={{ height: HOME_CAPSULE_HEIGHT }} pointerEvents="none" />
        )}

        {/* IDLE PROTRUDING MIC ORB & PERSISTENT PAN GESTURE ANCHOR */}
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: -MIC_PROTRUDE_TOP,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 20,
          }}
        >
          <GestureDetector gesture={voiceGesture}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("mobile.app.capsule.voiceLabel")}
              style={{
                width: MIC_ORB_SIZE + 10,
                height: MIC_ORB_SIZE + 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {!recording ? (
                <View
                  style={{
                    width: MIC_ORB_SIZE,
                    height: MIC_ORB_SIZE,
                    borderRadius: MIC_ORB_SIZE / 2,
                    backgroundColor: BRAND_PURPLE,
                    borderWidth: 3.5,
                    borderColor: sheetBg,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: BRAND_PURPLE,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.42,
                    shadowRadius: 16,
                    elevation: 12,
                  }}
                >
                  <Mic color="#ffffff" size={28} strokeWidth={2.3} />
                </View>
              ) : null}
            </View>
          </GestureDetector>
        </View>
      </View>

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
          void sendVoiceTextToAgent(agent, text);
        }}
        onClose={() => setTranscriptOpen(false)}
      />
    </>
  );
}

function OrbLiveWave({ level, clock }: { level: SharedValue<number>; clock: SharedValue<number> }) {
  return (
    <View className="flex-row items-center gap-[4px]">
      {ORB_WAVE_BARS.map((bar) => (
        <OrbWaveBar key={bar.id} phase={bar.phase} weight={bar.weight} level={level} clock={clock} />
      ))}
    </View>
  );
}

function OrbWaveBar({
  phase,
  weight,
  level,
  clock,
}: {
  phase: number;
  weight: number;
  level: SharedValue<number>;
  clock: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const wave = (Math.sin(clock.get() * 1.55 + phase) + 1) * 0.5;
    const amp = Math.max(0.22, level.get());
    const height = Math.max(7, Math.min(28, 7 + (amp * 15 + wave * 8) * weight));
    return { height };
  });
  return <Animated.View style={[{ width: 3.6, borderRadius: 2, backgroundColor: "#ffffff" }, style]} />;
}

function AnalyticsBarsIcon({ color }: { color: string }) {
  return (
    <View className="h-[18px] w-[18px] flex-row items-end justify-center gap-[3px] pb-[1px]">
      <View style={{ width: 3.2, height: 8, borderRadius: 1.6, backgroundColor: color }} />
      <View style={{ width: 3.2, height: 15, borderRadius: 1.6, backgroundColor: color }} />
      <View style={{ width: 3.2, height: 11, borderRadius: 1.6, backgroundColor: color }} />
    </View>
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
          size={isIOS ? 38 : 36}
          animateIdle={false}
        />
      </View>
    </Pressable>
  );
}
