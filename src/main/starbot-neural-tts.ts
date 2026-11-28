import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { SpeechAudio } from "@openbot/contracts/ipc";
import { createOpenBotLogger } from "@openbot/logging";
import { Effect } from "effect";
import { VoiceOperationError } from "./voice-model-service";

const logger = createOpenBotLogger("starbot-neural-tts");

const NEURAL_TTS_TIMEOUT_MS = 28_000;
const WORKER_IDLE_MS = 120_000;
const MAX_CACHE_ENTRIES = 32;
const MAX_CACHE_BYTES = 12 * 1024 * 1024;
const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

// Warm, natural, conversational female neural voices (zero robotic cadence)
const ZH_FEMALE_VOICE = "zh-CN-XiaoxiaoNeural";
const EN_FEMALE_VOICE = "en-US-AvaMultilingualNeural";

const PYTHON_WORKER_SCRIPT = String.raw`
import asyncio, base64, json, os, shutil, socket, struct, subprocess, sys, tempfile
import aiohttp
import edge_tts

# Force IPv4 to avoid multi-second IPv6 fallback stalls on macOS networks
_orig_connector_init = aiohttp.TCPConnector.__init__
def _ipv4_connector_init(self, *args, **kwargs):
    kwargs.setdefault("family", socket.AF_INET)
    _orig_connector_init(self, *args, **kwargs)
aiohttp.TCPConnector.__init__ = _ipv4_connector_init

def find_ffmpeg():
    for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", shutil.which("ffmpeg")):
        if p and os.path.isfile(p):
            return p
    return None

FFMPEG_BIN = find_ffmpeg()
AFCONVERT_BIN = "/usr/bin/afconvert" if os.path.isfile("/usr/bin/afconvert") else None

def extract_wav_pcm(wav_bytes: bytes) -> bytes:
    if len(wav_bytes) < 44 or wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
        return wav_bytes
    offset = 12
    total = len(wav_bytes)
    while offset + 8 <= total:
        chunk_id = wav_bytes[offset:offset + 4]
        chunk_size = struct.unpack_from("<I", wav_bytes, offset + 4)[0]
        data_start = offset + 8
        data_end = min(total, data_start + chunk_size)
        if chunk_id == b"data":
            raw = wav_bytes[data_start:data_end]
            return raw[: len(raw) & ~1]
        offset = data_start + chunk_size + (chunk_size & 1)
    raw = wav_bytes[44:]
    return raw[: len(raw) & ~1]

def mp3_to_pcm24k(mp3_bytes: bytes) -> bytes:
    if FFMPEG_BIN:
        proc = subprocess.run(
            [FFMPEG_BIN, "-v", "error", "-f", "mp3", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1"],
            input=mp3_bytes,
            capture_output=True,
            timeout=15,
        )
        if proc.returncode == 0 and len(proc.stdout) >= 2:
            out = proc.stdout
            return out[: len(out) & ~1]
    if AFCONVERT_BIN:
        mp3_path = None
        wav_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                f.write(mp3_bytes)
                mp3_path = f.name
            wav_path = mp3_path + ".wav"
            subprocess.run(
                [AFCONVERT_BIN, "-f", "WAVE", "-d", "LEI16@24000", "-c", "1", mp3_path, wav_path],
                check=True,
                capture_output=True,
                timeout=15,
            )
            with open(wav_path, "rb") as wf:
                return extract_wav_pcm(wf.read())
        finally:
            for p in (mp3_path, wav_path):
                if p and os.path.exists(p):
                    try:
                        os.unlink(p)
                    except OSError:
                        pass
    raise RuntimeError("No audio decoder (ffmpeg or afconvert) available.")

def emit(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()

async def handle_request(req):
    req_id = req.get("id")
    try:
        text = str(req.get("text") or "").strip()
        voice = str(req.get("voice") or "zh-CN-XiaoxiaoNeural")
        rate = str(req.get("rate") or "+4%")
        pitch = str(req.get("pitch") or "+1Hz")
        if not text:
            emit({"id": req_id, "ok": False, "error": "Empty text"})
            return
        comm = edge_tts.Communicate(text, voice=voice, rate=rate, pitch=pitch)
        mp3 = bytearray()
        async for chunk in comm.stream():
            if chunk.get("type") == "audio":
                mp3.extend(chunk["data"])
        if len(mp3) < 64:
            emit({"id": req_id, "ok": False, "error": "No audio returned"})
            return
        pcm = await asyncio.to_thread(mp3_to_pcm24k, bytes(mp3))
        if len(pcm) < 2:
            emit({"id": req_id, "ok": False, "error": "PCM decode produced empty output"})
            return
        emit({
            "id": req_id,
            "ok": True,
            "sampleRate": 24000,
            "pcmBase64": base64.b64encode(pcm).decode("ascii"),
        })
    except Exception as exc:
        emit({"id": req_id, "ok": False, "error": f"{type(exc).__name__}: {exc}"})

async def main():
    loop = asyncio.get_running_loop()
    tasks = set()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue
        task = asyncio.create_task(handle_request(req))
        tasks.add(task)
        task.add_done_callback(tasks.discard)
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

if __name__ == "__main__":
    asyncio.run(main())
`;

