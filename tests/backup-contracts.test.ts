import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createBackupPayload, parseBackupPayload, POCKET_RELAY_BACKUP_FORMAT, POCKET_RELAY_BACKUP_VERSION, summarizeBackupRestore } from "../lib/backup-contracts";
import { defaultHostRuntimePolicy } from "../lib/host-contracts";

const unsafeSource = {
  config: {
    hostName: "Relay phone",
    allowedChatId: "123456789",
    modelProvider: "openai",
    modelEndpoint: "https://api.openai.com/v1",
    modelName: "gpt-5",
    telegramProxy: { type: "socks5" as const, host: "proxy.example.net", port: 1080, hasCredentials: true },
    policy: defaultHostRuntimePolicy,
    hasTelegramToken: true,
    hasModelApiKey: true,
    telegramToken: "telegram-token-must-never-export",
    modelApiKey: "provider-key-must-never-export",
  },
  automations: [],
  favoriteModelIds: ["gpt-5"],
  mcpServers: [{
    id: "mcp-1", name: "Read-only docs", endpoint: "https://mcp.example.com/mcp", authMode: "bearer" as const,
    enabled: true, hasCredential: true, connectionState: "verified" as const, lastCheckedAt: "2026-08-19T00:00:00.000Z", latencyMs: 42, toolCount: 1,
    credential: "mcp-bearer-must-never-export",
  }],
  mcpTools: [],
  mcpApprovals: [],
  providerConnections: [{
    id: "provider-1", label: "Primary", provider: "openai", endpoint: "https://api.openai.com/v1", hasApiKey: true, createdAt: "2026-08-19T00:00:00.000Z",
    apiKey: "provider-connection-key-must-never-export",
  }],
  activeProviderConnectionId: "provider-1",
  installedSkills: [],
  skillBundles: [],
};

describe("Pocket Relay encrypted backup contract", () => {
  it("allow-lists restorable data and removes every supplied credential-like field", () => {
    const payload = createBackupPayload(unsafeSource as never, "1.2.3");
    const serialized = JSON.stringify(payload);

    expect(payload.format).toBe(POCKET_RELAY_BACKUP_FORMAT);
    expect(payload.version).toBe(POCKET_RELAY_BACKUP_VERSION);
    expect(payload.config.telegramProxy).toEqual({ type: "socks5", host: "proxy.example.net", port: 1080, hasCredentials: false });
    expect(payload.providerConnections).toEqual([{ id: "provider-1", label: "Primary", provider: "openai", endpoint: "https://api.openai.com/v1", hasApiKey: false, createdAt: "2026-08-19T00:00:00.000Z" }]);
    expect(payload.mcpServers).toEqual([{ id: "mcp-1", name: "Read-only docs", endpoint: "https://mcp.example.com/mcp", authMode: "bearer", enabled: true, hasCredential: false, connectionState: "verified", lastCheckedAt: "2026-08-19T00:00:00.000Z", latencyMs: 42, toolCount: 1 }]);
    expect(serialized).not.toContain("telegram-token-must-never-export");
    expect(serialized).not.toContain("provider-key-must-never-export");
    expect(serialized).not.toContain("provider-connection-key-must-never-export");
    expect(serialized).not.toContain("mcp-bearer-must-never-export");
  });

  it("keeps the expected safe control-plane collections intact", () => {
    const payload = createBackupPayload(unsafeSource as never, "1.2.3");

    expect(payload.config.hostName).toBe("Relay phone");
    expect(payload.config.allowedChatId).toBe("123456789");
    expect(payload.favoriteModelIds).toEqual(["gpt-5"]);
    expect(payload.activeProviderConnectionId).toBe("provider-1");
    expect(payload.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects other encrypted file formats, unsupported versions, and incomplete backup objects", () => {
    expect(parseBackupPayload({ format: "other", version: 1 })).toEqual({ ok: false, message: "This encrypted file is not a supported Pocket Relay backup." });
    expect(parseBackupPayload({ format: POCKET_RELAY_BACKUP_FORMAT, version: 2 })).toEqual({ ok: false, message: "This encrypted file is not a supported Pocket Relay backup." });
    expect(parseBackupPayload({ format: POCKET_RELAY_BACKUP_FORMAT, version: POCKET_RELAY_BACKUP_VERSION, config: {}, automations: [], favoriteModelIds: [], mcpServers: [], installedSkills: [] })).toEqual({ ok: false, message: "The backup payload is incomplete or malformed." });
  });

  it("keeps restore preview-first in Settings rather than applying a decrypted candidate automatically", () => {
    const settings = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");

    expect(settings).toContain("Decrypt for preview");
    expect(settings).toContain("stageNativeEncryptedBackupForPreview(file.uri)");
    expect(settings).toContain("setBackupPreview(result.preview)");
    expect(settings).toContain("Apply this verified backup?");
    expect(settings).toContain("await applyBackup(backupPreview)");
    expect(settings).not.toContain("applyBackup(result.preview)");
  });

  it("computes an itemized safe restore summary without examining credentials or restoring approvals", () => {
    const payload = createBackupPayload(unsafeSource as never, "1.2.3");
    const unchanged = summarizeBackupRestore(unsafeSource as never, payload);
    const changedPayload = { ...payload, favoriteModelIds: ["gpt-5-mini"] };
    const changed = summarizeBackupRestore(unsafeSource as never, changedPayload);

    expect(unchanged.items.find((item) => item.id === "configuration")?.status).toBe("unchanged");
    expect(unchanged.items.find((item) => item.id === "providers")?.status).toBe("unchanged");
    expect(unchanged.items.find((item) => item.id === "mcpApprovals")).toMatchObject({ status: "excluded", incoming: "No approvals restored" });
    expect(changed.items.find((item) => item.id === "favorites")).toMatchObject({ status: "changed", current: "1 favourite", incoming: "1 favourite" });
    expect(unchanged.exclusions).toContain("Provider API keys");
    expect(JSON.stringify(unchanged)).not.toContain("telegram-token-must-never-export");
    expect(JSON.stringify(unchanged)).not.toContain("provider-connection-key-must-never-export");
  });

  it("keeps the dashboard health signal and itemized restore statuses tied to safe persisted data", () => {
    const settings = readFileSync(resolve(process.cwd(), "app/(tabs)/settings.tsx"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(settings).toContain("setBackupSummary(result.summary)");
    expect(settings).toContain("Detailed change review");
    expect(settings).toContain("WILL CHANGE");
    expect(settings).toContain("UNCHANGED");
    expect(settings).toContain("EXCLUDED");
    expect(dashboard).toContain("lastSuccessfulBackupAt");
    expect(dashboard).toContain("BACKUP HEALTH");
    expect(dashboard).toContain("Last successful:");
  });
});
