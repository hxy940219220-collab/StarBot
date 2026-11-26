import { router } from "expo-router";
import { Typography } from "heroui-native";
import Info from "lucide-react-native/icons/info";
import Languages from "lucide-react-native/icons/languages";
import Palette from "lucide-react-native/icons/palette";
import { mobileUserName } from "@/features/auth/api/mobile-user-name";
import { useMobileSession } from "@/features/auth/context/mobile-session-context";
import { SettingsContent, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { RowIcon } from "@/features/settings/components/settings-row-icon";
import { ProfileAvatar } from "@/shared/components/profile-avatar";
import { useText } from "@/shared/lib/text";

export function SettingsScreen() {
  const { session } = useMobileSession();
  const { t } = useText();
  const displayName = session ? mobileUserName(session.user) : t("mobile.settings.home.profile");
  return (
    <SettingsContent>
      <SettingsSection>
        <SettingsRow
          onPress={() => router.push("/settings/profile")}
          supportingText={session?.user.email}
          leading={
            <ProfileAvatar
              neutral
              name={displayName}
              imageUrl={session?.user.avatarUrl ? new URL(session.user.avatarUrl, session.apiUrl).toString() : null}
              size={40}
            />
          }
        >
          <Typography.Paragraph>{displayName}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection title={t("mobile.settings.home.preferences")}>
        <SettingsRow leading={<RowIcon icon={Palette} />} onPress={() => router.push("/settings/appearance")}>
          <Typography.Paragraph>{t("mobile.settings.appearance.title")}</Typography.Paragraph>
        </SettingsRow>
        <SettingsRow leading={<RowIcon icon={Languages} />} onPress={() => router.push("/settings/language")}>
          <Typography.Paragraph>{t("mobile.settings.language.title")}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection>
        <SettingsRow leading={<RowIcon icon={Info} />} onPress={() => router.push("/settings/about")}>
          <Typography.Paragraph>{t("mobile.settings.home.about")}</Typography.Paragraph>
        </SettingsRow>
      </SettingsSection>
    </SettingsContent>
  );
}
