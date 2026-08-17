import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("functionality-audit remediation contracts", () => {
  it("exposes the persisted battery threshold and storage reserve in Settings", () => {
    const settings = read("app/(tabs)/settings.tsx");
    expect(settings).toContain("lowBatteryPercent");
    expect(settings).toContain("minimumFreeStorageMb");
    expect(settings).toContain("Battery warning · %");
    expect(settings).toContain("Free storage reserve · MB");
    expect(settings).toContain("minimumFreeStorageBytes: Number(minimumFreeStorageMb) * 1024 * 1024");
  });

  it("keeps setup guidance aligned with the private-owner-only validation contract", () => {
    const setup = read("app/setup.tsx");
    expect(setup).toContain("Allowed owner user ID");
    expect(setup).toContain("Groups and negative chat IDs are intentionally rejected.");
    expect(setup).not.toContain("For a group, add the bot first");
  });

  it("documents that physical-device gateway and provider tests remain required", () => {
    const audit = read("docs/full-functionality-audit.md");
    expect(audit).toContain("Physical-Device Acceptance Checks");
    expect(audit).toContain("real owner-controlled Telegram bot");
    expect(audit).toContain("does not treat a web preview as an Android-host test");
  });
});
