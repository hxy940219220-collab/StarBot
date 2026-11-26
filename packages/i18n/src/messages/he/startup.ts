import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "StarBot לא הצליח להיפתח",

  "startup.failedBody":
    "{message}\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו. בצעדי השחזור שבמדריך לפתרון בעיות אפשר לקרוא איך להמשיך.",
  "startup.archiveChangedTitle": "קובצי StarBot שונו",

  "startup.archiveChangedBody":
    "תוכנה אחרת שינתה את קובץ StarBot app.asar. StarBot פועל כעת, אך לא ייפתח לאחר היציאה ממנו.\n\nכדי לתקן את StarBot, יש להתקין אותו מחדש. הנתונים המקומיים נשמרים.",

  "startup.archiveChangedDownload": "הורדת StarBot",

  "startup.filesDamagedBody":
    "חלק מקובצי StarBot פגומים או חסרים.\n\nכדי לתקן את StarBot, יש להתקין אותו מחדש. הנתונים המקומיים נשמרים.",

  "startup.newerDataUpdatingTitle": "StarBot מתעדכן",

  "startup.newerDataUpdatingBody":
    "גרסה חדשה יותר של StarBot שמרה את הנתונים שלך. StarBot מתקין את הגרסה האחרונה ואז נפתח מחדש.\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו.",

  "startup.newerDataTitle": "התקנת StarBot העדכני ביותר",

  "startup.newerDataBody":
    "גרסה חדשה יותר של StarBot שמרה את הנתונים שלך, והגרסה הזו ({version}) אינה יכולה לפתוח אותם. יש להתקין את הגרסה האחרונה כדי לפתוח את הנתונים.\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו.",

  "startup.newerDataDownload": "הורדת StarBot",

  "startup.newerDataGuide": "פתיחת המדריך",
  "startup.newerDataQuit": "יציאה",
  "startup.newerDataLoopTitle": "הגרסה האחרונה של StarBot לא נפתחה",

  "startup.newerDataLoopBody":
    "גרסה חדשה יותר של StarBot שמרה את הנתונים שלך, והגרסה הזו ({version}) אינה יכולה לפתוח אותם. StarBot {loopVersion} נעצר לפני שנפתח כמה פעמים ברצף, ולכן הוא לא יותקן שוב.\n\nיש להתקין גרסה חדשה יותר מ-{loopVersion} כשתהיה זמינה. לקבלת עזרה, יש לפתוח את המדריך.\n\nהנתונים המקומיים שלך לא אופסו ולא נדרסו.",

  "startup.newerDataReleases": "הצגת הגרסאות",
  "startup.recoveryWindowTitle": "שחזור StarBot",

  "startup.recoveryTitle": "StarBot לא נפתח",

  "startup.recoveryBody": {
    one: "StarBot {version} נעצר לפני שנפתח, פעם אחת ({count}). הנתונים המקומיים שלך לא אופסו ולא נדרסו.",
    two: "StarBot {version} נעצר לפני שנפתח, פעמיים ברצף ({count}). הנתונים המקומיים שלך לא אופסו ולא נדרסו.",
    other: "StarBot {version} נעצר לפני שנפתח, {count} פעמים ברצף. הנתונים המקומיים שלך לא אופסו ולא נדרסו.",
  },
  "startup.recoveryHint":
    "נסה שוב, או התקן את הגרסה האחרונה שנפתחה. לקבלת עזרה, ייצא את נתוני האבחון ושלח את הקובץ עם הדיווח שלך.",
  "startup.recoveryHintLatest":
    "StarBot לא מצא גרסה קודמת שיכולה לפתוח את הנתונים שלך. נסה שוב, או התקן את הגרסה האחרונה. לקבלת עזרה, ייצא את נתוני האבחון ושלח את הקובץ עם הדיווח שלך.",

  "startup.recoveryRetry": "נסה שוב",
  "startup.recoveryPreviousVersion": "הורדת הגרסה הקודמת",
  "startup.recoveryLatestVersion": "הורדת הגרסה האחרונה",
  "startup.recoveryExportDiagnostics": "ייצוא אבחון",
  "startup.recoveryOpenDataFolder": "פתיחת תיקיית הנתונים",
  "startup.recoveryQuit": "יציאה",
  "startup.recoveryDiagnosticsSaved": "קובץ האבחון נשמר.",
  "startup.recoveryActionFailed": "StarBot לא הצליח לבצע את הפעולה הזו.",
} as const satisfies PartialTranslation<typeof source>;
