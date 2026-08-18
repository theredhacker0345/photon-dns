const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Pocket Agent Host is deliberately distributed for physical ARM64 Android phones.
 * Expo's buildArchs property narrows React Native's native build, but third-party
 * AARs can still contribute other ABI libraries unless the application module also
 * declares an explicit NDK ABI filter. The default remains ARM64 for F-Droid and
 * physical hosts; POCKET_HERMES_ANDROID_ABIS exists solely for a signed test build
 * that must match an external emulator architecture such as x86_64.
 */
module.exports = function withArm64Only(config) {
  return withAppBuildGradle(config, (configMod) => {
    if (configMod.modResults.language !== "groovy") {
      throw new Error("Pocket Agent Host arm64-only plugin requires a Groovy app/build.gradle");
    }

    const contents = configMod.modResults.contents;
    const marker = "// @generated-by-pocket-agent-host-arm64-only";
    if (contents.includes(marker)) {
      return configMod;
    }

    const defaultConfigBlock = /defaultConfig\s*\{([\s\S]*?)\n\s*\}/m;
    const match = contents.match(defaultConfigBlock);
    if (!match) {
      throw new Error("Could not find android.defaultConfig in app/build.gradle");
    }

    const original = match[0];
    const insertion = `\n        ${marker}\n        // ARM64 is the F-Droid/device default. Appetize test builds can opt into x86_64.\n        def pocketAgentHostAbis = (System.getenv("POCKET_HERMES_ANDROID_ABIS") ?: "arm64-v8a")\n            .split(",")\n            .collect { it.trim() }\n        ndk {\n            abiFilters(*pocketAgentHostAbis)\n        }`;
    const replacement = original.replace(/\n\s*\}/, `${insertion}\n    }`);

    configMod.modResults.contents = contents.replace(original, replacement);
    return configMod;
  });
};
