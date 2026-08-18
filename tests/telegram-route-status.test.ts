import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProject = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Telegram route-status feedback", () => {
  const status = readProject("components/telegram-route-status.tsx");
  const settings = readProject("app/(tabs)/settings.tsx");
  const setup = readProject("app/setup.tsx");
  const store = readProject("lib/pocket-hermes-store.tsx");

  it("shows a live, route-specific status surface for Direct, HTTP, and SOCKS5 routes", () => {
    expect(status).toContain('type === "none" ? "Direct" : type === "http" ? "HTTP proxy" : "SOCKS5 proxy"');
    expect(status).toContain("Checking ${routeLabel(proxy.type)}…");
    expect(status).toContain("ready to verify");
    expect(status).toContain("reachable");
    expect(status).toContain("needs attention");
    expect(status).toContain("setResult(null);");
  });

  it("tests the active form draft through the protected native route without persisting it first", () => {
    expect(status).toContain("testGateway({");
    expect(status).toContain("telegramProxy: { type: normalizedProxy.type");
    expect(store).toContain("export type GatewayTestInput");
    expect(store).toContain("const draftProxy = input?.telegramProxy");
    expect(store).toContain("savedRouteMatchesDraft");
    expect(store).toContain("testNativeTelegramGateway({");
    expect(store).toContain("telegramProxyType: draftProxy.type");
  });

  it("keeps optional proxy credentials out of UI text while passing them only to the route check", () => {
    expect(status).toContain("telegramProxyCredential: proxyCredential");
    expect(status).not.toContain("{proxyCredential}");
    expect(status).not.toContain("value={proxyCredential}");
  });

  it("makes the same route-status component available before and after first-run setup", () => {
    expect(settings).toContain("<TelegramRouteStatus");
    expect(setup).toContain("<TelegramRouteStatus");
    expect(settings).toContain("testGateway={testGateway}");
    expect(setup).toContain("testGateway={testGateway}");
  });
});
