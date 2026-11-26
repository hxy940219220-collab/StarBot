/**
 * StarBot (星友) — Original Kawaii Web Audio Synthesizer & Mascot Interaction Sound Engine.
 * Replaces OpenBot/cuelume wooden/mechanical clicks with warm, cute plush/bubble/chime sounds,
 * plus dedicated interactive character sounds for hover approach, click/poke, and long-hover petting.
 */

export type KawaiiTheme = "default" | "bubble" | "mech" | "press" | "classic";
export type KawaiiCue =
  | "tap"
  | "select"
  | "toggle-on"
  | "toggle-off"
  | "open"
  | "close"
  | "navigate"
  | "type"
  | "loading"
  | "attention"
  | "success"
  | "error"
  | "voice-warn"
  | "voice-stop"
  | "mascot-hover"
  | "mascot-poke"
  | "mascot-purr"
  | "splash-pop";

const ACTION_SOUNDS_STORAGE_KEY = "openbot:action-sounds-enabled";
const ACTION_SOUNDS_THEME_STORAGE_KEY = "openbot:action-sounds-theme";
const COMPLETION_SOUND_STORAGE_KEY = "openbot:completion-sound-enabled";

let sharedCtx: AudioContext | null = null;
let pokeVariant = 0;
let lastHoverSoundAt = 0;
let lastTypeSoundAt = 0;

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
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new Ctor();
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

interface NoteSpec {
  freq: number;
  endFreq?: number;
  at: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  harmonic?: number;
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
  filter.frequency.setValueAtTime(4200, t0);
  filter.Q.setValueAtTime(0.7, t0);

  const attack = Math.min(0.012, spec.dur * 0.2);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.gain), t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t1);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t1 + 0.01);
  osc.addEventListener(
    "ended",
    () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    },
    { once: true },
  );

  // Optional bell overtone for celesta / sparkle feel
  if (spec.harmonic && spec.harmonic > 0) {
    const hOsc = ctx.createOscillator();
    const hGain = ctx.createGain();
    hOsc.type = "sine";
    hOsc.frequency.setValueAtTime(spec.freq * 2, t0);
    if (spec.endFreq) {
      hOsc.frequency.exponentialRampToValueAtTime(spec.endFreq * 2, t0 + spec.dur * 0.8);
    }
    hGain.gain.setValueAtTime(0.0001, t0);
    hGain.gain.exponentialRampToValueAtTime(spec.gain * spec.harmonic, t0 + attack * 0.8);
    hGain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur * 0.72);
    hOsc.connect(hGain);
    hGain.connect(ctx.destination);
    hOsc.start(t0);
    hOsc.stop(t0 + spec.dur * 0.75 + 0.01);
    hOsc.addEventListener(
      "ended",
      () => {
        hOsc.disconnect();
        hGain.disconnect();
      },
      { once: true },
    );
  }
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

