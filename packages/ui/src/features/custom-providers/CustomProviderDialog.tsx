import { INPUT_LIMITS } from "@openbot/contracts/input-limits";
import type {
  CustomProviderApiFormat,
  CustomProviderHarness,
  CustomProviderInputKind,
  CustomProviderReasoningEffort,
  ProviderRuntimeStatus,
  SaveCustomProviderInput,
} from "@openbot/contracts/ipc";
import {
  CUSTOM_PROVIDER_DEFAULT_INPUTS,
  CUSTOM_PROVIDER_HARNESS_INPUT_KINDS,
  CUSTOM_PROVIDER_LIMITS,
  CUSTOM_PROVIDER_REASONING_EFFORTS,
  DEFAULT_CUSTOM_PROVIDER_API_FORMAT,
  DEFAULT_CUSTOM_PROVIDER_HARNESS,
} from "@openbot/contracts/ipc";
import type { AppTextKey } from "@openbot/i18n";
import {
  ArrowLeft,
  Button,
  ChevronDown,
  ChevronUp,
  Dialog,
  Eye,
  EyeOff,
  Field,
  Heading,
  IconButton,
  Input,
  KeyRound,
  Plus,
  RefreshCw,
  Spinner,
  Text,
  Trash2,
  X,
} from "@openbot/ui";
import { createEffect, createSignal, createStore, For, Match, onSettled, Show, Switch, untrack } from "solid-js";
import { createScrollFades } from "../../components/createScrollFades";
import { REASONING_LABEL } from "../../components/ProviderModelPicker";
import { useText } from "../../text";
import {
  blankModel,
  type CustomProviderDraft,
  type CustomProviderEndpoint,
  type CustomProviderErrors,
  customProviderEndpoint,
  customProviderValue,
  type DiscoveredModel,
  emptyCustomProviderDraft,
  fillFoundValues,
  hasCustomProviderError,
  holdsFoundValues,
  keepsHeaderValue,
  type ModelDiscovery,
  resolveCustomProviderDraft,
  tokenCountEditText,
  tokenCountRestText,
  tokenCountText,
  validateCustomProvider,
} from "./custom-provider-form";
import { FoundModelPicker } from "./FoundModelPicker";
import { ModelChoiceMenu } from "./ModelChoiceMenu";
import { type RepeatableColumn, RepeatableRows, type RepeatableTable } from "./RepeatableRows";

const PROVIDER_ID_PLACEHOLDER = "留空将自动生成（如 deepseek-api）";
const OPENAI_URL_PLACEHOLDER = "https://api.openai.com/v1";
const ANTHROPIC_URL_PLACEHOLDER = "https://api.anthropic.com/v1";
const MODEL_ID_PLACEHOLDER = "例如：deepseek-chat / gpt-4.1";
const HEADER_NAME_PLACEHOLDER = "Header-Name";

const INPUT_KIND_LABEL = {
  image: "customProvider.model.inputImage",
  pdf: "customProvider.model.inputPdf",
} as const satisfies Record<CustomProviderInputKind, AppTextKey>;

export interface CustomProviderHarnessChoice {
  id: CustomProviderHarness;
  ready: boolean;
  runtime?: ProviderRuntimeStatus | undefined;
}

type ModelRow = CustomProviderDraft["models"][number];
type HeaderRow = CustomProviderDraft["headers"][number];

function cloneDraft(draft: CustomProviderDraft): CustomProviderDraft {
  return {
    ...draft,
    apiFormat: draft.apiFormat ?? DEFAULT_CUSTOM_PROVIDER_API_FORMAT,
    models: draft.models.map((model) => ({
      ...model,
      ...(model.reasoningEfforts ? { reasoningEfforts: [...model.reasoningEfforts] } : {}),
      ...(model.inputs ? { inputs: [...model.inputs] } : {}),
    })),
    headers: draft.headers.map((header) => ({ ...header })),
  };
}

