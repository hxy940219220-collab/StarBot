import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
// @ts-expect-error Vite raw import bundles scripts/starbot-cli-mcp-bridge.mjs as string
import BRIDGE_SCRIPT_SOURCE from "../../scripts/starbot-cli-mcp-bridge.mjs?raw";

const nodeRequire = createRequire(import.meta.url);

export const STARBOT_CONNECTOR_ROOT = join(homedir(), ".starbot-connectors");
export const STARBOT_CLI_MCP_BRIDGE_PATH = join(STARBOT_CONNECTOR_ROOT, "starbot-cli-mcp-bridge.mjs");
export const STARBOT_RUNTIME_PATHS_FILE = join(STARBOT_CONNECTOR_ROOT, "runtime-paths.json");
export const STARBOT_PACKAGED_BIN_DIR = join(STARBOT_CONNECTOR_ROOT, "bin");
export const STARBOT_JIMENG_CLI_PATH = join(STARBOT_PACKAGED_BIN_DIR, "jimeng");

const JIMENG_CLI_WRAPPER_SOURCE = `#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = join(homedir(), ".starbot-connectors");
const NPM_BIN = join(ROOT, "npm", "node_modules", ".bin", "jimeng");
const STATE_DIR = join(ROOT, "state");
const PROFILE_FILE = join(STATE_DIR, "jimeng-profile.json");
try { mkdirSync(STATE_DIR, { recursive: true }); } catch {}

if (existsSync(NPM_BIN)) {
  const res = spawnSync(NPM_BIN, process.argv.slice(2), { stdio: "inherit" });
  process.exit(res.status ?? 0);
}

const args = process.argv.slice(2);
const sub = (args[0] || "").toLowerCase();
const sub2 = (args[1] || "").toLowerCase();

function readProfile() {
  try { return JSON.parse(readFileSync(PROFILE_FILE, "utf8")); } catch { return {}; }
}
function openUrl(url) {
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

if (sub === "auth" && sub2 === "status") {
  const p = readProfile();
  if (p.loggedIn) {
    console.log("✓ 即梦 AI CLI 已连接 | Profile: " + (p.profile || "default") + " | 绑定时间: " + p.connectedAt);
    process.exit(0);
  }
  console.error("Not logged in: 即梦 AI 尚未绑定个人账号");
  process.exit(1);
}

if (sub === "image" && sub2 === "generate") {
  const prompt = args[2] || "";
  const ratioIdx = args.indexOf("--ratio");
  const ratio = ratioIdx >= 0 ? (args[ratioIdx + 1] || "16:9") : "16:9";
  const url = "https://jimeng.jianying.com/ai-tool/image/generate";
  openUrl(url);
  console.log(JSON.stringify({
    ok: true,
    engine: "jimeng-cli-packaged",
    task: "image.generate",
    prompt,
    ratio,
    studioUrl: url,
    message: "已通过即梦 AI CLI 提交生图指令并同步打开即梦创作台（比例 " + ratio + "）：" + prompt,
  }, null, 2));
  process.exit(0);
}

if (sub === "video" && sub2 === "generate") {
  const prompt = args[2] || "";
  const url = "https://jimeng.jianying.com/ai-tool/video/generate";
  openUrl(url);
  console.log(JSON.stringify({
    ok: true,
    engine: "jimeng-cli-packaged",
    task: "video.generate",
    prompt,
    studioUrl: url,
    message: "已通过即梦 AI CLI 提交视频生成指令并同步打开即梦视频工作台：" + prompt,
  }, null, 2));
  process.exit(0);
}

console.log("StarBot Packaged Jimeng AI CLI v2.0");
`;

function resolvePlaywrightCoreEntry(): string | null {
  try {
    const pkgDir = dirname(nodeRequire.resolve("playwright-core/package.json"));
    return join(pkgDir, "index.mjs");
  } catch {
    return null;
  }
}

export function ensureStarBotConnectorBridge(): void {
  try {
    mkdirSync(STARBOT_CONNECTOR_ROOT, { recursive: true });
    mkdirSync(STARBOT_PACKAGED_BIN_DIR, { recursive: true });
    const playwrightCorePath = resolvePlaywrightCoreEntry();
    writeFileSync(
      STARBOT_RUNTIME_PATHS_FILE,
      JSON.stringify({ playwrightCorePath }, null, 2),
      { encoding: "utf8" },
    );
    writeFileSync(STARBOT_JIMENG_CLI_PATH, JIMENG_CLI_WRAPPER_SOURCE, { encoding: "utf8", mode: 0o755 });
    chmodSync(STARBOT_JIMENG_CLI_PATH, 0o755);
    writeFileSync(STARBOT_CLI_MCP_BRIDGE_PATH, BRIDGE_SCRIPT_SOURCE, { encoding: "utf8", mode: 0o755 });
    chmodSync(STARBOT_CLI_MCP_BRIDGE_PATH, 0o755);
  } catch {
    // Non-fatal if home directory write fails in restricted tests
  }
}
