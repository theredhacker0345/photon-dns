import { describe, expect, it } from "vitest";

import {
  classifyMcpToolRisk,
  isAllowedRemoteMcpEndpoint,
  isSafeMcpArgumentsJson,
  isValidMcpToolName,
  normalizeRemoteMcpEndpoint,
  requiresOwnerApproval,
  validateRemoteMcpDraft,
} from "../lib/mcp-contracts";

describe("remote MCP security contracts", () => {
  it("accepts only credential-free public HTTPS endpoints", () => {
    expect(isAllowedRemoteMcpEndpoint("https://mcp.example.com/v1")).toBe(true);
    expect(isAllowedRemoteMcpEndpoint("http://mcp.example.com")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://token@mcp.example.com")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://localhost/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://host.localhost/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://127.0.0.1/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://192.168.1.9/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://100.64.0.9/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://[::1]/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://[fd00::1]/mcp")).toBe(false);
    expect(isAllowedRemoteMcpEndpoint("https://mcp.example.com:8443/mcp")).toBe(false);
    expect(normalizeRemoteMcpEndpoint(" https://mcp.example.com/v1/ ")).toBe("https://mcp.example.com/v1");
  });

  it("requires a complete connector draft before discovery", () => {
    expect(validateRemoteMcpDraft({ name: "Ops", endpoint: "https://mcp.example.com", authMode: "bearer" })).toBeNull();
    expect(validateRemoteMcpDraft({ name: "X", endpoint: "https://mcp.example.com", authMode: "bearer" })).toContain("between 2 and 48");
    expect(validateRemoteMcpDraft({ name: "Ops", endpoint: "https://10.0.0.2", authMode: "none" })).toContain("public HTTPS");
  });

  it("keeps tool execution approval-scoped regardless of inferred risk", () => {
    expect(classifyMcpToolRisk("search_docs", "Find approved notes")).toBe("read");
    expect(classifyMcpToolRisk("send_invoice", "Post an invoice to the customer")).toBe("side_effect");
    expect(requiresOwnerApproval({ risk: "read" })).toBe(true);
    expect(requiresOwnerApproval({ risk: "side_effect" })).toBe(true);
  });

  it("accepts bounded object-only tool arguments and canonical tool names", () => {
    expect(isSafeMcpArgumentsJson('{"query":"status"}')).toBe(true);
    expect(isSafeMcpArgumentsJson("[]")).toBe(false);
    expect(isSafeMcpArgumentsJson("not-json")).toBe(false);
    expect(isValidMcpToolName("docs.search-v2")).toBe(true);
    expect(isValidMcpToolName("../shell")).toBe(false);
  });
});
