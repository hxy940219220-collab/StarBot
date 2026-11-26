import { isNewerMobileVersion, type MobileReleaseNotes } from "@openbot/contracts/mobile-features";
import { createFileRoute } from "@tanstack/solid-router";
import { json } from "../../../server/request-auth";

const STARBOT_MOBILE_RELEASES: readonly MobileReleaseNotes[] = [
  {
    version: "0.2.0",
    date: "2026-11-26",
    groups: [
      {
        type: "added",
        heading: "星友（StarBot）局域网直连版",
        items: ["支持手机与 Mac 桌面工作台局域网点对点加密直连与实时多助手对话。"],
      },
    ],
  },
];

export const Route = createFileRoute("/v1/mobile/changelog")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams;
        const platform = query.get("platform");
        const after = query.get("after");
        const releases: MobileReleaseNotes[] =
          platform === "ios" || platform === "android"
            ? STARBOT_MOBILE_RELEASES.filter((release) => !after || isNewerMobileVersion(release.version, after))
            : [];
        return json({ releases });
      },
    },
  },
});
