import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import {
  getThemeTokenPalette,
  isThemeId,
  resolveThemeScheme,
  type ColorScheme,
  type ThemeId,
} from "@/constants/theme";

export const THEME_PREFERENCE_STORAGE_KEY = "pocket-agent-host.theme-preference.v1";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [themeId, setThemeIdState] = useState<ThemeId>("system");
  const colorScheme = resolveThemeScheme(themeId, systemScheme);
  const themePalette = useMemo(() => getThemeTokenPalette(themeId, systemScheme), [systemScheme, themeId]);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)
      .then((storedTheme) => {
        if (mounted && isThemeId(storedTheme)) setThemeIdState(storedTheme);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const applyTheme = useCallback((scheme: ColorScheme, palette: typeof themePalette) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
    }
  }, []);

  const setThemeId = useCallback((nextThemeId: ThemeId) => {
    setThemeIdState(nextThemeId);
    void AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextThemeId).catch(() => undefined);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setThemeId(scheme === "light" ? "cloud" : "midnight");
  }, [setThemeId]);

  useEffect(() => {
    applyTheme(colorScheme, themePalette);
  }, [applyTheme, colorScheme, themePalette]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": themePalette.primary,
        "color-background": themePalette.background,
        "color-surface": themePalette.surface,
        "color-foreground": themePalette.foreground,
        "color-muted": themePalette.muted,
        "color-border": themePalette.border,
        "color-success": themePalette.success,
        "color-warning": themePalette.warning,
        "color-error": themePalette.error,
      }),
    [themePalette],
  );

  const value = useMemo(
    () => ({ colorScheme, setColorScheme, themeId, setThemeId }),
    [colorScheme, setColorScheme, setThemeId, themeId],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeContext must be used within ThemeProvider");
  return ctx;
}
