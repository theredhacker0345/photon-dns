/**
 * Enable Android release shrinking in every regenerated native project.
 *
 * The Expo template already wires these Gradle properties into the release
 * build type, but leaves them disabled by default. R8 and resource shrinking
 * are open-source Android build tools and are safe to use for the F-Droid
 * release; the generated APK must still pass the worker/package checks.
 */
const { withGradleProperties } = require("@expo/config-plugins");

const PROPERTIES = {
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
};

module.exports = function withReleaseShrinking(config) {
  return withGradleProperties(config, (configMod) => {
    const properties = configMod.modResults;
    for (const [key, value] of Object.entries(PROPERTIES)) {
      const existing = properties.find(
        (entry) => entry.type === "property" && entry.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        properties.push({ type: "property", key, value });
      }
    }
    return configMod;
  });
};
