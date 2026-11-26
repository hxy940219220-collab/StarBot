import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { type ClientSideConnection, type InitializeResponse, RequestError } from "@agentclientprotocol/sdk";
import {
  type AgentAuthState,
  type AgentModelOption,
  type AgentProviderId,
  composedCustomModelId,
  customProviderOfModel,
  DEFAULT_PROMPT_CACHE_TTL,
  type KeyOnlyProviderId,
  type PromptCacheTtl,
  type ProviderEnvironmentProvider,
  type ProviderModelSource,
} from "@openbot/contracts/ipc";
import { isDynamicRecord } from "@openbot/contracts/runtime-values";
import { sourceText } from "@openbot/i18n/source";
import { Effect } from "effect";
import { AcpAgentClient, type AcpHistoryPersistence } from "./acp-client";
import type { AcpModel } from "./acp-configuration";
import {
  CLINE_ACP_FLAVOR,
  COPILOT_ACP_FLAVOR,
  CURSOR_ACP_FLAVOR,
  customAgentFlavor,
  DEVIN_ACP_FLAVOR,
  HERMES_ACP_FLAVOR,
  KIMI_ACP_FLAVOR,
  MISTRAL_ACP_FLAVOR,
  OPENCLAW_ACP_FLAVOR,
  WORKBUDDY_ACP_FLAVOR,
} from "./acp-flavor";
import {
  ANTIGRAVITY_ACP_FLAVOR,
  antigravityGeminiHome,
  GEMINI_DIR_FLAG,
  geminiSavedKeyLimitFailure,
} from "./acp-flavor-antigravity";
import { OPENCODE_ACP_FLAVOR } from "./acp-flavor-opencode";
import { acpSessionSteers, steerAcpSession } from "./acp-session-steering";
import type { AcpArgv, AcpExtensionMethod } from "./acp-sign-in";
import { CODEX_VARIABLE_PROVIDER, readCodexModelSource } from "./agent/codex-model-source";
import type { ImageFitter } from "./agent/image-reader";
import { readMuseAccount } from "./agent/muse-login";
import { claudeModelName, modelsAfterOpenCodeDiscoveryFailure, serviceTierFields } from "./agent/provider-models";
import type { TurnContext } from "./agent/turn-context";
import type { AgentClient } from "./agent-client";
import { ANTIGRAVITY_TOKEN_FILE, importAntigravityToken } from "./antigravity-token-import";
import { readAntigravityEmail, readAntigravityQuota, readAntigravityValidationLink } from "./antigravity-usage";
import { CodexAppServerClient } from "./app-server-client";
import { ClaudeAgentClient } from "./claude-client";
import {
  type AgentCliInfo,
  ANTIGRAVITY_UPDATE_ENV,
  antigravityTakesStateFolders,
  COPILOT_ENV,
  cliPathEnvironment,
  kimiLoginArgs,
  resolveAntigravityCli,
  resolveClaudeCli,
  resolveClineCli,
  resolveCodexCli,
  resolveCopilotCli,
  resolveCursorCli,
  resolveDevinCli,
  resolveGrokCli,
  resolveHermesCli,
  resolveKimiCli,
  resolveMistralCli,
  resolveMuseCli,
  resolveOpenClawCli,
  resolveOpencodeCli,
  resolvePiCli,
  resolveWorkBuddyCli,
  WORKBUDDY_MAC_CLI_SCRIPT,
} from "./cli";
import { clineFreeModels } from "./cline-free-models";
import { checkCursorApiKey, readCursorUsage } from "./cursor-usage";
import { CustomAcpAgentsClient, type CustomAgentConfig, type CustomAgentSource } from "./custom-acp-agents-client";
import { isMissingFileError } from "./file-errors";
import { GrokAgentClient } from "./grok-client";
import { hermesSettingsEnvironment } from "./hermes-settings";
import { isPythonKimiCli, kimiPythonLoginEnv, kimiPythonSavedRegionEnv, type SignInRegion } from "./kimi-region";
import { domesticDirectEnv, overseasProviderProxyEnv } from "./local-proxy-detector";
import { kimiSavedSignInCheck, kimiSavedSignInVersion } from "./kimi-sign-in-check";
import { readKimiUsage } from "./kimi-usage";
import type { McpOAuthAuthority } from "./mcp-oauth-provider";
import type { McpOAuthProxySettingsStore } from "./mcp-oauth-proxy";
import type { McpDropReporter, McpEndpointSource, McpServerSource, McpToolRuntimeSource } from "./mcp-provider-shapes";
import { MuseAgentClient } from "./muse-client";
import { openCodeAgentDefaultsEnv } from "./opencode-agent-defaults";
import {
  CUSTOM_ENDPOINT_SILENCE_MS,
  type CustomProviderSource,
  customProvidersOn,
  OPENCODE_AGENT_CONFIG,
  OPENCODE_PROFILE_CONFIG,
  openCodeConfigEnv,
  openCodeModelName,
  openCodeSignInMessage,
} from "./opencode-config";
import { hasOpenCodeProviderKey, readOpenCodeGoUsage, readOpenCodeRefusalStatus } from "./opencode-usage";
import { PiAgentClient } from "./pi-client";
import {
  antigravityStatePaths,
  COPILOT_CONFINED_ENV,
  clineStatePaths,
  codexHomeDirectory,
  confineSpawnTarget,
  copilotHomeDirectory,
  copilotStatePaths,
  cursorConfinedEnv,
  cursorStatePaths,
  customAgentStatePaths,
  devinDataDirectory,
  devinStatePaths,
  grokHomeDirectory,
  hermesHome,
  hermesStatePaths,
  kimiCodeStatePaths,
  kimiStatePaths,
  mistralHomeDirectory,
  mistralStatePaths,
  museStatePaths,
  OPENCODE_CONFINED_ENV,
  openCodeStatePaths,
  type ProcessConfinement,
  type ProviderStatePaths,
  piAgentDirectory,
  piStatePaths,
  type SpawnTarget,
} from "./process-confinement";
import { type AccountReadResult, isCodexLoginType, type ModelListResponse } from "./protocol";
import { type ProviderClientOperationError, providerCall, providerFailure } from "./provider-client-effects";

interface ProviderCliCommand {
  readonly argv: readonly string[];
  readonly env: (cli: AgentCliInfo) => Record<string, string>;
  readonly timeoutMs: number;
  readonly closeInput?: true;
  readonly acpLogout?: true | AcpExtensionMethod;
  readonly windowsPageByOpenBot?: true;
  readonly failureText?: (output: string) => string | null;
}

interface ProviderSignInCommand extends Omit<ProviderCliCommand, "argv" | "env"> {
  readonly argv:
    | readonly string[]
    | ((cli: AgentCliInfo, region: SignInRegion) => Effect.Effect<readonly string[], ProviderClientOperationError>);
  readonly env: (cli: AgentCliInfo, region: SignInRegion) => Record<string, string>;
  readonly savedSignIn?: (cli: AgentCliInfo, env: NodeJS.ProcessEnv) => Effect.Effect<string | null>;
  readonly pipedInput?: true;
}

const CLI_LOGIN_TIMEOUT_MS = 10 * 60_000;

const CURSOR_KEY_ACCOUNTS_MIN_VERSION = "2026.10.01";

export interface ProviderHomeAccountSupport {
  readonly homeVariable: string;
  readonly signIn: ProviderCliCommand | AcpAuthenticateSignIn;
  readonly codeSignIn?: { readonly flow: "device" | "paste" | "link"; readonly command: ProviderCliCommand };
  readonly signOut?: ProviderCliCommand;
  supports?(cli: AgentCliInfo): boolean;
  readonly usageLeavesSession?: boolean;
}

export interface ProviderKeyAccountSupport {
  readonly keyEnvironment: (key: string) => Readonly<Record<string, string>>;
  readonly checkKey?: (key: string) => Effect.Effect<boolean, { readonly cause: unknown }>;
  supports?(cli: AgentCliInfo): boolean;
}

export type ProviderAccountSupport = ProviderHomeAccountSupport | ProviderKeyAccountSupport;

export function isKeyAccountSupport(support: ProviderAccountSupport | undefined): support is ProviderKeyAccountSupport {
  return support !== undefined && "keyEnvironment" in support;
}

interface ProviderAccountKeys {
  get(provider: AgentProviderId, accountId: string): string | null;
  set(
    provider: AgentProviderId,
    accountId: string,
    key: string | null,
  ): Effect.Effect<void, { readonly cause: unknown }>;
}

const CLAUDE_COMMAND_ENV = (cli: AgentCliInfo): Record<string, string> => ({
  ...overseasProviderProxyEnv(),
  ...(cli.source === "managed" ? { DISABLE_AUTOUPDATER: "1" } : {}),
});

const CLAUDE_CODE_SIGN_IN: ProviderCliCommand = {
  argv: ["auth", "login", "--claudeai"],
  env: CLAUDE_COMMAND_ENV,
  timeoutMs: CLI_LOGIN_TIMEOUT_MS,
};
const GROK_CODE_SIGN_IN: ProviderCliCommand = {
  argv: ["--no-auto-update", "login", "--device-auth"],
  env: () => ({ ...overseasProviderProxyEnv(), GROK_OAUTH2_REFERRER: "openbot" }),
  timeoutMs: CLI_LOGIN_TIMEOUT_MS,
};
function claudeSignInFailure(output: string): string | null {
  return /couldn.t save your login/iu.test(output) ? sourceText("error.provider.claudeLoginNotSaved") : null;
}
const CLAUDE_SIGN_IN: ProviderCliCommand = {
  argv: ["auth", "login", "--claudeai"],
  env: CLAUDE_COMMAND_ENV,
  timeoutMs: CLI_LOGIN_TIMEOUT_MS,
  windowsPageByOpenBot: true,
  failureText: claudeSignInFailure,
};

