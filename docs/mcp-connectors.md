# Remote MCP Connectors

## Scope

Pocket Agent Host provides an **owner-managed remote MCP connector foundation**. It is an MCP *client*: the embedded Android worker can connect directly to a server selected by the device owner, discover its tool manifest, and invoke a previously approved tool through the existing durable task and Telegram boundaries.

The implementation is intentionally narrow. It supports remote **HTTPS Streamable HTTP** endpoints and bearer-style credentials stored through the Android protected-secret path. It does **not** run local MCP processes, `stdio` transports, a terminal, arbitrary binaries, Docker, package installation, or an app-operated cloud relay.

| Capability | V1 behavior | Security boundary |
|---|---|---|
| Transport | HTTPS JSON-RPC / Streamable HTTP | HTTP, redirects, URL credentials, loopback, private-network, link-local, and non-standard ports are rejected. |
| Discovery | `initialize` followed by `tools/list` | Tool metadata is untrusted data and is size-bounded and redacted. |
| Credentials | Optional bearer token | The token is saved through the native protected-secret bridge and is omitted from ordinary persisted app state, diagnostics, and task history. |
| Execution | Explicit `mcp serverId toolName {json}` command | Only the verified private Telegram owner or the local durable task path can request a tool. |
| Approval | Named tool, scoped to a ten-minute grant | A missing, expired, disabled, or manifest-mismatched grant fails closed. |
| Side effects | No automatic tool escalation | The tool schema and output are treated as untrusted; a later release must add a per-invocation confirmation surface for writes. |

## Owner flow

The owner opens **Settings → Remote MCP**, supplies a connector name, HTTPS endpoint, and optional bearer credential, then runs discovery. A successful discovery presents the server's tool manifest. The owner must explicitly approve each tool before the worker may call it. Disabling or removing a connector immediately removes it from the runtime payload.

When the Android host is active, connector and grant changes synchronize through the narrow native MCP runtime-update bridge. The worker does not need to restart and no credential is written into ordinary JavaScript persistence to make an approved tool available.

## Security model

> Server-provided tool names, descriptions, annotations, schemas, and results are data—not authorization.

The transport adapter requires an absolute, credential-free HTTPS endpoint on the default HTTPS port, rejects directly addressed local, private, link-local, reserved, and IPv6 targets, disables redirects, bounds request and response size, and reports redacted errors. The worker independently repeats endpoint validation before any outbound invocation. DNS hostnames remain an owner-selected external-service boundary; trusted-LAN and self-hosted private MCP deployments are intentionally unsupported. The worker retains the upstream MCP loader block, gives every upstream Hermes agent session an explicit empty toolset, and exposes no generic local command or server-runner path. The bounded `/mcp` bridge is deliberately separate from the model-facing tool registry.

Connector state is partitioned into a secret-free record, a protected credential reference, the discovered manifest fingerprint, and expiring grants. A changed manifest fingerprint invalidates prior grants. Runtime payloads contain only enabled connectors with unexpired approvals and are encrypted by the existing Android supervisor configuration lifecycle.

## Model and runtime limitations

The current foundation exposes explicit, owner-approved calls; it does not claim that every selected model can autonomously issue safe tool calls. A later model-driven tool loop must first enforce a provider-specific tool-capability contract, validate tool arguments against the discovered schema, and add a durable per-invocation approval record for side-effecting tools.

OAuth, device authorization flows, resources, prompts, trusted-LAN MCP endpoints, and local or `stdio` servers are deliberately deferred. Any of these additions requires a separate security and release review.

## Verification

The deterministic test suite covers endpoint policy, tool manifest normalization, approval expiry, manifest invalidation, owner-only command parsing, secret-redaction boundaries, Streamable HTTP discovery, and the Android live-update contract. Native compilation uses the existing `POCKET_HERMES_BUILDPYTHON` environment contract with a CPython 3.11 executable; a build toolchain must expose the matching runtime libraries. The Python SBOM is generated from Chaquopy’s release payload only, and the Android requirement manifest pins its full reviewed runtime closure.

## References

[1]: https://modelcontextprotocol.io/specification/2025-06-18/server/tools "Model Context Protocol — Tools"

[2]: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports "Model Context Protocol — Transports"

[3]: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization "Model Context Protocol — Authorization"

[4]: https://github.com/modelcontextprotocol/python-sdk "Official Model Context Protocol Python SDK"
