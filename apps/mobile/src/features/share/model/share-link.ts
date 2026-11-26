export function isIncomingShareLink(path: string): boolean {
  try {
    const url = new URL(path);
    return url.protocol === "starbot:" && url.host === "expo-sharing";
  } catch {
    return false;
  }
}
