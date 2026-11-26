import { type AvatarMood, avatarMoodIsBusy, avatarMoodPresentation } from "@openbot/brand/bloub-avatar-motion";
import type { AvatarColor, AvatarHue } from "@openbot/contracts/ipc";
import { memo, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, {
  convertToRGBA,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useAgentActivity } from "@/features/workspace/components/use-agent-activity";
import {
  DISCONNECTED_APPEARANCE,
  useConnectionAppearance,
} from "@/features/workspace/components/use-connection-appearance";
import { useMobileWorkspaceSelector } from "@/features/workspace/context/mobile-workspace-context";
import { agentActivityMood } from "@/features/workspace/model/agent-activity";
import { showsOnline } from "@/features/workspace/model/server-status";
import { useMotionPreference } from "@/shared/lib/motion";
import { useScreenFocusedWhile } from "@/shared/lib/use-screen-focused-while";
import { AgentPhoto, type AgentPhotoProps } from "./agent-photo";
import { ZodiacClayMobile } from "./zodiac-clay-mobile";

interface BloubAvatarProps extends AgentPhotoProps {
  agentId: string;
  hue: AvatarHue | null;
  color?: AvatarColor | null;
  seed: string;
  size?: number;
  animateIdle?: boolean;
  paused?: boolean;
  rings?: boolean;
}

type PlushTransition = "pop" | "cut";

export function BloubAvatar({
  activityMood,
  ...props
}: BloubAvatarProps & {
  activityMood?: AvatarMood;
}) {
  if (activityMood !== undefined) return <LiveBloubAvatar {...props} activityMood={activityMood} />;
  return <ChatBloubAvatar {...props} />;
}

function ChatBloubAvatar(props: BloubAvatarProps) {
  return <LiveBloubAvatar {...props} activityMood={agentActivityMood(useAgentActivity(props.agentId))} />;
}

function LiveBloubAvatar({
  agentId,
  serverId: hostId,
  avatarUrl,
  hue,
  color = null,
  seed,
  size = 54,
  animateIdle = true,
  paused = false,
  rings = false,
  activityMood,
}: BloubAvatarProps & { activityMood: AvatarMood }) {
  const serverId = useMobileWorkspaceSelector(
    (workspace) => hostId ?? workspace.agents.find((agent) => agent.id === agentId)?.serverId,
  );
  const disconnected = useMobileWorkspaceSelector(
    (workspace) => !workspace.servers.some((server) => server.id === serverId && showsOnline(server)),
  );
  return (
    <BloubAvatarPreview
      agentId={agentId}
      serverId={serverId}
      avatarUrl={avatarUrl}
      hue={hue}
      color={color}
      seed={seed}
      size={size}
      animateIdle={animateIdle}
      paused={paused}
      rings={rings}
      disconnected={disconnected}
      mood={disconnected ? "idle" : activityMood}
    />
  );
}

interface AvatarPreviewOptions {
  disconnected?: boolean;
  mood?: AvatarMood;
  transition?: PlushTransition;
}

export const BloubAvatarPreview = memo(function BloubAvatarPreview(
  props: Omit<BloubAvatarProps, "agentId"> & AgentPhotoProps & AvatarPreviewOptions,
) {
  const size = props.size ?? 54;
  return (
    <AgentPhoto
      {...props}
      size={size}
      rings={props.rings ? !props.disconnected && avatarMoodPresentation(props.mood ?? "idle").rings : undefined}
    >
      <PlushAvatar
        seed={props.seed}
        hue={props.hue}
        color={props.color ?? null}
        size={size}
        mood={props.mood}
        animateIdle={props.animateIdle}
        paused={props.paused}
        disconnected={props.disconnected}
        transition={props.transition}
      />
    </AgentPhoto>
  );
});

const PlushAvatar = memo(function PlushAvatar({
  seed,
  hue,
  color,
  size,
  mood = "idle",
  animateIdle = true,
  paused = false,
  disconnected = false,
  transition = "cut",
}: {
  seed: string;
  hue: AvatarHue | null;
  color: AvatarColor | null;
  size: number;
  mood?: AvatarMood;
  animateIdle?: boolean;
  paused?: boolean;
  disconnected?: boolean;
  transition?: PlushTransition;
}) {
  const facesMove = useMotionPreference("agentFaces");
  const wantsMotion = facesMove && !paused && !disconnected && (avatarMoodIsBusy(mood) || animateIdle);
  const focused = useScreenFocusedWhile(wantsMotion);
  const animate = wantsMotion && focused;
  const { shown, style: popStyle } = usePlushPop(seed, hue, color, transition === "pop" && facesMove);
  const appearance = useConnectionAppearance(disconnected);
  const appearanceStyle = useAnimatedStyle(() => ({ opacity: appearance.get().opacity }));
  const drawn = size * 1.06;
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, appearanceStyle]}>
      <Animated.View
        style={[
          { position: "absolute", left: (size - drawn) / 2, top: (size - drawn) / 2, width: drawn, height: drawn },
          popStyle,
        ]}
      >
        <ZodiacClayMobile
          seed={shown.seed}
          hue={shown.hue}
          color={shown.color}
          size={drawn}
          mood={mood}
          animate={animate}
          disconnected={disconnected}
        />
      </Animated.View>
    </Animated.View>
  );
});

