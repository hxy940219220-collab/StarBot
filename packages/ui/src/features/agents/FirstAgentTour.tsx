import { Portal } from "@solidjs/web";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

export interface FirstAgentTourStep {
  target: "zodiac" | "name" | "model" | "persona" | "submit";
  badge: string;
  title: string;
  hint: string;
  placement: "left" | "top" | "bottom";
}

const TOUR_STORAGE_KEY = "starbot:first-agent-tour-v2";

const TOUR_STEPS: readonly FirstAgentTourStep[] = [
  {
    target: "zodiac",
    badge: "1 / 5",
    title: "挑一只喜欢的星友",
    hint: "12 星座软陶都有专属微动作与釉色，点击即可切换",
    placement: "left",
  },
  {
    target: "name",
    badge: "2 / 5",
    title: "给它起个专属名字",
    hint: "填上喜欢的称呼，对话时它会带着这个专属名字回应你",
    placement: "left",
  },
  {
    target: "model",
    badge: "3 / 5",
    title: "选好驱动模型",
    hint: "支持本机 GPT / Gemini / Claude / Grok 及 14+ 第三方 API",
    placement: "left",
  },
  {
    target: "persona",
    badge: "4 / 5",
    title: "赋予它性格与职责",
    hint: "选填但超关键：写下它的身份、说话语气以及擅长负责的领域",
    placement: "left",
  },
  {
    target: "submit",
    badge: "5 / 5",
    title: "点这里唤醒星友",
    hint: "创建后在右侧栏也能随时调整记忆、模型与人设",
    placement: "top",
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const REPLAY_FIRST_AGENT_TOUR_EVENT = "starbot:replay-first-agent-tour";

let pendingTourReplay = false;

export function requestFirstAgentTourReplay(): void {
  pendingTourReplay = true;
  try {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPLAY_FIRST_AGENT_TOUR_EVENT));
  }
}

export function consumePendingFirstAgentTourReplay(): boolean {
  if (!pendingTourReplay) return false;
  pendingTourReplay = false;
  return true;
}

export function shouldAutoRunFirstAgentTour(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) !== "done";
  } catch {
    return false;
  }
}

export function markFirstAgentTourDone(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {}
}