interface PendingSynthesis {
  resolve: (audio: SpeechAudio) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

function findPythonBinary(): string {
  for (const candidate of ["/usr/bin/python3", "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "python3"]) {
    if (candidate === "python3" || existsSync(candidate)) return candidate;
  }
  return "python3";
}

function pickVoiceProfile(text: string): { voice: string; rate: string; pitch: string } {
  if (CJK_REGEX.test(text)) {
    return { voice: ZH_FEMALE_VOICE, rate: "+4%", pitch: "+1Hz" };
  }
  return { voice: EN_FEMALE_VOICE, rate: "+2%", pitch: "+0Hz" };
}

export class StarBotNeuralTts {
  #worker: ChildProcessWithoutNullStreams | null = null;
  #stdoutBuffer = "";
  #nextId = 1;
  #pending = new Map<number, PendingSynthesis>();
  #idleTimer: NodeJS.Timeout | null = null;
  #cache = new Map<string, SpeechAudio>();
  #cacheBytes = 0;

  synthesize(text: string): Effect.Effect<SpeechAudio, VoiceOperationError> {
    return Effect.tryPromise({
      try: () => this.#synthesizeInternal(text),
      catch: (cause) =>
        new VoiceOperationError({
          cause: cause instanceof Error ? cause : new Error(String(cause)),
        }),
    });
  }

  warm(): void {
    try {
      this.#ensureWorker();
      this.#scheduleIdleTimer();
    } catch {}
  }

  shutdown(): void {
    this.#stopWorker(new Error("Neural TTS service shut down."));
    this.#cache.clear();
    this.#cacheBytes = 0;
  }

  async #synthesizeInternal(rawText: string): Promise<SpeechAudio> {
    const text = rawText.trim();
    if (!text) throw new Error("Empty speech text.");
    const profile = pickVoiceProfile(text);
    const cacheKey = `${profile.voice}|${profile.rate}|${profile.pitch}|${text}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) {
      this.#cache.delete(cacheKey);
      this.#cache.set(cacheKey, cached);
      return cached;
    }

    const startedAt = Date.now();
    const audio = await this.#requestWorker({ text, ...profile });
    logger.info(
      `Neural female TTS (${profile.voice}) synthesized ${text.length} chars (${(audio.pcm.byteLength / 2 / audio.sampleRate).toFixed(1)}s) in ${Date.now() - startedAt}ms.`,
    );
    this.#rememberCache(cacheKey, audio);
    return audio;
  }

  #rememberCache(key: string, audio: SpeechAudio): void {
    if (audio.pcm.byteLength > MAX_CACHE_BYTES / 2) return;
    const prev = this.#cache.get(key);
    if (prev) {
      this.#cacheBytes -= prev.pcm.byteLength;
      this.#cache.delete(key);
    }
    this.#cache.set(key, audio);
    this.#cacheBytes += audio.pcm.byteLength;
    while (this.#cache.size > MAX_CACHE_ENTRIES || this.#cacheBytes > MAX_CACHE_BYTES) {
      const oldestKey = this.#cache.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.#cache.get(oldestKey);
      this.#cache.delete(oldestKey);
      if (oldest) this.#cacheBytes -= oldest.pcm.byteLength;
    }
  }

  #requestWorker(payload: { text: string; voice: string; rate: string; pitch: string }): Promise<SpeechAudio> {
    this.#cancelIdleTimer();
    const worker = this.#ensureWorker();
    const id = this.#nextId++;
    return new Promise<SpeechAudio>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.#pending.delete(id)) {
          reject(new Error("Neural TTS timed out."));
          this.#scheduleIdleTimer();
        }
      }, NEURAL_TTS_TIMEOUT_MS);
      timer.unref();
      this.#pending.set(id, { resolve, reject, timer });
      try {
        worker.stdin.write(`${JSON.stringify({ id, ...payload })}\n`);
      } catch (err) {
        clearTimeout(timer);
        this.#pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
        this.#stopWorker(new Error("Neural TTS stdin write failed."));
      }
    });
  }

  #ensureWorker(): ChildProcessWithoutNullStreams {
    if (this.#worker && !this.#worker.killed && this.#worker.exitCode === null) {
      return this.#worker;
    }
    const pythonBin = findPythonBinary();
    const child = spawn(pythonBin, ["-u", "-c", PYTHON_WORKER_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    this.#worker = child;
    this.#stdoutBuffer = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (this.#worker !== child) return;
      this.#stdoutBuffer += chunk;
      for (;;) {
        const idx = this.#stdoutBuffer.indexOf("\n");
        if (idx < 0) break;
        const line = this.#stdoutBuffer.slice(0, idx).trim();
        this.#stdoutBuffer = this.#stdoutBuffer.slice(idx + 1);
        if (!line) continue;
        this.#handleWorkerLine(line);
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      const msg = chunk.trim();
      if (msg) logger.warn("Neural TTS worker stderr:", msg.slice(0, 300));
    });

    child.on("error", (err) => {
      if (this.#worker !== child) return;
      this.#stopWorker(err);
    });

    child.on("exit", (code, signal) => {
      if (this.#worker !== child) return;
      this.#stopWorker(new Error(`Neural TTS worker exited (code=${code}, signal=${signal}).`));
    });

    return child;
  }

  #handleWorkerLine(line: string): void {
    let parsed: { id?: number; ok?: boolean; sampleRate?: number; pcmBase64?: string; error?: string };
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof parsed.id !== "number") return;
    const pending = this.#pending.get(parsed.id);
    if (!pending) return;
    this.#pending.delete(parsed.id);
    clearTimeout(pending.timer);

    if (parsed.ok && typeof parsed.pcmBase64 === "string" && typeof parsed.sampleRate === "number") {
      const buf = Buffer.from(parsed.pcmBase64, "base64");
      const pcm = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength & ~1);
      pending.resolve({ pcm, sampleRate: parsed.sampleRate });
    } else {
      pending.reject(new Error(parsed.error || "Neural TTS synthesis failed."));
    }
    this.#scheduleIdleTimer();
  }

  #scheduleIdleTimer(): void {
    this.#cancelIdleTimer();
    if (!this.#worker || this.#pending.size > 0) return;
    this.#idleTimer = setTimeout(() => {
      this.#stopWorker(new Error("Neural TTS idle shutdown."));
    }, WORKER_IDLE_MS);
    this.#idleTimer.unref();
  }

  #cancelIdleTimer(): void {
    if (this.#idleTimer) {
      clearTimeout(this.#idleTimer);
      this.#idleTimer = null;
    }
  }

  #stopWorker(reason: Error): void {
    this.#cancelIdleTimer();
    const child = this.#worker;
    this.#worker = null;
    this.#stdoutBuffer = "";
    for (const [, pending] of this.#pending) {
      clearTimeout(pending.timer);
      pending.reject(reason);
    }
    this.#pending.clear();
    if (child && !child.killed && child.exitCode === null) {
      try {
        child.kill();
      } catch {}
    }
  }
}
