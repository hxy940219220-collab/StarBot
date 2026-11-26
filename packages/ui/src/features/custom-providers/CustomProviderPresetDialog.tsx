import {
  Badge,
  Button,
  ChevronRight,
  Dialog,
  Globe2,
  HardDrive,
  Heading,
  IconButton,
  KeyRound,
  Text,
  X,
} from "@openbot/ui";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import { useText } from "../../text";
import {
  type CustomProviderPresetId,
  type LocalServerProbe,
  THIRD_PARTY_API_PRESETS,
} from "./custom-provider-presets";

interface CustomProviderPresetDialogProps {
  open: boolean;
  probes?: Partial<Record<"ollama" | "lmstudio", LocalServerProbe>>;
  onChoose: (preset: CustomProviderPresetId) => void;
  onCancel: () => void;
}

interface PresetRow {
  id: CustomProviderPresetId;
  icon: () => JSX.Element;
  title: () => string;
  description: () => string;
}

function ProbeBadge(badge: { probe: LocalServerProbe }) {
  const { t } = useText();
  return (
    <Show
      when={badge.probe.status === "running" ? badge.probe : undefined}
      fallback={<Badge variant="secondary">{t("customProvider.probe.checking")}</Badge>}
    >
      {(running) => (
        <Badge variant="success-light">{t("customProvider.probe.running", { count: running().models })}</Badge>
      )}
    </Show>
  );
}

function PresetGroup(group: {
  label: string;
  rows: readonly PresetRow[];
  probe: (id: CustomProviderPresetId) => LocalServerProbe | undefined;
  onChoose: (preset: CustomProviderPresetId) => void;
}) {
  return (
    <section class="custom-provider-preset-group" aria-label={group.label}>
      <Text variant="label-sm" tone="muted">
        {group.label}
      </Text>
      <ul class="custom-provider-presets">
        <For each={group.rows}>
          {(row) => (
            <li>
              <Button
                type="button"
                variant="ghost"
                class="custom-provider-preset"
                onClick={() => group.onChoose(row.id)}
              >
                <span class="custom-provider-preset-icon" aria-hidden="true">
                  {row.icon()}
                </span>
                <span class="custom-provider-preset-copy">
                  <span class="custom-provider-preset-title">{row.title()}</span>
                  <span class="custom-provider-preset-description">{row.description()}</span>
                </span>
                <Show when={group.probe(row.id)}>{(state) => <ProbeBadge probe={state()} />}</Show>
                <ChevronRight class="custom-provider-preset-chevron" aria-hidden="true" />
              </Button>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

export function CustomProviderPresetDialog(props: CustomProviderPresetDialogProps) {
  const { t } = useText();

  const localAndOtherRows: readonly PresetRow[] = [
    {
      id: "openai-compatible",
      icon: () => <Globe2 />,
      title: () => "自定义 API 接口（OpenAI / Anthropic 兼容）",
      description: () => "任意第三方中转站或私有模型地址，填 URL 与 API Key 即可",
    },
    {
      id: "ollama",
      icon: () => <HardDrive />,
      title: () => t("customProvider.preset.ollama"),
      description: () => t("customProvider.preset.ollamaDescription"),
    },
    {
      id: "lmstudio",
      icon: () => <HardDrive />,
      title: () => t("customProvider.preset.lmstudio"),
      description: () => t("customProvider.preset.lmstudioDescription"),
    },
  ];

  const probe = (id: CustomProviderPresetId): LocalServerProbe | undefined =>
    id === "ollama" || id === "lmstudio" ? props.probes?.[id] : undefined;

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay class="custom-provider-backdrop">
          <Dialog.Content as="section" class="custom-provider-dialog custom-provider-dialog-presets">
            <Dialog.Title class="sr-only">{t("customProvider.preset.title")}</Dialog.Title>
            <Dialog.Description class="sr-only">{t("customProvider.preset.description")}</Dialog.Description>

            <header class="custom-provider-header">
              <span class="custom-provider-mark" aria-hidden="true">
                <KeyRound />
              </span>
              <div class="custom-provider-title">
                <Heading as="h2" size="md">
                  选择第三方 API 平台
                </Heading>
                <Text tone="muted" variant="caption">
                  点选任意平台即可自动填好接口地址、兼容格式与推荐模型，只需填入 API Key
                </Text>
              </div>
              <IconButton
                class="custom-provider-close"
                label={t("common.close")}
                variant="ghost"
                onClick={props.onCancel}
              >
                <X />
              </IconButton>
            </header>

            <div class="custom-provider-list">
              <section class="custom-provider-preset-group" aria-label="快捷接入第三方 API">
                <Text variant="label-sm" tone="muted">
                  主流模型平台（14 家一键预设）
                </Text>
                <div class="starbot-api-preset-grid">
                  <For each={THIRD_PARTY_API_PRESETS}>
                    {(preset) => (
                      <button
                        type="button"
                        class="starbot-api-preset-card"
                        onClick={() => props.onChoose(preset.id)}
                      >
                        <span
                          class="starbot-api-preset-badge"
                          style={{ background: preset.accent }}
                          aria-hidden="true"
                        >
                          {preset.badge}
                        </span>
                        <span class="starbot-api-preset-info">
                          <strong>{preset.name}</strong>
                          <small>{preset.description}</small>
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </section>

              <PresetGroup
                label="自定义接口与本机模型服务"
                rows={localAndOtherRows}
                probe={probe}
                onChoose={props.onChoose}
              />
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