export function FirstAgentTour(props: {
  open: boolean;
  container: () => HTMLElement | undefined;
  onFinish: () => void;
}) {
  const [stepIndex, setStepIndex] = createSignal(0);
  const [rect, setRect] = createSignal<TargetRect | null>(null);

  const step = () => TOUR_STEPS[stepIndex()] ?? TOUR_STEPS[0]!;
  const isLast = () => stepIndex() >= TOUR_STEPS.length - 1;

  function finish(): void {
    markFirstAgentTourDone();
    setStepIndex(0);
    props.onFinish();
  }

  function next(): void {
    if (isLast()) {
      finish();
      return;
    }
    setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
  }

  function prev(): void {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function measure(): void {
    if (!props.open) {
      setRect(null);
      return;
    }
    const root = props.container() ?? document;
    const el = root.querySelector<HTMLElement>(`[data-tour-target="${step().target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      setRect(null);
      return;
    }
    const pad = 7;
    setRect({
      top: Math.max(8, r.top - pad),
      left: Math.max(8, r.left - pad),
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }

  createEffect(
    () => [props.open, stepIndex()] as const,
    ([open]) => {
      if (!open) {
        setRect(null);
        return;
      }
      const root = props.container() ?? document;
      const el = root.querySelector<HTMLElement>(`[data-tour-target="${step().target}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const raf = requestAnimationFrame(measure);
      const timer = window.setTimeout(() => {
        measure();
        if (!rect()) finish();
      }, 220);
      const onLayout = () => measure();
      const isEditableEl = (target: EventTarget | null): boolean => {
        if (!(target instanceof HTMLElement)) return false;
        return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      };
      const onKey = (event: KeyboardEvent) => {
        if (!rect()) return;
        if (event.key === "Escape") {
          event.preventDefault();
          finish();
          return;
        }
        if (isEditableEl(event.target) || isEditableEl(document.activeElement)) return;
        if (event.key === "ArrowRight" || event.key === "Enter") {
          event.preventDefault();
          next();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          prev();
        }
      };
      window.addEventListener("resize", onLayout, { passive: true });
      window.addEventListener("scroll", onLayout, { passive: true, capture: true });
      window.addEventListener("keydown", onKey);
      onCleanup(() => {
        cancelAnimationFrame(raf);
        window.clearTimeout(timer);
        window.removeEventListener("resize", onLayout);
        window.removeEventListener("scroll", onLayout, { capture: true });
        window.removeEventListener("keydown", onKey);
      });
    },
  );

  // Compute floating popover + animated arrow placement relative to viewport
  const cardLayout = () => {
    const r = rect();
    if (!r) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardW = 264;
    const cardH = 128;
    const gap = 44; // room for animated pointing arrow

    const preferLeft = step().placement === "left" && r.left >= cardW + gap + 16;
    if (preferLeft) {
      const top = Math.min(Math.max(16, r.top + r.height / 2 - cardH / 2), vh - cardH - 16);
      const left = r.left - cardW - gap;
      return { side: "left" as const, left, top };
    }
    const preferTop = step().placement === "top" || r.top + r.height + cardH + gap > vh - 16;
    if (preferTop && r.top >= cardH + gap + 16) {
      const left = Math.min(Math.max(16, r.left + r.width / 2 - cardW / 2), vw - cardW - 16);
      const top = r.top - cardH - gap;
      return { side: "top" as const, left, top };
    }
    const left = Math.min(Math.max(16, r.left + r.width / 2 - cardW / 2), vw - cardW - 16);
    const top = Math.min(vh - cardH - 16, r.top + r.height + gap);
    return { side: "bottom" as const, left, top };
  };

  return (
    <Show when={props.open && rect()}>
      {(box) => (
        <Portal>
          <div class="starbot-tour-root" role="dialog" aria-modal="true" aria-label="星友新手引导">
            {/* Click backdrop to advance/dismiss gently */}
            <div class="starbot-tour-click-shield" onClick={next} />

            {/* Real Spotlight Cutout: dimmed translucent backdrop surrounds target with animated highlight ring */}
            <div
              class="starbot-tour-spotlight"
              style={{
                top: `${box().top}px`,
                left: `${box().left}px`,
                width: `${box().width}px`,
                height: `${box().height}px`,
              }}
            />

            {/* Floating Coach-Mark Card + Animated Bouncing Pointer Arrow */}
            <Show when={cardLayout()}>
              {(pos) => (
                <div
                  class={`starbot-tour-card is-side-${pos().side}`}
                  style={{
                    top: `${pos().top}px`,
                    left: `${pos().left}px`,
                  }}
                >
                  {/* Animated Bouncing Directional Arrow pointing right into the spotlight target */}
                  <div class={`starbot-tour-arrow is-side-${pos().side}`} aria-hidden="true">
                    <Show when={pos().side === "left"}>
                      <svg viewBox="0 0 42 26" fill="none">
                        <path
                          d="M4 13 C 14 13, 22 13, 35 13"
                          stroke="#8b6cff"
                          stroke-width="3.2"
                          stroke-linecap="round"
                        />
                        <path
                          d="M27 5 L 37 13 L 27 21"
                          stroke="#8b6cff"
                          stroke-width="3.2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </Show>
                    <Show when={pos().side === "top"}>
                      <svg viewBox="0 0 26 42" fill="none">
                        <path
                          d="M13 4 C 13 14, 13 22, 13 35"
                          stroke="#8b6cff"
                          stroke-width="3.2"
                          stroke-linecap="round"
                        />
                        <path
                          d="M5 27 L 13 37 L 21 27"
                          stroke="#8b6cff"
                          stroke-width="3.2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </Show>
                    <Show when={pos().side === "bottom"}>
                      <svg viewBox="0 0 26 42" fill="none">
                        <path
                          d="M13 38 C 13 28, 13 20, 13 7"
                          stroke="#8b6cff"
                          stroke-width="3.2"
                          stroke-linecap="round"
                        />
                        <path
                          d="M5 15 L 13 5 L 21 15"
                          stroke="#8b6cff"
                          stroke-width="3.2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </Show>
                  </div>

                  <div class="starbot-tour-card-top">
                    <span class="starbot-tour-step-pill">{step().badge}</span>
                    <button type="button" class="starbot-tour-skip" onClick={finish}>
                      跳过
                    </button>
                  </div>
                  <strong class="starbot-tour-title">{step().title}</strong>
                  <p class="starbot-tour-hint">{step().hint}</p>
                  <div class="starbot-tour-actions">
                    <Show when={stepIndex() > 0}>
                      <button type="button" class="starbot-tour-btn-ghost" onClick={prev}>
                        上一步
                      </button>
                    </Show>
                    <button type="button" class="starbot-tour-btn-primary" onClick={next}>
                      {isLast() ? "开始创建" : "下一步 →"}
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  );
}
