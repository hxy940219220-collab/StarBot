import type { MobileReleaseNotes } from "@starbot/contracts/mobile-features";

export type AppUpdate = { kind: "ready"; id: string } | { kind: "store"; id: string; version: string };

export const MOBILE_CHANGELOG_URL = "";

export async function dismissAppUpdate(_update: AppUpdate): Promise<void> {
  return undefined;
}

export function useAppUpdate(): null {
  return null;
}

export async function openStorePage(_options?: { review?: boolean }): Promise<void> {
  return undefined;
}

export async function installAppUpdate(_update: AppUpdate, _accentColor?: string): Promise<void> {
  return undefined;
}

const EMPTY_NOTES: readonly MobileReleaseNotes[] = [];

export function useAppUpdateNotes(_enabled = false): {
  data: readonly MobileReleaseNotes[];
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
} {
  return {
    data: EMPTY_NOTES,
    isPending: false,
    isLoading: false,
    isError: false,
    refetch: async () => undefined,
  };
}
