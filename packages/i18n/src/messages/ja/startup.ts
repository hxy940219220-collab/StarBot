import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "StarBot を起動できませんでした",

  "startup.failedBody":
    "{message}\n\nお使いのデータは初期化も上書きもされていません。復旧の手順はトラブルシューティングガイドをご覧ください。",
  "startup.archiveChangedTitle": "StarBot のファイルが変更されました",

  "startup.archiveChangedBody":
    "別のプログラムが StarBot のファイル app.asar を変更しました。StarBot は今は動作していますが、終了すると次は起動しません。\n\n修復するには、StarBot をもう一度インストールしてください。ローカルのデータはそのまま残ります。",

  "startup.archiveChangedDownload": "StarBot をダウンロード",

  "startup.filesDamagedBody":
    "StarBot の一部のファイルが破損しているか、見つかりません。\n\n修復するには、StarBot をもう一度インストールしてください。ローカルのデータはそのまま残ります。",

  "startup.newerDataUpdatingTitle": "StarBot を更新しています",

  "startup.newerDataUpdatingBody":
    "新しいバージョンの StarBot がデータを保存しました。StarBot は最新バージョンをインストールしてから、もう一度開きます。\n\nローカルデータはリセットも上書きもされていません。",

  "startup.newerDataTitle": "最新の StarBot をインストールしてください",

  "startup.newerDataBody":
    "新しいバージョンの StarBot がデータを保存したため、このバージョン ({version}) では開けません。データを開くには最新バージョンをインストールしてください。\n\nローカルデータはリセットも上書きもされていません。",

  "startup.newerDataDownload": "StarBot をダウンロード",

  "startup.newerDataGuide": "ガイドを開く",
  "startup.newerDataQuit": "終了",
  "startup.newerDataLoopTitle": "最新の StarBot が開きませんでした",

  "startup.newerDataLoopBody":
    "新しいバージョンの StarBot がデータを保存したため、このバージョン ({version}) では開けません。StarBot {loopVersion} は開く前に何度も続けて停止したため、再インストールしません。\n\n{loopVersion} より新しいバージョンが公開されたら、それをインストールしてください。サポートが必要な場合は、ガイドを開いてください。\n\nローカルデータはリセットも上書きもされていません。",

  "startup.newerDataReleases": "リリースを表示",
  "startup.recoveryWindowTitle": "StarBot の復旧",

  "startup.recoveryTitle": "StarBot を開けませんでした",

  "startup.recoveryBody": {
    other:
      "StarBot {version} は開く前に {count} 回続けて停止しました。ローカルデータはリセットも上書きもされていません。",

  },
  "startup.recoveryHint":
    "もう一度試すか、最後に開けたバージョンをインストールしてください。サポートが必要な場合は、診断情報を書き出し、そのファイルをレポートと一緒に送ってください。",
  "startup.recoveryHintLatest":
    "データを開ける以前のバージョンが見つかりませんでした。もう一度試すか、最新バージョンをインストールしてください。サポートが必要な場合は、診断情報を書き出し、そのファイルをレポートと一緒に送ってください。",
  "startup.recoveryRetry": "再試行",
  "startup.recoveryPreviousVersion": "前のバージョンをダウンロード",
  "startup.recoveryLatestVersion": "最新バージョンをダウンロード",
  "startup.recoveryExportDiagnostics": "診断情報を書き出す",
  "startup.recoveryOpenDataFolder": "データフォルダを開く",
  "startup.recoveryQuit": "終了",
  "startup.recoveryDiagnosticsSaved": "診断ファイルを保存しました。",
  "startup.recoveryActionFailed": "StarBot はこの操作を実行できませんでした。",

} as const satisfies PartialTranslation<typeof source>;
