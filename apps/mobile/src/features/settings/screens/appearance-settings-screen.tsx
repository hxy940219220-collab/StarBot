import { APP_INTERFACE_SIZES, type AppInterfaceSize } from "@openbot/contracts/ipc";
import { Typography } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useUniwind } from "uniwind";
import { SettingsContent, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { SettingsSwitch } from "@/features/settings/components/settings-controls";
import { SettingsPictureChoice } from "@/features/settings/components/settings-picture-choice";
import { ThemePicture } from "@/features/settings/components/settings-pictures";
import { type Appearance, saveAppearance, useAppearance } from "@/features/settings/model/appearance";
import { saveTextSize, useTextSize } from "@/features/settings/model/text-size";
import { PauseSlider } from "@/features/voice/components/pause-slider";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";
import { loadUiSoundPreference, setUiSoundEnabled, uiFeedback, useUiSoundPreference } from "@/shared/lib/ui-feedback";

export function AppearanceSettingsScreen() {
  return (
    <SettingsContent>
      <ThemeSection />
      <TextSizeSection />
      <SoundSection />
    </SettingsContent>
  );
}

function SoundSection() {
  const { t } = useText();
  const { theme } = useUniwind();
  const enabled = useUiSoundPreference((state) => state.enabled);
  const ready = useUiSoundPreference((state) => state.ready);

  useEffect(() => {
    void loadUiSoundPreference();
  }, []);

  return (
    <SettingsSection footer={t("mobile.app.uiSoundsFooter")}>
      <SettingsRow>
        <SettingsSwitch
          value={enabled}
          disabled={!ready}
          label={t("mobile.app.uiSounds")}
          dark={theme === "dark"}
          onValueChange={(next) => {
            setUiSoundEnabled(next);
            if (next) uiFeedback.confirm();
            else void haptics.selection();
          }}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

function ThemeSection() {
  const { t } = useText();
  const { value, ready } = useAppearance();
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsSection
      title={t("mobile.settings.appearance.theme")}
      footer={error || t("mobile.settings.appearance.footer")}
    >
      <SettingsPictureChoice<Appearance>
        label={t("mobile.settings.appearance.theme")}
        value={value}
        disabled={!ready}
        options={(
          [
            ["light", t("mobile.settings.appearance.light")],
            ["dark", t("mobile.settings.appearance.dark")],
            ["system", t("mobile.settings.appearance.system")],
          ] as const
        ).map(([mode, label]) => ({
          value: mode,
          label,
          picture: (play: number) => <ThemePicture mode={mode} play={play} />,
        }))}
        onChange={(next) => {
          setError(null);
          void saveAppearance(next).catch(() => {
            setError(t("mobile.settings.appearance.saveFailed"));
            void haptics.notification("error");
          });
        }}
      />
    </SettingsSection>
  );
}

function TextSizeSection() {
  const { t, format } = useText();
  const ready = useTextSize((state) => state.ready);
  const saved = useTextSize((state) => state.percent);
  const [error, setError] = useState<string | null>(null);
  const [dragged, setDragged] = useState<AppInterfaceSize | null>(null);
  const shown = dragged ?? saved;
  const lastStep = useRef(shown);
  const step = (index: number) =>
    APP_INTERFACE_SIZES[Math.min(APP_INTERFACE_SIZES.length - 1, Math.max(0, Math.round(index)))] ?? saved;
  const label = t("mobile.settings.appearance.textSize");
  return (
    <SettingsSection footer={error ?? t("mobile.settings.appearance.textSizeFooter")}>
      <View className="gap-3 px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Typography.Paragraph>{label}</Typography.Paragraph>
          <Typography.Paragraph className="text-grouped-secondary">{format.percent(shown / 100)}</Typography.Paragraph>
        </View>
        <PauseSlider
          value={APP_INTERFACE_SIZES.indexOf(shown)}
          minimum={0}
          maximum={APP_INTERFACE_SIZES.length - 1}
          step={1}
          disabled={!ready}
          label={label}
          onChange={(index) => {
            const next = step(index);
            if (next === lastStep.current) return;
            lastStep.current = next;
            uiFeedback.tick();
            setDragged(next);
          }}
          onChangeEnd={(index) => {
            const next = step(index);
            lastStep.current = next;
            setDragged(null);
            if (next === saved) return;
            setError(null);
            void saveTextSize(next).catch(() => {
              setError(t("mobile.settings.saveFailed"));
              uiFeedback.error();
            });
          }}
        />
      </View>
    </SettingsSection>
  );
}
