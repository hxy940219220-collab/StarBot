import { NOTIFICATION_SOUNDS, type NotificationSound } from "@starbot/contracts/notification-relay";
import type { MobileTextKey } from "@starbot/i18n/mobile";
import * as Notifications from "expo-notifications";
import { currentText } from "@/shared/lib/text";

export function androidChannelId(sound: NotificationSound | null): string {
  if (sound === null || sound === "default") return `starbot.sound.${sound ?? "none"}`;
  return `starbot.sound.${sound}.v2`;
}

const SOUND_FILES: Readonly<Record<Exclude<NotificationSound, "default">, string>> = {
  starbot: "starbot_task.wav",
  warm: "starbot_warm.wav",
  mech: "starbot_mech.wav",
  bubble: "starbot_bubble.wav",
  press: "starbot_press.wav",
};

const SOUND_LABELS = {
  starbot: "mobile.settings.notifications.sound.starbot",
  warm: "mobile.settings.notifications.sound.warm",
  mech: "mobile.settings.notifications.sound.mech",
  bubble: "mobile.settings.notifications.sound.bubble",
  press: "mobile.settings.notifications.sound.press",
  default: "mobile.settings.notifications.sound.defaultAndroid",
} as const satisfies Record<NotificationSound, MobileTextKey>;

export async function createAndroidChannels(): Promise<void> {
  const { t } = currentText();
  for (const sound of Object.keys(SOUND_FILES)) {
    await Notifications.deleteNotificationChannelAsync(`starbot.sound.${sound}`);
  }
  for (const sound of NOTIFICATION_SOUNDS) {
    await Notifications.setNotificationChannelAsync(androidChannelId(sound), {
      name: t("mobile.settings.notifications.channel", { sound: t(SOUND_LABELS[sound]) }),
      importance: Notifications.AndroidImportance.HIGH,
      ...(sound === "default" ? {} : { sound: SOUND_FILES[sound] }),
    });
  }
  await Notifications.setNotificationChannelAsync(androidChannelId(null), {
    name: t("mobile.settings.notifications.channelSilent"),
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    enableVibrate: false,
  });
}
