/**
 * StarBot (星友) — Original Kawaii Web Audio Synthesizer & Mascot Interaction Sound Engine.
 * Features stereo-panned celesta/plush synthesis, soft filtered airy whooshes,
 * 12 zodiac-specific character voice profiles, rapid double-poke celebration giggles,
 * and rich UI/animation cues for every StarBot interaction.
 */

export type KawaiiTheme = "default" | "bubble" | "mech" | "press" | "classic";

export type KawaiiCue =
  | "tap"
  | "select"
  | "tab-switch"
  | "toggle-on"
  | "toggle-off"
  | "open"
  | "close"
  | "drawer-open"
  | "drawer-close"
  | "orbital-bloom"
  | "slide-next"
  | "slide-prev"
  | "navigate"
  | "type"
  | "copy"
  | "delete"
  | "message-send"
  | "reply-start"
  | "loading"
  | "attention"
  | "success"
  | "error"
  | "voice-warn"
  | "voice-stop"
  | "mascot-hover"
  | "mascot-poke"
  | "mascot-double-poke"
  | "mascot-purr"
  | "mascot-happy"
  | "mascot-wake"
  | "mascot-dizzy"
  | "mascot-bubble-pop"
  | "splash-pop"
  | "splash-theme";

export interface KawaiiCueOptions {
  theme?: KawaiiTheme | undefined;
  subtle?: boolean | undefined;
  force?: boolean | undefined;
  zodiac?: string | undefined;
  pan?: number | undefined;
}

interface ZodiacVoiceProfile {
  pitch: number;
  wave: OscillatorType;
  harmonic: number;
  filterHz: number;
}

const ZODIAC_VOICE_PROFILES: Readonly<Record<string, ZodiacVoiceProfile>> = {
  // Fire signs: bright, energetic, sparkling
  aries: { pitch: 1.12, wave: "sine", harmonic: 0.34, filterHz: 4800 },
  leo: { pitch: 0.96, wave: "triangle", harmonic: 0.38, filterHz: 4500 },
  sagittarius: { pitch: 1.08, wave: "sine", harmonic: 0.3, filterHz: 4700 },
  // Earth signs: warm, cozy, plush marimba
  taurus: { pitch: 0.88, wave: "triangle", harmonic: 0.18, filterHz: 3600 },
  virgo: { pitch: 1.16, wave: "sine", harmonic: 0.42, filterHz: 5200 },
  capricorn: { pitch: 0.9, wave: "triangle", harmonic: 0.22, filterHz: 3800 },
  // Air signs: light, breezy, twinkling twin-bell
  gemini: { pitch: 1.2, wave: "sine", harmonic: 0.38, filterHz: 5200 },
  libra: { pitch: 1.04, wave: "sine", harmonic: 0.32, filterHz: 4600 },
  aquarius: { pitch: 1.14, wave: "sine", harmonic: 0.44, filterHz: 5400 },
  // Water signs: dreamy, gentle, aquatic celesta
  cancer: { pitch: 1.0, wave: "sine", harmonic: 0.26, filterHz: 4000 },
  scorpio: { pitch: 0.92, wave: "triangle", harmonic: 0.34, filterHz: 4100 },
  pisces: { pitch: 1.06, wave: "sine", harmonic: 0.36, filterHz: 4300 },
};

const ACTION_SOUNDS_STORAGE_KEY = "openbot:action-sounds-enabled";
const ACTION_SOUNDS_THEME_STORAGE_KEY = "openbot:action-sounds-theme";
const COMPLETION_SOUND_STORAGE_KEY = "openbot:completion-sound-enabled";

let sharedCtx: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;
let pokeVariant = 0;
let lastHoverSoundAt = 0;
let lastOrbitalBloomAt = 0;
let lastTypeSoundAt = 0;
let lastReplyStartAt = 0;

export function isKawaiiActionSoundEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(ACTION_SOUNDS_STORAGE_KEY);
    // Default to enabled ("true") in StarBot unless explicitly turned off ("false")
    return raw !== "false";
  } catch {
    return true;
  }
}

