import { Share } from "react-native";
import { supportLog, supportLogValue } from "@/features/support/model/support-log";

const SHARE_MESSAGE = "星友 StarBot";

export function shareStarBot(): void {
  Share.share({ message: SHARE_MESSAGE }).catch((error: unknown) => {
    supportLog.add("warn", "app", `Share sheet not opened: ${supportLogValue(error)}`);
  });
}
