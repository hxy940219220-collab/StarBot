const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { withEntitlementsPlist } = require("expo/config-plugins");

const GOOGLE_SERVICES_FILE = "./google-services.json";

const PAID_IOS_EXTENSION_PLUGINS = new Set([
  "./plugins/with-share-target",
  "expo-widgets",
  "./plugins/with-notification-service",
  "./plugins/with-shortcuts",
]);

/** @param {{ config: import('expo/config').ExpoConfig }} context */
module.exports = ({ config }) => {
  const fullEntitlements = process.env.STARBOT_FULL_ENTITLEMENTS === "1";
  const bundleId = process.env.EXPO_PUBLIC_BUNDLE_ID || config.ios?.bundleIdentifier || "com.think2do.starbot";
  const appleTeamId = process.env.APPLE_TEAM_ID?.trim();

  const plugins = (config.plugins ?? []).filter((entry) => {
    if (fullEntitlements) return true;
    const pluginName = Array.isArray(entry) ? entry[0] : entry;
    return !PAID_IOS_EXTENSION_PLUGINS.has(pluginName);
  });

  const ios = {
    ...config.ios,
    bundleIdentifier: bundleId,
    ...(appleTeamId ? { appleTeamId } : {}),
    ...(fullEntitlements ? {} : { associatedDomains: undefined }),
  };

  const android = {
    ...config.android,
    package: bundleId,
    ...(existsSync(join(__dirname, GOOGLE_SERVICES_FILE)) ? { googleServicesFile: GOOGLE_SERVICES_FILE } : {}),
  };

  const nextConfig = {
    ...config,
    ios,
    android,
    plugins,
  };

  if (fullEntitlements) return nextConfig;

  return withEntitlementsPlist(nextConfig, (mod) => {
    delete mod.modResults["aps-environment"];
    delete mod.modResults["com.apple.developer.associated-domains"];
    delete mod.modResults["com.apple.security.application-groups"];
    delete mod.modResults["com.apple.developer.siri"];
    return mod;
  });
};
