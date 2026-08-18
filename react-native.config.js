/**
 * Pocket Relay uses no Reanimated APIs. Expo Router and NativeWind declare
 * Reanimated as an optional peer, and pnpm may still materialize it locally.
 * Excluding it here prevents Android autolinking from compiling its CMake
 * targets in the constrained host build while preserving the app's UI stack.
 */
module.exports = {
  dependencies: {
    "react-native-reanimated": {
      platforms: { android: null },
    },
    "react-native-worklets": {
      platforms: { android: null },
    },
  },
};
