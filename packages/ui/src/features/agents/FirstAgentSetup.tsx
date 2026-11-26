import type { ExpressionId } from "@norbert_bodziony/bloub";
import type { PlushState } from "@norbert_bodziony/bloub/plush";
import { agentProviderDescriptor } from "@openbot/contracts/agent-providers";
import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type {
  AccountUsage,
  AgentModelId,
  AgentProviderId,
  AgentReasoningEffort,
  AgentStatus,
  AvatarColor,
  AvatarHue,
  ClientAgentModelOption,
  CustomAgentSummary,
  CustomProviderSummary,
  ProviderRuntimeStatus,
} from "@openbot/contracts/ipc";
import type { AppTextKey, AppTranslate } from "@openbot/i18n";
import { Button, Field, Input, Textarea } from "@openbot/ui";
import { createMemo, createSignal, For, onCleanup, onSettled, Show } from "solid-js";
import {
  avatarColorChoicesForSeed,
  avatarHeadColor,
  avatarSeedForFace,
  bloubAvatarProfile,
  isAvatarColorChoice,
  type SupportedAvatarSilhouetteId,
  ZODIAC_AVATAR_LIST,
  zodiacForShape,
} from "../../bloub-avatar";
import { ProviderModelPicker } from "../../components/ProviderModelPicker";
import { currentText, useText } from "../../text";
import { prefersReducedMotion } from "../../utils";
import { AgentAvatar } from "./AgentAvatar";
import { avatarColorChoiceLabel } from "./avatar-hue-label";
import {
  consumePendingFirstAgentTourReplay,
  FirstAgentTour,
  REPLAY_FIRST_AGENT_TOUR_EVENT,
  requestFirstAgentTourReplay,
  shouldAutoRunFirstAgentTour,
} from "./FirstAgentTour";

export { requestFirstAgentTourReplay };
import { InstructionsLimit, instructionsTooLong } from "./InstructionsLimit";

export interface FirstAgentDraft {
  name: string;
  purpose: string;
  avatarSeed: string;
  avatarHue: AvatarHue | null;
  avatarColor?: AvatarColor | null | undefined;
  suggestionId: string | null;
  provider: AgentProviderId;
  model: AgentModelId;
  reasoningEffort?: AgentReasoningEffort | undefined;
  providerAccountId?: string | undefined;
}

export interface FirstAgentSuggestion {
  id: string;
  nameKey: AppTextKey;
  descriptionKey: AppTextKey;
  purposeKey: AppTextKey;
  avatarSeed: string;
  avatarHue: AvatarHue | null;
  animationOffset: number;
}

export interface FirstAgentSetupProps {
  value: FirstAgentDraft;
  suggestions: FirstAgentSuggestion[];
  mode?: "first" | "additional";
  submitting?: boolean;
  error?: string | null;
  modelOptions?: ClientAgentModelOption[] | undefined;
  agentStatus?: AgentStatus | undefined;
  accountChoice?: boolean | undefined;
  accountUsage?: AccountUsage | null | undefined;
  runtimeStatuses?: Partial<Record<AgentProviderId, ProviderRuntimeStatus>> | undefined;
  customProviders?: readonly CustomProviderSummary[] | undefined;
  customAgents?: readonly CustomAgentSummary[] | undefined;
  onDownloadProvider?: ((provider: AgentProviderId) => void | Promise<void>) | undefined;
  onCancelProviderDownload?: ((provider: AgentProviderId) => void | Promise<void>) | undefined;
  onConnectProvider?: ((provider: AgentProviderId) => void | Promise<void>) | undefined;
  onAddCustomProvider?: ((trigger: HTMLElement) => void) | undefined;
  onManageProviders?: ((trigger: HTMLElement) => void) | undefined;
  onChange: (value: FirstAgentDraft) => void;
  onSubmit: (value: FirstAgentDraft) => void | Promise<void>;
  onCancel?: (() => void) | undefined;
}