function usePlushPop(seed: string, hue: AvatarHue | null, color: AvatarColor | null, pop: boolean) {
  const [shown, setShown] = useState({ seed, hue, color });
  const target = useRef({ seed, hue, color });
  target.current = { seed, hue, color };
  const scale = useSharedValue(1);
  const changed = shown.seed !== seed || shown.hue !== hue || shown.color !== color;
  useEffect(() => {
    if (!changed) return;
    if (!pop) {
      scale.set(1);
      setShown(target.current);
      return;
    }
    const swap = () => {
      setShown(target.current);
      scale.set(withSpring(1, { duration: 420, dampingRatio: 0.55, reduceMotion: ReduceMotion.Never }));
    };
    scale.set(
      withTiming(
        0,
        { duration: 225, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.Never },
        (finished) => {
          if (finished) scheduleOnRN(swap);
        },
      ),
    );
  }, [changed, pop, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return { shown: changed && !pop ? { seed, hue, color } : shown, style };
}

export const BloubAvatarThumbnail = memo(function BloubAvatarThumbnail(
  props: Omit<BloubAvatarProps, "agentId"> & AgentPhotoProps & { disconnected?: boolean },
) {
  return (
    <AgentPhoto {...props} size={props.size ?? 48}>
      <AvatarThumbnail {...props} />
    </AgentPhoto>
  );
});

export const AvatarThumbnail = memo(function AvatarThumbnail({
  seed,
  hue,
  color = null,
  size = 48,
  disconnected = false,
}: Omit<BloubAvatarProps, "agentId"> & {
  disconnected?: boolean;
  animateColor?: boolean;
}) {
  const drawn = size * 1.06;
  return (
    <View
      pointerEvents="none"
      style={{ width: size, height: size, opacity: disconnected ? DISCONNECTED_APPEARANCE.opacity : 1 }}
    >
      <View style={{ position: "absolute", left: (size - drawn) / 2, top: (size - drawn) / 2 }}>
        <ZodiacClayMobile seed={seed} hue={hue} color={color} size={drawn} mood="idle" disconnected={disconnected} />
      </View>
    </View>
  );
});

function saturateColor(color: string, saturation: number) {
  if (saturation >= 1) return color;
  const [r, g, b, a] = convertToRGBA(color);
  const gray = r * 0.213 + g * 0.715 + b * 0.072;
  const channel = (value: number) => Math.round((gray + (value - gray) * saturation) * 255);
  return `rgba(${channel(r)}, ${channel(g)}, ${channel(b)}, ${a})`;
}

export function thumbnailColor(color: string, disconnected: boolean) {
  return disconnected ? saturateColor(color, DISCONNECTED_APPEARANCE.saturation) : color;
}