function opencodeEnv(cli: AgentCliInfo): Record<string, string> {
  return cli.source === "managed" ? { OPENCODE_DISABLE_AUTOUPDATE: "1" } : {};
}

type ProviderSignIn =
  | { kind: "browser" }
  | { kind: "cli-command"; command: ProviderSignInCommand }
  | { kind: "external" }
  | { kind: "terminal"; argv?: readonly string[]; timeoutMs: number }
  | { kind: "muse-device"; timeoutMs: number }
  | AcpAuthenticateSignIn;

interface AcpAuthenticateSignIn {
  readonly kind: "acp-authenticate";
  readonly methodId: string;
  readonly argv: AcpArgv;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

type ProviderCodeSignIn =
  | { kind: "codex-device" }
  | { kind: "muse-device"; timeoutMs: number }
  | { kind: "cli"; flow: "device" | "paste" | "link"; command: ProviderSignInCommand }
  | (Omit<AcpAuthenticateSignIn, "kind"> & { readonly kind: "acp-delegated" });

function antigravityTokenFile(context: ProviderClientContext): string {
  return join(antigravityAppDataDir({ ...process.env, ...context.accountEnvironment }), ANTIGRAVITY_TOKEN_FILE);
}

function antigravityUsesSavedKey(context: ProviderClientContext): boolean {
  return Boolean(context.apiKey("antigravity")) && !context.accountEnvironment;
}

function antigravityKeyOptions(context: ProviderClientContext, agentEnvironment: boolean) {
  const account = context.accountEnvironment;
  const variables = () => context.providerEnvironment?.("antigravity") ?? {};
  const key = () =>
    account || "AGY_LLM_GATEWAY_URL" in variables() || "GEMINI_API_KEY" in variables()
      ? null
      : context.apiKey("antigravity");
  return {
    extraEnv: () => {
      importAntigravityToken(antigravityAppDataDir({ ...process.env, ...account }));
      const saved = key();
      return {
        ...overseasProviderProxyEnv(),
        ...(agentEnvironment ? context.agentEnvironment?.() : {}),
        ...account,
        ...(saved ? { GEMINI_API_KEY: saved } : {}),
        ...variables(),
      };
    },
    redactValues: () => {
      const saved = key();
      return saved ? [saved] : [];
    },
    authenticate: (connection: ClientSideConnection, initialization: InitializeResponse) =>
      key() && initialization.authMethods?.some((method) => method.id === GEMINI_API_KEY_METHOD)
        ? providerCall(() => connection.authenticate({ methodId: GEMINI_API_KEY_METHOD })).pipe(Effect.asVoid)
        : Effect.void,
    savedKeyRefusedMessage: () => (key() ? sourceText("error.provider.geminiKeyRefused") : null),
    savedKeyLimitMessage: (detail: string, error?: unknown) =>
      key() ? geminiSavedKeyLimitFailure(detail, error) : null,
    authBlockedMessage: () =>
      antigravitySettingsUnreadable(antigravityAppDataDir({ ...process.env, ...account }))
        ? sourceText(
            account ? "error.provider.geminiAccountSettingsUnreadable" : "error.provider.geminiSettingsUnreadable",
          )
        : null,
  };
}

function antigravitySettingsUnreadable(appDataDir: string): boolean {
  try {
    readFileSync(join(appDataDir, "settings.json"));
    return false;
  } catch (error) {
    return !isMissingFileError(error);
  }
}

const ANTIGRAVITY_ENV = { WSL_DISTRO_NAME: "OpenBot", ...ANTIGRAVITY_UPDATE_ENV };

const ANTIGRAVITY_APP_DATA = "antigravity-acp";

function antigravityAppDataDir(env: Readonly<Record<string, string | undefined>>): string {
  return join(antigravityGeminiHome(env), ANTIGRAVITY_APP_DATA);
}

const antigravityArgv = (env: Readonly<Record<string, string | undefined>>): readonly string[] => [
  "acp",
  `${GEMINI_DIR_FLAG}${antigravityGeminiHome(env)}`,
  `--app-data-dir=${ANTIGRAVITY_APP_DATA}`,
];

function antigravityAccountStatePaths(context: ProviderClientContext) {
  const state = antigravityStatePaths({ ...process.env, ...context.accountEnvironment });
  if (context.accountEnvironment)
    for (const folder of state.writable) mkdirSync(folder, { recursive: true, mode: 0o700 });
  return state;
}

const GEMINI_API_KEY_METHOD = "gemini-api-key";

export function antigravityTemp(context: Pick<ProviderClientContext, "providerTempDirectory" | "availableDiskBytes">) {
  return context.providerTempDirectory
    ? {
        root: join(context.providerTempDirectory, "antigravity"),
        availableDiskBytes: context.availableDiskBytes,
      }
    : undefined;
}

const ANTIGRAVITY_SIGN_IN: AcpAuthenticateSignIn = {
  kind: "acp-authenticate",
  methodId: "oauth-personal",
  argv: antigravityArgv,
  env: ANTIGRAVITY_ENV,
  timeoutMs: CLI_LOGIN_TIMEOUT_MS,
};

const ANTIGRAVITY_CODE_SIGN_IN: ProviderSignInCommand = {
  argv: () => Effect.succeed([...antigravityArgv({ ...process.env, ...ANTIGRAVITY_ENV }), "--login"]),
  env: () => ({ ...ANTIGRAVITY_ENV }),
  timeoutMs: CLI_LOGIN_TIMEOUT_MS,
  pipedInput: true,
};

const CLINE_ARGV: readonly string[] = ["--acp"];

const CLINE_ENV: Readonly<Record<string, string>> = {
  CLINE_SESSION_BACKEND_MODE: "local",
  CLINE_NO_AUTO_UPDATE: "1",
};

function confineClineTarget(target: SpawnTarget, confinement: ProcessConfinement): SpawnTarget {
  const state = clineStatePaths();
  for (const folder of state.writable) mkdirSync(folder, { recursive: true, mode: 0o700 });
  return confineSpawnTarget(target, confinement, state);
}

const HERMES_ARGV: readonly string[] = ["acp"];

const HERMES_NOUS_SIGN_IN: readonly string[] = ["auth", "add", "nous", "--type", "oauth"];

const HERMES_SETUP_METHOD = "hermes-setup";
function hasHermesLlmConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  const envKeys = [
    "NOUS_API_KEY",
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "XAI_API_KEY",
    "DEEPSEEK_API_KEY",
    "MOONSHOT_API_KEY",
    "DASHSCOPE_API_KEY",
    "ZHIPU_API_KEY",
    "MINIMAX_API_KEY",
  ];
  if (envKeys.some((key) => Boolean(env[key]?.trim()))) return true;
  const home = hermesHome(env);
  try {
    const authPath = join(home, "auth.json");
    if (existsSync(authPath)) {
      const raw = readFileSync(authPath, "utf8").trim();
      if (raw.length > 2 && raw !== "{}" && /"[^"]+"\s*:\s*"[^"]+"/u.test(raw)) return true;
    }
  } catch {}
  try {
    const dotEnvPath = join(home, ".env");
    if (existsSync(dotEnvPath)) {
      const raw = readFileSync(dotEnvPath, "utf8");
      if (/^[A-Z0-9_]+(?:KEY|TOKEN)\s*=\s*\S+/mu.test(raw)) return true;
    }
  } catch {}
  try {
    const configPath = join(home, "config.yaml");
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf8");
      if (/(?:^|\n)\s*api_key\s*:\s*['"]?[A-Za-z0-9_.-]{8,}/u.test(raw)) return true;
    }
  } catch {}
  return false;
}

function requireHermesProvider(_connection: ClientSideConnection, initialization: InitializeResponse) {
  const methods = initialization.authMethods ?? [];
  if (methods.length > 0 && methods.every((method) => method.id === HERMES_SETUP_METHOD)) {
    return Effect.fail(providerFailure(RequestError.authRequired()));
  }
  if (!hasHermesLlmConfig()) {
    return Effect.fail(providerFailure(RequestError.authRequired()));
  }
  return Effect.void;
}

function confineHermesTarget(
  target: SpawnTarget,
  confinement: ProcessConfinement,
  env: NodeJS.ProcessEnv,
): SpawnTarget {
  mkdirSync(hermesHome(env), { recursive: true, mode: 0o700 });
  return confineSpawnTarget(target, confinement, hermesStatePaths(env));
}

const OPENCLAW_ARGV: readonly string[] = ["acp"];
const OPENCLAW_SIGN_IN: readonly string[] = ["models", "auth", "add"];

function readOpenClawModels(): AcpModel[] {
  let primary = "";
  try {
    const raw = JSON.parse(readFileSync(join(homedir(), ".openclaw", "openclaw.json"), "utf8")) as {
      agents?: { defaults?: { model?: { primary?: unknown } } };
    };
    if (typeof raw.agents?.defaults?.model?.primary === "string") {
      primary = raw.agents.defaults.model.primary.trim();
    }
  } catch {}
  const shortName = primary ? primary.split("/").pop() || primary : "";
  return [
    {
      id: "default",
      name: shortName ? `OpenClaw · ${shortName}` : "OpenClaw Gateway",
      description: primary ? `OpenClaw (${primary})` : "OpenClaw 本地 Gateway",
      defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [],
      reasoningEffortConfigurable: false,
      reasoningEffortWireValues: new Map(),
      usesModelReasoningEffort: null,
    },
  ];
}

const WORKBUDDY_FALLBACK_MODELS: ReadonlyArray<{ id: string; name: string; description: string }> = [
  { id: "hy4flash-free", name: "Hy4 flash", description: "腾讯混元 Hy4 Flash · 限时免费极速模型" },
  { id: "hy4std", name: "Hy4", description: "腾讯混元 Hy4 旗舰推理模型" },
  { id: "deepseek-v4.1-flash", name: "DeepSeek-V4.1-Flash", description: "DeepSeek V4.1 Flash 高速编码与分析模型" },
  { id: "glm-5.4", name: "GLM-5.4", description: "智谱最新旗舰 GLM-5.4 模型" },
  { id: "glm-5.3", name: "GLM-5.3", description: "智谱 GLM-5.3 强力全能模型" },
  { id: "glm-5.3-flash", name: "GLM-5.3-Flash", description: "智谱 GLM-5.3-Flash 轻量高速模型" },
  { id: "glm-5.2", name: "GLM-5.2", description: "智谱 GLM-5.2 推理与工程模型" },
  { id: "space-bunny", name: "Space-Bunny", description: "WorkBuddy Space-Bunny 敏捷助手模型" },
  { id: "minimax-m3.1-flash", name: "MiniMax-M3.1-Flash", description: "MiniMax M3.1 Flash 最新高速模型" },
  { id: "kimi-k3.1-pro", name: "Kimi-K3.1-Pro", description: "月之暗面 Kimi K3.1 Pro 旗舰长文本模型" },
  { id: "kimi-k3-1", name: "Kimi-K3", description: "月之暗面 Kimi K3 模型" },
  { id: "deepseek-v4-pro", name: "DeepSeek-V4-Pro", description: "DeepSeek V4 Pro 深度思考旗舰模型" },
  { id: "step-5-preview", name: "Step-5-Preview", description: "阶跃星辰 Step-5 Preview 模型" },
  { id: "mimo-v2.6-pro", name: "Xiaomi MiMo-V2.6-Pro", description: "小米 MiMo V2.6 Pro 推理模型" },
  { id: "auto", name: "Auto", description: "WorkBuddy 智能自动路由模型" },
];

const WORKBUDDY_MODEL_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  hy4std: "Hy4",
  "hy4flash-free": "Hy4 flash (限时免费)",
  hy4flash: "Hy4 flash",
  "deepseek-v4.1-flash": "DeepSeek-V4.1-Flash",
  "deepseek-v4-pro": "DeepSeek-V4-Pro",
  "glm-5.4": "GLM-5.4",
  "glm-5.3": "GLM-5.3",
  "glm-5.3-flash": "GLM-5.3-Flash",
  "glm-5.2": "GLM-5.2",
  "space-bunny": "Space-Bunny",
  "minimax-m3.1-flash": "MiniMax-M3.1-Flash",
  "kimi-k3.1-pro": "Kimi-K3.1-Pro",
  "kimi-k3-1": "Kimi-K3",
  "kimi-k2.8-preview": "Kimi-K2.8-Preview",
  "step-5-preview": "Step-5-Preview",
  "mimo-v2.6-pro": "Xiaomi MiMo-V2.6-Pro",
  auto: "Auto",
};

