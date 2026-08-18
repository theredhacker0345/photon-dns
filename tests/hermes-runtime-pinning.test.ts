import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("Hermes runtime pinning", () => {
  it("locks the embedded Hermes Android wheel build to the documented source revision and version", () => {
    const script = readFileSync(resolve(root, "scripts/build-hermes-android-wheel.sh"), "utf8");
    expect(script).toContain('PIN="165c889e5b4277b56dadd42949a4112c1e6175a6"');
    expect(script).toContain('VERSION="0.20.1"');
    expect(script).toContain('test "$(git -C "${WORK}" rev-parse HEAD)" = "${PIN}"');
    expect(script).toContain('pip wheel --no-deps');
  });

  it("publishes the source pin, upgrade procedure, online-only rationale, and MCP code-execution boundary", () => {
    const readme = readFileSync(resolve(root, "README.md"), "utf8");
    const pinning = readFileSync(resolve(root, "docs/hermes-runtime-pinning.md"), "utf8");
    const mcp = readFileSync(resolve(root, "docs/mcp-connectors.md"), "utf8");
    expect(readme).toContain("Why Pocket Relay is connected-operation only");
    expect(readme).toContain("same-network Ollama and LM Studio presets");
    expect(pinning).toContain("165c889e5b4277b56dadd42949a4112c1e6175a6");
    expect(pinning).toContain("Controlled upgrade process");
    expect(mcp).toContain("does not run arbitrary code from connectors");
  });
});
