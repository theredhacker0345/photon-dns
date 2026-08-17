import { afterEach, describe, expect, it, vi } from "vitest";

import { discoverRemoteMcpTools } from "../lib/mcp-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remote MCP Streamable HTTP discovery", () => {
  it("initializes, lists a bounded valid manifest, and never follows redirects", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } }), {
        status: 200,
        headers: { "mcp-session-id": "session-1" },
      }))
      .mockResolvedValueOnce(new Response("", { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [
        { name: "docs.search", description: "Search technical documentation", inputSchema: { type: "object" } },
        { name: "send_report", description: "Send a report to an approved recipient", inputSchema: { type: "object" } },
        { name: "../invalid", description: "Ignored", inputSchema: {} },
      ] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverRemoteMcpTools({
      endpoint: "https://mcp.example.com/v1/",
      authMode: "bearer",
      credential: "secret-token",
    });

    expect(result.ok).toBe(true);
    expect(result.tools).toHaveLength(2);
    expect(result.tools[0]).toMatchObject({ name: "docs.search", risk: "read" });
    expect(result.tools[1]).toMatchObject({ name: "send_report", risk: "side_effect" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://mcp.example.com/v1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer secret-token" }) });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ headers: expect.objectContaining({ "mcp-session-id": "session-1" }) });
  });

  it("does not list tools when initialization is rejected", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "unsupported protocol" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await discoverRemoteMcpTools({ endpoint: "https://mcp.example.com", authMode: "none" });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("rejected discovery");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