const FIRST_AGENT_FACES: ReadonlyArray<{ shape: SupportedAvatarSilhouetteId; expression: ExpressionId }> =
  ZODIAC_AVATAR_LIST.map((zodiac) => ({ shape: zodiac.shape, expression: "neutre" }));

export const FIRST_AGENT_AVATAR_SEEDS = FIRST_AGENT_FACES.map((face) => avatarSeedForFace("first-bot", face));

interface PreviewMoodPreset {
  readonly id: "idle" | "happy" | "thinking" | "asleep";
  readonly labelZh: string;
  readonly expression?: ExpressionId;
  readonly previewState?: PlushState;
}

const PREVIEW_MOOD_PRESETS: readonly PreviewMoodPreset[] = [
  { id: "idle", labelZh: "待机" },
  { id: "happy", labelZh: "开心", expression: "heureux" },
  { id: "thinking", labelZh: "思考", previewState: "thinking" },
  { id: "asleep", labelZh: "睡眠", previewState: "asleep" },
];

const SUGGESTION_MOMENTUM_FRICTION = 0.88;
const SUGGESTION_MOMENTUM_MINIMUM = 0.01;
const SUGGESTION_MOMENTUM_MAXIMUM = 1.75;
const SUGGESTION_DRAG_THRESHOLD = 8;
const MOTION_FRAME_DURATION = 1000 / 60;
const FACE_CHOICE_EYE_SCALE = 1.02;

export function createFirstAgentDraft(random: () => number = Math.random): FirstAgentDraft {
  const index = Math.min(FIRST_AGENT_AVATAR_SEEDS.length - 1, Math.floor(random() * FIRST_AGENT_AVATAR_SEEDS.length));
  return {
    name: currentText().t("agent.setup.nameFallback"),
    purpose: "",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[index] ?? "first-bot",
    avatarHue: null,
    suggestionId: null,
    provider: "codex",
    model: agentProviderDescriptor("codex").defaultModel,
  };
}

export const FIRST_AGENT_SUGGESTIONS: FirstAgentSuggestion[] = [
  {
    id: "inbox-helper",
    nameKey: "agent.setup.suggestion.inboxHelper.name",
    descriptionKey: "agent.setup.suggestion.inboxHelper.description",
    purposeKey: "agent.setup.suggestion.inboxHelper.purpose",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[0] ?? "first-bot:inbox",
    avatarHue: null,
    animationOffset: 0.15,
  },
  {
    id: "trip-planner",
    nameKey: "agent.setup.suggestion.tripPlanner.name",
    descriptionKey: "agent.setup.suggestion.tripPlanner.description",
    purposeKey: "agent.setup.suggestion.tripPlanner.purpose",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[8] ?? "first-bot:travel",
    avatarHue: null,
    animationOffset: 0.65,
  },
  {
    id: "personal-organizer",
    nameKey: "agent.setup.suggestion.personalOrganizer.name",
    descriptionKey: "agent.setup.suggestion.personalOrganizer.description",
    purposeKey: "agent.setup.suggestion.personalOrganizer.purpose",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[5] ?? "first-bot:organizer",
    avatarHue: null,
    animationOffset: 1.2,
  },
  {
    id: "shopping-scout",
    nameKey: "agent.setup.suggestion.shoppingScout.name",
    descriptionKey: "agent.setup.suggestion.shoppingScout.description",
    purposeKey: "agent.setup.suggestion.shoppingScout.purpose",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[2] ?? "first-bot:shopping",
    avatarHue: null,
    animationOffset: 1.8,
  },
  {
    id: "writing-partner",
    nameKey: "agent.setup.suggestion.writingPartner.name",
    descriptionKey: "agent.setup.suggestion.writingPartner.description",
    purposeKey: "agent.setup.suggestion.writingPartner.purpose",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[6] ?? "first-bot:writing",
    avatarHue: null,
    animationOffset: 2.45,
  },
  {
    id: "learning-coach",
    nameKey: "agent.setup.suggestion.learningCoach.name",
    descriptionKey: "agent.setup.suggestion.learningCoach.description",
    purposeKey: "agent.setup.suggestion.learningCoach.purpose",
    avatarSeed: FIRST_AGENT_AVATAR_SEEDS[10] ?? "first-bot:learning",
    avatarHue: null,
    animationOffset: 3.15,
  },
];