export function isKawaiiTaskSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(COMPLETION_SOUND_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function currentKawaiiTheme(): KawaiiTheme {
  try {
    const saved = window.localStorage.getItem(ACTION_SOUNDS_THEME_STORAGE_KEY);
    if (saved === "bubble" || saved === "mech" || saved === "press" || saved === "default") return saved;
    return "default";
  } catch {
    return "default";
  }
}

export async function getKawaiiAudioContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new Ctor();
      sharedNoiseBuffer = null;
    }
    if (sharedCtx.state === "suspended") {
      await sharedCtx.resume().catch(() => undefined);
    }
    return sharedCtx.state === "running" ? sharedCtx : null;
  } catch {
    return null;
  }
}

export function unlockKawaiiAudio(): void {
  void getKawaiiAudioContext();
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const len = Math.floor(ctx.sampleRate * 0.45);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

interface NoteSpec {
  freq: number;
  endFreq?: number;
  at: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  harmonic?: number;
  thirdHarmonic?: number;
  pan?: number;
  filterHz?: number;
}

function connectWithPan(ctx: AudioContext, source: AudioNode, pan: number): AudioNode | null {
  if (typeof ctx.createStereoPanner === "function" && Math.abs(pan) > 0.01) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    source.connect(panner);
    panner.connect(ctx.destination);
    return panner;
  }
  source.connect(ctx.destination);
  return null;
}

function scheduleNote(ctx: AudioContext, baseTime: number, spec: NoteSpec): void {
  const t0 = baseTime + spec.at;
  const t1 = t0 + spec.dur;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = spec.type ?? "sine";
  osc.frequency.setValueAtTime(Math.max(40, spec.freq), t0);
  if (spec.endFreq && spec.endFreq !== spec.freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, spec.endFreq), t0 + spec.dur * 0.86);
  }

  // Warm kawaii lowpass so highs are silky-sweet, never piercing
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(spec.filterHz ?? 4400, t0);
  filter.Q.setValueAtTime(0.7, t0);

  const attack = Math.min(0.012, spec.dur * 0.2);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.gain), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);

  osc.connect(filter);
  filter.connect(gain);
  const panner = connectWithPan(ctx, gain, spec.pan ?? 0);

  osc.start(t0);
  osc.stop(t1 + 0.012);
  osc.addEventListener(
    "ended",
    () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner?.disconnect();
    },
    { once: true },
  );

  // Optional 2nd harmonic overtone for celesta / sparkle bell feel
  if (spec.harmonic && spec.harmonic > 0) {
    const hOsc = ctx.createOscillator();
    const hGain = ctx.createGain();
    hOsc.type = "sine";
    hOsc.frequency.setValueAtTime(spec.freq * 2, t0);
    if (spec.endFreq) {
      hOsc.frequency.exponentialRampToValueAtTime(spec.endFreq * 2, t0 + spec.dur * 0.8);
    }
    hGain.gain.setValueAtTime(0.0001, t0);
    hGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.gain * spec.harmonic), t0 + attack * 0.8);
    hGain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur * 0.72);
    const hPanner = connectWithPan(ctx, hGain, (spec.pan ?? 0) * 0.85);
    hOsc.connect(hGain);
    hOsc.start(t0);
    hOsc.stop(t0 + spec.dur * 0.75 + 0.012);
    hOsc.addEventListener(
      "ended",
      () => {
        hOsc.disconnect();
        hGain.disconnect();
        hPanner?.disconnect();
      },
      { once: true },
    );
  }

  // Optional subtle 3rd harmonic for crystalline starlight shimmer
  if (spec.thirdHarmonic && spec.thirdHarmonic > 0) {
    const tOsc = ctx.createOscillator();
    const tGain = ctx.createGain();
    tOsc.type = "sine";
    tOsc.frequency.setValueAtTime(spec.freq * 3, t0);
    tGain.gain.setValueAtTime(0.0001, t0);
    tGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.gain * spec.thirdHarmonic), t0 + attack * 0.7);
    tGain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur * 0.52);
    const tPanner = connectWithPan(ctx, tGain, -(spec.pan ?? 0) * 0.5);
    tOsc.connect(tGain);
    tOsc.start(t0);
    tOsc.stop(t0 + spec.dur * 0.55 + 0.012);
    tOsc.addEventListener(
      "ended",
      () => {
        tOsc.disconnect();
        tGain.disconnect();
        tPanner?.disconnect();
      },
      { once: true },
    );
  }
}