function makeWorkBuddyAcpModel(id: string, name: string, description: string): AcpModel {
  return {
    id,
    name,
    description,
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [],
    reasoningEffortConfigurable: false,
    reasoningEffortWireValues: new Map(),
    usesModelReasoningEffort: null,
  };
}

const WORKBUDDY_MAC_PRODUCT_JSON =
  "/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/product.json";
const STARBUDDY_CLI_AUTH_ID = "starbot-workbuddy-cli";

function starbotWorkBuddyCliDir(): string {
  return join(homedir(), ".starbot-connectors", "workbuddy-cli");
}

function starbotWorkBuddyAuthFile(): string {
  const home = homedir();
  const base =
    process.platform === "darwin"
      ? join(home, "Library", "Application Support", "CodeBuddyExtension")
      : process.platform === "win32"
        ? join(home, "AppData", "Local", "CodeBuddyExtension")
        : join(home, ".local", "share", "CodeBuddyExtension");
  return join(base, "Data", "Public", "auth", `${STARBUDDY_CLI_AUTH_ID}.info`);
}

function ensureStarBotWorkBuddyProductJson(): string | null {
  if (process.platform !== "darwin" || !existsSync(WORKBUDDY_MAC_PRODUCT_JSON)) return null;
  try {
    const cliDir = starbotWorkBuddyCliDir();
    mkdirSync(cliDir, { recursive: true, mode: 0o700 });
    const targetPath = join(cliDir, "product.json");
    const raw = JSON.parse(readFileSync(WORKBUDDY_MAC_PRODUCT_JSON, "utf8")) as Record<string, unknown>;
    const origAuth = isDynamicRecord(raw.authentication) ? raw.authentication : {};
    const origAttrs = isDynamicRecord(origAuth.attributes) ? origAuth.attributes : {};
    const patched = {
      ...raw,
      authentication: {
        ...origAuth,
        id: STARBUDDY_CLI_AUTH_ID,
        attributes: {
          ...origAttrs,
          platform: "cli",
        },
      },
      deepLinkSchemes: [],
      dataFolderName: ".starbot-workbuddy",
    };
    const nextContent = JSON.stringify(patched, null, 2);
    const currentContent = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : "";
    if (currentContent !== nextContent) {
      writeFileSync(targetPath, nextContent, { mode: 0o600 });
    }
    return targetPath;
  } catch {
    return null;
  }
}

function readWorkBuddyLatestModels(): AcpModel[] {
  const storageDirs = [
    join(starbotWorkBuddyCliDir(), "local_storage"),
    join(homedir(), ".workbuddy", "local_storage"),
  ];
  try {
    for (const storageDir of storageDirs) {
      if (!existsSync(storageDir)) continue;
      for (const file of readdirSync(storageDir)) {
        if (!file.endsWith(".info")) continue;
        const rawText = readFileSync(join(storageDir, file), "utf8");
        if (!rawText.includes('"models"') || !rawText.includes('"agents"')) continue;
        const parsed = JSON.parse(rawText) as unknown;
        const first = Array.isArray(parsed) ? parsed[0] : null;
        const data = isDynamicRecord(first) && isDynamicRecord(first.data) ? first.data : null;
        if (!data || !Array.isArray(data.agents) || !Array.isArray(data.models)) continue;
        const cliAgent = data.agents.find((a) => isDynamicRecord(a) && a.name === "cli");
        const cliModelIds = isDynamicRecord(cliAgent) && Array.isArray(cliAgent.models) ? cliAgent.models : [];
        if (cliModelIds.length === 0) continue;

        const metaById = new Map<string, string>();
        for (const item of data.models) {
          if (isDynamicRecord(item) && typeof item.id === "string" && typeof item.name === "string") {
            metaById.set(item.id, item.name);
          }
        }

        // Put user's primary modern models in WorkBuddy's exact UI order (Hy4, Hy4 flash, DeepSeek-V4.1-Flash, GLM-5.4...)
        const orderedIds = [
          ...cliModelIds.filter((m): m is string => typeof m === "string" && m !== "auto" && m !== "hy4flash"),
          ...(cliModelIds.includes("auto") ? ["auto"] : []),
        ];
        const seen = new Set<string>();
        const dynamicModels: AcpModel[] = [];
        for (const modelId of orderedIds) {
          if (!modelId || seen.has(modelId)) continue;
          seen.add(modelId);
          const displayName = WORKBUDDY_MODEL_NAME_OVERRIDES[modelId] ?? metaById.get(modelId) ?? modelId;
          dynamicModels.push(makeWorkBuddyAcpModel(modelId, displayName, `WorkBuddy · ${displayName}`));
        }
        if (dynamicModels.length > 0) return dynamicModels;
      }
    }
  } catch {}
  return WORKBUDDY_FALLBACK_MODELS.map((m) => makeWorkBuddyAcpModel(m.id, m.name, m.description));
}

function workbuddyArgv(): readonly string[] {
  return process.platform === "darwin" && existsSync(WORKBUDDY_MAC_CLI_SCRIPT)
    ? [WORKBUDDY_MAC_CLI_SCRIPT, "--serve", "--acp"]
    : ["--serve", "--acp"];
}

