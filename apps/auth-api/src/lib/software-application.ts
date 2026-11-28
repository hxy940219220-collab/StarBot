import { version } from "../../../../package.json";
import channelScreenshot from "../content/guides/media/starbot-101/a-channel.webp";
import { STARBOT_SITE_URL, starBotSoftwareApplication } from "./site-metadata";

export const STARBOT_SOFTWARE_APPLICATION = starBotSoftwareApplication({
  version,
  screenshot: new URL(channelScreenshot, STARBOT_SITE_URL).toString(),
});
