import { describe, expect, it } from "vitest";

import { getThemePalette, isThemeId, resolveThemeScheme, ThemeOptions } from "../lib/_core/theme";

describe("Pocket Agent Host theme palettes", () => {
  it("exposes the four supported appearance choices", () => {
    expect(ThemeOptions.map((theme) => theme.id)).toEqual(["system", "cloud", "midnight", "terminal"]);
  });

  it("keeps System adaptive while named themes resolve deterministically", () => {
    expect(resolveThemeScheme("system", "light")).toBe("light");
    expect(resolveThemeScheme("system", "dark")).toBe("dark");
    expect(resolveThemeScheme("cloud", "dark")).toBe("light");
    expect(resolveThemeScheme("midnight", "light")).toBe("dark");
    expect(resolveThemeScheme("terminal", "light")).toBe("dark");
  });

  it("applies the Terminal accent without weakening required semantic tokens", () => {
    const terminal = getThemePalette("terminal", "light");
    expect(terminal.primary).toBe("#54D8B7");
    expect(terminal.background).toBe("#08110F");
    expect(terminal.success).toBe("#54D8B7");
    expect(terminal.error).toBe("#FF8F9C");
  });

  it("accepts only persisted theme identifiers that are known to the UI", () => {
    expect(isThemeId("cloud")).toBe(true);
    expect(isThemeId("untrusted-theme")).toBe(false);
    expect(isThemeId(null)).toBe(false);
  });
});
