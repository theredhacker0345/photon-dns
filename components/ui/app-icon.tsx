import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import type { StyleProp, TextStyle } from "react-native";

export type AppIconName = ComponentProps<typeof MaterialIcons>["name"] | string;

/**
 * Uses the native bundled Material icon font on Android. The web platform
 * resolves `app-icon.web.tsx`, which deliberately uses local text glyphs so
 * startup never depends on a browser FontFaceObserver request.
 */
export function AppIcon({ name, size = 24, color, style }: { name: AppIconName; size?: number; color: string; style?: StyleProp<TextStyle> }) {
  return <MaterialIcons name={name as ComponentProps<typeof MaterialIcons>["name"]} size={size} color={color} style={style} />;
}
