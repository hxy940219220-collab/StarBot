import {
  type AppInfo,
  type AppVariant,
  DEFAULT_DYNAMIC_ISLAND_PREFERENCE,
  DYNAMIC_ISLAND_SIZE_LIMITS,
  type DynamicIslandGeometry,
  type DynamicIslandNotchSize,
  type DynamicIslandPresentation,
  type ServerSummary,
} from "@starbot/contracts/ipc";
import { Button, ItemGroup, SettingsSection, SliderField, SwitchField } from "@starbot/ui";
import {
  StarBotDynamicIsland,
  starBotIdleCompactWidth,
} from "@starbot/ui/features/dynamic-island/StarBotDynamicIsland";
import type { GeneralSettingsValue } from "@starbot/ui/features/settings/app-settings";
import type { JSX } from "@solidjs/web";
import { createSignal, onSettled, Show } from "solid-js";
import { useI18n } from "../../i18n-context";
import { usePlatform } from "../../platform";
import { settingsPort } from "./settings-port";
import { XWaylandRestartRow } from "./XWaylandRestartRow";

const PREVIEW_NOTCH_SIZE: DynamicIslandNotchSize = { width: 192, height: 32 };
const PREVIEW_FIT_INSET = 12;
const PREVIEW_ACTIVE_PRESENTATION: DynamicIslandPresentation = {
  serverId: "local",
  mode: "working",
  working: [
    {
      agent: {
        id: "preview-starbot",
        name: "星友",
        avatarSeed: "zodiac-leo",
        avatarHue: null,
        avatarUrl: null,
      },
      task: "正在整理要点…",
      turnId: "preview-turn",
    },
  ],
};

export interface SettingsDynamicIslandTabProps {
  value: GeneralSettingsValue;
  variant: AppVariant;
  platform: AppInfo["platform"] | undefined;
  builtInDisplayGeometry?: DynamicIslandGeometry | undefined;
  servers: readonly ServerSummary[];
  onUpdateSetting: <Key extends keyof GeneralSettingsValue>(key: Key, value: GeneralSettingsValue[Key]) => void;
  onUpdateSettings: (patch: Partial<GeneralSettingsValue>) => void;
}

