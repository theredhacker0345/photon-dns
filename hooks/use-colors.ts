import { Colors, getThemePalette, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useThemeContext } from "@/lib/theme-provider";

/**
 * Returns the selected theme's runtime palette. An explicit light/dark override
 * remains available for diagnostic previews.
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const { colorScheme, themeId } = useThemeContext();
  return colorSchemeOverride ? Colors[colorSchemeOverride] : getThemePalette(themeId, colorScheme);
}