function matchesSuggestion(draft: FirstAgentDraft, suggestion: FirstAgentSuggestion, t: AppTranslate): boolean {
  return (
    draft.name === t(suggestion.nameKey) &&
    draft.purpose === t(suggestion.purposeKey) &&
    draft.avatarSeed === suggestion.avatarSeed &&
    draft.avatarHue === suggestion.avatarHue &&
    (draft.avatarColor ?? null) === null
  );
}

export function FirstAgentSetup(props: FirstAgentSetupProps) {
  const { t, sourceText } = useText();
  let suggestionList: HTMLUListElement | undefined;
  let activeSuggestionPointer: number | null = null;
  let suggestionDragStartX = 0;
  let suggestionDragStartScrollLeft = 0;
  let suggestionDragPreviousX = 0;
  let suggestionDragPreviousTime = 0;
  let suggestionDragVelocity = 0;
  let suggestionDragMoved = false;
  let suppressSuggestionClick = false;
  let suggestionMomentumFrame: number | null = null;
  let shakeTimer: number | undefined;

  const [canScrollSuggestionsBack, setCanScrollSuggestionsBack] = createSignal(false);
  const [canScrollSuggestionsForward, setCanScrollSuggestionsForward] = createSignal(false);
  const [draggingSuggestions, setDraggingSuggestions] = createSignal(false);
  const [previewMoodId, setPreviewMoodId] = createSignal<PreviewMoodPreset["id"]>("idle");
  const [shaking, setShaking] = createSignal(false);
  const [tourOpen, setTourOpen] = createSignal(false);
  let panelEl: HTMLElement | undefined;

  onSettled(() => {
    let tId: number | undefined;
    if (consumePendingFirstAgentTourReplay() || shouldAutoRunFirstAgentTour()) {
      tId = window.setTimeout(() => setTourOpen(true), 320);
    }
    const handleReplay = () => {
      consumePendingFirstAgentTourReplay();
      window.clearTimeout(tId);
      setTourOpen(false);
      tId = window.setTimeout(() => setTourOpen(true), 120);
    };
    window.addEventListener(REPLAY_FIRST_AGENT_TOUR_EVENT, handleReplay);
    onCleanup(() => {
      window.clearTimeout(tId);
      window.removeEventListener(REPLAY_FIRST_AGENT_TOUR_EVENT, handleReplay);
    });
  });

  onCleanup(() => {
    window.clearTimeout(shakeTimer);
  });

  const canSubmit = () =>
    Boolean(props.value.name.trim()) && !instructionsTooLong(props.value.purpose) && !props.submitting;
  const displayName = () => props.value.name.trim() || t("agent.setup.nameFallback");

  const currentZodiac = createMemo(() => {
    const profile = bloubAvatarProfile(props.value.avatarSeed, null);
    return zodiacForShape(profile.shape);
  });

  const colorChoices = createMemo(() => avatarColorChoicesForSeed(props.value.avatarSeed));

  const activePreviewMood = createMemo(
    () => PREVIEW_MOOD_PRESETS.find((preset) => preset.id === previewMoodId()) ?? PREVIEW_MOOD_PRESETS[0]!,
  );

  function updateSuggestionFades(): void {
    if (!suggestionList) return;
    const maximumScroll = Math.max(0, suggestionList.scrollWidth - suggestionList.clientWidth);
    setCanScrollSuggestionsBack(suggestionList.scrollLeft > 1);
    setCanScrollSuggestionsForward(suggestionList.scrollLeft < maximumScroll - 1);
  }

  function stopSuggestionMomentum(): void {
    if (suggestionMomentumFrame === null) return;
    cancelAnimationFrame(suggestionMomentumFrame);
    suggestionMomentumFrame = null;
  }

  function startSuggestionMomentum(): void {
    if (!suggestionList || Math.abs(suggestionDragVelocity) < SUGGESTION_MOMENTUM_MINIMUM || prefersReducedMotion()) {
      return;
    }

    let previousFrameTime = performance.now();
    const move = (frameTime: number) => {
      if (!suggestionList) return;
      const elapsed = Math.min(frameTime - previousFrameTime, MOTION_FRAME_DURATION * 2);
      previousFrameTime = frameTime;
      const previousScrollLeft = suggestionList.scrollLeft;
      suggestionList.scrollLeft += suggestionDragVelocity * elapsed;
      suggestionDragVelocity *= SUGGESTION_MOMENTUM_FRICTION ** (elapsed / MOTION_FRAME_DURATION);
      updateSuggestionFades();

      const reachedEdge = Math.abs(suggestionList.scrollLeft - previousScrollLeft) < 0.1;
      if (!reachedEdge && Math.abs(suggestionDragVelocity) >= SUGGESTION_MOMENTUM_MINIMUM) {
        suggestionMomentumFrame = requestAnimationFrame(move);
      } else {
        suggestionMomentumFrame = null;
      }
    };

    suggestionMomentumFrame = requestAnimationFrame(move);
  }

  onSettled(() => {
    updateSuggestionFades();
    const observer = new ResizeObserver(updateSuggestionFades);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (props.mode !== "additional" || props.submitting || !props.onCancel) return;
      event.preventDefault();
      props.onCancel();
    };
    const list = suggestionList;
    const scrollOnWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (!list || props.submitting || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const rightToLeft = getComputedStyle(list).direction === "rtl";
      const position = rightToLeft ? -list.scrollLeft : list.scrollLeft;
      const maximumScroll = list.scrollWidth - list.clientWidth;
      if (event.deltaY > 0 ? position >= maximumScroll - 1 : position <= 1) return;
      event.preventDefault();
      stopSuggestionMomentum();
      list.scrollLeft += rightToLeft ? -event.deltaY : event.deltaY;
    };
    if (list) {
      observer.observe(list);
      list.addEventListener("wheel", scrollOnWheel, { passive: false });
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      observer.disconnect();
      list?.removeEventListener("wheel", scrollOnWheel);
      document.removeEventListener("keydown", closeOnEscape);
      stopSuggestionMomentum();
    };
  });

  function startSuggestionDrag(event: PointerEvent): void {
    if (props.submitting || event.button !== 0 || !suggestionList) return;
    stopSuggestionMomentum();
    activeSuggestionPointer = event.pointerId;
    suggestionDragStartX = event.clientX;
    suggestionDragStartScrollLeft = suggestionList.scrollLeft;
    suggestionDragPreviousX = event.clientX;
    suggestionDragPreviousTime = event.timeStamp;
    suggestionDragVelocity = 0;
    suggestionDragMoved = false;
  }

  function moveSuggestionDrag(event: PointerEvent): void {
    if (event.pointerId !== activeSuggestionPointer || !suggestionList) return;
    const distance = event.clientX - suggestionDragStartX;
    if (!suggestionDragMoved && Math.abs(distance) > SUGGESTION_DRAG_THRESHOLD) {
      suggestionDragMoved = true;
      setDraggingSuggestions(true);
      suggestionList.setPointerCapture(event.pointerId);
    }
    if (!suggestionDragMoved) return;
    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - suggestionDragPreviousTime);
    const immediateVelocity = Math.max(
      -SUGGESTION_MOMENTUM_MAXIMUM,
      Math.min(SUGGESTION_MOMENTUM_MAXIMUM, (suggestionDragPreviousX - event.clientX) / elapsed),
    );
    suggestionDragVelocity = suggestionDragVelocity * 0.65 + immediateVelocity * 0.35;
    suggestionDragPreviousX = event.clientX;
    suggestionDragPreviousTime = event.timeStamp;
    suggestionList.scrollLeft = suggestionDragStartScrollLeft - distance;
    updateSuggestionFades();
  }

  function finishSuggestionDrag(event: PointerEvent): void {
    if (event.pointerId !== activeSuggestionPointer || !suggestionList) return;
    if (suggestionList.hasPointerCapture(event.pointerId)) suggestionList.releasePointerCapture(event.pointerId);
    suppressSuggestionClick = suggestionDragMoved;
    activeSuggestionPointer = null;
    suggestionDragMoved = false;
    setDraggingSuggestions(false);
    if (suppressSuggestionClick && event.type === "pointerup") startSuggestionMomentum();
    window.setTimeout(() => {
      suppressSuggestionClick = false;
    }, 0);
  }

  function automaticColor(): boolean {
    return props.value.avatarHue === null && (props.value.avatarColor ?? null) === null;
  }

  function updateDraft(updates: Partial<FirstAgentDraft>): void {
    if (props.submitting) return;
    const next = { ...props.value, ...updates };
    if (updates.avatarSeed && updates.avatarSeed !== props.value.avatarSeed) {
      const nextChoices = avatarColorChoicesForSeed(updates.avatarSeed);
      const stillValid =
        (next.avatarHue === null && (next.avatarColor ?? null) === null) ||
        nextChoices.some((choice) => isAvatarColorChoice(choice, next.avatarHue, next.avatarColor));
      if (!stillValid) {
        next.avatarHue = null;
        next.avatarColor = null;
      }
    }
    const selected = props.suggestions.find((suggestion) => suggestion.id === next.suggestionId);
    props.onChange({
      ...next,
      suggestionId: selected && matchesSuggestion(next, selected, t) ? selected.id : null,
    });
  }

  function shakeBlindBox(): void {
    if (props.submitting) return;
    const candidates = FIRST_AGENT_AVATAR_SEEDS.filter((seed) => seed !== props.value.avatarSeed);
    const randomSeed = candidates[Math.floor(Math.random() * candidates.length)] ?? FIRST_AGENT_AVATAR_SEEDS[0]!;
    setShaking(false);
    window.clearTimeout(shakeTimer);
    requestAnimationFrame(() => {
      setShaking(true);
      shakeTimer = window.setTimeout(() => setShaking(false), 480);
    });
    updateDraft({ avatarSeed: randomSeed, avatarHue: null, avatarColor: null });
  }

  function selectSuggestion(suggestion: FirstAgentSuggestion): void {
    if (props.submitting) return;
    props.onChange({
      name: t(suggestion.nameKey),
      purpose: t(suggestion.purposeKey),
      avatarSeed: suggestion.avatarSeed,
      avatarHue: suggestion.avatarHue,
      avatarColor: null,
      suggestionId: suggestion.id,
      provider: props.value.provider,
      model: props.value.model,
      reasoningEffort: props.value.reasoningEffort,
      providerAccountId: props.value.providerAccountId,
    });
  }

  const modelOption = (provider: AgentProviderId, model: AgentModelId) =>
    props.modelOptions?.find((option) => option.provider === provider && option.id === model);
  const reasoningEffort = () =>
    props.value.reasoningEffort ?? modelOption(props.value.provider, props.value.model)?.defaultReasoningEffort;

  function selectModel(
    model: AgentModelId,
    provider: AgentProviderId,
    accountId?: string | null,
    effort?: AgentReasoningEffort,
  ): void {
    const kept = effort ?? props.value.reasoningEffort;
    updateDraft({
      model,
      provider,
      providerAccountId: props.accountChoice ? (accountId ?? undefined) : undefined,
      reasoningEffort:
        kept && modelOption(provider, model)?.supportedReasoningEfforts.includes(kept) ? kept : undefined,
    });
  }

  return (
    <main
      ref={(el) => (panelEl = el)}
      class="conversation-panel first-agent-setup-panel"
      aria-labelledby="first-agent-setup-title"
    >
      <header class="window-drag first-agent-setup-header">
        <div
          class="first-agent-header-identity"
          data-avatar-seed={props.value.avatarSeed}
          data-avatar-hue={props.value.avatarHue ?? "automatic"}
        >
          <AgentAvatar
            seed={props.value.avatarSeed}
            hue={props.value.avatarHue}
            color={props.value.avatarColor ?? null}
            motion="idle"
          />
          <h1 id="first-agent-setup-title" aria-live="polite">
            {displayName()}
          </h1>
        </div>
        <div class="first-agent-header-actions no-drag">
          <button
            type="button"
            class="first-agent-tour-replay"
            title="重播新手引导"
            aria-label="重播新手引导"
            onClick={() => setTourOpen(true)}
          >
            ?
          </button>
          <Show when={props.mode === "additional" && props.onCancel}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="first-agent-cancel no-drag"
              disabled={props.submitting}
              onClick={() => props.onCancel?.()}
            >
              {t("common.cancel")}
            </Button>
          </Show>
        </div>
      </header>

      <div class="first-agent-setup-content">
        <form
          class="first-agent-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit()) void props.onSubmit(props.value);
          }}
        >
          {/* Left Bento Card: Clean Showcase + Deduplicated Glaze Colors */}
          <section class="first-agent-bento-card first-agent-stage-card" aria-label="星座形象预览">
            <div class="first-agent-stage-topbar">
              <span class="first-agent-element-pill">
                ✦ {currentZodiac().nameZh} · {currentZodiac().elementZh}
              </span>
              <button
                type="button"
                class="first-agent-shake-button"
                disabled={props.submitting}
                onClick={shakeBlindBox}
              >
                随机抽盒
              </button>
            </div>

            <div class="first-agent-stage-showcase">
              <div class="first-agent-stage-glow" aria-hidden="true" />
              <div
                class={`first-agent-live-avatar${shaking() ? " is-shaking" : ""}`}
                data-avatar-seed={props.value.avatarSeed}
                data-avatar-hue={props.value.avatarHue ?? "automatic"}
              >
                <AgentAvatar
                  seed={props.value.avatarSeed}
                  hue={props.value.avatarHue}
                  color={props.value.avatarColor ?? null}
                  motion="always"
                  expression={activePreviewMood().expression}
                  previewState={activePreviewMood().previewState}
                  followPointer
                  animationOffset={0.4}
                />
              </div>
              <div class="first-agent-pedestal" aria-hidden="true" />
            </div>

            <strong class="first-agent-stage-name">{currentZodiac().nicknameZh}</strong>

            <div class="first-agent-mood-bar" role="group" aria-label="试玩表情">
              <For each={PREVIEW_MOOD_PRESETS}>
                {(preset) => (
                  <button
                    type="button"
                    class="first-agent-mood-pill"
                    aria-pressed={previewMoodId() === preset.id ? "true" : "false"}
                    disabled={props.submitting}
                    onClick={() => setPreviewMoodId(preset.id)}
                  >
                    {preset.labelZh}
                  </button>
                )}
              </For>
            </div>

            <fieldset class="first-agent-avatar-fieldset first-agent-color-fieldset" disabled={props.submitting}>
              <legend class="sr-only">软陶釉色</legend>
              <div class="first-agent-color-options">
                <Button
                  variant="ghost"
                  type="button"
                  size="sm"
                  class="first-agent-color-choice"
                  title="原色（本星座专属）"
                  aria-label={t("agent.setup.colorAutomatic")}
                  aria-pressed={automaticColor() ? "true" : "false"}
                  data-cuelume-tap="select"
                  onClick={() => updateDraft({ avatarHue: null, avatarColor: null })}
                >
                  <span
                    class="first-agent-color-swatch"
                    style={{ background: avatarHeadColor(props.value.avatarSeed, null) }}
                  />
                </Button>
                <For each={colorChoices()}>
                  {(option) => (
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      class="first-agent-color-choice"
                      aria-label={t("agent.setup.colorOption", { color: t(avatarColorChoiceLabel(option)) })}
                      aria-pressed={
                        isAvatarColorChoice(option, props.value.avatarHue, props.value.avatarColor) ? "true" : "false"
                      }
                      data-cuelume-tap="select"
                      onClick={() => updateDraft({ avatarHue: option.hue, avatarColor: option.color })}
                    >
                      <span class="first-agent-color-swatch" style={{ background: option.swatch }} />
                    </Button>
                  )}
                </For>
              </div>
            </fieldset>
          </section>

          {/* Right Bento Card: Clean 12 Zodiac Picker + Minimal Form (guided by Spotlight Tour!) */}
          <section class="first-agent-bento-card first-agent-config-card" aria-label="星座与基础设置">
            <fieldset
              class="first-agent-avatar-fieldset first-agent-face-fieldset"
              data-tour-target="zodiac"
              disabled={props.submitting}
            >
              <legend class="sr-only">挑选星座形象</legend>
              <div class="first-agent-face-options">
                <For each={FIRST_AGENT_AVATAR_SEEDS}>
                  {(seed, index) => {
                    const zodiac = () => ZODIAC_AVATAR_LIST[index()];
                    return (
                      <Button
                        variant="ghost"
                        type="button"
                        size="sm"
                        class="first-agent-face-choice"
                        title={zodiac() ? `${zodiac()!.nameZh} · ${zodiac()!.nicknameZh}` : undefined}
                        aria-label={
                          zodiac()
                            ? `${zodiac()!.nameZh} (${zodiac()!.nicknameZh})`
                            : t("agent.setup.faceOption", { number: index() + 1 })
                        }
                        aria-pressed={props.value.avatarSeed === seed ? "true" : "false"}
                        data-cuelume-tap="select"
                        onClick={() => updateDraft({ avatarSeed: seed })}
                      >
                        <AgentAvatar
                          seed={seed}
                          hue={null}
                          color={null}
                          motion="hover"
                          animationOffset={index() * 0.16}
                          eyeScale={FACE_CHOICE_EYE_SCALE}
                        />
                        <span class="first-agent-face-label">{zodiac()?.shortNameZh ?? ""}</span>
                      </Button>
                    );
                  }}
                </For>
              </div>
            </fieldset>

            <div class="first-agent-fields">
              <div class="first-agent-clean-field" data-tour-target="name">
                <Field label={t("agent.setup.name")} required>
                  <Input
                    value={props.value.name}
                    maxlength={INPUT_LIMITS.agentName}
                    placeholder="给星友起个名字，例如：灵感小狮"
                    autocomplete="off"
                    disabled={props.submitting}
                    onValueChange={(name) => updateDraft({ name })}
                  />
                </Field>
              </div>

              <Show when={props.modelOptions}>
                {(options) => (
                  <Show when={props.agentStatus}>
                    {(status) => (
                      <div class="first-agent-clean-field" data-tour-target="model">
                        <ProviderModelPicker
                          variant="field"
                          ariaLabel={t("agent.setup.model")}
                          provider={props.value.provider}
                          value={props.value.model}
                          modelOptions={options()}
                          agentStatus={status()}
                          accountChoice={props.accountChoice === true}
                          providerAccountId={props.value.providerAccountId}
                          accountUsage={props.accountUsage}
                          runtimeStatuses={props.runtimeStatuses}
                          customProviders={props.customProviders}
                          customAgents={props.customAgents}
                          onDownloadProvider={props.onDownloadProvider}
                          onCancelProviderDownload={props.onCancelProviderDownload}
                          onConnectProvider={props.onConnectProvider}
                          onAddCustomProvider={props.onAddCustomProvider}
                          onManageProviders={props.onManageProviders}
                          disabled={props.submitting}
                          reasoningEffort={reasoningEffort()}
                          onReasoningEffortChange={(effort) => updateDraft({ reasoningEffort: effort })}
                          onChange={selectModel}
                        />
                      </div>
                    )}
                  </Show>
                )}
              </Show>

              <div class="first-agent-clean-field" data-tour-target="persona">
                <Field label="角色身份（选填）">
                  <Textarea
                    value={props.value.purpose}
                    rows={3}
                    invalid={instructionsTooLong(props.value.purpose)}
                    placeholder="可写下它的身份、性格语气和负责领域。例如：你是我的专属产品合伙人，说话直接干练、逻辑清晰，平时专门帮我打磨需求方案、拆解竞品与复盘思路。"
                    disabled={props.submitting}
                    onValueChange={(purpose) => updateDraft({ purpose, suggestionId: null })}
                  />
                </Field>
                <InstructionsLimit text={props.value.purpose} />
              </div>
            </div>

            <Show when={props.error}>
              {(error) => (
                <p class="first-agent-error" role="alert">
                  {sourceText(error())}
                </p>
              )}
            </Show>

            <div class="first-agent-submit-actions" data-tour-target="submit">
              <Button
                type="submit"
                variant="default"
                size="default"
                class="first-agent-submit"
                disabled={!canSubmit()}
                loading={props.submitting}
                loadingLabel={t("agent.setup.creating")}
              >
                {`创建${currentZodiac().shortNameZh}星友`}
              </Button>
            </div>
          </section>
        </form>

        <section class="first-agent-suggestions" aria-labelledby="first-agent-suggestions-title">
          <h2 id="first-agent-suggestions-title">灵感模板</h2>
          <div
            class={`first-agent-suggestion-viewport${canScrollSuggestionsBack() ? " can-scroll-back" : ""}${canScrollSuggestionsForward() ? " can-scroll-forward" : ""}${draggingSuggestions() ? " is-dragging" : ""}`}
          >
            <ul
              ref={suggestionList}
              class="first-agent-suggestion-list"
              onScroll={updateSuggestionFades}
              onPointerDown={startSuggestionDrag}
              onPointerMove={moveSuggestionDrag}
              onPointerUp={finishSuggestionDrag}
              onPointerCancel={finishSuggestionDrag}
            >
              <For each={props.suggestions}>
                {(suggestion) => (
                  <li class="first-agent-suggestion-item">
                    <Button
                      variant="ghost"
                      type="button"
                      class="first-agent-suggestion-card"
                      data-animation-offset={suggestion.animationOffset}
                      aria-label={t("agent.setup.suggestion.label", {
                        name: t(suggestion.nameKey),
                        description: t(suggestion.descriptionKey),
                      })}
                      aria-pressed={props.value.suggestionId === suggestion.id ? "true" : "false"}
                      data-cuelume-tap="select"
                      disabled={props.submitting}
                      onClick={() => {
                        if (!suppressSuggestionClick) selectSuggestion(suggestion);
                      }}
                    >
                      <AgentAvatar
                        seed={suggestion.avatarSeed}
                        hue={suggestion.avatarHue}
                        motion="always"
                        animationOffset={suggestion.animationOffset}
                      />
                      <span class="first-agent-suggestion-copy">
                        <strong>{t(suggestion.nameKey)}</strong>
                        <small>{t(suggestion.descriptionKey)}</small>
                      </span>
                    </Button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </section>
      </div>
      <FirstAgentTour open={tourOpen()} container={() => panelEl} onFinish={() => setTourOpen(false)} />
    </main>
  );
}
