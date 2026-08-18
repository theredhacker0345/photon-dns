import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProject = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("focused mobile control-plane presentation", () => {
  const home = readProject("app/(tabs)/index.tsx");
  const agent = readProject("app/(tabs)/agent.tsx");
  const settings = readProject("app/(tabs)/settings.tsx");

  it("keeps Home’s essential host pulse visible and moves secondary history into a disclosure", () => {
    expect(home).toContain("const [detailsVisible, setDetailsVisible] = useState(false);");
    expect(home).toContain("HOST READINESS");
    expect(home).toContain("Host details");
    expect(home).toContain("Usage history, telemetry notes, and recent activity");
    expect(home).toContain("{detailsVisible ? <View style={styles.detailsContent}>");
  });

  it("keeps the Agent Console conversation-first while retaining owner safeguards behind an explicit disclosure", () => {
    expect(agent).toContain("const [advancedVisible, setAdvancedVisible] = useState(false);");
    expect(agent).toContain('SectionHeading eyebrow="SHARED OWNER CHAT" title="Conversation"');
    expect(agent).toContain("This private, bounded timeline combines this phone and your authorized Telegram chat.");
    expect(agent).toContain("Clear shared conversation & context");
    expect(agent).toContain("Owner tools & safeguards");
    expect(agent).toContain("Context controls, isolated JavaScript, and execution metadata");
    expect(agent).toContain("{advancedVisible ? <View style={advancedStyles.content}>");
  });

  it("shows saved provider metadata and token state without rendering a credential value", () => {
    expect(settings).toContain('SectionHeading eyebrow="MODEL ACCESS" title="Saved providers"');
    expect(settings).toContain("token protected");
    expect(settings).toContain("token needed");
    expect(settings).toContain("Long press one to remove its metadata and protected API token.");
    expect(settings).toContain("API tokens are never displayed here.");
  });

  it("keeps creator attribution concise and exposes Hire choices only through user-triggered email and WhatsApp links", () => {
    expect(settings).toContain('SectionHeading eyebrow="CREATOR" title="Built for open, owner-controlled hosting"');
    expect(settings).toContain("Created by Ubaid ur Rehman");
    expect(settings).toContain("A self-taught FOSS developer and security researcher.");
    expect(settings).toContain('label={showHireChoices ? "Close hiring options" : "Hire Ubaid"}');
    expect(settings).toContain("mailto:arifubaid0345@gmail.com");
    expect(settings).toContain("https://wa.me/923352706540");
    expect(settings).toContain("await Linking.openURL(url);");
  });
});