interface AirWhooshSpec {
  at: number;
  dur: number;
  startHz: number;
  endHz: number;
  gain: number;
  pan?: number;
}

function scheduleAirWhoosh(ctx: AudioContext, baseTime: number, spec: AirWhooshSpec): void {
  const t0 = baseTime + spec.at;
  const t1 = t0 + spec.dur;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.setValueAtTime(1.4, t0);
  filter.frequency.setValueAtTime(Math.max(120, spec.startHz), t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(120, spec.endHz), t1);

  const gain = ctx.createGain();
  const peakAt = t0 + spec.dur * 0.34;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.gain), peakAt);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);

  src.connect(filter);
  filter.connect(gain);
  const panner = connectWithPan(ctx, gain, spec.pan ?? 0);

  src.start(t0);
  src.stop(t1 + 0.012);
  src.addEventListener(
    "ended",
    () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner?.disconnect();
    },
    { once: true },
  );
}

function themePitchShift(theme: KawaiiTheme): number {
  switch (theme) {
    case "bubble":
      return 1.12;
    case "mech":
      return 1.26; // music-box high celesta register
    case "press":
      return 0.92; // soft plush lower register
    default:
      return 1.0;
  }
}

function themeWave(theme: KawaiiTheme): OscillatorType {
  if (theme === "press") return "triangle";
  return "sine";
}

