import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/mcp";

export const messages = {
  "error.mcp.redirectByName": "הכתובת הזו אינה נגישה לפי שם.",
  "error.mcp.redirectNotSignIn": "הכתובת הזו אינה חלק מהתחברות.",
  "error.mcp.redirectRefused": "ההתחברות נדחתה. יש לחזור אל StarBot ולנסות שוב.",

  "error.mcp.redirectNoSignIn": "ההתחברות הזו כבר לא פעילה. אפשר לחזור ל-StarBot ולהתחיל את ההתחברות מחדש.",

  "error.mcp.redirectSignedIn": "StarBot מחובר. אפשר לסגור את החלון הזה.",

  "error.mcp.redirectNotSaved": "ההתחברות לא הסתיימה. חזרו ל-StarBot כדי לראות למה.",

  "error.mcp.signInFileUnreadable": "לא ניתן לקרוא את קובץ ההתחברות של MCP.",
  "error.mcp.signInFileTooLarge": "קובץ ההתחברות של MCP גדול מדי.",
  "error.mcp.unsupported": "שרתי MCP אינם נתמכים בשרת הזה.",
  "error.mcp.signInOnHost": "התחברות לשרת MCP פועלת רק ב-StarBot במחשב המארח.",

  "error.mcp.signInPageOnServer": "דף ההתחברות הזה נפתח רק בשרת. יש לבקש מבעלים או ממנהל של השרת להתחבר.",
  "error.mcp.signInPageOnServerSwitch": "דף ההתחברות הזה נפתח רק בשרת. יש לעבור לשרת הזה, ואז לבחור שוב התחברות.",
  "error.mcp.signInAppUnsupported": "השרת הזה אינו תומך באפליקציות התחברות. יש לעדכן את StarBot במארח.",

  "error.mcp.redirectRelayed": "StarBot שלח את ההתחברות לשרת. אפשר לסגור את החלון הזה.",

  "error.mcp.relayEnded": "ההתחברות הזו הסתיימה. יש להתחיל אותה מחדש.",
  "error.mcp.signInLinkNotReady": "דף ההתחברות עוד לא נפתח. אפשר לנסות שוב בעוד רגע.",
  "error.mcp.relayNoState": "דף ההתחברות של השרת אינו מגן על כתובת החזרה שלו, ולכן StarBot אינו פותח אותו במחשב הזה.",

  "error.mcp.relayAddressInvalid": "זו אינה הכתובת שבסוף ההתחברות הזו. יש להעתיק את הכתובת המלאה מהדפדפן.",
} as const satisfies PartialTranslation<typeof source>;
