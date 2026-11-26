import MaskedView from "@react-native-masked-view/masked-view";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { useMobileSession, useQueryScope } from "@/features/auth/context/mobile-session-context";
import { loadServerLogo } from "@/features/servers/model/server-logo";
import { DISCONNECTED_APPEARANCE } from "@/features/workspace/components/use-connection-appearance";
import { queryKeys } from "@/features/workspace/model/query-keys";
import { showsOnline } from "@/features/workspace/model/server-status";
import type { MobileServer } from "@/features/workspace/model/workspace-types";
import { END_X } from "@/shared/lib/text-direction";

const STARBOT_SERVER_ICON = require("../../../../assets/icons/app-icon.png");
export const SERVER_AVATAR_CORNER_RATIO = 0.32;
const DOT = 12;
const DOT_OVERHANG = 2;
const DOT_GAP = 2.5;

function cutoutPath(size: number): string {
  const centerY = size + DOT_OVERHANG - DOT / 2;
  const centerX = END_X === 1 ? centerY : size - centerY;
  const radius = DOT / 2 + DOT_GAP;
  return `M0 0H${size}V${size}H0Z M${centerX - radius} ${centerY}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`;
}

export function ServerAvatar({
  server,
  size = 48,
  logoUri,
  showStatus = true,
}: {
  server: MobileServer;
  size?: number;
  logoUri?: string | null;
  showStatus?: boolean;
}) {
  const { session } = useMobileSession();
  const queryScope = useQueryScope();
  const { logoKey } = server;
  const saved = useQuery({
    queryKey: queryKeys.serverLogo(queryScope, server.id, logoKey),
    enabled: logoUri === undefined && Boolean(session && logoKey),
    queryFn: () => {
      if (!session || !logoKey) throw new Error("The server logo is unavailable.");
      return loadServerLogo(session, server.id, logoKey);
    },
    retry: 4,
    staleTime: Infinity,
  });
  const logo = logoUri === undefined ? (saved.data ?? null) : logoUri;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const logoFailed = logo === failedUri;
  const success = String(useCSSVariable("--openbot-success"));
  const warning = String(useCSSVariable("--openbot-warning"));
  const danger = String(useCSSVariable("--openbot-danger"));
  const offline = String(useCSSVariable("--openbot-text-dim"));
  const online = showsOnline(server);
  const dot = online
    ? success
    : server.state === "error"
      ? danger
      : server.state === "connecting" && server.initialConnectionPending
        ? warning
        : offline;
  const muted = showStatus && !online;
  const showsLogo = Boolean(logo && !logoFailed);
  const tile = (
    <View
      className="items-center justify-center"
      style={{
        borderCurve: "continuous",
        borderRadius: size * SERVER_AVATAR_CORNER_RATIO,
        height: size,
        opacity: muted ? DISCONNECTED_APPEARANCE.opacity : 1,
        overflow: "hidden",
        width: size,
      }}
    >
      <Image
        source={showsLogo && logo ? { uri: logo } : STARBOT_SERVER_ICON}
        contentFit="cover"
        recyclingKey={showsLogo && logo ? logo : "starbot-server-icon"}
        style={{ height: size, width: size }}
        onError={() => {
          if (logo) setFailedUri(logo);
        }}
      />
    </View>
  );
  if (!showStatus)
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {tile}
      </View>
    );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <MaskedView
        style={{ height: size, width: size }}
        maskElement={
          <Svg height={size} width={size}>
            <Path d={cutoutPath(size)} fill="#000" fillRule="evenodd" />
          </Svg>
        }
      >
        {tile}
      </MaskedView>
      <View
        className="absolute rounded-full"
        style={{
          backgroundColor: dot,
          bottom: -DOT_OVERHANG,
          height: DOT,
          right: -DOT_OVERHANG,
          width: DOT,
        }}
      />
    </View>
  );
}
