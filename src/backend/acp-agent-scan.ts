import { homedir } from "node:os";
import { join } from "node:path";
import {
  ACP_AGENT_PRESETS,
  type AcpAgentPreset,
  type DetectedAcpAgent,
  isNewCustomAgentId,
} from "@starbot/contracts/ipc";
import { Effect } from "effect";
import { resolveAgentCommand } from "./acp-agent-command";

const AGENT_SCAN_TIMEOUT_MS = 10_000;
const AGENT_SCAN_CONCURRENCY = 4;

export interface ScanAcpAgentsOptions {
  folders: readonly string[];
  takenIds: ReadonlySet<string>;
  presets?: readonly AcpAgentPreset[];
  platform?: NodeJS.Platform;
  home?: string;
  timeoutMs?: number;
  resolve?: typeof resolveAgentCommand;
}

export const scanAcpAgents = Effect.fn("AcpAgents.scan")(function* (options: ScanAcpAgentsOptions) {
  const presets = options.presets ?? ACP_AGENT_PRESETS;
  const platform = options.platform ?? process.platform;
  const home = options.home ?? homedir();
  const resolve = options.resolve ?? resolveAgentCommand;
  const defaultMacFolders =
    platform === "darwin" ? ["/opt/homebrew/bin", "/usr/local/bin", join(home, ".local/bin")] : [];
  const folders = [
    ...options.folders.flatMap((folder) => {
      if (folder === "~") return [home];
      if (folder.startsWith("~/")) return [join(home, folder.slice(2))];
      return [folder];
    }),
    ...defaultMacFolders,
  ];
  const names = (command: string) => (platform === "win32" ? [`${command}.exe`, `${command}.cmd`] : [command]);
  const lookup = Effect.fn("AcpAgents.lookup")((name: string, searchPath?: readonly string[]) =>
    resolve(name, { platform, home, ...(searchPath ? { searchPath } : {}) }).pipe(
      Effect.catch(() => Effect.succeed(null)),
    ),
  );
  const find = Effect.fn("AcpAgents.find")(function* (
    preset: AcpAgentPreset,
  ): Effect.fn.Return<{ command: string; args: readonly string[] } | null> {
    if (folders.length > 0) {
      for (const name of names(preset.command)) {
        const found = yield* lookup(name, folders);
        if (found) return { command: found, args: preset.args };
      }
    }
    const direct = yield* lookup(preset.command);
    if (direct) return { command: direct, args: preset.args };
    return null;
  });
  const found = yield* Effect.forEach(presets, find, { concurrency: AGENT_SCAN_CONCURRENCY }).pipe(
    Effect.timeoutOrElse({
      duration: options.timeoutMs ?? AGENT_SCAN_TIMEOUT_MS,
      orElse: () => Effect.succeed(presets.map(() => null)),
    }),
  );
  const taken = new Set(options.takenIds);
  const seen = new Set<string>();
  const rows: DetectedAcpAgent[] = [];
  presets.forEach((preset, index) => {
    const resolved = found[index];
    if (!resolved) return;
    const dedupeKey = `${resolved.command}\0${resolved.args.join("\0")}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const id = freeId(preset.id, taken);
    if (!id) return;
    taken.add(id);
    rows.push({ id, name: preset.name, command: resolved.command, args: [...resolved.args] });
  });
  return rows;
});

function freeId(base: string, taken: ReadonlySet<string>): string | null {
  for (let suffix = 1; suffix <= 99; suffix += 1) {
    const id = suffix === 1 ? base : `${base}-${suffix}`;
    if (!taken.has(id) && isNewCustomAgentId(id)) return id;
  }
  return null;
}
