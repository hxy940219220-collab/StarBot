import type { PartialTranslation } from "../../message";
import type { messages as source } from "../en/startup";

export const messages = {
  "startup.failedTitle": "StarBot başlatılamadı",

  "startup.failedBody":
    "{message}\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı. Kurtarma adımları için sorun giderme kılavuzuna bakın.",
  "startup.archiveChangedTitle": "StarBot dosyaları değiştirildi",

  "startup.archiveChangedBody":
    "Başka bir program StarBot’un app.asar dosyasını değiştirdi. StarBot şu an çalışıyor, ancak kapattıktan sonra açılmayacak.\n\nOnarmak için StarBot’u yeniden yükleyin. Yerel verileriniz korunur.",

  "startup.archiveChangedDownload": "StarBot’u indir",

  "startup.filesDamagedBody":
    "Bazı StarBot dosyaları hasarlı veya eksik.\n\nOnarmak için StarBot’u yeniden yükleyin. Yerel verileriniz korunur.",

  "startup.newerDataUpdatingTitle": "StarBot güncelleniyor",

  "startup.newerDataUpdatingBody":
    "StarBot’un daha yeni bir sürümü verilerinizi kaydetti. StarBot en son sürümü yüklüyor ve ardından yeniden açılacak.\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",

  "startup.newerDataTitle": "En son StarBot’u yükleyin",

  "startup.newerDataBody":
    "StarBot’un daha yeni bir sürümü verilerinizi kaydetti ve bu sürüm ({version}) onları açamıyor. Verilerinizi açmak için en son sürümü yükleyin.\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",

  "startup.newerDataDownload": "StarBot’u indir",

  "startup.newerDataGuide": "Kılavuzu aç",
  "startup.newerDataQuit": "Çık",
  "startup.newerDataLoopTitle": "En son StarBot açılmadı",

  "startup.newerDataLoopBody":
    "StarBot’un daha yeni bir sürümü verilerinizi kaydetti ve bu sürüm ({version}) onları açamıyor. StarBot {loopVersion} art arda birkaç kez açılmadan durdu, bu yüzden yeniden yüklenmiyor.\n\n{loopVersion} sürümünden daha yeni bir sürüm çıktığında onu yükleyin. Yardım almak için kılavuzu açın.\n\nYerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",

  "startup.newerDataReleases": "Sürümleri göster",
  "startup.recoveryWindowTitle": "StarBot kurtarma",

  "startup.recoveryTitle": "StarBot açılmadı",

  "startup.recoveryBody": {
    one: "StarBot {version}, açılmadan önce art arda {count} kez durdu. Yerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",
    other:
      "StarBot {version}, açılmadan önce art arda {count} kez durdu. Yerel verileriniz sıfırlanmadı veya üzerine yazılmadı.",
  },
  "startup.recoveryHint":
    "Yeniden deneyin veya açılan son sürümü yükleyin. Yardım almak için tanılamayı dışa aktarın ve dosyayı raporunuzla gönderin.",
  "startup.recoveryHintLatest":
    "StarBot verilerinizi açabilen daha eski bir sürüm bulamadı. Yeniden deneyin veya en son sürümü yükleyin. Yardım almak için tanılamayı dışa aktarın ve dosyayı raporunuzla gönderin.",

  "startup.recoveryRetry": "Yeniden dene",
  "startup.recoveryPreviousVersion": "Önceki sürümü indir",
  "startup.recoveryLatestVersion": "En son sürümü indir",
  "startup.recoveryExportDiagnostics": "Tanılamayı dışa aktar",
  "startup.recoveryOpenDataFolder": "Veri klasörünü aç",
  "startup.recoveryQuit": "Çık",
  "startup.recoveryDiagnosticsSaved": "Tanılama dosyası kaydedildi.",
  "startup.recoveryActionFailed": "StarBot bu işlemi yapamadı.",
} as const satisfies PartialTranslation<typeof source>;
