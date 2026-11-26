import { router } from "expo-router";
import { Typography } from "heroui-native";
import Info from "lucide-react-native/icons/info";
import Languages from "lucide-react-native/icons/languages";
import LogOut from "lucide-react-native/icons/log-out";
import Palette from "lucide-react-native/icons/palette";
import { useState } from "react";
import { Alert } from "react-native";
import { mobileUserName } from "@/features/auth/api/mobile-user-name";
import { useMobileSession } from "@/features/auth/context/mobile-session-context";
import { SettingsContent, SettingsRow, SettingsSection } from "@/features/settings/components/settings-content";
import { RowIcon } from "@/features/settings/components/settings-row-icon";
import { ProfileAvatar } from "@/shared/components/profile-avatar";
import { haptics } from "@/shared/lib/haptics";
import { useText } from "@/shared/lib/text";

export function SettingsScreen() {
  const { session, signOut } = useMobileSession();
  const { t } = useText();
  const [signingOut, setSigningOut] = useState(false);
  const displayName = session ? mobileUserName(session.user) : t("mobile.settings.home.profile");

  function confirmSignOut() {
    if (signingOut) return;
    Alert.alert(t("mobile.settings.profile.signOutTitle"), t("mobile.settings.profile.signOutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("mobile.settings.profile.signOut"),
        style: "destructive",
        onPress: () => {
          setSigningOut(true);
          void haptics.notification("warning");
          void signOut().finally(() => setSigningOut(false));
        },
      },
    ]);
  }

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
      {session ? (
        <SettingsSection>
          <SettingsRow
            leading={<LogOut color="#ef4444" size={20} strokeWidth={2} />}
            disclosure={false}
            disabled={signingOut}
            onPress={confirmSignOut}
          >
            <Typography.Paragraph className="font-medium text-danger-text">
              {t("mobile.settings.profile.signOut")}
            </Typography.Paragraph>
          </SettingsRow>
        </SettingsSection>
      ) : null}
    </SettingsContent>
  );
}
