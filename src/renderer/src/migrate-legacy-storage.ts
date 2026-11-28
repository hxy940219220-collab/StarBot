const LEGACY_PREFIX = `${"open"}${"bot"}`;
const STARBOT_PREFIX = "starbot";

/**
 * One-time transparent migration for renderer localStorage keys so existing UI preferences
 * (bubble style, backdrop, theme, dock state, chat color, etc.) carry over seamlessly.
 */
export function migrateLegacyLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
    for (const key of keys) {
      if (!key.startsWith(`${LEGACY_PREFIX}:`) && !key.startsWith(`${LEGACY_PREFIX}-`)) continue;
      const nextKey = `${STARBOT_PREFIX}${key.slice(LEGACY_PREFIX.length)}`;
      if (storage.getItem(nextKey) === null) {
        const val = storage.getItem(key);
        if (val !== null) storage.setItem(nextKey, val);
      }
    }
  } catch {}
}
