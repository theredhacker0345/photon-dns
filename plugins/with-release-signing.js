const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * F-Droid signs its own reproducible artifacts. Direct distribution may opt in
 * to a release keystore through environment variables or Gradle properties,
 * but a `release` build must never silently inherit the Android debug key.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (configMod) => {
    if (configMod.modResults.language !== "groovy") {
      throw new Error("Pocket Hermes release-signing plugin requires a Groovy app/build.gradle");
    }
    const marker = "// @generated-by-pocket-hermes-release-signing";
    const contents = configMod.modResults.contents;
    if (contents.includes(marker)) return configMod;

    const signingBlock = `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        ${marker}
        release {
            def releaseStore = System.getenv("POCKET_HERMES_RELEASE_STORE_FILE") ?: findProperty("pocketHermes.releaseStoreFile")
            if (releaseStore) {
                storeFile file(releaseStore)
                storePassword System.getenv("POCKET_HERMES_RELEASE_STORE_PASSWORD") ?: findProperty("pocketHermes.releaseStorePassword")
                keyAlias System.getenv("POCKET_HERMES_RELEASE_KEY_ALIAS") ?: findProperty("pocketHermes.releaseKeyAlias")
                keyPassword System.getenv("POCKET_HERMES_RELEASE_KEY_PASSWORD") ?: findProperty("pocketHermes.releaseKeyPassword")
            }
        }
    }`;
    const existingSigning = /signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\}\s*\n\s*\}/m;
    if (!existingSigning.test(contents)) {
      throw new Error("Could not find Android debug signing configuration in app/build.gradle");
    }
    let updated = contents.replace(existingSigning, signingBlock);
    const debugRelease = /\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/;
    const releaseSigning = `def releaseStore = System.getenv("POCKET_HERMES_RELEASE_STORE_FILE") ?: findProperty("pocketHermes.releaseStoreFile")
            if (releaseStore) {
                signingConfig signingConfigs.release
            } else {
                logger.lifecycle("Pocket Hermes: assembling an unsigned release artifact for F-Droid signing.")
            }`;
    if (!debugRelease.test(updated)) {
      throw new Error("Could not find Android debug release signing fallback in app/build.gradle");
    }
    configMod.modResults.contents = updated.replace(debugRelease, releaseSigning);
    return configMod;
  });
};