function workbuddyEnv(): Record<string, string> {
  const cliDir = starbotWorkBuddyCliDir();
  try {
    mkdirSync(cliDir, { recursive: true, mode: 0o700 });
  } catch {}
  const productConfigPath = ensureStarBotWorkBuddyProductJson();
  return {
    CODEBUDDY_CONFIG_DIR: cliDir,
    ...(productConfigPath ? { ACC_PRODUCT_CONFIG_PATH: productConfigPath } : {}),
    // WorkBuddy CLI's bundled Axios crashes in setProxy ("Right-hand side of 'instanceof' is not callable")
    // under modern Node when HTTP_PROXY / HTTPS_PROXY environment variables are present; its domestic Tencent
    // endpoints connect directly without proxy.
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

function extractWorkBuddyUserInfo(raw: unknown): { userId?: string; userName?: string; token?: string } | null {
  if (!isDynamicRecord(raw)) return null;
  const info = isDynamicRecord(raw.userInfo) ? raw.userInfo : null;
  if (!info) return null;
  const authType = typeof info.authType === "string" ? info.authType.trim().toLowerCase() : "";
  const userId = typeof info.userId === "string" && info.userId.trim() ? info.userId.trim() : undefined;
  const userName =
    typeof info.userNickname === "string" && info.userNickname.trim()
      ? info.userNickname.trim()
      : typeof info.userName === "string" && info.userName.trim()
        ? info.userName.trim()
        : undefined;
  const token =
    typeof info.token === "string" && info.token.trim()
      ? info.token.trim()
      : typeof info.accessToken === "string" && info.accessToken.trim()
        ? info.accessToken.trim()
        : undefined;
  // WorkBuddy returns authType="local" with a guest UUID and no accessToken when signed out.
  if (!token || authType === "local") return null;
  return { ...(userId ? { userId } : {}), ...(userName ? { userName } : {}), token };
}

function requireWorkBuddyAuth(connection: ClientSideConnection, _initialization: InitializeResponse) {
  return providerCall(() => connection.extMethod("_codebuddy.ai/getUserInfo", {})).pipe(
    Effect.flatMap((response) =>
      extractWorkBuddyUserInfo(response) ? Effect.void : Effect.fail(providerFailure(RequestError.authRequired())),
    ),
    Effect.catch(() => Effect.fail(providerFailure(RequestError.authRequired()))),
  );
}

function readWorkBuddyAccount(connection: ClientSideConnection) {
  return providerCall(() => connection.extMethod("_codebuddy.ai/getUserInfo", {})).pipe(
    Effect.map((response) => {
      const info = extractWorkBuddyUserInfo(response);
      return { email: info?.userName ?? info?.userId ?? null, planType: null };
    }),
    Effect.catch(() => Effect.succeed({ email: null, planType: null })),
  );
}

const KIMI_ENV: Readonly<Record<string, string>> = { KIMI_CLI_NO_AUTO_UPDATE: "1" };

const KIMI_CODE_LOGIN_ENV: Readonly<Record<string, string>> =
  process.platform === "win32" ? KIMI_ENV : { ...KIMI_ENV, BROWSER: "true" };

function kimiLoginEnv(
  base: Readonly<Record<string, string>>,
  cli: AgentCliInfo,
  region: SignInRegion,
): Record<string, string> {
  const regionEnv = isPythonKimiCli(cli) ? kimiPythonLoginEnv(region) : {};
  const proxyEnv = region === "global" ? overseasProviderProxyEnv() : domesticDirectEnv();
  return { ...proxyEnv, ...base, ...regionEnv };
}

const kimiSavedSignIn = (cli: AgentCliInfo, env: NodeJS.ProcessEnv) =>
  kimiSavedSignInVersion(isPythonKimiCli(cli), env);

function kimiProcessEnv(
  cli: AgentCliInfo,
  agentEnvironment: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  const region = isPythonKimiCli(cli) ? kimiPythonSavedRegionEnv({ ...process.env, ...agentEnvironment }) : {};
  const isGlobal = "KIMI_CODE_BASE_URL" in region;
  return {
    ...agentEnvironment,
    ...(isGlobal ? overseasProviderProxyEnv() : domesticDirectEnv()),
    ...region,
  };
}

function confineWithState(
  target: SpawnTarget,
  confinement: ProcessConfinement,
  statePaths: (env: NodeJS.ProcessEnv) => ProviderStatePaths,
  agentEnvironment: Readonly<Record<string, string>> | undefined,
): SpawnTarget {
  const state = statePaths({ ...process.env, ...agentEnvironment });
  for (const folder of state.writable) mkdirSync(folder, { recursive: true, mode: 0o700 });
  return confineSpawnTarget(target, confinement, state);
}

const DEVIN_ARGV: readonly string[] = ["acp"];

const COPILOT_ARGV: readonly string[] = ["--acp", "--no-auto-update"];

const MISTRAL_ENV: Readonly<Record<string, string>> = {
  VIBE_ENABLE_TELEMETRY: "false",
  VIBE_EXPERIMENTAL_ENABLE_MODEL_CATALOG: "true",
};

const MISTRAL_ARGV: readonly string[] = [];

export interface ProviderClientContext {
  apiKey(provider: AgentProviderId): string | null;
  readonly accountKeys?: ProviderAccountKeys;
  readonly history?: (provider: AgentProviderId) => AcpHistoryPersistence | undefined;
  readonly customProviders: CustomProviderSource;
  readonly mcpServers: McpServerSource;
  readonly reportMcpDrops?: McpDropReporter;
  readonly mcpToolRuntimes?: McpToolRuntimeSource;
  readonly mcpEndpoint?: McpEndpointSource;
  readonly mcpOAuth?: McpOAuthAuthority;
  readonly mcpOAuthProxySettings?: McpOAuthProxySettingsStore;
  readonly appVersion?: string;
  servesModel?(modelId: string): boolean;
  readonly providerStateDirectory?: string;
  readonly providerTempDirectory?: string;
  readonly availableDiskBytes?: (path: string) => number;
  readonly agentEnvironment?: (inherited?: NodeJS.ProcessEnv) => Readonly<Record<string, string>>;
  readonly serverEnvironment?: Readonly<Record<string, string>>;
  readonly accountEnvironment?: Readonly<Record<string, string>>;
  readonly customAgents?: CustomAgentSource;
  readonly promptCacheTtl?: () => PromptCacheTtl;
  readonly claudeUserSetup?: () => boolean;
  readonly claudeCompactWindow?: () => number | null;
  readonly codexTurnContext?: TurnContext;
  readonly providerEnvironment?: (provider: ProviderEnvironmentProvider) => Readonly<Record<string, string>>;
  readonly systemProxyFetch?: (url: string, init: RequestInit) => Promise<Response>;
  readonly fitImage?: ImageFitter | null;
}

const CODEX_ADDRESS_VARIABLE = "OPENAI_BASE_URL";

function codexVariableOverrides(variables: Readonly<Record<string, string>>): string[] {
  const baseUrl = variables[CODEX_ADDRESS_VARIABLE]?.trim().replace(/\/+$/, "");
  if (!baseUrl || !/^https?:\/\/[^/\s]+/.test(baseUrl) || /\s/.test(baseUrl)) return [];
  return [
    `model_provider=${CODEX_VARIABLE_PROVIDER}`,
    `model_providers.${CODEX_VARIABLE_PROVIDER}.name=OpenBot`,
    `model_providers.${CODEX_VARIABLE_PROVIDER}.base_url=${baseUrl}`,
    `model_providers.${CODEX_VARIABLE_PROVIDER}.wire_api=responses`,
    ...("OPENAI_API_KEY" in variables ? [`model_providers.${CODEX_VARIABLE_PROVIDER}.env_key=OPENAI_API_KEY`] : []),
  ];
}

function withAccountEnvironment(
  context: ProviderClientContext,
): ((inherited?: NodeJS.ProcessEnv) => Readonly<Record<string, string>>) | undefined {
  const { agentEnvironment, accountEnvironment } = context;
  return (inherited) => ({
    ...overseasProviderProxyEnv(),
    ...agentEnvironment?.(inherited),
    ...accountEnvironment,
  });
}

function claudeAgentEnvironment(
  context: ProviderClientContext,
): (inherited?: NodeJS.ProcessEnv) => Readonly<Record<string, string>> {
  const environment = withAccountEnvironment(context);
  return (inherited) => {
    const compactWindow = context.claudeCompactWindow?.() ?? null;
    return {
      ...((context.promptCacheTtl?.() ?? DEFAULT_PROMPT_CACHE_TTL.ttl) === "1h"
        ? { ENABLE_PROMPT_CACHING_1H: "1" }
        : {}),
      ...(compactWindow === null ? {} : { CLAUDE_CODE_AUTO_COMPACT_WINDOW: String(compactWindow) }),
      ...environment?.(inherited),
      ...context.providerEnvironment?.("claude"),
    };
  };
}

function claudeFallbackApiKey(context: ProviderClientContext): (() => string | null) | undefined {
  if (context.accountEnvironment) return undefined;
  return () => {
    const variables = context.providerEnvironment?.("claude") ?? {};
    return "ANTHROPIC_API_KEY" in variables || "ANTHROPIC_AUTH_TOKEN" in variables ? null : context.apiKey("claude");
  };
}

export const NO_PROVIDER_CREDENTIALS: ProviderClientContext = {
  apiKey: () => null,
  customProviders: () => [],
  mcpServers: () => [],
};

interface ProviderModelCatalog {
  readonly paged?: true;
  readonly slowList?: true;
  readonly hiddenWhenSignedOut?: true;
  readonly ownOrder?: true;
  readonly partialListAtStart?: true;
  readonly relistAfterStart?: true;
  readonly relistWhileRunning?: true;
  modelName?(id: string): string | null;
  modelFields?(
    model: ModelListResponse["data"][number],
  ): Pick<AgentModelOption, "fastServiceTier" | "ultrafastServiceTier" | "steersTurns">;
  fallback?(previous: AgentModelOption[]): AgentModelOption[];
  source?(
    client: AgentClient,
    timeoutMs: number,
  ): Effect.Effect<{ source: ProviderModelSource | null; startSettings: string | null }, unknown>;
}

function steeringFields(model: ModelListResponse["data"][number]): Pick<AgentModelOption, "steersTurns"> {
  return model.steersTurns ? { steersTurns: true } : {};
}

export interface BuiltInProviderDriver {
  id: AgentProviderId;
  signIn: ProviderSignIn;
  signInFiles?(): readonly string[];
  codeSignIn?: ProviderCodeSignIn;
  accounts?: ProviderAccountSupport;
  signOut?: ProviderCliCommand;
  cliProvider?: AgentProviderId;
  catalog?: ProviderModelCatalog;
  resolveCli(options?: {
    bundledExecutable?: string | null | undefined;
  }): Effect.Effect<AgentCliInfo, ProviderClientOperationError>;
  createClient(
    cli: AgentCliInfo,
    requestTimeoutMs: number,
    context: ProviderClientContext,
    confinement?: ProcessConfinement,
  ): AgentClient;
  createProfileClient?(cli: AgentCliInfo, requestTimeoutMs: number, context: ProviderClientContext): AgentClient;
  createMediaClient?(cli: AgentCliInfo, requestTimeoutMs: number, context: ProviderClientContext): AgentClient;
  authState(account: AccountReadResult["account"]): AgentAuthState;
  validateAccount(account: NonNullable<AccountReadResult["account"]>): void;
}

function piClient(
  provider: "pi" | KeyOnlyProviderId,
  cli: AgentCliInfo,
  timeout: number,
  context: ProviderClientContext,
  confinement: ProcessConfinement | undefined,
): AgentClient {
  const history = context.history?.(provider);
  return new PiAgentClient(cli, {
    requestTimeoutMs: timeout,
    ...(confinement
      ? {
          confine: (target) => {
            const paths = piStatePaths();
            for (const path of paths.writable) mkdirSync(path, { recursive: true, mode: 0o700 });
            try {
              writeFileSync(join(piAgentDirectory(), "auth.json"), "{}", { flag: "wx", mode: 0o600 });
            } catch (error) {
              if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
            }
            return confineSpawnTarget(target, confinement, paths);
          },
        }
      : {}),
    extraEnv: () => ({ ...piCacheEnvironment(context), ...context.agentEnvironment?.() }),
    ...piKeyProvider(provider, context),
    ...(context.providerStateDirectory ? { providerStateDirectory: context.providerStateDirectory } : {}),
    mcpServers: context.mcpServers,
    ...(context.reportMcpDrops ? { reportMcpDrops: context.reportMcpDrops } : {}),
    ...(context.mcpToolRuntimes ? { mcpToolRuntimes: context.mcpToolRuntimes } : {}),
    ...(context.mcpEndpoint ? { mcpEndpoint: context.mcpEndpoint } : {}),
    ...(history ? { history } : {}),
  });
}

function piCacheEnvironment(context: ProviderClientContext): Readonly<Record<string, string>> {
  return (context.promptCacheTtl?.() ?? DEFAULT_PROMPT_CACHE_TTL.ttl) === "1h" ? { PI_CACHE_RETENTION: "long" } : {};
}

function piKeyProvider(provider: "pi" | KeyOnlyProviderId, context: ProviderClientContext) {
  return provider === "pi"
    ? { customEndpoints: customProvidersOn(context.customProviders, "pi") }
    : { keyProvider: { id: provider, apiKey: () => context.apiKey(provider) } };
}

function openCodeEndpoints(context: ProviderClientContext): CustomProviderSource {
  return customProvidersOn(context.customProviders, "opencode");
}

function piProfileClient(
  provider: "pi" | KeyOnlyProviderId,
  cli: AgentCliInfo,
  timeout: number,
  context: ProviderClientContext,
): AgentClient {
  return new PiAgentClient(cli, {
    requestTimeoutMs: timeout,
    profileGeneration: true,
    ...piKeyProvider(provider, context),
    ...(context.providerStateDirectory ? { providerStateDirectory: context.providerStateDirectory } : {}),
  });
}

export const BUILT_IN_PROVIDER_DRIVERS: readonly BuiltInProviderDriver[] = [
  {
    id: "pi",
    signIn: { kind: "terminal", timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    signInFiles: () => ["auth.json", "models.json"].map((name) => join(piAgentDirectory(), name)),
    resolveCli: resolvePiCli,
    createClient: (cli, timeout, context, confinement) => piClient("pi", cli, timeout, context, confinement),
    createProfileClient: (cli, timeout, context) => piProfileClient("pi", cli, timeout, context),
    authState: (account) => ({ kind: "pi", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "inception",
    signIn: { kind: "external" },
    cliProvider: "pi",
    resolveCli: resolvePiCli,
    createClient: (cli, timeout, context, confinement) => piClient("inception", cli, timeout, context, confinement),
    createProfileClient: (cli, timeout, context) => piProfileClient("inception", cli, timeout, context),
    authState: (account) => ({ kind: "inception", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "deepseek",
    signIn: { kind: "external" },
    cliProvider: "pi",
    resolveCli: resolvePiCli,
    createClient: (cli, timeout, context, confinement) => piClient("deepseek", cli, timeout, context, confinement),
    createProfileClient: (cli, timeout, context) => piProfileClient("deepseek", cli, timeout, context),
    authState: (account) => ({ kind: "deepseek", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "openrouter",
    signIn: { kind: "external" },
    cliProvider: "pi",
    resolveCli: resolvePiCli,
    createClient: (cli, timeout, context, confinement) => piClient("openrouter", cli, timeout, context, confinement),
    createProfileClient: (cli, timeout, context) => piProfileClient("openrouter", cli, timeout, context),
    authState: (account) => ({ kind: "openrouter", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "muse",
    signIn: { kind: "muse-device", timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    codeSignIn: { kind: "muse-device", timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    signOut: { argv: ["logout"], env: () => ({ MUSE_NO_AUTO_UPDATE: "1" }), timeoutMs: 30_000 },
    resolveCli: resolveMuseCli,
    createClient: (cli, timeout, context, confinement) =>
      new MuseAgentClient(cli, {
        requestTimeoutMs: timeout,
        apiKey: () => context.apiKey("muse"),
        extraEnv: () => ({ ...context.agentEnvironment?.() }),
        readAccount: () =>
          readMuseAccount({ cli, apiKey: context.apiKey("muse"), extraEnv: { ...context.agentEnvironment?.() } }),
        ...(confinement
          ? {
              confine: (target) => {
                const paths = museStatePaths();
                for (const path of paths.writable)
                  mkdirSync(basename(path).startsWith("session-index.db") ? dirname(path) : path, {
                    recursive: true,
                    mode: 0o700,
                  });
                return confineSpawnTarget(target, confinement, paths);
              },
            }
          : {}),
        mcpServers: context.mcpServers,
        ...(context.reportMcpDrops ? { reportMcpDrops: context.reportMcpDrops } : {}),
        ...(context.mcpToolRuntimes ? { mcpToolRuntimes: context.mcpToolRuntimes } : {}),
        ...(context.mcpEndpoint ? { mcpEndpoint: context.mcpEndpoint } : {}),
      }),
    createProfileClient: (cli, timeout, context) =>
      new MuseAgentClient(cli, {
        requestTimeoutMs: timeout,
        apiKey: () => context.apiKey("muse"),
        profileGeneration: true,
      }),
    authState: (account) =>
      account?.type === "muse" ? { kind: "muse", email: account.email ?? null } : { kind: "unknown" },
    validateAccount: () => undefined,
  },
  {
    id: "codex",
    signIn: { kind: "browser" },
    codeSignIn: { kind: "codex-device" },
    accounts: {
      homeVariable: "CODEX_HOME",
      signIn: { argv: ["login"], env: () => ({}), timeoutMs: CLI_LOGIN_TIMEOUT_MS },
      codeSignIn: {
        flow: "device",
        command: { argv: ["login", "--device-auth"], env: () => ({}), timeoutMs: CLI_LOGIN_TIMEOUT_MS },
      },
      signOut: { argv: ["logout"], env: () => ({}), timeoutMs: 30_000 },
    },
    signInFiles: () => [join(codexHomeDirectory(), "auth.json")],
    catalog: { paged: true, modelFields: serviceTierFields, source: readCodexModelSource, relistWhileRunning: true },
    resolveCli: resolveCodexCli,
    createClient: (cli, requestTimeoutMs, context) => {
      const { SSL_CERT_FILE: _openBotRoots, ...serverEnvironment } = context.serverEnvironment ?? {};
      const variables = context.providerEnvironment?.("codex") ?? {};
      const overrides = codexVariableOverrides(variables);
        return new CodexAppServerClient(
          cli.executable,
          requestTimeoutMs,
          {
            ...cliPathEnvironment(cli),
            ...overseasProviderProxyEnv(),
            ...serverEnvironment,
            ...context.accountEnvironment,
            ...variables,
          },
          context.codexTurnContext,
          overrides,
          overrides.length > 0 ? CODEX_ADDRESS_VARIABLE : undefined,
        );
    },
    authState: (account) => ({ kind: "chatgpt", email: account?.email ?? null }),
    validateAccount: (account) => {
      if (!isCodexLoginType(account.type)) {
        throw new Error(sourceText("error.provider.codexLoginRequired"));
      }
    },
  },
  {
    id: "claude",
    signIn: { kind: "cli-command", command: CLAUDE_SIGN_IN },
    codeSignIn: { kind: "cli", flow: "paste", command: CLAUDE_CODE_SIGN_IN },
    accounts: {
      homeVariable: "CLAUDE_CONFIG_DIR",
      signIn: CLAUDE_SIGN_IN,
      codeSignIn: { flow: "paste", command: CLAUDE_CODE_SIGN_IN },
      signOut: { argv: ["auth", "logout"], env: CLAUDE_COMMAND_ENV, timeoutMs: 30_000 },
    },
    signInFiles: () => [join(homedir(), ".claude.json"), join(homedir(), ".claude", ".credentials.json")],
    catalog: { modelName: claudeModelName, modelFields: serviceTierFields },
    resolveCli: resolveClaudeCli,
    createClient: (cli, requestTimeoutMs, context) =>
      new ClaudeAgentClient(
        cli,
        undefined,
        undefined,
        requestTimeoutMs,
        context.mcpServers,
        context.reportMcpDrops,
        context.mcpToolRuntimes,
        context.mcpEndpoint,
        context.providerStateDirectory,
        claudeAgentEnvironment(context),
        undefined,
        claudeFallbackApiKey(context),
        context.claudeUserSetup,
      ),
    authState: (account) => ({ kind: "claude", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "grok",
    signIn: {
      kind: "cli-command",
      command: {
        argv: ["--no-auto-update", "login"],
        env: () => ({ ...overseasProviderProxyEnv(), GROK_OAUTH2_REFERRER: "openbot" }),
        timeoutMs: CLI_LOGIN_TIMEOUT_MS,
      },
    },
    codeSignIn: { kind: "cli", flow: "device", command: GROK_CODE_SIGN_IN },
    accounts: {
      homeVariable: "GROK_HOME",
      signIn: {
        argv: ["--no-auto-update", "login"],
        env: () => ({ ...overseasProviderProxyEnv(), GROK_OAUTH2_REFERRER: "openbot" }),
        timeoutMs: CLI_LOGIN_TIMEOUT_MS,
      },
      codeSignIn: { flow: "device", command: GROK_CODE_SIGN_IN },
    },
    signInFiles: () => [join(grokHomeDirectory(), "auth.json")],
    signOut: { argv: ["--no-auto-update", "logout"], env: () => ({}), timeoutMs: 30_000 },
    resolveCli: resolveGrokCli,
    createClient: (cli, requestTimeoutMs, context, confinement) =>
      new GrokAgentClient(
        cli,
        requestTimeoutMs,
        false,
        context.mcpServers,
        context.reportMcpDrops,
        context.mcpToolRuntimes,
        context.mcpEndpoint,
        confinement,
        withAccountEnvironment(context),
        context.history?.("grok"),
        context.fitImage,
      ),
    createProfileClient: (cli, requestTimeoutMs, { accountEnvironment }) =>
      new GrokAgentClient(
        cli,
        requestTimeoutMs,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        accountEnvironment && (() => accountEnvironment),
      ),
    createMediaClient: (cli, requestTimeoutMs, { accountEnvironment }) =>
      new GrokAgentClient(
        cli,
        requestTimeoutMs,
        "media",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        accountEnvironment && (() => accountEnvironment),
      ),
    authState: (account) => ({ kind: "grok", email: account?.email ?? null }),
    validateAccount: () => undefined,
    catalog: { partialListAtStart: true, relistAfterStart: true },
  },
  {
    id: "opencode",
    signIn: { kind: "external" },
    signInFiles: () => [
      join(homedir(), ".local", "share", "opencode", "auth.json"),
      join(homedir(), ".config", "opencode", "opencode.json"),
    ],
    catalog: {
      hiddenWhenSignedOut: true,
      partialListAtStart: true,
      relistAfterStart: true,
      modelFields: steeringFields,
      fallback: modelsAfterOpenCodeDiscoveryFailure,
    },
    resolveCli: resolveOpencodeCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "opencode",
        flavor: OPENCODE_ACP_FLAVOR,
        argv: ["acp"],
        env: {},
        ...(confinement ? { confine: (target) => confineSpawnTarget(target, confinement, openCodeStatePaths()) } : {}),
        extraEnv: () => {
          const agentEnvironment = context.agentEnvironment?.();
          return {
            ...agentEnvironment,
            ...opencodeEnv(cli),
            ...openCodeAgentDefaultsEnv(
              context.providerStateDirectory,
              { ...process.env, ...agentEnvironment },
              cli.version,
            ),
            ...openCodeConfigEnv(OPENCODE_AGENT_CONFIG, openCodeEndpoints(context), context.apiKey("opencode")),
            ...(confinement ? OPENCODE_CONFINED_ENV : {}),
          };
        },
        signInMessage: openCodeSignInMessage(openCodeEndpoints(context)().length),
        modelName: (id, name) => openCodeModelName(id, name, openCodeEndpoints(context)),
        customEndpoint: (modelId) => {
          const endpoint = customProviderOfModel(modelId, openCodeEndpoints(context)());
          const contextWindow = endpoint?.models.find(
            (model) => composedCustomModelId(endpoint.id, model.id) === modelId,
          )?.contextWindow;
          return endpoint
            ? {
                name: endpoint.name,
                hasCredentials: Boolean(endpoint.apiKey) || endpoint.headers.length > 0,
                stallMs: CUSTOM_ENDPOINT_SILENCE_MS,
                ...(contextWindow === undefined ? {} : { contextWindow }),
              }
            : null;
        },
        savedKey: (modelId) =>
          Boolean(context.apiKey("opencode")) && (modelId?.toLowerCase().startsWith("opencode-go/") ?? false),
        providerKeyStored: (provider) =>
          Effect.runSync(hasOpenCodeProviderKey(provider, { ...process.env, ...context.agentEnvironment?.() })),
        providerRefusalStatus: (sessionId) =>
          Effect.runSync(readOpenCodeRefusalStatus(sessionId, { ...process.env, ...context.agentEnvironment?.() })),
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        readRateLimits: () =>
          readOpenCodeGoUsage(context.apiKey("opencode")).pipe(
            Effect.mapError((failure) => providerFailure(failure.cause)),
          ),
        steer: steerAcpSession,
        steers: acpSessionSteers,
        history: context.history?.("opencode"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "opencode",
        flavor: OPENCODE_ACP_FLAVOR,
        argv: ["acp"],
        profileGeneration: true,
        env: {},
        extraEnv: () => ({
          ...opencodeEnv(cli),
          ...openCodeConfigEnv(OPENCODE_PROFILE_CONFIG, openCodeEndpoints(context), context.apiKey("opencode")),
        }),
        signInMessage: openCodeSignInMessage(openCodeEndpoints(context)().length),
        modelName: (id, name) => openCodeModelName(id, name, openCodeEndpoints(context)),
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "opencode", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "antigravity",
    signIn: ANTIGRAVITY_SIGN_IN,
    codeSignIn: { kind: "cli", flow: "paste", command: ANTIGRAVITY_CODE_SIGN_IN },
    accounts: {
      homeVariable: "GEMINI_HOME",
      signIn: ANTIGRAVITY_SIGN_IN,
      supports: (cli) => antigravityTakesStateFolders(cli.version),
      usageLeavesSession: true,
    },
    signInFiles: () => [
      join(antigravityAppDataDir(process.env), ANTIGRAVITY_TOKEN_FILE),
      join(antigravityGeminiHome(process.env), "oauth_creds.json"),
    ],
    signOut: {
      argv: antigravityArgv(process.env),
      env: () => ({ ...ANTIGRAVITY_ENV }),
      timeoutMs: 30_000,
      acpLogout: true,
    },
    catalog: { slowList: true, ownOrder: true, relistWhileRunning: true },
    resolveCli: resolveAntigravityCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "antigravity",
        flavor: ANTIGRAVITY_ACP_FLAVOR,
        argv: antigravityArgv({ ...process.env, ...context.accountEnvironment }),
        env: ANTIGRAVITY_ENV,
        discoveryCwd: () => discoveryFolder("antigravity"),
        privateTemp: antigravityTemp(context),
        ...(confinement
          ? { confine: (target) => confineSpawnTarget(target, confinement, antigravityAccountStatePaths(context)) }
          : {}),
        ...antigravityKeyOptions(context, true),
        signInMessage: sourceText("error.provider.antigravitySignIn"),
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("antigravity"),
        readAccount: () =>
          antigravityUsesSavedKey(context)
            ? Effect.succeed({ email: null })
            : readAntigravityEmail(antigravityTokenFile(context)).pipe(Effect.map((email) => ({ email }))),
        readRateLimits: (_connection, model) =>
          antigravityUsesSavedKey(context)
            ? Effect.succeed({ rateLimits: null, rateLimitsByLimitId: null })
            : readAntigravityQuota({
                tokenFile: antigravityTokenFile(context),
                model,
                ...(context.systemProxyFetch ? { fetch: context.systemProxyFetch } : {}),
              }),
        readVerificationLink: () =>
          antigravityUsesSavedKey(context)
            ? Effect.succeed(null)
            : readAntigravityValidationLink({
                tokenFile: antigravityTokenFile(context),
                fetch: context.systemProxyFetch,
              }),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "antigravity",
        flavor: ANTIGRAVITY_ACP_FLAVOR,
        argv: antigravityArgv({ ...process.env, ...context.accountEnvironment }),
        env: ANTIGRAVITY_ENV,
        profileGeneration: true,
        discoveryCwd: () => discoveryFolder("antigravity"),
        privateTemp: antigravityTemp(context),
        ...antigravityKeyOptions(context, false),
        signInMessage: sourceText("error.provider.antigravitySignIn"),
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "antigravity", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "cursor",
    signIn: { kind: "acp-authenticate", methodId: "cursor_login", argv: ["acp"], timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    codeSignIn: {
      kind: "cli",
      flow: "link",
      command: { argv: ["login"], env: () => ({ NO_OPEN_BROWSER: "1" }), timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    },
    signOut: { argv: ["logout"], env: () => ({}), timeoutMs: 30_000 },
    accounts: {
      keyEnvironment: (key) => ({ CURSOR_API_KEY: key, CURSOR_AUTH_TOKEN: "", AGENT_CLI_CREDENTIAL_STORE: "memory" }),
      checkKey: checkCursorApiKey,
      supports: (cli) => cli.version >= CURSOR_KEY_ACCOUNTS_MIN_VERSION,
    },
    signInFiles: () => [
      join(homedir(), ".cursor", "cli-config.json"),
      ...(process.platform === "darwin"
        ? [join(homedir(), "Library", "Application Support", "Cursor", "User", "globalStorage", "storage.json")]
        : []),
    ],
    resolveCli: resolveCursorCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "cursor",
        flavor: CURSOR_ACP_FLAVOR,
        argv: ["acp"],
        env: {},
        ...(confinement ? { confine: (target) => confineSpawnTarget(target, confinement, cursorStatePaths()) } : {}),
        extraEnv: () => ({
          ...context.agentEnvironment?.(),
          ...(confinement ? cursorConfinedEnv() : {}),
          ...context.accountEnvironment,
        }),
        signInMessage: sourceText("error.provider.cursorSignIn"),
        ...(context.accountEnvironment
          ? { savedKeyRefusedMessage: () => sourceText("error.provider.accountKeyRefused", { provider: "Cursor" }) }
          : {
              readRateLimits: () =>
                readCursorUsage().pipe(Effect.mapError((failure) => providerFailure(failure.cause))),
            }),
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("cursor"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "cursor",
        flavor: CURSOR_ACP_FLAVOR,
        argv: ["acp"],
        profileGeneration: true,
        env: {},
        ...(context.accountEnvironment ? { extraEnv: () => ({ ...context.accountEnvironment }) } : {}),
        signInMessage: sourceText("error.provider.cursorSignIn"),
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "cursor", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "cline",
    signIn: {
      kind: "acp-authenticate",
      methodId: "cline",
      argv: CLINE_ARGV,
      env: CLINE_ENV,
      timeoutMs: CLI_LOGIN_TIMEOUT_MS,
    },
    codeSignIn: {
      kind: "cli",
      flow: "device",
      command: { argv: ["auth", "-p", "cline"], env: () => ({ ...CLINE_ENV }), timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    },
    resolveCli: resolveClineCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "cline",
        flavor: CLINE_ACP_FLAVOR,
        argv: CLINE_ARGV,
        env: { ...CLINE_ENV },
        ...(confinement ? { confine: (target) => confineClineTarget(target, confinement) } : {}),
        extraEnv: () => ({ ...context.agentEnvironment?.() }),
        additionalModels: clineFreeModels(),
        encodesModelIds: true,
        signInMessage: sourceText("error.provider.clineSignIn"),
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("cline"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "cline",
        flavor: CLINE_ACP_FLAVOR,
        argv: CLINE_ARGV,
        profileGeneration: true,
        env: { ...CLINE_ENV },
        additionalModels: clineFreeModels(),
        encodesModelIds: true,
        signInMessage: sourceText("error.provider.clineSignIn"),
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "cline", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "kimi",
    signIn: {
      kind: "cli-command",
      command: {
        argv: (cli, region) => kimiLoginArgs(cli, kimiLoginEnv(KIMI_ENV, cli, region), { code: false, region }),
        env: (cli, region) => kimiLoginEnv(KIMI_ENV, cli, region),
        savedSignIn: kimiSavedSignIn,
        timeoutMs: CLI_LOGIN_TIMEOUT_MS,
      },
    },
    codeSignIn: {
      kind: "cli",
      flow: "device",
      command: {
        argv: (cli, region) =>
          kimiLoginArgs(cli, kimiLoginEnv(KIMI_CODE_LOGIN_ENV, cli, region), { code: true, region }),
        env: (cli, region) => kimiLoginEnv(KIMI_CODE_LOGIN_ENV, cli, region),
        savedSignIn: kimiSavedSignIn,
        timeoutMs: CLI_LOGIN_TIMEOUT_MS,
      },
    },
    signOut: { argv: ["logout"], env: () => ({ ...KIMI_ENV }), timeoutMs: 30_000 },
    signInFiles: () => [
      join(homedir(), ".kimi", "credentials", "kimi-code.json"),
      join(homedir(), ".kimi", "config.toml"),
      join(homedir(), ".kimi-code", "config.toml"),
      join(homedir(), ".kimi-code", "credentials.json"),
    ],
    resolveCli: resolveKimiCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "kimi",
        flavor: KIMI_ACP_FLAVOR,
        argv: ["acp"],
        env: { ...KIMI_ENV },
        ...(confinement
          ? {
              confine: (target) =>
                confineWithState(
                  target,
                  confinement,
                  isPythonKimiCli(cli) ? kimiStatePaths : kimiCodeStatePaths,
                  context.agentEnvironment?.(),
                ),
            }
          : {}),
        extraEnv: () => kimiProcessEnv(cli, context.agentEnvironment?.()),
        signInMessage: sourceText("error.provider.kimiSignIn"),
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("kimi"),
        readRateLimits: () =>
          readKimiUsage(isPythonKimiCli(cli), { ...process.env, ...context.agentEnvironment?.() }).pipe(
            Effect.mapError((failure) => providerFailure(failure.cause)),
          ),
        ...(isPythonKimiCli(cli)
          ? { savedSignInCheck: kimiSavedSignInCheck(() => ({ ...process.env, ...context.agentEnvironment?.() })) }
          : {}),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "kimi",
        flavor: KIMI_ACP_FLAVOR,
        argv: ["acp"],
        profileGeneration: true,
        env: { ...KIMI_ENV },
        extraEnv: () => kimiProcessEnv(cli, undefined),
        signInMessage: sourceText("error.provider.kimiSignIn"),
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "kimi", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "devin",
    signIn: { kind: "acp-authenticate", methodId: "devin-browser", argv: DEVIN_ARGV, timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    signInFiles: () => [join(devinDataDirectory(), "credentials.toml")],
    signOut: { argv: ["auth", "logout"], env: () => ({}), timeoutMs: 30_000 },
    resolveCli: resolveDevinCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "devin",
        flavor: DEVIN_ACP_FLAVOR,
        argv: DEVIN_ARGV,
        env: {},
        ...(confinement
          ? {
              confine: (target) => confineWithState(target, confinement, devinStatePaths, context.agentEnvironment?.()),
            }
          : {}),
        extraEnv: () => ({ ...context.agentEnvironment?.() }),
        signInMessage: sourceText("error.provider.devinSignIn"),
        noModelsWhenSignedOut: true,
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("devin"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "devin",
        flavor: DEVIN_ACP_FLAVOR,
        argv: DEVIN_ARGV,
        profileGeneration: true,
        env: {},
        signInMessage: sourceText("error.provider.devinSignIn"),
        noModelsWhenSignedOut: true,
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "devin", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "copilot",
    signIn: {
      kind: "cli-command",
      command: { argv: ["login"], env: () => ({ ...COPILOT_ENV }), timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    },
    codeSignIn: {
      kind: "cli",
      flow: "device",
      command: {
        argv: ["login", "--device-code"],
        env: () => ({ ...COPILOT_ENV }),
        timeoutMs: CLI_LOGIN_TIMEOUT_MS,
        closeInput: true,
      },
    },
    signOut: { argv: COPILOT_ARGV, env: () => ({ ...COPILOT_ENV }), timeoutMs: 30_000, acpLogout: true },
    signInFiles: () => [join(copilotHomeDirectory(), "config.json")],
    catalog: { relistWhileRunning: true },
    resolveCli: resolveCopilotCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "copilot",
        flavor: COPILOT_ACP_FLAVOR,
        argv: COPILOT_ARGV,
        env: { ...COPILOT_ENV },
        ...(confinement
          ? {
              confine: (target) =>
                confineWithState(target, confinement, copilotStatePaths, context.agentEnvironment?.()),
            }
          : {}),
        extraEnv: () => ({ ...context.agentEnvironment?.(), ...(confinement ? COPILOT_CONFINED_ENV : {}) }),
        signInMessage: sourceText("error.provider.copilotSignIn"),
        noModelsWhenSignedOut: true,
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("copilot"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "copilot",
        flavor: COPILOT_ACP_FLAVOR,
        argv: COPILOT_ARGV,
        profileGeneration: true,
        env: { ...COPILOT_ENV },
        signInMessage: sourceText("error.provider.copilotSignIn"),
        noModelsWhenSignedOut: true,
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "copilot", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "mistral",
    signIn: {
      kind: "acp-authenticate",
      methodId: "browser-auth",
      argv: MISTRAL_ARGV,
      env: MISTRAL_ENV,
      timeoutMs: CLI_LOGIN_TIMEOUT_MS,
    },
    codeSignIn: {
      kind: "acp-delegated",
      methodId: "browser-auth-delegated",
      argv: MISTRAL_ARGV,
      env: MISTRAL_ENV,
      timeoutMs: CLI_LOGIN_TIMEOUT_MS,
    },
    signOut: { argv: MISTRAL_ARGV, env: () => ({ ...MISTRAL_ENV }), timeoutMs: 30_000, acpLogout: "_auth/signOut" },
    signInFiles: () => [join(mistralHomeDirectory(), ".env"), join(mistralHomeDirectory(), "config.toml")],
    resolveCli: resolveMistralCli,
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "mistral",
        flavor: MISTRAL_ACP_FLAVOR,
        argv: MISTRAL_ARGV,
        env: { ...MISTRAL_ENV },
        ...(confinement
          ? {
              confine: (target) =>
                confineWithState(target, confinement, mistralStatePaths, context.agentEnvironment?.()),
            }
          : {}),
        extraEnv: () => ({ ...context.agentEnvironment?.() }),
        signInMessage: sourceText("error.provider.mistralSignIn"),
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("mistral"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "mistral",
        flavor: MISTRAL_ACP_FLAVOR,
        argv: MISTRAL_ARGV,
        profileGeneration: true,
        env: { ...MISTRAL_ENV },
        signInMessage: sourceText("error.provider.mistralSignIn"),
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "mistral", email: account?.email ?? null }),
    validateAccount: () => undefined,
    catalog: { partialListAtStart: true, relistAfterStart: true },
  },
  {
    id: "hermes",
    signIn: {
      kind: "cli-command",
      command: { argv: HERMES_NOUS_SIGN_IN, env: () => ({}), timeoutMs: CLI_LOGIN_TIMEOUT_MS },
    },
    codeSignIn: {
      kind: "cli",
      flow: "device",
      command: {
        argv: [...HERMES_NOUS_SIGN_IN, "--no-browser"],
        env: () => ({}),
        timeoutMs: CLI_LOGIN_TIMEOUT_MS,
        closeInput: true,
      },
    },
    signInFiles: () => ["auth.json", ".env", "config.yaml"].map((name) => join(hermesHome(), name)),
    resolveCli: () => resolveHermesCli(),
    createClient: (cli, timeout, context, confinement) =>
      new AcpAgentClient(cli, timeout, {
        provider: "hermes",
        flavor: HERMES_ACP_FLAVOR,
        argv: HERMES_ARGV,
        env: {},
        ...(confinement
          ? {
              confine: (target) =>
                confineHermesTarget(target, confinement, { ...process.env, ...context.agentEnvironment?.() }),
            }
          : {}),
        extraEnv: () => {
          const agentEnvironment = context.agentEnvironment?.() ?? {};
          return {
            ...hermesSettingsEnvironment({ ...process.env, ...agentEnvironment }, context.providerStateDirectory),
            ...agentEnvironment,
          };
        },
        signInMessage: sourceText("error.provider.hermesSignIn"),
        authenticate: requireHermesProvider,
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("hermes"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "hermes",
        flavor: HERMES_ACP_FLAVOR,
        argv: HERMES_ARGV,
        profileGeneration: true,
        env: {},
        extraEnv: () => hermesSettingsEnvironment(process.env, context.providerStateDirectory),
        signInMessage: sourceText("error.provider.hermesSignIn"),
        authenticate: requireHermesProvider,
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "hermes", email: account?.email ?? null }),
    validateAccount: () => undefined,
  },
  {
    id: "openclaw",
    signIn: {
      kind: "terminal",
      argv: OPENCLAW_SIGN_IN,
      timeoutMs: CLI_LOGIN_TIMEOUT_MS,
    },
    signInFiles: () => [join(homedir(), ".openclaw", "openclaw.json")],
    resolveCli: () => resolveOpenClawCli(),
    createClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "openclaw",
        flavor: OPENCLAW_ACP_FLAVOR,
        label: "OpenClaw",
        argv: OPENCLAW_ARGV,
        env: {},
        allowNoModels: true,
        additionalModels: () => Effect.sync(readOpenClawModels),
        extraEnv: () => ({ ...context.agentEnvironment?.() }),
        signInMessage: "请先完成 OpenClaw 授权登录，或在终端运行 openclaw models auth login。",
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("openclaw"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "openclaw",
        flavor: OPENCLAW_ACP_FLAVOR,
        label: "OpenClaw",
        argv: OPENCLAW_ARGV,
        profileGeneration: true,
        env: {},
        allowNoModels: true,
        additionalModels: () => Effect.sync(readOpenClawModels),
        signInMessage: "请先完成 OpenClaw 授权登录，或在终端运行 openclaw models auth login。",
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "openclaw", email: account?.email ?? null }),
    validateAccount: () => undefined,
    catalog: { slowList: true, partialListAtStart: true, relistAfterStart: true },
  },
  {
    id: "workbuddy",
    signIn: {
      kind: "acp-authenticate",
      methodId: "internal",
      argv: () => workbuddyArgv(),
      env: workbuddyEnv(),
      timeoutMs: CLI_LOGIN_TIMEOUT_MS,
    },
    signInFiles: () => [
      starbotWorkBuddyAuthFile(),
      join(starbotWorkBuddyCliDir(), "settings.json"),
      join(starbotWorkBuddyCliDir(), "local_storage"),
    ],
    resolveCli: () => resolveWorkBuddyCli(),
    createClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "workbuddy",
        flavor: WORKBUDDY_ACP_FLAVOR,
        label: "WorkBuddy",
        argv: workbuddyArgv(),
        env: workbuddyEnv(),
        allowNoModels: true,
        additionalModels: () => Effect.sync(readWorkBuddyLatestModels),
        replaceModelsWithAdditional: true,
        extraEnv: () => ({ ...context.agentEnvironment?.(), ...workbuddyEnv() }),
        authenticate: requireWorkBuddyAuth,
        readAccount: readWorkBuddyAccount,
        signInMessage: "请点击连接在浏览器完成一次 WorkBuddy 网页登录（与桌面端独立保存，重启不掉线）。",
        servesModel: context.servesModel,
        mcpServers: context.mcpServers,
        fitImage: context.fitImage,
        reportMcpDrops: context.reportMcpDrops,
        mcpToolRuntimes: context.mcpToolRuntimes,
        mcpEndpoint: context.mcpEndpoint,
        history: context.history?.("workbuddy"),
      }),
    createProfileClient: (cli, timeout, context) =>
      new AcpAgentClient(cli, timeout, {
        provider: "workbuddy",
        flavor: WORKBUDDY_ACP_FLAVOR,
        label: "WorkBuddy",
        argv: workbuddyArgv(),
        profileGeneration: true,
        env: workbuddyEnv(),
        extraEnv: () => workbuddyEnv(),
        allowNoModels: true,
        additionalModels: () => Effect.sync(readWorkBuddyLatestModels),
        replaceModelsWithAdditional: true,
        authenticate: requireWorkBuddyAuth,
        readAccount: readWorkBuddyAccount,
        signInMessage: "请点击连接在浏览器完成一次 WorkBuddy 网页登录（与桌面端独立保存，重启不掉线）。",
        servesModel: context.servesModel,
      }),
    authState: (account) => ({ kind: "workbuddy", email: account?.email ?? null }),
    validateAccount: () => undefined,
    catalog: { slowList: true, partialListAtStart: true, relistAfterStart: true },
  },
  {
    id: "acp",
    signIn: { kind: "external" },
    catalog: {
      slowList: true,
      partialListAtStart: true,
      relistAfterStart: true,
      modelFields: steeringFields,
    },
    resolveCli: () => Effect.succeed(CUSTOM_AGENTS_CLI),
    createClient: (_cli, timeout, context, confinement) =>
      new CustomAcpAgentsClient(
        () => savedCustomAgents(context),
        (config, executable, folder, history, launchPath) =>
          customAgentChild(config, executable, folder, timeout, context, confinement, false, history, launchPath),
        undefined,
        context.history?.("acp"),
        confinement !== undefined,
      ),
    createProfileClient: (_cli, timeout, context) =>
      new CustomAcpAgentsClient(
        () => savedCustomAgents(context),
        (config, executable, folder, history, launchPath) =>
          customAgentChild(config, executable, folder, timeout, context, undefined, true, history, launchPath),
        undefined,
        context.history?.("acp"),
      ),
    authState: () => ({ kind: "acp", email: null }),
    validateAccount: () => undefined,
  },
] as const;

function customAgentChild(
  config: CustomAgentConfig,
  executable: string,
  folder: string | null,
  timeout: number,
  context: ProviderClientContext,
  confinement: ProcessConfinement | undefined,
  profileGeneration: boolean,
  history?: AcpHistoryPersistence,
  launchPath?: string | null,
): AgentClient {
  const env = {
    ...(launchPath ? { PATH: launchPath } : {}),
    ...Object.fromEntries(config.env.map((entry) => [entry.name, entry.value])),
  };
  const values = config.env.map((entry) => entry.value);
  return new AcpAgentClient({ executable, version: "", source: "system" }, timeout, {
    provider: "acp",
    flavor: customAgentFlavor(config.command),
    label: config.name,
    allowNoModels: true,
    discoveryCwd: () => folder ?? discoveryFolder(config.id),
    redactValues: () => values,
    argv: config.args,
    env,
    ...(profileGeneration ? { profileGeneration: true } : {}),
    history: profileGeneration ? undefined : history,
    ...(confinement ? { confine: (target) => confineSpawnTarget(target, confinement, customAgentStatePaths()) } : {}),
    signInMessage: sourceText("error.provider.customAgentSignIn"),
    servesModel: () => savedCustomAgents(context).some((saved) => saved.id === config.id),
    steer: steerAcpSession,
    steers: acpSessionSteers,
    ...(profileGeneration
      ? {}
      : {
          extraEnv: () =>
            Object.fromEntries(
              Object.entries(context.agentEnvironment?.({ ...process.env, ...env }) ?? {}).filter(
                ([name]) =>
                  name.startsWith("GIT_CONFIG_") ||
                  !(name in env || (name === "SSL_CERT_FILE" && "SSL_CERT_DIR" in env)),
              ),
            ),
          mcpServers: context.mcpServers,
          fitImage: context.fitImage,
          reportMcpDrops: context.reportMcpDrops,
          mcpToolRuntimes: context.mcpToolRuntimes,
          mcpEndpoint: context.mcpEndpoint,
        }),
  });
}

export function savedCustomAgents(context: ProviderClientContext): readonly CustomAgentConfig[] {
  return context.customAgents?.() ?? [];
}

let customAgentDiscoveryRoot: string | undefined;

function discoveryFolder(agentId: string): string {
  customAgentDiscoveryRoot ??= mkdtempSync(join(tmpdir(), "openbot-custom-agents-"));
  const folder = join(customAgentDiscoveryRoot, agentId);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  return folder;
}

const CUSTOM_AGENTS_CLI: AgentCliInfo = { executable: "", version: "", source: "system" };

const PROVIDER_DRIVERS = new Map(BUILT_IN_PROVIDER_DRIVERS.map((driver) => [driver.id, driver]));

export function requireProviderDriver(provider: AgentProviderId): BuiltInProviderDriver {
  const driver = PROVIDER_DRIVERS.get(provider);
  if (!driver) throw new Error(`Unknown agent provider: ${provider}`);
  return driver;
}