export function SettingsDynamicIslandTab(props: SettingsDynamicIslandTabProps) {
  const i18n = useI18n();
  const isMac = () => props.platform === "darwin";
  const showKey = () => (isMac() ? "settings.notch.show.title" : "settings.notch.show.titleTopOfScreen");
  const platform = usePlatform();
  const linux = () => props.platform === "linux";
  const screenSupport = () => (linux() && props.value.macBookNotch ? platform.appInfo()?.aboveAppsSupport : undefined);
  const widthPercent = () => props.value.macBookNotchWidthPercent;
  const heightPercent = () => props.value.macBookNotchHeightPercent;
  const widestBuiltInWidth = () =>
    starBotIdleCompactWidth("notch", builtInNotchSize(), DYNAMIC_ISLAND_SIZE_LIMITS.widthPercent.max);
  const widestExternalWidth = starBotIdleCompactWidth("island", undefined, DYNAMIC_ISLAND_SIZE_LIMITS.widthPercent.max);
  const builtInNotchSize = (): DynamicIslandNotchSize | undefined =>
    props.builtInDisplayGeometry === null ? undefined : (props.builtInDisplayGeometry ?? PREVIEW_NOTCH_SIZE);
  const isDefaultSize = () =>
    props.value.macBookNotchWidthPercent === DEFAULT_DYNAMIC_ISLAND_PREFERENCE.widthPercent &&
    props.value.macBookNotchHeightPercent === DEFAULT_DYNAMIC_ISLAND_PREFERENCE.heightPercent;

  function resetSize(): void {
    props.onUpdateSettings({
      macBookNotchWidthPercent: DEFAULT_DYNAMIC_ISLAND_PREFERENCE.widthPercent,
      macBookNotchHeightPercent: DEFAULT_DYNAMIC_ISLAND_PREFERENCE.heightPercent,
    });
  }

  return (
    <>
      <SettingsSection title={i18n.t("settings.notch.title")}>
        <ItemGroup class="settings-modal-card">
          <SwitchField
            data-settings-row={showKey()}
            checked={props.value.macBookNotch}
            onChange={(checked) => props.onUpdateSetting("macBookNotch", checked)}
            label={i18n.t(showKey())}
            description={i18n.t("settings.notch.show.description")}
          />
          <XWaylandRestartRow
            support={screenSupport()}
            keys={{
              title: "settings.notch.xwayland.title",
              description: "settings.notch.xwayland.description",
              unsupported: "settings.notch.xwayland.unsupported",
              restart: "settings.notch.xwayland.restart",
            }}
            onRestart={() => settingsPort().dynamicIsland.setXWayland({ enabled: true })}
          />
          <SwitchField
            data-settings-row="settings.notch.displays.title"
            checked={props.value.macBookNotchAdditionalDisplays}
            disabled={!props.value.macBookNotch}
            onChange={(checked) => props.onUpdateSetting("macBookNotchAdditionalDisplays", checked)}
            label={i18n.t("settings.notch.displays.title")}
            description={i18n.t("settings.notch.displays.description")}
          />
          <Show when={isMac()}>
            <SwitchField
              data-settings-row="settings.notch.haptics.title"
              checked={props.value.macBookNotchHaptics}
              disabled={!props.value.macBookNotch}
              onChange={(checked) => props.onUpdateSetting("macBookNotchHaptics", checked)}
              label={i18n.t("settings.notch.haptics.title")}
              description={i18n.t("settings.notch.haptics.description")}
            />
          </Show>
        </ItemGroup>
      </SettingsSection>

      <SettingsSection
        data-settings-row="settings.notch.size.title"
        title={i18n.t("settings.notch.size.title")}
        description={linux() ? undefined : i18n.t("settings.notch.size.description")}
        actions={
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!props.value.macBookNotch || isDefaultSize()}
            onClick={resetSize}
          >
            {i18n.t("settings.notch.size.reset")}
          </Button>
        }
      >
        <ItemGroup class="settings-modal-card settings-dynamic-island-size">
          <div class="settings-dynamic-island-preview">
            <Show when={!linux()}>
              <figure class="settings-dynamic-island-preview-display">
                <PreviewFit widestWidth={widestBuiltInWidth()}>
                  <StarBotDynamicIsland
                    presentation={PREVIEW_ACTIVE_PRESENTATION}
                    state="compact"
                    displayMode="notch"
                    notchSize={builtInNotchSize()}
                    variant={props.variant}
                    widthPercent={widthPercent()}
                    heightPercent={heightPercent()}
                    onStateChange={() => undefined}
                    onAction={() => undefined}
                  />
                </PreviewFit>
                <figcaption class="settings-dynamic-island-preview-caption">
                  {i18n.t("settings.notch.size.previewNotch")}
                </figcaption>
              </figure>
            </Show>
            <figure class="settings-dynamic-island-preview-display">
              <PreviewFit widestWidth={widestExternalWidth}>
                <StarBotDynamicIsland
                  presentation={PREVIEW_ACTIVE_PRESENTATION}
                  state="compact"
                  displayMode="island"
                  variant={props.variant}
                  widthPercent={widthPercent()}
                  heightPercent={heightPercent()}
                  onStateChange={() => undefined}
                  onAction={() => undefined}
                />
              </PreviewFit>
              <Show when={!linux()}>
                <figcaption class="settings-dynamic-island-preview-caption">
                  {i18n.t("settings.notch.size.previewIsland")}
                </figcaption>
              </Show>
            </figure>
          </div>
          <SliderField
            label={i18n.t("settings.notch.size.width")}
            value={widthPercent()}
            minValue={DYNAMIC_ISLAND_SIZE_LIMITS.widthPercent.min}
            maxValue={DYNAMIC_ISLAND_SIZE_LIMITS.widthPercent.max}
            step={DYNAMIC_ISLAND_SIZE_LIMITS.widthPercent.step}
            disabled={!props.value.macBookNotch}
            formatValue={(value) => `${value}%`}
            onChange={(value) => props.onUpdateSetting("macBookNotchWidthPercent", value)}
          />
          <SliderField
            label={i18n.t("settings.notch.size.height")}
            value={heightPercent()}
            minValue={DYNAMIC_ISLAND_SIZE_LIMITS.heightPercent.min}
            maxValue={DYNAMIC_ISLAND_SIZE_LIMITS.heightPercent.max}
            step={DYNAMIC_ISLAND_SIZE_LIMITS.heightPercent.step}
            disabled={!props.value.macBookNotch}
            formatValue={(value) => `${value}%`}
            onChange={(value) => props.onUpdateSetting("macBookNotchHeightPercent", value)}
          />
        </ItemGroup>
      </SettingsSection>
    </>
  );
}

function PreviewFit(props: { widestWidth: number | undefined; children: JSX.Element }): JSX.Element {
  let frame: HTMLDivElement | undefined;
  const [available, setAvailable] = createSignal(0);
  const scale = () => {
    const widest = props.widestWidth ?? 0;
    const room = available() - PREVIEW_FIT_INSET * 2;
    return widest > room && room > 0 ? room / widest : 1;
  };
  onSettled(() => {
    const root = frame;
    if (!root) return;
    const resize = new ResizeObserver(() => setAvailable(root.clientWidth));
    resize.observe(root);
    return () => resize.disconnect();
  });
  return (
    <div ref={frame} class="settings-dynamic-island-preview-bar" inert>
      <div class="settings-dynamic-island-preview-fit" style={{ "--settings-dynamic-island-preview-scale": scale() }}>
        {props.children}
      </div>
    </div>
  );
}