interface CustomProviderDialogProps {
  open: boolean;
  draft?: CustomProviderDraft | undefined;
  showErrors?: boolean | undefined;
  busy?: boolean | undefined;
  submitError?: string | null | undefined;
  takenProviderIds?: readonly string[] | undefined;
  providerIdLocked?: boolean | undefined;
  apiKeyKept?: boolean | undefined;
  contextWindows?: boolean | undefined;
  harnesses?: readonly CustomProviderHarnessChoice[] | undefined;
  onDownloadHarness?: ((harness: CustomProviderHarness) => void) | undefined;
  harnessError?: string | undefined;
  discovery?: ModelDiscovery | undefined;
  onDiscoverModels?: ((endpoint: CustomProviderEndpoint) => void) | undefined;
  onSubmit: (value: SaveCustomProviderInput) => void;
  onCancel: () => void;
  onBack?: (() => void) | undefined;
}

export function CustomProviderDialog(props: CustomProviderDialogProps) {
  const { t, format } = useText();
  const [draft, setDraft] = createStore<CustomProviderDraft>(
    untrack(() => (props.draft ? cloneDraft(props.draft) : emptyCustomProviderDraft())),
  );
  const [submitted, setSubmitted] = createSignal(untrack(() => Boolean(props.showErrors)));
  const [showKey, setShowKey] = createSignal(false);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);

  let fillNextList = false;

  createEffect(
    () => props.open,
    (open, previous) => {
      if (!open || previous) return;
      const next = untrack(() => props.draft);
      setDraft(() => (next ? cloneDraft(next) : emptyCustomProviderDraft()));
      setSubmitted(untrack(() => Boolean(props.showErrors)));
      setShowKey(false);
      setAdvancedOpen(false);
      fillNextList = false;
    },
  );

  const resolvedDraft = () =>
    resolveCustomProviderDraft(draft, { taken: props.takenProviderIds, locked: props.providerIdLocked });
  const errors = () =>
    validateCustomProvider(
      resolvedDraft(),
      { taken: props.takenProviderIds, locked: props.providerIdLocked },
      t,
      format,
    );
  const shown = (): CustomProviderErrors | null => (submitted() ? errors() : null);
  const busy = () => Boolean(props.busy);
  const discovery = (): ModelDiscovery => props.discovery ?? { status: "idle" };
  const [mount, setMount] = createSignal<HTMLElement | undefined>(undefined);
  const apiFormat = (): CustomProviderApiFormat => draft.apiFormat ?? DEFAULT_CUSTOM_PROVIDER_API_FORMAT;
  const harness = (): CustomProviderHarness =>
    draft.harness ?? props.harnesses?.find((choice) => choice.ready)?.id ?? DEFAULT_CUSTOM_PROVIDER_HARNESS;

  const hasAdvancedError = () => {
    const err = shown();
    if (!err) return false;
    return Boolean(err.providerId || err.displayName || err.headerRows.some(Boolean));
  };

  createEffect(hasAdvancedError, (failed) => {
    if (failed) setAdvancedOpen(true);
  });

  const fades = createScrollFades();
  onSettled(() => fades.stop);
  createEffect(
    () => ({
      models: draft.models.length,
      headers: draft.headers.length,
      errors: shown(),
      discovery: discovery().status,
      advanced: advancedOpen(),
    }),
    () => fades.remeasure(),
  );

  const advancedModelColumns: readonly RepeatableColumn<ModelRow>[] = [
    {
      label: (number) => t("customProvider.model.id", { number }),
      placeholder: () => MODEL_ID_PLACEHOLDER,
      maxlength: INPUT_LIMITS.modelName,
      identifier: true,
      mono: true,
      read: (row) => row.id,
      write: (index, value) =>
        setDraft((state) => {
          const model = state.models[index];
          if (model) model.id = value;
        }),
    },
    {
      label: (number) => t("customProvider.model.name", { number }),
      placeholder: () => t("customProvider.model.namePlaceholder"),
      maxlength: INPUT_LIMITS.modelName,
      read: (row) => row.name,
      write: (index, value) =>
        setDraft((state) => {
          const model = state.models[index];
          if (model) model.name = value;
        }),
    },
    {
      label: (number) => t("customProvider.model.contextWindow", { number }),
      placeholder: () => t("customProvider.model.contextWindowPlaceholder"),
      maxlength: 16,
      identifier: true,
      numeric: true,
      read: (row) => row.contextWindow ?? "",
      editText: tokenCountEditText,
      restText: (value) => tokenCountRestText(value, format),
      write: (index, value) =>
        setDraft((state) => {
          const model = state.models[index];
          if (model) model.contextWindow = value;
        }),
    },
    {
      label: (number) => t("customProvider.model.maxOutput", { number }),
      placeholder: () => t("customProvider.model.maxOutputPlaceholder"),
      maxlength: 16,
      identifier: true,
      numeric: true,
      read: (row) => row.maxOutput ?? "",
      editText: tokenCountEditText,
      restText: (value) => tokenCountRestText(value, format),
      write: (index, value) =>
        setDraft((state) => {
          const model = state.models[index];
          if (model) model.maxOutput = value;
        }),
    },
  ];

  function setEffort(index: number, effort: CustomProviderReasoningEffort, checked: boolean): void {
    setDraft((state) => {
      const model = state.models[index];
      if (!model) return;
      model.reasoningEfforts ??= [];
      const at = model.reasoningEfforts.indexOf(effort);
      if (checked && at < 0) model.reasoningEfforts.push(effort);
      if (!checked && at >= 0) model.reasoningEfforts.splice(at, 1);
      if (model.reasoningEfforts.length === 0) delete model.reasoningEfforts;
    });
  }

  function setNoEffort(index: number, on: boolean): void {
    setDraft((state) => {
      const model = state.models[index];
      if (!model) return;
      if (on) model.reasoningEfforts = [];
      else delete model.reasoningEfforts;
    });
  }

  const modelEfforts = (row: ModelRow): readonly CustomProviderReasoningEffort[] => row.reasoningEfforts ?? [];
  const noEfforts = () =>
    harness() === "pi" ? t("customProvider.model.effortsNone") : t("customProvider.model.effortsDefault");

  const modelInputs = (row: ModelRow): readonly CustomProviderInputKind[] =>
    row.inputs ?? CUSTOM_PROVIDER_DEFAULT_INPUTS[harness()];

  function setInput(index: number, kind: CustomProviderInputKind, checked: boolean): void {
    setDraft((state) => {
      const model = state.models[index];
      if (!model) return;
      model.inputs ??= [...CUSTOM_PROVIDER_DEFAULT_INPUTS[harness()]];
      const at = model.inputs.indexOf(kind);
      if (checked && at < 0) model.inputs.push(kind);
      if (!checked && at >= 0) model.inputs.splice(at, 1);
    });
  }

  const modelTable: RepeatableTable<ModelRow> = {
    get header() {
      return [
        t("customProvider.model.idColumn"),
        t("customProvider.field.displayName"),
        t("customProvider.model.contextWindowColumn"),
        t("customProvider.model.maxOutputColumn"),
        t("customProvider.model.effortsLabel"),
        t("customProvider.model.inputsLabel"),
      ];
    },
    cells: (row, index) => (
      <>
        <ModelChoiceMenu
          label={t("customProvider.model.efforts", { number: index() + 1 })}
          empty={noEfforts()}
          none={harness() === "pi" ? undefined : t("customProvider.model.effortsNone")}
          noneChosen={row.reasoningEfforts?.length === 0}
          onNone={(on) => setNoEffort(index(), on)}
          choices={CUSTOM_PROVIDER_REASONING_EFFORTS}
          name={(effort) => t(REASONING_LABEL[effort])}
          chosen={modelEfforts(row)}
          busy={busy()}
          mount={mount()}
          onToggle={(effort, on) => setEffort(index(), effort, on)}
        />
        <ModelChoiceMenu
          label={t("customProvider.model.inputs", { number: index() + 1 })}
          empty={t("customProvider.model.inputsNone")}
          choices={CUSTOM_PROVIDER_HARNESS_INPUT_KINDS[harness()]}
          name={(kind) => t(INPUT_KIND_LABEL[kind])}
          chosen={modelInputs(row)}
          busy={busy()}
          mount={mount()}
          onToggle={(kind, on) => setInput(index(), kind, on)}
        />
      </>
    ),
  };

  const headerColumns: readonly [RepeatableColumn<HeaderRow>, RepeatableColumn<HeaderRow>] = [
    {
      label: (number) => t("customProvider.header.name", { number }),
      placeholder: () => HEADER_NAME_PLACEHOLDER,
      maxlength: INPUT_LIMITS.identifier,
      identifier: true,
      read: (row) => row.name,
      write: (index, value) =>
        setDraft((state) => {
          const header = state.headers[index];
          if (header) header.name = value;
        }),
    },
    {
      label: (number) => t("customProvider.header.value", { number }),
      placeholder: (row) =>
        keepsHeaderValue(row)
          ? t("customProvider.header.keptPlaceholder")
          : t("customProvider.header.valuePlaceholder"),
      maxlength: CUSTOM_PROVIDER_LIMITS.apiKey,
      identifier: true,
      read: (row) => row.value,
      write: (index, value) =>
        setDraft((state) => {
          const header = state.headers[index];
          if (header) header.value = value;
        }),
    },
  ];

  const discoveryFailed = () => {
    const state = discovery();
    return state.status === "failed" ? state.message : undefined;
  };
  const discovered = () => {
    const state = discovery();
    return state.status === "found" ? state.models : undefined;
  };
  const listed = (id: string) => draft.models.some((model) => model.id.trim() === id);

  createEffect(discovery, (list) => {
    if (list.status === "loading") return;
    const fill = fillNextList;
    fillNextList = false;
    if (!fill || list.status !== "found") return;
    const models = list.models;
    if (models.length > 0) setPicking(true);
    if (!untrack(() => props.contextWindows)) return;
    setDraft((state) => {
      for (const row of state.models) {
        const found = models.find((model) => model.id === row.id.trim());
        if (found) fillFoundValues(row, found, format);
      }
    });
  });

  const [picking, setPicking] = createSignal(false);
  const full = () => draft.models.filter((row) => !blankModel(row)).length >= CUSTOM_PROVIDER_LIMITS.models;

  function addRow(state: CustomProviderDraft, model: DiscoveredModel): void {
    if (state.models.some((row) => row.id.trim() === model.id)) return;
    const row = {
      id: model.id,
      name: model.name ?? model.id,
      contextWindow: model.contextWindow === undefined ? "" : tokenCountText(model.contextWindow, format),
      maxOutput: model.maxOutput === undefined ? "" : tokenCountText(model.maxOutput, format),
      ...(model.reasoningEfforts ? { reasoningEfforts: [...model.reasoningEfforts] } : {}),
      ...(model.inputs ? { inputs: [...model.inputs] } : {}),
    };
    const blank = state.models.findIndex(blankModel);
    if (blank >= 0) state.models[blank] = row;
    else state.models.push(row);
  }

  function removeRow(state: CustomProviderDraft, model: DiscoveredModel): void {
    const index = state.models.findIndex((row) => row.id.trim() === model.id);
    if (index >= 0) state.models.splice(index, 1);
    if (state.models.length === 0) state.models.push({ id: "", name: "" });
  }

  function toggleModel(model: DiscoveredModel, checked: boolean): void {
    setDraft((state) => {
      if (checked) addRow(state, model);
      else removeRow(state, model);
    });
  }

  function toggleModels(models: readonly DiscoveredModel[], checked: boolean): void {
    setDraft((state) => {
      for (const model of models) {
        if (!checked) {
          removeRow(state, model);
          continue;
        }
        if (state.models.some((row) => row.id.trim() === model.id)) continue;
        if (state.models.filter((row) => !blankModel(row)).length >= CUSTOM_PROVIDER_LIMITS.models) break;
        addRow(state, model);
      }
    });
  }

  function submit(): void {
    setSubmitted(true);
    const resolved = resolvedDraft();
    const nextErrors = validateCustomProvider(
      resolved,
      { taken: props.takenProviderIds, locked: props.providerIdLocked },
      t,
      format,
    );
    if (busy() || hasCustomProviderError(nextErrors)) return;
    const value = customProviderValue(resolved);
    props.onSubmit({
      ...value,
      apiFormat: apiFormat(),
      ...(props.harnesses ? { harness: harness() } : {}),
    });
  }

  const headingTitle = () => {
    const name = draft.displayName.trim();
    if (props.providerIdLocked) return name ? `编辑 ${name}` : "编辑第三方 API";
    return name ? `接入 ${name}` : "接入第三方 API";
  };

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay class="custom-provider-backdrop">
          <Dialog.Content
            as="section"
            class="custom-provider-dialog starbot-simple-api-dialog"
            aria-busy={busy() ? "true" : undefined}
            ref={setMount}
          >
            <Dialog.Title class="sr-only">
              {props.providerIdLocked ? t("customProvider.form.editTitle") : t("customProvider.form.title")}
            </Dialog.Title>
            <Dialog.Description class="sr-only">{t("customProvider.form.description")}</Dialog.Description>

            <header class="custom-provider-header">
              <Show when={props.onBack}>
                <IconButton
                  label={t("common.back")}
                  variant="ghost"
                  disabled={busy()}
                  data-cuelume-tap="navigate"
                  onClick={() => props.onBack?.()}
                >
                  <ArrowLeft />
                </IconButton>
              </Show>
              <span class="custom-provider-mark" aria-hidden="true">
                <KeyRound />
              </span>
              <div class="custom-provider-title">
                <Heading as="h2" size="md">
                  {headingTitle()}
                </Heading>
                <Text tone="muted" variant="caption">
                  只需填写接口地址、API Key 和模型名称，即可快速启用
                </Text>
              </div>
              <IconButton
                class="custom-provider-close"
                label={t("common.close")}
                variant="ghost"
                disabled={busy()}
                onClick={props.onCancel}
              >
                <X />
              </IconButton>
            </header>

            <form
              class="custom-provider-body"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <div class={["custom-provider-form", fades.classes()]} ref={fades.bind} onScroll={fades.measure}>
                <Show when={!props.providerIdLocked}>
                  <div class="starbot-api-format-section" style={{ "margin-bottom": "4px" }}>
                    <span class="starbot-api-field-label">国内主流平台快捷模板（点击一键填入地址与最新模型）</span>
                    <div
                      style={{
                        display: "flex",
                        "flex-wrap": "wrap",
                        gap: "6px",
                        "margin-top": "4px",
                      }}
                    >
                      <For
                        each={[
                          {
                            id: "qwen-dashscope",
                            label: "阿里千问 · 百炼",
                            name: "阿里千问 (百炼)",
                            baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
                            models: [
                              { id: "qwen3-max", name: "Qwen3-Max" },
                              { id: "qwen-plus-latest", name: "Qwen-Plus" },
                              { id: "qwen3-coder-plus", name: "Qwen3-Coder-Plus" },
                            ],
                          },
                          {
                            id: "doubao-ark",
                            label: "字节豆包 · 火山方舟",
                            name: "字节豆包 (火山方舟)",
                            baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
                            models: [
                              { id: "doubao-seed-1-6-250615", name: "Doubao-Seed-1.6" },
                              { id: "doubao-seed-1-6-thinking-250615", name: "Doubao-Seed-1.6-Thinking" },
                              { id: "doubao-1-5-pro-32k-250115", name: "Doubao-1.5-Pro" },
                            ],
                          },
                          {
                            id: "kimi-moonshot",
                            label: "月之暗面 · Kimi",
                            name: "Kimi 开放平台",
                            baseUrl: "https://api.moonshot.cn/v1",
                            models: [
                              { id: "kimi-k2-turbo-preview", name: "Kimi-K2-Turbo" },
                              { id: "moonshot-v1-128k", name: "Moonshot-128K" },
                            ],
                          },
                          {
                            id: "zhipu-glm",
                            label: "智谱 GLM · BigModel",
                            name: "智谱 GLM",
                            baseUrl: "https://open.bigmodel.cn/api/paas/v4",
                            models: [
                              { id: "glm-5", name: "GLM-5" },
                              { id: "glm-4.5-air", name: "GLM-4.5-Air" },
                            ],
                          },
                          {
                            id: "deepseek-cn",
                            label: "DeepSeek 官方",
                            name: "DeepSeek API",
                            baseUrl: "https://api.deepseek.com/v1",
                            models: [
                              { id: "deepseek-chat", name: "DeepSeek-V3/V4" },
                              { id: "deepseek-reasoner", name: "DeepSeek-Reasoner" },
                            ],
                          },
                        ]}
                      >
                        {(preset) => (
                          <button
                            type="button"
                            disabled={busy()}
                            onClick={() =>
                              setDraft((state) => {
                                state.apiFormat = "openai";
                                state.providerId = preset.id;
                                state.displayName = preset.name;
                                state.baseUrl = preset.baseUrl;
                                state.models = preset.models.map((m) => ({
                                  id: m.id,
                                  name: m.name,
                                }));
                              })
                            }
                            style={{
                              padding: "5px 10px",
                              "border-radius": "999px",
                              "font-size": "12px",
                              "font-weight": "500",
                              cursor: "pointer",
                              border:
                                draft.baseUrl === preset.baseUrl
                                  ? "1.5px solid var(--openbot-accent, #7c5cff)"
                                  : "1px solid var(--openbot-border, rgba(120, 115, 150, 0.25))",
                              background:
                                draft.baseUrl === preset.baseUrl
                                  ? "color-mix(in srgb, var(--openbot-accent, #7c5cff) 12%, transparent)"
                                  : "var(--openbot-bg-surface, rgba(255,255,255,0.6))",
                              color: "var(--openbot-text-primary)",
                            }}
                          >
                            + {preset.label}
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <div class="starbot-api-format-section">
                  <span class="starbot-api-field-label">接口兼容格式</span>
                  <div class="starbot-api-format-grid" role="radiogroup" aria-label="接口兼容格式">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={apiFormat() === "openai" ? "true" : "false"}
                      class="starbot-api-format-card"
                      data-selected={apiFormat() === "openai" ? "" : undefined}
                      disabled={busy()}
                      onClick={() =>
                        setDraft((state) => {
                          state.apiFormat = "openai";
                        })
                      }
                    >
                      <span class="starbot-api-format-top">
                        <strong>OpenAI 兼容格式</strong>
                        <span class="starbot-api-format-tag">推荐</span>
                      </span>
                      <small>适用 GPT、DeepSeek、Kimi、Qwen、OpenRouter 等绝大多数平台</small>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={apiFormat() === "anthropic" ? "true" : "false"}
                      class="starbot-api-format-card"
                      data-selected={apiFormat() === "anthropic" ? "" : undefined}
                      disabled={busy()}
                      onClick={() =>
                        setDraft((state) => {
                          state.apiFormat = "anthropic";
                        })
                      }
                    >
                      <span class="starbot-api-format-top">
                        <strong>Anthropic 兼容格式</strong>
                      </span>
                      <small>适用 Claude 官方接口及 Anthropic Messages 协议中转站</small>
                    </button>
                  </div>
                </div>

                <div class="custom-provider-fields">
                  <Field label="API 地址（Base URL）" error={shown()?.baseUrl} required>
                    <Input
                      value={draft.baseUrl}
                      onValueChange={(value) =>
                        setDraft((state) => {
                          state.baseUrl = value;
                        })
                      }
                      placeholder={apiFormat() === "anthropic" ? ANTHROPIC_URL_PLACEHOLDER : OPENAI_URL_PLACEHOLDER}
                      inputmode="url"
                      autocomplete="off"
                      spellcheck={false}
                      maxlength={CUSTOM_PROVIDER_LIMITS.baseUrl}
                      disabled={busy()}
                    />
                  </Field>

                  <Field
                    label="API Key"
                    description={
                      props.apiKeyKept
                        ? "已安全保存密钥；如需更换请重新输入，留空保持不变"
                        : "请粘贴对应平台生成的 API Key（本机免密服务可留空）"
                    }
                    error={shown()?.apiKey}
                  >
                    <div class="starbot-api-key-wrap">
                      <Input
                        type={showKey() ? "text" : "password"}
                        value={draft.apiKey}
                        onValueChange={(value) =>
                          setDraft((state) => {
                            state.apiKey = value;
                          })
                        }
                        placeholder={props.apiKeyKept ? "已保存（留空保持不变）" : "sk-..."}
                        autocomplete="off"
                        spellcheck={false}
                        maxlength={CUSTOM_PROVIDER_LIMITS.apiKey}
                        disabled={busy()}
                      />
                      <IconButton
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="starbot-api-key-toggle"
                        label={showKey() ? "隐藏 API Key" : "显示 API Key"}
                        disabled={busy()}
                        onClick={() => setShowKey((prev) => !prev)}
                      >
                        <Show when={showKey()} fallback={<Eye />}>
                          <EyeOff />
                        </Show>
                      </IconButton>
                    </div>
                  </Field>

                  <section class="starbot-simple-models" aria-label="模型名称">
                    <div class="custom-provider-rows-heading">
                      <span class="starbot-api-field-label">
                        模型名称 <span class="starbot-required-star">*</span>
                      </span>
                      <Show when={props.onDiscoverModels}>
                        {(discover) => (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            class="custom-provider-discover"
                            disabled={busy() || !draft.baseUrl.trim() || discovery().status === "loading"}
                            onClick={() => {
                              fillNextList = true;
                              discover()(customProviderEndpoint(resolvedDraft()));
                            }}
                          >
                            <RefreshCw />
                            {discovery().status === "idle" ? "自动获取模型" : "重新获取"}
                          </Button>
                        )}
                      </Show>
                    </div>

                    <div class="starbot-simple-model-list">
                      <For each={draft.models}>
                        {(row, index) => (
                          <div class="starbot-simple-model-row">
                            <div class="starbot-simple-model-input-row">
                              <Input
                                value={row.id}
                                onValueChange={(value) =>
                                  setDraft((state) => {
                                    const model = state.models[index()];
                                    if (!model) return;
                                    model.id = value;
                                    if (!model.name.trim() || model.name === row.id) model.name = value;
                                  })
                                }
                                placeholder={MODEL_ID_PLACEHOLDER}
                                autocomplete="off"
                                spellcheck={false}
                                maxlength={INPUT_LIMITS.modelName}
                                disabled={busy()}
                                class="custom-provider-mono"
                              />
                              <Show when={draft.models.length > 1}>
                                <IconButton
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  label={t("customProvider.model.remove", { number: index() + 1 })}
                                  disabled={busy()}
                                  onClick={() =>
                                    setDraft((state) => {
                                      state.models.splice(index(), 1);
                                    })
                                  }
                                >
                                  <Trash2 />
                                </IconButton>
                              </Show>
                            </div>
                            <Show when={shown()?.modelRows[index()]}>
                              {(err) => (
                                <Text class="custom-provider-row-error" tone="danger" variant="caption" role="alert">
                                  {err()}
                                </Text>
                              )}
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>

                    <Show when={shown()?.models}>
                      {(err) => (
                        <Text class="custom-provider-rows-error" tone="danger" variant="caption" role="alert">
                          {err()}
                        </Text>
                      )}
                    </Show>

                    <div class="starbot-simple-model-footer">
                      <Show when={draft.models.length < CUSTOM_PROVIDER_LIMITS.models}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          disabled={busy()}
                          onClick={() =>
                            setDraft((state) => {
                              state.models.push({ id: "", name: "" });
                            })
                          }
                        >
                          <Plus />
                          添加模型
                        </Button>
                      </Show>
                    </div>

                    <Switch>
                      <Match when={discovery().status === "loading"}>
                        <div class="custom-provider-discovery-status" role="status">
                          <Spinner size="sm" />
                          <Text tone="muted" variant="caption">
                            正在从 {draft.baseUrl.trim()} 拉取可用模型…
                          </Text>
                        </div>
                      </Match>
                      <Match when={discoveryFailed()}>
                        {(message) => (
                          <Text class="custom-provider-rows-error" tone="danger" variant="caption" role="alert">
                            {message()}
                          </Text>
                        )}
                      </Match>
                      <Match when={discovered()}>
                        {(models) => (
                          <Show
                            when={models().length > 0}
                            fallback={
                              <Text tone="muted" variant="caption" role="status">
                                未从该接口拉取到模型列表，请直接手动输入模型名称。
                              </Text>
                            }
                          >
                            <div class="starbot-discovered-picker-box">
                              <Text tone="muted" variant="caption" role="status">
                                已发现 {models().length} 个可用模型，勾选即可添加：
                              </Text>
                              <Show
                                when={
                                  props.contextWindows &&
                                  draft.models.some((row) =>
                                    models().some((model) => model.id === row.id.trim() && holdsFoundValues(row, model)),
                                  )
                                }
                              >
                                <Text tone="muted" variant="caption">
                                  {t("customProvider.model.foundValuesHint")}
                                </Text>
                              </Show>
                              <FoundModelPicker
                                models={models()}
                                listed={listed}
                                full={full()}
                                busy={busy()}
                                open={picking()}
                                mount={mount()}
                                onOpenChange={setPicking}
                                onToggle={toggleModel}
                                onToggleAll={toggleModels}
                              />
                            </div>
                          </Show>
                        )}
                      </Match>
                    </Switch>
                  </section>
                </div>

                <div class="starbot-advanced-disclosure">
                  <button
                    type="button"
                    class="starbot-advanced-toggle"
                    aria-expanded={advancedOpen() ? "true" : "false"}
                    onClick={() => setAdvancedOpen((prev) => !prev)}
                  >
                    <span>高级选项（名称、自定义 ID、请求头等，普通用户无需填写）</span>
                    <Show when={advancedOpen()} fallback={<ChevronDown aria-hidden="true" />}>
                      <ChevronUp aria-hidden="true" />
                    </Show>
                  </button>

                  <Show when={advancedOpen()}>
                    <div class="starbot-advanced-body">
                      <div class="starbot-advanced-two-col">
                        <Field label="显示名称（选填）" error={shown()?.displayName}>
                          <Input
                            value={draft.displayName}
                            onValueChange={(value) =>
                              setDraft((state) => {
                                state.displayName = value;
                              })
                            }
                            placeholder="留空将按网址自动命名"
                            maxlength={INPUT_LIMITS.agentName}
                            disabled={busy()}
                          />
                        </Field>

                        <Field label="服务商标识 ID（选填）" error={shown()?.providerId}>
                          <Input
                            value={draft.providerId}
                            onValueChange={(value) =>
                              setDraft((state) => {
                                state.providerId = value;
                              })
                            }
                            placeholder={PROVIDER_ID_PLACEHOLDER}
                            autocomplete="off"
                            spellcheck={false}
                            maxlength={INPUT_LIMITS.identifier}
                            disabled={busy() || Boolean(props.providerIdLocked)}
                          />
                        </Field>
                      </div>

                      <Show when={props.contextWindows}>
                        <RepeatableRows
                          label="模型详细参数（上下文窗口 / 最大输出 / 推理档位）"
                          removeLabel={(number) => t("customProvider.model.remove", { number })}
                          addLabel={t("customProvider.model.add")}
                          columns={advancedModelColumns}
                          rows={draft.models}
                          limit={CUSTOM_PROVIDER_LIMITS.models}
                          busy={busy()}
                          rowError={(index) => shown()?.modelRows[index]}
                          table={modelTable}
                          onAdd={() =>
                            setDraft((state) => {
                              state.models.push({ id: "", name: "" });
                            })
                          }
                          onRemove={(index) =>
                            setDraft((state) => {
                              state.models.splice(index, 1);
                            })
                          }
                        />
                      </Show>

                      <RepeatableRows
                        label="自定义请求头（选填）"
                        removeLabel={(number) => t("customProvider.header.remove", { number })}
                        addLabel={t("customProvider.header.add")}
                        columns={headerColumns}
                        rows={draft.headers}
                        limit={CUSTOM_PROVIDER_LIMITS.headers}
                        busy={busy()}
                        rowError={(index) => shown()?.headerRows[index]}
                        onAdd={() =>
                          setDraft((state) => {
                            state.headers.push({ name: "", value: "" });
                          })
                        }
                        onRemove={(index) =>
                          setDraft((state) => {
                            state.headers.splice(index, 1);
                          })
                        }
                      />
                    </div>
                  </Show>
                </div>
              </div>

              <footer class="custom-provider-actions">
                <Show when={props.submitError || props.harnessError}>
                  {(message) => (
                    <Text class="custom-provider-submit-error" tone="danger" variant="caption" role="alert">
                      {message()}
                    </Text>
                  )}
                </Show>
                <Button type="submit" variant="default" loading={busy()} loadingLabel={t("common.saving")}>
                  {props.providerIdLocked ? "保存修改" : "保存并接入"}
                </Button>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
