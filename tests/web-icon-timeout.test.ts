import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("web icon loading", () => {
  it("resolves Material Icons imports to the local browser-safe glyph adapter", () => {
    const metro = read("metro.config.js");
    const adapter = read("components/ui/material-icons.web.tsx");
    const browserIcon = read("components/ui/app-icon.web.tsx");

    expect(metro).toContain('platform === "web" && moduleName === "@expo/vector-icons/MaterialIcons"');
    expect(metro).toContain('components/ui/material-icons.web.tsx');
    expect(adapter).toContain('import { AppIcon } from "./app-icon"');
    expect(adapter).toContain("export default AppIcon");
    expect(browserIcon).not.toContain("FontFaceObserver");
    expect(browserIcon).toContain("fontFamily: \"system-ui, sans-serif\"");
  });
});
