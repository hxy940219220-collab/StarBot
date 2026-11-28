import { speechTextFromMarkdown } from "@openbot/contracts/speech-text";
import { createSignal } from "solid-js";
import { actionToast } from "../../action-toast";
import { speechPort } from "./speech-port";
import { speechSpeed } from "./speech-speed";

const [readingIdSignal, setReadingIdSignal] = createSignal<string | null>(null);
const [loadingIdSignal, setLoadingIdSignal] = createSignal<string | null>(null);
let currentSessionToken = 0;
let activeAudioElement: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;

const MAX_WAV_CACHE_ENTRIES = 48;
const wavCache = new Map<string, ArrayBuffer>();
const inFlightSyntheses = new Map<string, Promise<ArrayBuffer>>();

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

export function isNativeTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    (typeof Audio !== "undefined" || ("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"))
  );
}

export function nativeReadingMessageId(): string | null {
  return readingIdSignal();
}

export function nativeLoadingMessageId(): string | null {
  return loadingIdSignal();
}

function normalizeNaturalText(markdown: string): string {
  return speechTextFromMarkdown(markdown)
    .replace(/([\u4e00-\u9fff])\.(?=\s|$)/gu, "$1。")
    .replace(/[—–]{1,2}/gu, "，")
    .replace(/[|]/gu, "，")
    .replace(/[✦★☆✓✔✗✕→←↑↓↗↘•·▪▫◆◇]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function splitLongSegment(segment: string, maxLen: number): string[] {
  if (segment.length <= maxLen) return [segment];
  const clauses = segment.split(/(?<=[，,、：:])\s*/u).filter((s) => s.trim().length > 0);
  const out: string[] = [];
  let buf = "";
  for (const clause of clauses) {
    if ((buf + clause).length <= maxLen) {
      buf = buf ? `${buf}${clause}` : clause;
    } else {
      if (buf) out.push(buf);
      if (clause.length <= maxLen) {
        buf = clause;
      } else {
        for (let i = 0; i < clause.length; i += maxLen) {
          out.push(clause.slice(i, i + maxLen));
        }
        buf = "";
      }
    }
  }
  if (buf) out.push(buf);
  return out;
}

function cleanSpeechChunks(markdown: string): string[] {
  const plain = normalizeNaturalText(markdown);
  if (!plain) return [];

  const rawSentences = plain.split(/(?<=[。！？；.!?\n])\s*/u).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let buffer = "";

  for (const sentence of rawSentences) {
    // Keep the very first chunk ultra-short (~44 chars) for the fastest possible playback start
    const limit = chunks.length === 0 ? 44 : 165;
    if ((buffer + sentence).length <= limit) {
      buffer = buffer ? `${buffer} ${sentence}` : sentence;
    } else {
      if (buffer) chunks.push(buffer);
      const nextLimit = chunks.length === 0 ? 44 : 165;
      if (sentence.length <= nextLimit) {
        buffer = sentence;
      } else {
        const pieces = splitLongSegment(sentence, nextLimit);
        for (const piece of pieces) {
          chunks.push(piece);
        }
        buffer = "";
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

function encodePcm16Wav(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const byteLength = pcm.byteLength & ~1;
  const out = new ArrayBuffer(44 + byteLength);
  const view = new DataView(out);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, byteLength, true);
  new Uint8Array(out, 44, byteLength).set(pcm.subarray(0, byteLength));
  return out;
}

function rememberWav(key: string, wav: ArrayBuffer): void {
  wavCache.delete(key);
  wavCache.set(key, wav);
  while (wavCache.size > MAX_WAV_CACHE_ENTRIES) {
    const oldest = wavCache.keys().next().value;
    if (oldest === undefined) break;
    wavCache.delete(oldest);
  }
}

function synthesizeNeuralWav(text: string): Promise<ArrayBuffer> {
  const cached = wavCache.get(text);
  if (cached) {
    wavCache.delete(text);
    wavCache.set(text, cached);
    return Promise.resolve(cached);
  }
  const existing = inFlightSyntheses.get(text);
  if (existing) return existing;

  const task = speechPort()
    .voice.speak({ text, language: null })
    .then((audio) => {
      const wav = encodePcm16Wav(audio.pcm, audio.sampleRate);
      rememberWav(text, wav);
      return wav;
    })
    .finally(() => {
      if (inFlightSyntheses.get(text) === task) inFlightSyntheses.delete(text);
    });
  inFlightSyntheses.set(text, task);
  return task;
}

/**
 * Quietly pre-synthesizes the first short chunk of a message (on hover or after reply completes)
 * so clicking the read-aloud button starts playing immediately with near-zero latency.
 */
export function prefetchNativeReadAloud(markdown: string): void {
  if (!isNativeTtsSupported()) return;
  const chunks = cleanSpeechChunks(markdown);
  const first = chunks[0];
  if (!first || wavCache.has(first) || inFlightSyntheses.has(first)) return;
  // Cap concurrent background prefetches to keep the TTS worker responsive
  if (inFlightSyntheses.size >= 2) return;
  void synthesizeNeuralWav(first).catch(() => undefined);
}

function clearActiveAudio(): void {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.removeAttribute("src");
      activeAudioElement.load();
    } catch {}
    activeAudioElement = null;
  }
  if (activeAudioUrl) {
    try {
      URL.revokeObjectURL(activeAudioUrl);
    } catch {}
    activeAudioUrl = null;
  }
}

function playWavBuffer(wav: ArrayBuffer, token: number, rate: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (token !== currentSessionToken) {
      resolve(false);
      return;
    }
    clearActiveAudio();
    const url = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    const audio = new Audio();
    audio.preservesPitch = true;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    audio.src = url;
    activeAudioElement = audio;
    activeAudioUrl = url;

    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (activeAudioElement === audio) clearActiveAudio();
      resolve(ok);
    };
    const onEnded = () => done(true);
    const onError = () => done(false);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.play().catch(() => done(false));
  });
}

