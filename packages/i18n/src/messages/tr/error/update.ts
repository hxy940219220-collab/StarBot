import type { PartialTranslation } from "../../../message";
import type { messages as source } from "../../en/error/update";

export const messages = {
  "error.update.unsupported": "Güncellemeler yüklü masaüstü derlemelerinde kullanılabilir.",
  "error.update.notReady": "Bir güncelleme yüklenmeye hazır değil.",
  "error.update.restartFailed": "StarBot güncellemeyi yüklemek için yeniden başlatılamadı.",

  "error.update.downloadStalled": "Güncelleme indirmesi yanıt vermeyi durdurdu. Tekrar deneyin.",
  "error.update.installFailed": "Güncelleme yüklenemedi. StarBot'tan çıkıp yeniden açın, ardından tekrar deneyin.",

  "error.update.notInstalled": "Son yeniden başlatma güncellemeyi yüklemedi. Tekrar denemek için yeniden başlatın.",
  "error.update.downloadFailed": "Güncelleme indirilemedi. Tekrar deneyin.",
  "error.update.signatureNotConfirmed":
    "StarBot güncellemeyi doğrulayamadı. Tekrar deneyin. Bu hata sürerse StarBot'u starbot.app/download adresinden indirin.",

  "error.update.checkFailed": "Güncellemeler denetlenemedi. Tekrar deneyin.",
  "error.update.checkStalled": "Güncelleme denetimi yanıt vermeyi durdurdu. Tekrar deneyin.",
  "error.update.checkOffline":
    "Güncelleme hizmetine ulaşılamadı. İnternet bağlantınızı kontrol edin, ardından tekrar deneyin.",
  "error.update.checkUnavailable":
    "Güncelleme hizmeti yanıt vermedi. StarBot birkaç dakika içinde kendiliğinden tekrar dener.",

  "error.update.checkNoRelease":
    "Bu platform için yayımlanmış bir güncelleme bulunamadı. StarBot birkaç dakika içinde kendiliğinden tekrar dener.",

  "error.update.managedByNix": "Bu StarBot kopyasının güncellemelerini Nix yükler. Nix ile güncelleyin.",

  "error.update.managedByHost":
    "Bu Mac üzerindeki güncellemeler ana makine tarafından yüklenir. Güncelleme, ana makinenin bakımı çalışana kadar hazır kalır.",
  "error.update.siblingSession":
    "Bu uygulamadan çalışan başka bir StarBot oturumu var. Önce diğer tüm macOS kullanıcı hesaplarında StarBot'u durdurun, ardından güncellemeyi tekrar yükleyin.",

  "error.update.siblingSessionSameAccount":
    "Bu kullanıcı hesabında başka bir StarBot işlemi hâlâ çalışıyor. Bu işlemi kapatın, ardından güncellemeyi tekrar yükleyin.",

  "error.update.siblingCheckFailed": "Diğer StarBot oturumları doğrulanamadı. Yüklemeden önce tekrar deneyin.",

  "error.update.readOnlyLocation":
    "StarBot bu konumdan güncelleme yükleyemez. StarBot'tan çıkın. Finder'da StarBot'u Uygulamalar klasörüne sürükleyin (zaten oradaysa dışarı sürükleyip geri koyun). Ardından StarBot'u açın ve güncellemeyi yeniden yükleyin.",

  "error.update.appImageMissing":
    "AppImage dosyası taşındığı, yeniden adlandırıldığı veya değiştirildiği için StarBot güncellemeyi yükleyemiyor. StarBot'tan çıkın, sonra AppImage dosyasını yeniden açın.",

  "error.update.appImageReadOnly":
    "StarBot, AppImage dosyasının bulunduğu klasöre güncelleme yükleyemiyor. StarBot'tan çıkın, AppImage dosyasını ana klasörünüzdeki bir klasöre taşıyın, sonra dosyayı açıp güncellemeyi yeniden yükleyin.",

  "error.update.remoteDisabled": "Sunucu yöneticilerinden gelen güncellemeler bu bilgisayarda kapalı.",
  "error.update.restartStarted": "StarBot, güncellemeyi yüklemek için zaten yeniden başlatılıyor.",

  "error.update.alreadyRestarting": "StarBot zaten yeniden başlatılıyor.",

} as const satisfies PartialTranslation<typeof source>;
