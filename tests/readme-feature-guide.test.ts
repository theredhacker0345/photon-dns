import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readme = () => readFileSync(resolve(process.cwd(), "README.md"), "utf8");

describe("README complete feature guide", () => {
  it("documents each major owner-facing capability and its safety boundary", () => {
    const content = readme();

    expect(content).toContain("## Complete feature guide");
    expect(content).toContain("### 1. Dedicated-phone host and Dashboard");
    expect(content).toContain("### 2. Setup, provider connections, models, and Favorites");
    expect(content).toContain("### 3. Telegram gateway, Agent Console, and one owner conversation");
    expect(content).toContain("### 4. Immediate work, automations, and resource policy");
    expect(content).toContain("### 5. Remote MCP connectors");
    expect(content).toContain("### 6. Skills and owner-visible execution audit");
    expect(content).toContain("### 7. Encrypted backup, restore, and verification");
    expect(content).toContain("### 8. Notifications, themes, creator links, and project controls");
    expect(content).toContain("### 9. Security boundaries and deliberately unavailable powers");
    expect(content).toContain("cannot run shell commands");
  });
});
