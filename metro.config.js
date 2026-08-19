const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const isStaticExport = process.env.POCKET_AGENT_STATIC_EXPORT === "1";
const defaultResolveRequest = config.resolver.resolveRequest;
const rustTargetDirectory = path.join(
  __dirname,
  "modules/pocket-hermes-supervisor/android/neuron-encrypt/jni/target",
).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const existingBlockList = config.resolver.blockList
  ? (Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList])
  : [];

// Cargo's short-lived target paths are not application source. Excluding them
// prevents Metro from retaining a watcher for a build artifact after cleanup.
config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(`^${rustTargetDirectory}(?:[\\\\/].*)?$`),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "@expo/vector-icons/MaterialIcons") {
    return {
      filePath: path.resolve(__dirname, "components/ui/material-icons.web.tsx"),
      type: "sourceFile",
    };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  // The persisted cache helps Metro development, while static export needs the
  // virtual CSS module so its dependency graph can hash it inside a clean CI image.
  forceWriteFileSystem: !isStaticExport,
});