export async function playKawaiiCue(cue: KawaiiCue, options: KawaiiCueOptions = {}): Promise<void> {
  if (!options.force && !isKawaiiActionSoundEnabled()) return;
  const nowMs = performance.now();
  if (cue === "mascot-hover") {
    if (nowMs - lastHoverSoundAt < 720) return;
    lastHoverSoundAt = nowMs;
  } else if (cue === "orbital-bloom") {
    if (nowMs - lastOrbitalBloomAt < 460) return;
    lastOrbitalBloomAt = nowMs;
  } else if (cue === "type") {
    if (nowMs - lastTypeSoundAt < 38) return;
    lastTypeSoundAt = nowMs;
  } else if (cue === "reply-start") {
    if (nowMs - lastReplyStartAt < 900) return;
    lastReplyStartAt = nowMs;
  }

  const ctx = await getKawaiiAudioContext();
  if (!ctx) return;

  const theme = options.theme ?? currentKawaiiTheme();
  const zProfile = options.zodiac ? ZODIAC_VOICE_PROFILES[options.zodiac.toLowerCase()] : undefined;
  const basePitch = themePitchShift(theme) * (zProfile?.pitch ?? 1.0);
  const mul = basePitch * (0.985 + Math.random() * 0.03);
  const wave = zProfile?.wave ?? themeWave(theme);
  const v = options.subtle ? 0.65 : 1.0;
  const h = zProfile ? zProfile.harmonic : theme === "mech" ? 0.35 : 0.18;
  const fHz = zProfile?.filterHz ?? 4400;
  const basePan = options.pan ?? 0;
  const base = ctx.currentTime + 0.002;

  const play = (notes: NoteSpec[]) => {
    for (const n of notes) {
      scheduleNote(ctx, base, {
        ...n,
        freq: n.freq * mul,
        ...(n.endFreq ? { endFreq: n.endFreq * mul } : {}),
        gain: n.gain * v,
        filterHz: n.filterHz ?? fHz,
        pan: n.pan !== undefined ? n.pan : basePan,
      });
    }
  };

  const whoosh = (spec: AirWhooshSpec) => {
    scheduleAirWhoosh(ctx, base, {
      ...spec,
      gain: spec.gain * v,
      pan: spec.pan !== undefined ? spec.pan : basePan,
    });
  };

  switch (cue) {
    case "tap":
      // Cute gummy droplet pop: quick upward pitch bend
      play([{ freq: 560, endFreq: 860, at: 0, dur: 0.052, gain: 0.095, type: wave, harmonic: h }]);
      break;

    case "select":
    case "navigate":
      // Sweet crisp chirp
      play([{ freq: 660, endFreq: 990, at: 0, dur: 0.058, gain: 0.085, type: wave, harmonic: h }]);
      break;

    case "tab-switch":
      // Silky soft wooden marimba / celesta tick with subtle stereo lift
      play([
        { freq: 720, endFreq: 960, at: 0, dur: 0.045, gain: 0.072, type: "sine", harmonic: 0.24, pan: -0.14 },
        { freq: 1080, at: 0.024, dur: 0.055, gain: 0.052, type: "sine", harmonic: 0.3, pan: 0.14 },
      ]);
      break;

    case "toggle-on":
      // Happy upward 2-note "啵·啾!"
      play([
        { freq: 659.25, endFreq: 740, at: 0, dur: 0.055, gain: 0.095, type: wave, harmonic: h, pan: -0.15 },
        { freq: 987.77, endFreq: 1174.66, at: 0.048, dur: 0.085, gain: 0.11, type: wave, harmonic: 0.25, pan: 0.15 },
      ]);
      break;

    case "toggle-off":
      // Cozy tuck-in 2-note "啾·啵~"
      play([
        { freq: 880, endFreq: 784, at: 0, dur: 0.052, gain: 0.085, type: wave, pan: 0.12 },
        { freq: 659.25, endFreq: 523.25, at: 0.046, dur: 0.08, gain: 0.085, type: wave, pan: -0.12 },
      ]);
      break;

    case "open":
      // Dreamy miniature harp/starlight glissando
      whoosh({ at: 0, dur: 0.12, startHz: 750, endHz: 2400, gain: 0.024 });
      play([
        { freq: 587.33, at: 0, dur: 0.075, gain: 0.07, type: "sine", harmonic: 0.22, pan: -0.22 },
        { freq: 783.99, at: 0.038, dur: 0.085, gain: 0.08, type: "sine", harmonic: 0.25, pan: 0 },
        { freq: 1046.5, at: 0.076, dur: 0.12, gain: 0.085, type: "sine", harmonic: 0.3, pan: 0.22 },
      ]);
      break;

    case "close":
      // Soft bedtime descending chime
      whoosh({ at: 0, dur: 0.1, startHz: 1800, endHz: 620, gain: 0.02 });
      play([
        { freq: 880, at: 0, dur: 0.065, gain: 0.07, type: "sine", harmonic: 0.15, pan: 0.15 },
        { freq: 587.33, at: 0.042, dur: 0.095, gain: 0.075, type: "sine", pan: -0.15 },
      ]);
      break;

    case "drawer-open":
      // Airy silk panel glide + delicate sparkle bell (QuickAsk / Help / Modals)
      whoosh({ at: 0, dur: 0.15, startHz: 600, endHz: 2600, gain: 0.032 });
      play([
        { freq: 659.25, endFreq: 880, at: 0.02, dur: 0.08, gain: 0.075, type: "sine", harmonic: 0.26, pan: -0.2 },
        {
          freq: 1318.51,
          at: 0.068,
          dur: 0.14,
          gain: 0.082,
          type: "sine",
          harmonic: 0.34,
          thirdHarmonic: 0.1,
          pan: 0.2,
        },
      ]);
      break;

    case "drawer-close":
      // Soft tuck-away breeze
      whoosh({ at: 0, dur: 0.12, startHz: 2100, endHz: 560, gain: 0.026 });
      play([{ freq: 783.99, endFreq: 523.25, at: 0.015, dur: 0.09, gain: 0.068, type: "sine", harmonic: 0.16 }]);
      break;

    case "orbital-bloom":
      // Feather-light silky whoosh + 3 stereo starlight petal droplets when floating companion menu blooms open
      whoosh({ at: 0, dur: 0.1, startHz: 950, endHz: 3000, gain: 0.022 });
      play([
        { freq: 987.77, endFreq: 1174.66, at: 0, dur: 0.06, gain: 0.068, type: "sine", harmonic: 0.28, pan: -0.26 },
        { freq: 1318.51, at: 0.036, dur: 0.072, gain: 0.074, type: "sine", harmonic: 0.32, pan: 0 },
        {
          freq: 1760.0,
          at: 0.074,
          dur: 0.115,
          gain: 0.078,
          type: "sine",
          harmonic: 0.36,
          thirdHarmonic: 0.1,
          pan: 0.26,
        },
      ]);
      break;

    case "slide-next":
      // Crisp bubbly card flip / next step chime
      whoosh({ at: 0, dur: 0.09, startHz: 900, endHz: 2800, gain: 0.022, pan: 0.18 });
      play([
        { freq: 783.99, at: 0, dur: 0.065, gain: 0.08, type: "sine", harmonic: 0.28, pan: -0.18 },
        { freq: 1174.66, at: 0.045, dur: 0.11, gain: 0.09, type: "sine", harmonic: 0.34, pan: 0.22 },
      ]);
      break;

    case "slide-prev":
      // Gentle step-back card flip
      whoosh({ at: 0, dur: 0.09, startHz: 2200, endHz: 850, gain: 0.02, pan: -0.18 });
      play([
        { freq: 987.77, at: 0, dur: 0.06, gain: 0.075, type: "sine", harmonic: 0.22, pan: 0.18 },
        { freq: 739.99, at: 0.042, dur: 0.095, gain: 0.075, type: "sine", harmonic: 0.2, pan: -0.18 },
      ]);
      break;

    case "type":
      // Ultra-soft bubble keystroke
      play([
        {
          freq: 480 + Math.random() * 90,
          endFreq: 680 + Math.random() * 90,
          at: 0,
          dur: 0.032,
          gain: 0.042,
          type: "sine",
          pan: (Math.random() - 0.5) * 0.22,
        },
      ]);
      break;

    case "copy":
      // Crisp twin crystal sparkle ("叮·铃!") when copying text/code
      play([
        { freq: 1318.51, at: 0, dur: 0.068, gain: 0.082, type: "sine", harmonic: 0.35, pan: -0.16 },
        {
          freq: 1760.0,
          at: 0.052,
          dur: 0.13,
          gain: 0.092,
          type: "sine",
          harmonic: 0.4,
          thirdHarmonic: 0.12,
          pan: 0.18,
        },
      ]);
      break;

    case "delete":
      // Soft descending plush poof
      whoosh({ at: 0, dur: 0.11, startHz: 1500, endHz: 420, gain: 0.028 });
      play([{ freq: 622.25, endFreq: 392.0, at: 0.01, dur: 0.1, gain: 0.075, type: "triangle" }]);
      break;

    case "message-send":
      // Crisp joyful paper-plane launch whoosh + luminous bubble pop!
      whoosh({ at: 0, dur: 0.13, startHz: 850, endHz: 3400, gain: 0.03 });
      play([
        { freq: 587.33, endFreq: 987.77, at: 0, dur: 0.072, gain: 0.092, type: "sine", harmonic: 0.24, pan: -0.18 },
        { freq: 1174.66, endFreq: 1567.98, at: 0.05, dur: 0.115, gain: 0.098, type: "sine", harmonic: 0.34, pan: 0.22 },
      ]);
      break;

    case "reply-start":
      // Gentle incoming starlight ripple when a StarBot companion starts thinking/replying
      play([
        { freq: 880.0, at: 0, dur: 0.09, gain: 0.058, type: "sine", harmonic: 0.28, pan: -0.22 },
        {
          freq: 1174.66,
          at: 0.055,
          dur: 0.14,
          gain: 0.065,
          type: "sine",
          harmonic: 0.32,
          thirdHarmonic: 0.1,
          pan: 0.22,
        },
      ]);
      break;

    case "loading":
      play([
        { freq: 659.25, endFreq: 783.99, at: 0, dur: 0.07, gain: 0.07, type: "sine", harmonic: 0.2, pan: -0.12 },
        { freq: 783.99, endFreq: 987.77, at: 0.075, dur: 0.09, gain: 0.075, type: "sine", harmonic: 0.22, pan: 0.12 },
      ]);
      break;

    case "attention":
      // Cute curious "叮·咚?~"
      play([
        { freq: 783.99, at: 0, dur: 0.085, gain: 0.105, type: "sine", harmonic: 0.3, pan: -0.2 },
        { freq: 1174.66, endFreq: 1318.5, at: 0.082, dur: 0.16, gain: 0.115, type: "sine", harmonic: 0.35, pan: 0.2 },
      ]);
      break;

    case "success":
      // Cheerful 4-note stereo StarBot completion sparkle fanfare (C6 -> E6 -> G6 -> C7)
      play([
        { freq: 1046.5, at: 0, dur: 0.095, gain: 0.105, type: "sine", harmonic: 0.32, pan: -0.35 },
        { freq: 1318.51, at: 0.068, dur: 0.105, gain: 0.11, type: "sine", harmonic: 0.32, pan: -0.12 },
        { freq: 1567.98, at: 0.136, dur: 0.12, gain: 0.115, type: "sine", harmonic: 0.36, pan: 0.14 },
        { freq: 2093.0, at: 0.21, dur: 0.3, gain: 0.13, type: "sine", harmonic: 0.4, thirdHarmonic: 0.12, pan: 0.32 },
      ]);
      break;

    case "error":
      // Gentle sympathetic plush "呜·哦~" (never harsh)
      play([
        { freq: 523.25, endFreq: 466.16, at: 0, dur: 0.11, gain: 0.095, type: "triangle", pan: -0.12 },
        { freq: 415.3, endFreq: 349.23, at: 0.1, dur: 0.19, gain: 0.095, type: "triangle", pan: 0.12 },
      ]);
      break;

    case "voice-warn":
      play([
        { freq: 987.77, at: 0, dur: 0.08, gain: 0.08, type: "sine", harmonic: 0.2 },
        { freq: 1174.66, at: 0.11, dur: 0.1, gain: 0.085, type: "sine", harmonic: 0.2 },
      ]);
      break;

    case "voice-stop":
      play([
        { freq: 880, at: 0, dur: 0.11, gain: 0.1, type: "sine", harmonic: 0.18 },
        { freq: 659.25, at: 0.1, dur: 0.2, gain: 0.1, type: "sine" },
      ]);
      break;

    case "mascot-hover":
      // Cute zodiac-tuned curious greeting chirp when mouse approaches character ("啾~")
      play([
        { freq: 740, endFreq: 1108.73, at: 0, dur: 0.075, gain: 0.074, type: wave, harmonic: Math.max(h, 0.26) },
        { freq: 1479.98, at: 0.045, dur: 0.075, gain: 0.036, type: "sine", harmonic: 0.3, pan: 0.18 },
      ]);
      break;

    case "mascot-poke": {
      // Cycles through 6 adorable zodiac-tuned plush interactive reactions on click!
      const kind = pokeVariant++ % 6;
      if (kind === 0) {
        // 1. Happy squishy jump ("噗·啾!~")
        play([
          { freq: 523.25, endFreq: 880, at: 0, dur: 0.068, gain: 0.115, type: wave, harmonic: 0.22, pan: -0.18 },
          {
            freq: 1046.5,
            endFreq: 1567.98,
            at: 0.062,
            dur: 0.145,
            gain: 0.125,
            type: "sine",
            harmonic: 0.36,
            pan: 0.18,
          },
        ]);
      } else if (kind === 1) {
        // 2. Starlight giggle ("叮·铃·铃~")
        play([
          { freq: 1174.66, at: 0, dur: 0.065, gain: 0.1, type: "sine", harmonic: 0.35, pan: -0.25 },
          { freq: 1396.91, at: 0.052, dur: 0.065, gain: 0.105, type: "sine", harmonic: 0.35, pan: 0 },
          {
            freq: 1760.0,
            at: 0.104,
            dur: 0.18,
            gain: 0.12,
            type: "sine",
            harmonic: 0.42,
            thirdHarmonic: 0.12,
            pan: 0.25,
          },
        ]);
      } else if (kind === 2) {
        // 3. Elastic jelly boing ("啵·잉~")
        play([
          { freq: 440, endFreq: 987.77, at: 0, dur: 0.11, gain: 0.115, type: "triangle", harmonic: 0.2 },
          { freq: 1318.51, at: 0.085, dur: 0.14, gain: 0.105, type: "sine", harmonic: 0.32, pan: 0.15 },
        ]);
      } else if (kind === 3) {
        // 4. Sweet affectionate chirp ("咪·呜~")
        play([
          { freq: 1046.5, endFreq: 880, at: 0, dur: 0.072, gain: 0.1, type: wave, harmonic: 0.25, pan: -0.14 },
          {
            freq: 987.77,
            endFreq: 1396.91,
            at: 0.068,
            dur: 0.165,
            gain: 0.12,
            type: "sine",
            harmonic: 0.34,
            pan: 0.16,
          },
        ]);
      } else if (kind === 4) {
        // 5. Twin-star playful bounce ("哒·滴·哒!")
        play([
          { freq: 880, endFreq: 1046.5, at: 0, dur: 0.055, gain: 0.095, type: "sine", harmonic: 0.3, pan: -0.28 },
          { freq: 1318.51, at: 0.052, dur: 0.06, gain: 0.1, type: "sine", harmonic: 0.32, pan: 0.28 },
          { freq: 1567.98, endFreq: 1760, at: 0.105, dur: 0.15, gain: 0.115, type: "sine", harmonic: 0.38, pan: 0 },
        ]);
      } else {
        // 6. Soft clay squeak-hop ("噗叽~✨")
        whoosh({ at: 0, dur: 0.07, startHz: 1100, endHz: 3200, gain: 0.022 });
        play([
          { freq: 659.25, endFreq: 1174.66, at: 0, dur: 0.082, gain: 0.11, type: wave, harmonic: 0.26 },
          {
            freq: 1975.53,
            at: 0.072,
            dur: 0.15,
            gain: 0.085,
            type: "sine",
            harmonic: 0.38,
            thirdHarmonic: 0.1,
            pan: 0.2,
          },
        ]);
      }
      break;
    }

    case "mascot-double-poke":
      // Excited double-tap giggle + stereo starlight confetti celebration!
      whoosh({ at: 0, dur: 0.14, startHz: 1200, endHz: 4600, gain: 0.032 });
      play([
        { freq: 880, endFreq: 1318.51, at: 0, dur: 0.07, gain: 0.11, type: wave, harmonic: 0.3, pan: -0.35 },
        {
          freq: 1174.66,
          endFreq: 1567.98,
          at: 0.055,
          dur: 0.075,
          gain: 0.115,
          type: "sine",
          harmonic: 0.34,
          pan: 0.35,
        },
        { freq: 1567.98, at: 0.11, dur: 0.09, gain: 0.115, type: "sine", harmonic: 0.38, pan: -0.22 },
        { freq: 1975.53, at: 0.165, dur: 0.11, gain: 0.12, type: "sine", harmonic: 0.4, pan: 0.22 },
        { freq: 2349.32, at: 0.225, dur: 0.26, gain: 0.125, type: "sine", harmonic: 0.44, thirdHarmonic: 0.14, pan: 0 },
      ]);
      break;

    case "mascot-purr":
      // Warm cozy companionship purr + dreamy stereo starlight lullaby when hovering >= 1.5s!
      play([
        { freq: 220, endFreq: 246.94, at: 0, dur: 0.24, gain: 0.058, type: "triangle", pan: -0.18 },
        { freq: 246.94, endFreq: 261.63, at: 0.21, dur: 0.26, gain: 0.058, type: "triangle", pan: 0.18 },
        { freq: 1046.5, at: 0.06, dur: 0.18, gain: 0.078, type: "sine", harmonic: 0.3, pan: -0.32 },
        { freq: 1318.51, at: 0.19, dur: 0.2, gain: 0.084, type: "sine", harmonic: 0.34, pan: 0 },
        { freq: 1567.98, at: 0.32, dur: 0.3, gain: 0.092, type: "sine", harmonic: 0.38, thirdHarmonic: 0.1, pan: 0.32 },
      ]);
      break;

    case "mascot-happy":
      // Joyful sparkling personality/mood cheer ("太棒啦!✨")
      play([
        { freq: 783.99, endFreq: 1046.5, at: 0, dur: 0.075, gain: 0.095, type: wave, harmonic: 0.28, pan: -0.25 },
        { freq: 1318.51, at: 0.065, dur: 0.09, gain: 0.105, type: "sine", harmonic: 0.34, pan: 0.25 },
        { freq: 1567.98, at: 0.13, dur: 0.18, gain: 0.115, type: "sine", harmonic: 0.38, thirdHarmonic: 0.12, pan: 0 },
      ]);
      break;

    case "mascot-wake":
      // Curious bright wake-up chime
      play([
        { freq: 659.25, endFreq: 987.77, at: 0, dur: 0.08, gain: 0.082, type: "sine", harmonic: 0.24, pan: -0.15 },
        { freq: 1318.51, endFreq: 1479.98, at: 0.07, dur: 0.13, gain: 0.09, type: "sine", harmonic: 0.32, pan: 0.15 },
      ]);
      break;

    case "mascot-dizzy":
      // Soft cartoonish plush wobble swirl ("呜哇哇~")
      play([
        { freq: 720, endFreq: 460, at: 0, dur: 0.11, gain: 0.072, type: "triangle", pan: -0.2 },
        { freq: 640, endFreq: 410, at: 0.095, dur: 0.12, gain: 0.072, type: "triangle", pan: 0.2 },
        { freq: 560, endFreq: 360, at: 0.195, dur: 0.14, gain: 0.068, type: "triangle", pan: 0 },
      ]);
      break;

    case "mascot-bubble-pop":
      // Crisp tiny sleep-bubble pop + cute surprised wake blip!
      play([
        { freq: 1380, endFreq: 1960, at: 0, dur: 0.042, gain: 0.088, type: "sine", harmonic: 0.3 },
        { freq: 880, endFreq: 1174.66, at: 0.045, dur: 0.08, gain: 0.072, type: "sine", harmonic: 0.24 },
      ]);
      break;

    case "splash-pop":
      // Blind-box festive pop + stereo sparkle arpeggio
      whoosh({ at: 0, dur: 0.22, startHz: 1000, endHz: 5200, gain: 0.045 });
      play([
        { freq: 392, endFreq: 783.99, at: 0, dur: 0.095, gain: 0.115, type: "sine", harmonic: 0.22 },
        { freq: 1046.5, at: 0.08, dur: 0.13, gain: 0.095, type: "sine", harmonic: 0.35, pan: -0.4 },
        { freq: 1318.51, at: 0.145, dur: 0.14, gain: 0.1, type: "sine", harmonic: 0.35, pan: -0.15 },
        { freq: 1567.98, at: 0.21, dur: 0.17, gain: 0.105, type: "sine", harmonic: 0.38, pan: 0.15 },
        {
          freq: 2093.0,
          at: 0.285,
          dur: 0.36,
          gain: 0.125,
          type: "sine",
          harmonic: 0.44,
          thirdHarmonic: 0.14,
          pan: 0.35,
        },
      ]);
      break;

    case "splash-theme":
      // Lush 1.6s stereo StarBot brand harp chord (used for reduced-motion / fallback splash)
      whoosh({ at: 0, dur: 0.32, startHz: 650, endHz: 3200, gain: 0.036 });
      play([
        { freq: 523.25, at: 0.04, dur: 0.65, gain: 0.085, type: "sine", harmonic: 0.28, pan: -0.45 },
        { freq: 659.25, at: 0.11, dur: 0.65, gain: 0.088, type: "sine", harmonic: 0.3, pan: -0.25 },
        { freq: 783.99, at: 0.18, dur: 0.7, gain: 0.092, type: "sine", harmonic: 0.32, pan: -0.05 },
        { freq: 987.77, at: 0.25, dur: 0.75, gain: 0.095, type: "sine", harmonic: 0.34, pan: 0.15 },
        { freq: 1174.66, at: 0.32, dur: 0.85, gain: 0.1, type: "sine", harmonic: 0.38, pan: 0.35 },
        {
          freq: 1567.98,
          at: 0.4,
          dur: 0.95,
          gain: 0.105,
          type: "sine",
          harmonic: 0.42,
          thirdHarmonic: 0.12,
          pan: 0.45,
        },
        { freq: 2093.0, at: 0.5, dur: 1.05, gain: 0.115, type: "sine", harmonic: 0.46, thirdHarmonic: 0.15, pan: 0 },
      ]);
      break;
  }
}
