import { Image } from "expo-image";
import { Typography } from "heroui-native";
import { View } from "react-native";
import appIconAsset from "@/assets/icons/app-icon.png";
import { SettingsContent } from "@/features/settings/components/settings-content";
import { useText } from "@/shared/lib/text";

export function AppIconSettingsScreen() {
  const { t } = useText();
  return (
    <SettingsContent>
      <View className="items-center gap-4 py-8">
        <Image
          source={appIconAsset}
          style={{ width: 120, height: 120, borderRadius: 28 }}
          contentFit="cover"
          accessible={false}
        />
        <Typography.Paragraph className="font-semibold text-lg">
          {t("mobile.settings.appearance.appIcon")}
        </Typography.Paragraph>
      </View>
    </SettingsContent>
  );
}
