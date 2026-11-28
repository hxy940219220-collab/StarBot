import { isMobileConnectDevelopmentHost } from "@starbot/contracts/mobile-connect";

export function buildContentSecurityPolicy(
  packaged: boolean,
  developmentSignalUrl?: string,
  selfHostedSignalOrigin?: string | null,
): string {
  const selfHostedSignalSource = selfHostedSignalOrigin ? ` ${selfHostedSignalOrigin}` : "";
  const developmentSources = packaged
    ? ""
    : ` http://localhost:* ws://localhost:*${developmentSignalSource(developmentSignalUrl)}`;
  const developmentImageSources = packaged ? "" : " http://127.0.0.1:* http://localhost:*";

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: starbot-attachment: starbot-remote-attachment: starbot-avatar: starbot-remote-avatar: starbot-server-logo: starbot-remote-server-logo: https:${developmentImageSources}`,
    "font-src 'self' data:",
    "media-src 'self' blob: data: starbot-app: starbot-attachment: starbot-remote-attachment:",
    `connect-src 'self' starbot-attachment: starbot-remote-attachment: ws://127.0.0.1:*${selfHostedSignalSource}${developmentSources}`,
    "object-src 'none'",
    "frame-src 'self' starbot-attachment: starbot-remote-attachment: starbot-visual: starbot-remote-visual: http://127.0.0.1:* http://localhost:*",
    "base-uri 'none'",
  ].join("; ");
}

export function readSelfHostedSignalOrigin(
  authApiUrl: string | undefined,
  signalUrl: string | undefined,
): string | null {
  if (!signalUrl) return null;
  if (!authApiUrl) throw new Error("STARBOT_REMOTE_SIGNAL_URL needs STARBOT_AUTH_API_URL.");
  const api = new URL(authApiUrl);
  const url = new URL(signalUrl);
  const localDevPair =
    url.protocol === "ws:" &&
    isMobileConnectDevelopmentHost(api.hostname) &&
    isMobileConnectDevelopmentHost(url.hostname);
  if ((url.protocol !== "wss:" && !localDevPair) || url.username !== "" || url.password !== "") {
    throw new Error("STARBOT_REMOTE_SIGNAL_URL must be a wss: URL without credentials.");
  }
  return url.origin;
}

function developmentSignalSource(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (
      url.protocol !== "ws:" ||
      !isMobileConnectDevelopmentHost(url.hostname) ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return "";
    }
    return ` ${url.origin}`;
  } catch {
    return "";
  }
}
