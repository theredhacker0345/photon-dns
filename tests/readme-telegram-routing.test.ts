import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("README Telegram conversation and routing documentation", () => {
  it("documents the implemented shared owner session and bounded owner-visible ledger", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toContain("## Telegram conversations and routing");
    expect(readme).toContain("same canonical Hermes owner session");
    expect(readme).toContain("bounded 100-entry, owner-visible app-private transcript");
    expect(readme).not.toContain("Conversation text does not cross the Python/Kotlin/JavaScript control-plane bridge.");
  });

  it("documents the narrow Direct, HTTP, and SOCKS5 gateway route boundary and measured status", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");

    expect(readme).toContain("| **Direct** |");
    expect(readme).toContain("| **HTTP** |");
    expect(readme).toContain("| **SOCKS5** |");
    expect(readme).toContain("measured `getMe` latency in milliseconds");
    expect(readme).toContain("does **not** redirect model-provider calls, remote MCP traffic, Android telemetry");
    expect(existsSync(resolve(root, "docs/conversation-sync-and-proxy.md"))).toBe(true);
  });
});
