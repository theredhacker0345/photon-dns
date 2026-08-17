/**
 * Thin re-exports so consumers don't need to know about internal theme plumbing.
 * Full implementation lives in lib/_core/theme.ts.
 */
export {
  Colors,
  Fonts,
  getThemePalette,
  getThemeTokenPalette,
  isThemeId,
  SchemeColors,
  ThemeDefinitions,
  ThemeColors,
  ThemeOptions,
  resolveThemeScheme,
  type ColorScheme,
  type ThemeDefinition,
  type ThemeColorPalette,
  type ThemeId,
} from "@/lib/_core/theme";
