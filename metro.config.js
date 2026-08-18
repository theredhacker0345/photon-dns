const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const isStaticExport = process.env.POCKET_AGENT_STATIC_EXPORT === "1";
const defaultResolveRequest = config.resolver.resolveRequest;

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
