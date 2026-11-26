import { isDynamicRecord, isNumber, isString } from "@openbot/contracts/runtime-values";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

import { openStorePage } from "@/features/app-update/model/app-update";
import { localDay } from "@/shared/lib/local-day";

const key = "starbot.mobile.ratingAsk.v1";
const MIN_USE_DAYS = 5;

interface RatingAskRecord {
  days: readonly string[];
  firstUse: number | null;
  lastAsked: number | null;
  done: boolean;
}

const EMPTY: RatingAskRecord = { days: [], firstUse: null, lastAsked: null, done: false };

export const useRatingAsk = create<RatingAskRecord & { ready: boolean }>(() => ({ ...EMPTY, ready: false }));

function decodeRatingAsk(stored: string | null): RatingAskRecord {
  let value: unknown = null;
  try {
    value = stored === null ? null : JSON.parse(stored);
  } catch {
    value = null;
  }
  if (!isDynamicRecord(value)) return EMPTY;
  const time = (item: unknown) => (isNumber(item) && Number.isFinite(item) ? item : null);
  return {
    days: Array.isArray(value.days) ? value.days.filter(isString).slice(-MIN_USE_DAYS) : [],
    firstUse: time(value.firstUse),
    lastAsked: time(value.lastAsked),
    done: value.done === true,
  };
}

export async function loadRatingAsk(): Promise<void> {
  if (useRatingAsk.getState().ready) return;
  const stored = await SecureStore.getItemAsync(key);
  if (!useRatingAsk.getState().ready) useRatingAsk.setState({ ...decodeRatingAsk(stored), ready: true });
}

let writes: Promise<void> = Promise.resolve();

function save(change: Partial<RatingAskRecord>): Promise<void> {
  useRatingAsk.setState(change);
  const { days, firstUse, lastAsked, done } = useRatingAsk.getState();
  const record: RatingAskRecord = { days, firstUse, lastAsked, done };
  writes = writes.then(() => SecureStore.setItemAsync(key, JSON.stringify(record))).catch(() => undefined);
  return writes;
}

export function recordRatingAskUse(now = Date.now()): void {
  const state = useRatingAsk.getState();
  if (!state.ready) return;
  const today = localDay(new Date(now));
  if (state.days.includes(today)) return;
  void save({ days: [...state.days, today].slice(-MIN_USE_DAYS), firstUse: state.firstUse ?? now });
}

export function ratingAskDue(_now = Date.now()): boolean {
  return false;
}

export function markRatingAskShown(now = Date.now()): void {
  void save({ lastAsked: now });
}

export function finishRatingAsk(): void {
  void save({ done: true });
}

export function openStoreReview(): Promise<void> {
  return openStorePage({ review: true });
}

export async function openXPost(): Promise<void> {
  return undefined;
}
