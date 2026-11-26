import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/window";

export const messages = {
  "window.localHostTitle": "StarBot מארח מקומי",

  "window.localClientTitle": "StarBot לקוח מקומי",

  "window.computerUsePermissionTitle": "הפעלת שליטה במחשב",
  "window.rendererStoppedTitle": "StarBot הפסיק לעבוד",

  "window.rendererStoppedBody": "החלון נעצר כמה פעמים. הצ׳אטים שלך שמורים, והסוכנים שלך ממשיכים לעבוד.",
  "window.rendererStoppedReload": "טעינה מחדש",
} as const satisfies PartialTranslation<typeof source>;
