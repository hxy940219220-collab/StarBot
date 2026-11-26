import { Image } from "expo-image";
import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useEffect } from "react";
import { View } from "react-native";
import appIconAsset from "@/assets/icons/app-icon.png";
import { SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { APP_ICON_LABELS, loadAppIcon, useAppIcon } from "@/features/settings/model/app-icon";
import { useText } from "@/shared/lib/text";

export function AppIconSection() {
  const { t } = useText();
  const { value, ready } = useAppIcon();

  useEffect(() => {
    void loadAppIcon().catch(() => undefined);
  }, []);

  if (!ready || value === null) return null;
  return (
    <SettingsSection>
      <SettingsRow
        value={t(APP_ICON_LABELS[value])}
        onPress={() => router.push("/settings/app-icon")}
        leading={
          <View className="size-8 items-center justify-center overflow-hidden rounded-[8px]">
            <Image source={appIconAsset} style={{ width: 32, height: 32 }} contentFit="cover" accessible={false} />
          </View>
        }
      >
        <Typography.Paragraph>{t("mobile.settings.appearance.appIcon")}</Typography.Paragraph>
      </SettingsRow>
    </SettingsSection>
  );
}
