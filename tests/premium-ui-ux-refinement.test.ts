import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("premium UI/UX refinement", () => {
  it("keeps layered semantic surfaces available in runtime and NativeWind theme definitions", () => {
    const runtimeTheme = read("lib/_core/theme.ts");
    const nativeWindTheme = read("theme.config.js");
    const typeDefinitions = read("theme.config.d.ts");

    for (const token of ["surfaceRaised", "surfaceInset", "primarySoft"]) {
      expect(runtimeTheme).toContain(token);
      expect(nativeWindTheme).toContain(token);
      expect(typeDefinitions).toContain(token);
    }
  });

  it("preserves premium mobile navigation and owner interaction affordances", () => {
    const tabs = read("app/(tabs)/_layout.tsx");
    const agent = read("app/(tabs)/agent.tsx");
    const skills = read("components/skills-manager.tsx");

    expect(tabs).toContain("backgroundColor: colors.surfaceRaised");
    expect(tabs).toContain("const tabBarHeight = isWeb ? 68 : 60 + bottomPadding");
    expect(agent).toContain("accessibilityState={{ disabled: !body.trim() || submitting, busy: submitting }}");
    expect(agent).toContain("action: { minHeight: 44");
    expect(skills).toContain("accessibilityLiveRegion=\"polite\"");
    expect(skills).toContain("sampleButton: { minWidth: 60, minHeight: 44");
    expect(skills).toContain("accessibilityLabel={`${installed ? \"Installed\" : \"Install\"}");
  });
});
