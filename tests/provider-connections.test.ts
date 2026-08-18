import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProject = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("saved model-provider connections", () => {
  const store = readProject("lib/pocket-hermes-store.tsx");

  it("persists public provider metadata only and validates it during hydration", () => {
    expect(store).toContain('export type SavedProviderConnection = { id: string; label: string; provider: ModelProviderId; endpoint: string; hasApiKey: boolean; createdAt: string }');
    expect(store).not.toMatch(/SavedProviderConnection = \{[^}]*apiKey/);
    expect(store).not.toMatch(/SavedProviderConnection = \{[^}]*token/);
    expect(store).toContain("function normalizeSavedProviderConnections(value: unknown): SavedProviderConnection[]");
    expect(store).toContain("hasApiKey: item.hasApiKey === true");
  });

  it("bounds saved connections and ignores a stale active-connection reference", () => {
    expect(store).toContain("export const MAX_SAVED_PROVIDER_CONNECTIONS = 8");
    expect(store).toContain(".slice(0, MAX_SAVED_PROVIDER_CONNECTIONS)");
    expect(store).toContain("const activeProviderConnectionId = providerConnections.some((connection) => connection.id === parsed.activeProviderConnectionId) ? parsed.activeProviderConnectionId : null");
  });

  it("resolves every model credential from the selected connection’s protected key", () => {
    expect(store).toContain("const hasApiKey = await hasSecret(providerCredentialKey(connectionId));");
    expect(store).toContain("state.activeProviderConnectionId ? await readSecret(providerCredentialKey(state.activeProviderConnectionId)) : null");
    expect(store).toContain("state.activeProviderConnectionId ? readSecret(providerCredentialKey(state.activeProviderConnectionId)) : readSecret(MODEL_API_KEY)");
    expect(store).toContain("await deleteSecret(providerCredentialKey(connectionId));");
  });
});
