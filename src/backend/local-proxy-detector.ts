import { execFileSync } from "node:child_process";
import { createConnection } from "node:net";

const COMMON_LOCAL_PROXY_PORTS = [7890, 7897, 7891, 1087, 10808, 10809, 6152, 17890, 1080] as const;
const PROXY_CACHE_TTL_MS = 12_000;

const OVERSEAS_NO_PROXY = [
  "127.0.0.1",
  "localhost",
  "::1",
  "*.local",
  "*.cn",
  "workbuddy.cn",
  "*.workbuddy.cn",
  "*.tencent.com",
  "*.qq.com",
  "*.myqcloud.com",
  "kimi.com",
  "*.kimi.com",
  "*.moonshot.cn",
  "*.aliyuncs.com",
  "*.volces.com",
  "*.bigmodel.cn",
  "*.deepseek.com",
].join(",");

let cachedProxyUrl: string | null = null;
let lastCheckedAt = 0;
let refreshInFlight: Promise<string | null> | null = null;

function readEnvProxy(): string | null {
  for (const key of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"]) {
    const val = process.env[key]?.trim();
    if (val && /^https?:\/\/|^socks5h?:\/\//iu.test(val)) return val;
  }
  return null;
}

function readMacSystemProxySync(): string | null {
  if (process.platform !== "darwin") return null;
  try {
    const out = execFileSync("/usr/sbin/scutil", ["--proxy"], { encoding: "utf8", timeout: 800 });
    const get = (key: string): string | null => {
      const m = new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "mu").exec(out);
      return m?.[1]?.trim() ?? null;
    };
    if (get("HTTPSEnable") === "1") {
      const host = get("HTTPSProxy");
      const port = get("HTTPSPort");
      if (host && port) return `http://${host}:${port}`;
    }
    if (get("HTTPEnable") === "1") {
      const host = get("HTTPProxy");
      const port = get("HTTPPort");
      if (host && port) return `http://${host}:${port}`;
    }
    if (get("SOCKSEnable") === "1") {
      const host = get("SOCKSProxy");
      const port = get("SOCKSPort");
      if (host && port) return `socks5://${host}:${port}`;
    }
  } catch {}
  return null;
}

function checkLocalPortOpen(port: number, timeoutMs = 120): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function probeActiveProxyUrl(): Promise<string | null> {
  const fromEnv = readEnvProxy();
  if (fromEnv) return fromEnv;

  const fromSystem = readMacSystemProxySync();
  if (fromSystem) return fromSystem;

  for (const port of COMMON_LOCAL_PROXY_PORTS) {
    if (await checkLocalPortOpen(port)) {
      // port 1080 is typically SOCKS5; 7890/7897/1087/10808/6152/17890 support HTTP CONNECT on modern clients
      return port === 1080 ? `socks5://127.0.0.1:${port}` : `http://127.0.0.1:${port}`;
    }
  }
  return null;
}

function triggerBackgroundRefresh(): void {
  if (refreshInFlight) return;
  refreshInFlight = probeActiveProxyUrl()
    .then((detected) => {
      cachedProxyUrl = detected;
      lastCheckedAt = Date.now();
      return detected;
    })
    .catch(() => cachedProxyUrl)
    .finally(() => {
      refreshInFlight = null;
    });
}

export async function warmLocalProxyDetector(): Promise<string | null> {
  const detected = await probeActiveProxyUrl();
  cachedProxyUrl = detected;
  lastCheckedAt = Date.now();
  return detected;
}

export function detectActiveLocalProxyUrl(): string | null {
  const now = Date.now();
  if (lastCheckedAt === 0) {
    cachedProxyUrl = readEnvProxy() ?? readMacSystemProxySync();
    triggerBackgroundRefresh();
  } else if (now - lastCheckedAt > PROXY_CACHE_TTL_MS) {
    triggerBackgroundRefresh();
  }
  return cachedProxyUrl;
}

export function overseasProviderProxyEnv(): Record<string, string> {
  const proxy = detectActiveLocalProxyUrl();
  if (!proxy) return {};
  return {
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    ALL_PROXY: proxy,
    http_proxy: proxy,
    https_proxy: proxy,
    all_proxy: proxy,
    NO_PROXY: OVERSEAS_NO_PROXY,
    no_proxy: OVERSEAS_NO_PROXY,
  };
}

export function domesticDirectEnv(): Record<string, string> {
  return {
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
    http_proxy: "",
    https_proxy: "",
    all_proxy: "",
    NO_PROXY: "*",
    no_proxy: "*",
  };
}

// Kick off an immediate non-blocking probe on module import
triggerBackgroundRefresh();