export async function playKawaiiCue(
  cue: KawaiiCue,
  options: { theme?: KawaiiTheme; subtle?: boolean; force?: boolean } = {},
): Promise<void> {
  if (!options.force && !isKawaiiActionSoundEnabled()) return;
  const nowMs = performance.now();
  if (cue === "mascot-hover") {
    if (nowMs - lastHoverSoundAt < 850) return;
    lastHoverSoundAt = nowMs;
  } else if (cue === "type") {
    if (nowMs - lastTypeSoundAt < 38) return;
    lastTypeSoundAt = nowMs;
  }

  const ctx = await getKawaiiAudioContext();
  if (!ctx) return;

  const theme = options.theme ?? currentKawaiiTheme();
  const mul = themePitchShift(theme) * (0.985 + Math.random() * 0.03);
  const wave = themeWave(theme);
  const v = options.subtle ? 0.65 : 1.0;
  const h = theme === "mech" ? 0.35 : 0.16;
  const base = ctx.currentTime + 0.002;

  const play = (notes: NoteSpec[]) => {
    for (const n of notes) {
      scheduleNote(ctx, base, {
        ...n,
        freq: n.freq * mul,
        ...(n.endFreq ? { endFreq: n.endFreq * mul } : {}),
        gain: n.gain * v,
      });
    }
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

    case "toggle-on":
      // Happy upward 2-note "啵·啾!"
      play([
        { freq: 659.25, endFreq: 740, at: 0, dur: 0.055, gain: 0.095, type: wave, harmonic: h },
        { freq: 987.77, endFreq: 1174.66, at: 0.048, dur: 0.085, gain: 0.11, type: wave, harmonic: 0.25 },
      ]);
      break;

    case "toggle-off":
      // Cozy tuck-in 2-note "啾·啵~"
      play([
        { freq: 880, endFreq: 784, at: 0, dur: 0.052, gain: 0.085, type: wave },
        { freq: 659.25, endFreq: 523.25, at: 0.046, dur: 0.08, gain: 0.085, type: wave },
      ]);
      break;

    case "open":
      // Dreamy miniature harp/starlight glissando
      play([
        { freq: 587.33, at: 0, dur: 0.075, gain: 0.07, type: "sine", harmonic: 0.22 },
        { freq: 783.99, at: 0.038, dur: 0.085, gain: 0.08, type: "sine", harmonic: 0.25 },
        { freq: 1046.5, at: 0.076, dur: 0.12, gain: 0.085, type: "sine", harmonic: 0.3 },
      ]);
      break;

    case "close":
      // Soft bedtime descending chime
      play([
        { freq: 880, at: 0, dur: 0.065, gain: 0.07, type: "sine", harmonic: 0.15 },
        { freq: 587.33, at: 0.042, dur: 0.095, gain: 0.075, type: "sine" },
      ]);
      break;

    case "type":
      // Ultra-soft bubble keystroke
      play([{ freq: 480 + Math.random() * 90, endFreq: 680 + Math.random() * 90, at: 0, dur: 0.032, gain: 0.042, type: "sine" }]);
      break;

    case "loading":
      play([
        { freq: 659.25, endFreq: 783.99, at: 0, dur: 0.07, gain: 0.07, type: "sine", harmonic: 0.2 },
        { freq: 783.99, endFreq: 987.77, at: 0.075, dur: 0.09, gain: 0.075, type: "sine", harmonic: 0.22 },
      ]);
      break;

    case "attention":
      // Cute curious "叮·咚?~"
      play([
        { freq: 783.99, at: 0, dur: 0.085, gain: 0.105, type: "sine", harmonic: 0.3 },
        { freq: 1174.66, endFreq: 1318.5, at: 0.082, dur: 0.16, gain: 0.115, type: "sine", harmonic: 0.35 },
      ]);
      break;

    case "success":
      // Cheerful 4-note StarBot completion sparkle fanfare (C6 -> E6 -> G6 -> C7)
      play([
        { freq: 1046.5, at: 0, dur: 0.095, gain: 0.105, type: "sine", harmonic: 0.32 },
        { freq: 1318.51, at: 0.068, dur: 0.105, gain: 0.11, type: "sine", harmonic: 0.32 },
        { freq: 1567.98, at: 0.136, dur: 0.12, gain: 0.115, type: "sine", harmonic: 0.36 },
        { freq: 2093.0, at: 0.21, dur: 0.28, gain: 0.13, type: "sine", harmonic: 0.4 },
      ]);
      break;

    case "error":
      // Gentle sympathetic plush "呜·哦~" (never harsh)
      play([
        { freq: 523.25, endFreq: 466.16, at: 0, dur: 0.11, gain: 0.095, type: "triangle" },
        { freq: 415.3, endFreq: 349.23, at: 0.1, dur: 0.19, gain: 0.095, type: "triangle" },
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
      // Cute curious greeting chirp when mouse approaches character ("啾~")
      play([
        { freq: 740, endFreq: 1108.73, at: 0, dur: 0.072, gain: 0.072, type: "sine", harmonic: 0.24 },
      ]);
      break;

    case "mascot-poke": {
      // Cycles through 4 adorable plush interactive reactions on click!
      const kind = pokeVariant++ % 4;
      if (kind === 0) {
        // 1. Happy squishy jump ("噗·啾!~")
        play([
          { freq: 523.25, endFreq: 880, at: 0, dur: 0.068, gain: 0.115, type: "sine", harmonic: 0.22 },
          { freq: 1046.5, endFreq: 1567.98, at: 0.062, dur: 0.14, gain: 0.125, type: "sine", harmonic: 0.35 },
        ]);
      } else if (kind === 1) {
        // 2. Starlight giggle ("叮·铃·铃~")
        play([
          { freq: 1174.66, at: 0, dur: 0.065, gain: 0.1, type: "sine", harmonic: 0.35 },
          { freq: 1396.91, at: 0.055, dur: 0.065, gain: 0.105, type: "sine", harmonic: 0.35 },
          { freq: 1760.0, at: 0.11, dur: 0.18, gain: 0.12, type: "sine", harmonic: 0.4 },
        ]);
      } else if (kind === 2) {
        // 3. Elastic jelly boing ("啵·잉~")
        play([
          { freq: 440, endFreq: 987.77, at: 0, dur: 0.11, gain: 0.115, type: "triangle", harmonic: 0.18 },
          { freq: 1318.51, at: 0.085, dur: 0.13, gain: 0.1, type: "sine", harmonic: 0.3 },
        ]);
      } else {
        // 4. Sweet affectionate chirp ("咪·呜~")
        play([
          { freq: 1046.5, endFreq: 880, at: 0, dur: 0.07, gain: 0.1, type: "sine", harmonic: 0.25 },
          { freq: 987.77, endFreq: 1396.91, at: 0.068, dur: 0.16, gain: 0.12, type: "sine", harmonic: 0.32 },
        ]);
      }
      break;
    }

    case "mascot-purr":
      // Warm cozy companionship purr + gentle starlight lullaby when hovering >= 1.5s!
      play([
        { freq: 220, endFreq: 246.94, at: 0, dur: 0.22, gain: 0.055, type: "triangle" },
        { freq: 246.94, endFreq: 261.63, at: 0.2, dur: 0.24, gain: 0.055, type: "triangle" },
        { freq: 1046.5, at: 0.06, dur: 0.16, gain: 0.075, type: "sine", harmonic: 0.3 },
        { freq: 1318.51, at: 0.19, dur: 0.18, gain: 0.08, type: "sine", harmonic: 0.32 },
        { freq: 1567.98, at: 0.32, dur: 0.28, gain: 0.09, type: "sine", harmonic: 0.36 },
      ]);
      break;

    case "splash-pop":
      // Blind-box festive pop + sparkle arpeggio
      play([
        { freq: 392, endFreq: 783.99, at: 0, dur: 0.09, gain: 0.11, type: "sine", harmonic: 0.2 },
        { freq: 1046.5, at: 0.08, dur: 0.12, gain: 0.095, type: "sine", harmonic: 0.35 },
        { freq: 1318.51, at: 0.15, dur: 0.14, gain: 0.1, type: "sine", harmonic: 0.35 },
        { freq: 1567.98, at: 0.22, dur: 0.16, gain: 0.105, type: "sine", harmonic: 0.38 },
        { freq: 2093.0, at: 0.3, dur: 0.32, gain: 0.12, type: "sine", harmonic: 0.42 },
      ]);
      break;
  }
}
