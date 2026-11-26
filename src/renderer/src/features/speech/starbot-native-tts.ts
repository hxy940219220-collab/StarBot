import { speechTextFromMarkdown } from "@openbot/contracts/speech-text";
import { createSignal } from "solid-js";
import { actionToast } from "../../action-toast";
import { speechSpeed } from "./speech-speed";

const [readingIdSignal, setReadingIdSignal] = createSignal<string | null>(null);
let currentSessionToken = 0;

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

export function isNativeTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function nativeReadingMessageId(): string | null {
  return readingIdSignal();
}

function cleanSpeechChunks(markdown: string): string[] {
  const plain = speechTextFromMarkdown(markdown)
    .replace(/([\u4e00-\u9fff])\.(?=\s|$)/gu, "$1。")
    .replace(/\s+/gu, " ")
    .trim();
  if (!plain) return [];

  const rawParts = plain.split(/(?<=[。！？；.!?\n])\s*/u).filter((s) => s.trim().length > 0);
  const chunks: string[] = [];
  let buffer = "";
  for (const part of rawParts) {
    if ((buffer + part).length <= 160) {
      buffer = buffer ? `${buffer} ${part}` : part;
    } else {
      if (buffer) chunks.push(buffer);
      if (part.length <= 160) {
        buffer = part;
      } else {
        for (let i = 0; i < part.length; i += 150) {
          chunks.push(part.slice(i, i + 150));
        }
        buffer = "";
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

function pickBestVoice(isChinese: boolean): SpeechSynthesisVoice | null {
  if (!isNativeTtsSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  if (isChinese) {
    const zhVoices = voices.filter((v) => /^zh/iu.test(v.lang));
    return (
      zhVoices.find((v) => /tingting|meijia|xiaoxiao|yunxi|sinji/iu.test(v.name) && v.localService) ??
      zhVoices.find((v) => /^zh[-_]CN/iu.test(v.lang) && v.localService) ??
      zhVoices.find((v) => /^zh[-_]CN/iu.test(v.lang)) ??
      zhVoices[0] ??
      null
    );
  }

  const enVoices = voices.filter((v) => /^en/iu.test(v.lang));
  return (
    enVoices.find((v) => /samantha|ava|allison|alex/iu.test(v.name) && v.localService) ??
    enVoices.find((v) => /^en[-_]US/iu.test(v.lang) && v.localService) ??
    enVoices[0] ??
    null
  );
}

export function stopNativeReadAloud(): void {
  currentSessionToken += 1;
  setReadingIdSignal(null);
  if (!isNativeTtsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}

export function toggleNativeReadAloud(messageId: string, markdown: string): void {
  if (!isNativeTtsSupported()) {
    actionToast.warning("当前系统环境暂不支持本地语音朗读");
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
  try {
    window.speechSynthesis.cancel();
  } catch {}
  setReadingIdSignal(messageId);

  const isChinese = CJK_REGEX.test(chunks.join(""));
  const rate = Math.min(2, Math.max(0.75, speechSpeed() || 1));

  const speakChunkAt = (index: number) => {
    if (token !== currentSessionToken) return;
    const text = chunks[index];
    if (!text) {
      setReadingIdSignal(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const chunkZh = CJK_REGEX.test(text) || isChinese;
    utterance.lang = chunkZh ? "zh-CN" : "en-US";
    utterance.rate = rate;
    const voice = pickBestVoice(chunkZh);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      if (token !== currentSessionToken) return;
      if (index + 1 < chunks.length) {
        speakChunkAt(index + 1);
      } else {
        setReadingIdSignal(null);
      }
    };

    utterance.onerror = (event) => {
      if (token !== currentSessionToken) return;
      if (event.error === "canceled" || event.error === "interrupted") {
        setReadingIdSignal(null);
        return;
      }
      setReadingIdSignal(null);
      actionToast.error("语音朗读中断，请检查系统音量或语音设置");
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setReadingIdSignal(null);
    }
  };

  // Warm up voices list if needed, and delay 45ms after cancel() to avoid Chromium macOS drop quirk
  try {
    window.speechSynthesis.getVoices();
  } catch {}
  window.setTimeout(() => speakChunkAt(0), 45);
}
