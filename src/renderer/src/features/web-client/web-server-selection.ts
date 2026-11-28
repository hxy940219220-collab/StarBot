export function readWebServerSelection(accountId: string): string | null {
  try {
    return window.localStorage.getItem(`starbot.web.selected-server:${accountId}`);
  } catch {
    return null;
  }
}

export function writeWebServerSelection(accountId: string, hostId: string): void {
  try {
    window.localStorage.setItem(`starbot.web.selected-server:${accountId}`, hostId);
  } catch {}
}
