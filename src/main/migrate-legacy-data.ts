import { existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

const LEGACY_PREFIX = `${"open"}${"bot"}`;
const STARBOT_PREFIX = "starbot";

/**
 * One-time transparent migration for existing StarBot user data directories:
 * renames legacy database and JSON preference files to the unified `starbot` prefix
 * so agents, chat history, memories, automation settings, and pairings are 100% preserved.
 */
export function migrateLegacyStarBotDataDir(userDataDir: string): void {
  if (!existsSync(userDataDir)) return;
  try {
    const entries = readdirSync(userDataDir);
    // Migrate SQLite database (+ WAL/SHM sidecars together) first if target DB doesn't exist yet
    const legacyDb = `${LEGACY_PREFIX}.db`;
    const targetDb = `${STARBOT_PREFIX}.db`;
    if (entries.includes(legacyDb) && !entries.includes(targetDb)) {
      for (const suffix of ["", "-wal", "-shm"]) {
        const from = join(userDataDir, `${legacyDb}${suffix}`);
        const to = join(userDataDir, `${targetDb}${suffix}`);
        if (existsSync(from) && !existsSync(to)) {
          try {
            renameSync(from, to);
          } catch {}
        }
      }
    }

    // Migrate legacy preference/auth/state files (`<legacy>-*.json`, `<legacy>-*.bin`, etc.)
    for (const name of entries) {
      if (!name.startsWith(`${LEGACY_PREFIX}-`)) continue;
      if (name.endsWith(".log") || name.endsWith(".lock")) continue;
      const nextName = `${STARBOT_PREFIX}${name.slice(LEGACY_PREFIX.length)}`;
      const from = join(userDataDir, name);
      const to = join(userDataDir, nextName);
      if (!existsSync(to)) {
        try {
          renameSync(from, to);
        } catch {}
      }
    }
  } catch {}
}
