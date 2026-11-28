import { createEffect, createSignal, onSettled, Show, untrack } from "solid-js";
import starbotBadge from "../../assets/zodiac/starbot-badge.webp";
import starbotSplashVideo from "../../assets/zodiac/starbot-splash.mp4";
import { documentStillFaces } from "../../document-rendering";
import { useText } from "../../text";
import { prefersReducedMotion } from "../../utils";
import { isKawaiiActionSoundEnabled, playKawaiiCue } from "../agents/starbot-kawaii-audio";

const MIN_SPLASH_MS = 5350;
const EXIT_LIMIT_MS = 1800;
const EXIT_ANIMATION = "app-loading-exit";

type Phase = "loading" | "fade" | "exit";

export interface AppLoadingScreenProps {
  ready?: boolean | undefined;
  preview?: boolean | undefined;
  onExited?: (() => void) | undefined;
  onMountViews?: (() => void) | undefined;
  scene?: "pile" | "thinking" | "quiet";
  seed?: number;
  label?: string;
  title?: string;
  quickExit?: boolean;
  immediate?: boolean;
}

export function AppLoadingScreen(props: AppLoadingScreenProps) {
  const { t } = useText();
  const isPreview = untrack(() => props.preview === true);
  const reducedMotion = !isPreview && (prefersReducedMotion() || documentStillFaces());
  const scene = untrack(() => props.scene ?? "pile");
  const pileScene = scene === "pile";
  const playThrough = untrack(() => isPreview || props.quickExit === false);
  const wantSound = untrack(() => isKawaiiActionSoundEnabled());
  const start = performance.now();
  const [phase, setPhase] = createSignal<Phase>("loading");
  const [videoDone, setVideoDone] = createSignal(false);

  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackSoundTimer: ReturnType<typeof setTimeout> | undefined;
  let exited = false;
  let viewsMounted = false;
  let root: HTMLElement | undefined;
  let videoEl: HTMLVideoElement | undefined;

  if (reducedMotion && pileScene && wantSound) {
    fallbackSoundTimer = setTimeout(() => {
      void playKawaiiCue("splash-theme");
    }, 140);
  }

  function mountViews(): void {
    if (viewsMounted) return;
    viewsMounted = true;
    props.onMountViews?.();
  }

  function finishExit(): void {
    if (exited) return;
    exited = true;
    clearTimeout(exitTimer);
    clearTimeout(holdTimer);
    clearTimeout(fallbackSoundTimer);
    if (videoEl) {
      videoEl.pause();
    }
    mountViews();
    props.onExited?.();
  }

  function triggerExit(mode: "fade" | "exit"): void {
    if (untrack(phase) !== "loading") return;
    mountViews();
    setPhase(mode);
  }

  createEffect(phase, (current) => {
    if (current !== "fade" && current !== "exit") return;
    if (root && !getComputedStyle(root).animationName.includes(EXIT_ANIMATION)) queueMicrotask(finishExit);
  });

  createEffect(
    () => [props.ready, videoDone()] as const,
    ([ready, done]) => {
      if (!ready || untrack(phase) !== "loading") return;
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);

      if (!pileScene || !playThrough || reducedMotion) {
        exitTimer = setTimeout(finishExit, EXIT_LIMIT_MS);
        triggerExit("fade");
        return;
      }

      if (done) {
        if (isPreview) {
          holdTimer = setTimeout(() => {
            exitTimer = setTimeout(finishExit, EXIT_LIMIT_MS);
            triggerExit("exit");
          }, 420);
          return;
        }
        exitTimer = setTimeout(finishExit, EXIT_LIMIT_MS);
        triggerExit("exit");
        return;
      }

      if (isPreview) {
        // In manual preview mode, wait for actual video completion (with generous 8.5s fallback)
        holdTimer = setTimeout(() => {
          exitTimer = setTimeout(finishExit, EXIT_LIMIT_MS);
          triggerExit("exit");
        }, 8500);
        return;
      }

      const elapsed = performance.now() - start;
      const minWait = Math.max(0, MIN_SPLASH_MS - elapsed);
      exitTimer = setTimeout(finishExit, minWait + EXIT_LIMIT_MS);
      holdTimer = setTimeout(() => {
        triggerExit("exit");
      }, minWait);
    },
  );

  onSettled(() => {
    if (!reducedMotion && videoEl) {
      videoEl.muted = !wantSound;
      videoEl.volume = 0.88;
      const playPromise = videoEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        void playPromise.catch(() => {
          // If browser autoplay policy blocks unmuted playback (e.g. strict web client),
          // seamlessly retry muted so the animation never stalls and layer Web Audio fallback.
          if (!videoEl || exited) return;
          videoEl.muted = true;
          void videoEl.play().catch(() => setVideoDone(true));
          if (wantSound && pileScene) {
            fallbackSoundTimer = setTimeout(() => {
              void playKawaiiCue("splash-pop");
            }, 1150);
          }
        });
      }
    }
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(holdTimer);
      clearTimeout(fallbackSoundTimer);
      videoEl?.pause();
    };
  });

  function handleAnimationStart(event: AnimationEvent): void {
    if (event.animationName === EXIT_ANIMATION && event.target === event.currentTarget) mountViews();
  }

  function handleAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === EXIT_ANIMATION && event.target === event.currentTarget) finishExit();
  }

  return (
    <main
      ref={(element) => {
        root = element;
      }}
      class="app-loading starbot-splash is-blindbox-video"
      data-scene={scene}
      data-phase={phase()}
      role="status"
      aria-live="polite"
      aria-busy={props.ready ? "false" : "true"}
      onAnimationStart={handleAnimationStart}
      onAnimationEnd={handleAnimationEnd}
    >
      <span class="sr-only">{props.label ?? t("webClient.loading")}</span>
      <div class="starbot-splash-starry-backdrop" aria-hidden="true" />
      <Show
        when={!reducedMotion}
        fallback={
          <div class="app-loading-stage starbot-splash-stage">
            <img class="starbot-splash-static-badge" src={starbotBadge} alt="" draggable={false} />
            <div class="starbot-splash-brand is-light">
              <h1 class="starbot-splash-title">
                <span>StarBot</span>
                <span class="starbot-splash-title-star" aria-hidden="true">
                  ✦
                </span>
                <span>星友</span>
              </h1>
              <p class="starbot-splash-subtitle">你的星座 AI 伙伴</p>
            </div>
          </div>
        }
      >
        <div class="starbot-splash-video-frame" aria-hidden="true">
          <video
            ref={(el) => {
              videoEl = el;
            }}
            class="starbot-splash-video"
            src={starbotSplashVideo}
            autoplay
            muted={!wantSound}
            playsinline
            preload="auto"
            onEnded={() => setVideoDone(true)}
            onError={() => setVideoDone(true)}
          />
        </div>
      </Show>
      <Show when={isPreview}>
        <button
          type="button"
          class="starbot-splash-skip-btn"
          data-starbot-silent=""
          onClick={(e) => {
            e.stopPropagation();
            void playKawaiiCue("drawer-close");
            finishExit();
          }}
        >
          跳过预览 ×
        </button>
      </Show>
    </main>
  );
}
