import { Platform } from "react-native";

export type ColorScheme = "light" | "dark";
export type ThemeId = "system" | "cloud" | "midnight" | "terminal" | "oled";

/**
 * Runtime tokens mirror theme.config.js, whose CommonJS shape is consumed by
 * NativeWind at build time. Keeping this TypeScript representation local lets
 * the app and its deterministic tests share the same typed palette contract.
 */
export const ThemeColors = {
  primary: { light: "#6750E8", dark: "#A99BFF" },
  background: { light: "#F6F7FB", dark: "#0B0D14" },
  surface: { light: "#FFFFFF", dark: "#141827" },
  foreground: { light: "#161926", dark: "#F5F5FA" },
  muted: { light: "#667085", dark: "#A9B0C0" },
  border: { light: "#E3E6EF", dark: "#293044" },
  success: { light: "#11866A", dark: "#54D8B7" },
  warning: { light: "#A95F00", dark: "#F4B65A" },
  error: { light: "#C3384E", dark: "#FF8799" },
} as const;

type ThemeColorTokens = typeof ThemeColors;
type ThemeColorName = keyof ThemeColorTokens;
type SchemePalette = Record<ColorScheme, Record<ThemeColorName, string>>;
type SchemePaletteItem = SchemePalette[ColorScheme];

function buildSchemePalette(colors: ThemeColorTokens): SchemePalette {
  const palette: SchemePalette = {
    light: {} as SchemePalette["light"],
    dark: {} as SchemePalette["dark"],
  };

  (Object.keys(colors) as ThemeColorName[]).forEach((name) => {
    const swatch = colors[name];
    palette.light[name] = swatch.light;
    palette.dark[name] = swatch.dark;
  });

  return palette;
}

export const SchemeColors = buildSchemePalette(ThemeColors);

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
  scheme?: ColorScheme;
  previewColor: string;
  overrides?: Partial<SchemePaletteItem>;
};

/**
 * Themes are intentionally small in number and contrast-safe. Cloud and
 * Midnight preserve the product's indigo language; Terminal offers a focused
 * low-light palette; OLED Black keeps emissive area to a minimum on compatible
 * displays for a phone running as a host around the clock.
 */
export const ThemeDefinitions: Record<ThemeId, ThemeDefinition> = {
  system: {
    id: "system",
    label: "System",
    description: "Match this phone's light or dark appearance.",
    previewColor: "#6750E8",
  },
  cloud: {
    id: "cloud",
    label: "Cloud",
    description: "A clear, bright workspace for daytime checks.",
    scheme: "light",
    previewColor: "#6750E8",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    description: "The low-light default for a persistent host.",
    scheme: "dark",
    previewColor: "#A99BFF",
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    description: "A dark, high-signal palette with a green operational accent.",
    scheme: "dark",
    previewColor: "#54D8B7",
    overrides: {
      primary: "#54D8B7",
      background: "#08110F",
      surface: "#10201C",
      foreground: "#EAFBF4",
      muted: "#A4BFB5",
      border: "#24443A",
      success: "#54D8B7",
      warning: "#F4C46A",
      error: "#FF8F9C",
    },
  },
  oled: {
    id: "oled",
    label: "OLED Black",
    description: "True black surfaces for compatible OLED displays and low-light host monitoring.",
    scheme: "dark",
    previewColor: "#000000",
    overrides: {
      primary: "#B9AFFF",
      background: "#000000",
      surface: "#000000",
      foreground: "#FAFAFC",
      muted: "#AAAAB4",
      border: "#24242C",
      success: "#68DAB8",
      warning: "#F5C76E",
      error: "#FF929F",
    },
  },
};

export const ThemeOptions = Object.values(ThemeDefinitions);

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && value in ThemeDefinitions);
}

export function resolveThemeScheme(themeId: ThemeId, systemScheme: ColorScheme): ColorScheme {
  return ThemeDefinitions[themeId].scheme ?? systemScheme;
}

export function getThemeTokenPalette(themeId: ThemeId, systemScheme: ColorScheme): SchemePaletteItem {
  const theme = ThemeDefinitions[themeId];
  const scheme = resolveThemeScheme(themeId, systemScheme);
  return { ...SchemeColors[scheme], ...(theme.overrides ?? {}) } as SchemePaletteItem;
}

export type ThemeColorPalette = SchemePaletteItem & {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
};

function buildRuntimePalette(base: SchemePaletteItem): ThemeColorPalette {
  return {
    ...base,
    text: base.foreground,
    background: base.background,
    tint: base.primary,
    icon: base.muted,
    tabIconDefault: base.muted,
    tabIconSelected: base.primary,
    border: base.border,
  };
}

export function getThemePalette(themeId: ThemeId, systemScheme: ColorScheme): ThemeColorPalette {
  return buildRuntimePalette(getThemeTokenPalette(themeId, systemScheme));
}

/** Legacy scheme palettes retained for components that intentionally preview light/dark. */
export const Colors = {
  light: buildRuntimePalette(SchemeColors.light),
  dark: buildRuntimePalette(SchemeColors.dark),
} satisfies Record<ColorScheme, ThemeColorPalette>;

export const Fonts = {
  sans: "system-ui",
  serif: "ui-serif",
  rounded: "ui-rounded",
  mono: "ui-monospace",
} as const;
