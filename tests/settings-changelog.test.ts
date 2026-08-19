import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings = readFileSync("app/(tabs)/settings.tsx", "utf8");
const changelog = readFileSync("CHANGELOG.md", "utf8");

describe("Settings changelog action", () => {
  it("links to the public GitLab changelog through the existing external-link helper", () => {
    expect(settings).toContain('const PROJECT_CHANGELOG_URL = "https://gitlab.com/theredhacker0345/pocket-relay/-/blob/main/CHANGELOG.md"');
    expect(settings).toContain('accessibilityLabel="View Pocket Relay changelog"');
    expect(settings).toContain('openHireContact(PROJECT_CHANGELOG_URL, "Changelog")');
  });

  it("keeps the public changelog free of sensitive runtime information", () => {
    expect(changelog).toContain("# Changelog");
    expect(changelog).toContain("Security note");
    expect(changelog).not.toMatch(/telegram token|api key|password/i);
  });
});