function pickFallbackSystemVoice(isChinese: boolean): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  if (isChinese) {
    const zhVoices = voices.filter((v) => /^zh/iu.test(v.lang));
    return (
      zhVoices.find((v) => /xiaoxiao|xiaoyi|meijia|sinji|tingting/iu.test(v.name)) ??
      zhVoices.find((v) => /^zh[-_]CN/iu.test(v.lang)) ??
      zhVoices[0] ??
      null
    );
  }
  const enVoices = voices.filter((v) => /^en/iu.test(v.lang));
  return (
    enVoices.find((v) => /ava|samantha|allison|victoria|karen/iu.test(v.name)) ??
    enVoices.find((v) => /^en[-_]US/iu.test(v.lang)) ??
    enVoices[0] ??
    null
  );
}

function speakFallbackChunk(text: string, isChinese: boolean, rate: number, token: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (
      token !== currentSessionToken ||
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      resolve(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const chunkZh = CJK_REGEX.test(text) || isChinese;
    utterance.lang = chunkZh ? "zh-CN" : "en-US";
    utterance.rate = rate;
    utterance.pitch = 1.04;
    const voice = pickFallbackSystemVoice(chunkZh);
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}

export function stopNativeReadAloud(): void {
  currentSessionToken += 1;
  setReadingIdSignal(null);
  setLoadingIdSignal(null);
  clearActiveAudio();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

export function toggleNativeReadAloud(messageId: string, markdown: string): void {
  if (!isNativeTtsSupported()) {
    actionToast.warning("当前系统环境暂不支持语音朗读");
    return;
  }

  if (readingIdSignal() === messageId) {
    stopNativeReadAloud();
    return;
  }

  const chunks = cleanSpeechChunks(markdown);
  if (chunks.length === 0) {
    actionToast.warning("该消息没有可朗读的文本内容");
    return;
  }

  currentSessionToken += 1;
  const token = currentSessionToken;
  clearActiveAudio();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  setReadingIdSignal(messageId);
  const firstCached = chunks[0] ? wavCache.has(chunks[0]) : false;
  setLoadingIdSignal(firstCached ? null : messageId);

  const isChinese = CJK_REGEX.test(chunks.join(""));
  const rate = Math.min(2, Math.max(0.75, speechSpeed() || 1));

  void (async () => {
    let neuralAvailable = true;

    try {
      for (let i = 0; i < chunks.length; i += 1) {
        if (token !== currentSessionToken) return;
        const text = chunks[i]!;

        if (neuralAvailable) {
          try {
            // Immediately kick off chunk 1 synthesis in parallel with chunk 0 if chunk 0 is already cached
            if (i === 0 && chunks.length > 1) {
              void synthesizeNeuralWav(chunks[1]!).catch(() => undefined);
            }
            const wav = await synthesizeNeuralWav(text);
            if (token !== currentSessionToken) return;
            if (loadingIdSignal() === messageId) setLoadingIdSignal(null);
            // Prefetch next chunk in parallel while current chunk plays so sentences flow seamlessly
            if (i + 1 < chunks.length) {
              void synthesizeNeuralWav(chunks[i + 1]!).catch(() => undefined);
            }
            const ok = await playWavBuffer(wav, token, rate);
            if (token !== currentSessionToken) return;
            if (ok) continue;
          } catch {
            neuralAvailable = false;
            if (loadingIdSignal() === messageId) setLoadingIdSignal(null);
          }
        }

        if (token !== currentSessionToken) return;
        const fallbackOk = await speakFallbackChunk(text, isChinese, rate, token);
        if (token !== currentSessionToken) return;
        if (!fallbackOk) {
          actionToast.error("语音朗读中断，请检查网络或系统音量设置");
          break;
        }
      }
    } finally {
      if (token === currentSessionToken) {
        clearActiveAudio();
        setReadingIdSignal(null);
        setLoadingIdSignal(null);
      }
    }
  })();
}
