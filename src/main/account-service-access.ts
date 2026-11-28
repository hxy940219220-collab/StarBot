import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { isMobileConnectDevelopmentHost } from "@openbot/contracts/mobile-connect";
import { sourceText } from "@openbot/i18n/source";
import { app, net } from "electron";
import { CentralAuthManager, readCentralAuthApiUrl, readMobileConnectApiUrl } from "./central-auth-manager";
import type { CompanySignInBrowser } from "./company-sign-in-browser";
import {
  createSecretStorage,
  SECRET_STORAGE_KEY_FILE,
  type SecretStorage,
  type SecretStorageCipher,
} from "./secret-storage-cipher";

const CENTRAL_AUTH_FILE = "openbot-central-auth-v1.bin";

let userDataSecretStorage: SecretStorage | null = null;

function secretStorage(): SecretStorage {
  userDataSecretStorage ??= createSecretStorage({
    keyPath: join(app.getPath("userData"), SECRET_STORAGE_KEY_FILE),
  });
  return userDataSecretStorage;
}

export function safeStorageCipher(
  unavailableKey: "error.app.secretStorageUnavailable" | "error.app.macSecureStorageUnavailable",
): SecretStorageCipher {
  return secretStorage().cipher(() => sourceText(unavailableKey));
}

function isDirectLocalAccountRequest(input: string | URL | Request): boolean {
  try {
    const raw = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
    const parsed = new URL(raw);
    return parsed.protocol === "http:" && isMobileConnectDevelopmentHost(parsed.hostname);
  } catch {
    return false;
  }
}

async function accountServiceFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (isDirectLocalAccountRequest(input)) {
    return globalThis.fetch(input, {
      ...init,
      credentials: "omit",
      cache: "no-store",
    });
  }
  try {
    return await net.fetch(input instanceof URL ? input.href : input, {
      ...init,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const code = /^net::(ERR_[A-Z0-9_]+)$/u.exec(error.message)?.[1];
    if (code === undefined) throw error;
    throw new TypeError("fetch failed", { cause: Object.assign(error, { code }) });
  }
}

export function centralAuthApiUrl(): string {
  return readCentralAuthApiUrl(
    process.env.OPENBOT_AUTH_API_URL,
    app.isPackaged ? "https://api.starbot.app" : "http://127.0.0.1:3100",
  );
}

const PREFERRED_LAN_INTERFACES: readonly string[] = ["en0", "en1", "bridge100", "en2", "en3"];

export function detectLocalLanIpv4Addresses(): string[] {
  const interfaces = networkInterfaces();
  const preferredSet = new Set(PREFERRED_LAN_INTERFACES);
  const orderedNames = [
    ...PREFERRED_LAN_INTERFACES.filter((name) => name in interfaces),
    ...Object.keys(interfaces).filter((name) => !preferredSet.has(name)),
  ];
  const results: string[] = [];
  for (const name of orderedNames) {
    for (const entry of interfaces[name] ?? []) {
      const family = String(entry.family);
      if (entry.internal || (family !== "IPv4" && family !== "4")) continue;
      if (!isMobileConnectDevelopmentHost(entry.address)) continue;
      if (entry.address === "127.0.0.1") continue;
      if (!results.includes(entry.address)) results.push(entry.address);
    }
  }
  return results;
}

export function detectLocalLanIpv4(): string | null {
  return detectLocalLanIpv4Addresses()[0] ?? null;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export function resolveMobileConnectApiUrl(configuredMobileApiUrl: string | undefined, apiUrl: string): string {
  const trimmed = configuredMobileApiUrl?.trim();
  if (trimmed) {
    try {
      const parsedConfigured = new URL(trimmed);
      if (!isLoopbackHostname(parsedConfigured.hostname)) {
        if (parsedConfigured.protocol === "http:" && isMobileConnectDevelopmentHost(parsedConfigured.hostname)) {
          const liveLanIps = detectLocalLanIpv4Addresses();
          if (liveLanIps.length > 0 && !liveLanIps.includes(parsedConfigured.hostname)) {
            parsedConfigured.hostname = liveLanIps[0]!;
            return readMobileConnectApiUrl(parsedConfigured.toString(), apiUrl);
          }
        }
        return readMobileConnectApiUrl(trimmed, apiUrl);
      }
    } catch {
      return readMobileConnectApiUrl(trimmed, apiUrl);
    }
  }
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname)) {
      const lanIp = detectLocalLanIpv4();
      if (lanIp) {
        parsed.hostname = lanIp;
        return readMobileConnectApiUrl(parsed.toString(), apiUrl);
      }
    }
  } catch {
    // Fall back to configured/default URL validation below.
  }
  return readMobileConnectApiUrl(configuredMobileApiUrl, apiUrl);
}

export function createCentralAuthManager(options: {
  companySignInBrowser?: CompanySignInBrowser;
  confirmSessionAtStart: boolean;
}): CentralAuthManager {
  const apiUrl = centralAuthApiUrl();
  return new CentralAuthManager({
    apiUrl,
    mobileConnectApiUrl: resolveMobileConnectApiUrl(process.env.OPENBOT_MOBILE_AUTH_API_URL, apiUrl),
    resolveMobileConnectApiUrl: () => resolveMobileConnectApiUrl(process.env.OPENBOT_MOBILE_AUTH_API_URL, apiUrl),
    storagePath: join(app.getPath("userData"), CENTRAL_AUTH_FILE),
    fetch: accountServiceFetch,
    ...safeStorageCipher("error.app.macSecureStorageUnavailable"),
    keyringChanged: () => secretStorage().madeKeyFile(),
    ...(options.companySignInBrowser ? { companySignInBrowser: options.companySignInBrowser } : {}),
    confirmSessionAtStart: options.confirmSessionAtStart,
  });
}
