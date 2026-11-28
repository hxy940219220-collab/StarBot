/// <reference types="vite/client" />

import type { StarBotDesktopApi } from "@starbot/contracts/ipc";

declare global {
  interface HighlightRegistry {
    set(name: string, highlight: Highlight): this;
    delete(name: string): boolean;
  }

  interface Window {
    starbot: StarBotDesktopApi;
  }
}
