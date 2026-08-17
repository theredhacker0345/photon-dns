const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Pocket Agent Host is deliberately distributed for physical ARM64 Android phones.
 * Expo's buildArchs property narrows React Native's native build, but third-party
 * AARs can still contribute other ABI libraries unless the application module also
 * declares an explicit NDK ABI filter. Keep this in source so prebuild and F-Droid
 * builds produce the same single-ABI APK.
 */
module.exports = function withArm64Only(config) {
  return withAppBuildGradle(config, (configMod) => {
    if (configMod.modResults.language !== "groovy") {
      throw new Error("Pocket Agent Host arm64-only plugin requires a Groovy app/build.gradle");
    }

    const contents = configMod.modResults.contents;
    const marker = "// @generated-by-pocket-hermes-arm64-only";
    if (contents.includes(marker)) {
      return configMod;
    }

    const defaultConfigBlock = /defaultConfig\s*\{([\s\S]*?)\n\s*\}/m;
    const match = contents.match(defaultConfigBlock);
    if (!match) {
      throw new Error("Could not find android.defaultConfig in app/build.gradle");
    }

    const original = match[0];
    const insertion = `\n        ${marker}\n        ndk {\n            abiFilters "arm64-v8a"\n        }`;
    const replacement = original.replace(/\n\s*\}/, `${insertion}\n    }`);

    configMod.modResults.contents = contents.replace(original, replacement);
    return configMod;
  });
};
