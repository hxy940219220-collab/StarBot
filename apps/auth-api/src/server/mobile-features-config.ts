import type { MobileFeatureConfig, MobileLatestVersions } from "@openbot/contracts/mobile-features";

export const MOBILE_FEATURE_CONFIG: MobileFeatureConfig = {
  cloudServers: {
    ios: { upTo: "99.99.99" },
    android: { upTo: "99.99.99" },
  },
  browser: {
    ios: { upTo: "99.99.99" },
    android: { upTo: "99.99.99" },
  },
};

export const MOBILE_LATEST_VERSIONS: MobileLatestVersions = {
  ios: "0.2.0",
  android: "0.2.0",
};

export const ANDROID_APK_FIRST_VERSION: string | null = "0.2.0";
