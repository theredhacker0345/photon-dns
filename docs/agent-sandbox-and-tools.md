# Embedded Agent Sandbox and Tool Surface

## Direct answer

Pocket Relay provides the embedded model with an **Android app-private runtime boundary**, not a general-purpose container or virtual machine. The agent runs inside the application’s Android UID through the embedded CPython runtime. Its persistent workspace is the app-private `HERMES_HOME` directory; it is not shared storage, a user-visible terminal, or an arbitrary code-execution environment.

| Boundary | What the embedded agent receives | What it does not receive |
|---|---|---|
| Process | A private CPython 3.11 worker started by a foreground Android service. | Root, ADB, Termux, an Android shell, or another app’s permissions. |
| Storage | A bounded app-private workspace for its own task, schedule, and runtime data. The owner can set a 64 MB–8 GB quota. | Shared/external storage access, a user filesystem browser, or arbitrary local-file tools. |
| Runtime | An OpenAI-compatible provider connection and Telegram long-polling gateway configured by the owner. | Package installation, a Python REPL, arbitrary subprocess execution, local servers, Docker, or a browser session. |
| Network | The configured model endpoint, Telegram, and explicitly approved public HTTPS remote MCP endpoints. | General web search/fetch tools, LAN/private-network access, HTTP/redirect targets, and local/stdio MCP. |

> This is a **least-privilege application sandbox**, not a claim of Linux-container isolation. Android process isolation and the app-private filesystem are the security boundary; Android/OEM behavior still requires physical-device validation.

## Model-facing tools

The upstream Hermes package includes code for numerous desktop-oriented tools, but Pocket Relay now gives every embedded `AIAgent` session an explicit **empty upstream toolset**. Consequently, normal prompts and durable tasks cannot cause the model to invoke any of the packaged terminal, browser, file, web, plugin, local-MCP, or code-execution tools.

| Tool category | Available to the model through the standard Hermes tool registry? | Notes |
|---|---:|---|
| Terminal, shell, subprocess, package installation | No | No Android terminal or command runner is exposed. |
| Browser automation, screenshots, web search/extraction | No | Browser and general web tools are not exposed to the model. |
| Read/write/patch/search local files | No | The app-private workspace supports host metadata only; it is not an agent file-tool surface. |
| Code execution | No | The host does not provide a model-invocable code sandbox. |
| Upstream local or `stdio` MCP | No | The upstream loader is blocked and local transports are unsupported. |

## The only owner-invocable tool path: remote MCP

The sole tool-like capability is the **separate remote MCP bridge**. It is not automatically selected by the model. The configured private Telegram owner or local durable task flow may explicitly submit:

```text
/mcp serverId toolName {"argument":"value"}
```

The worker accepts that command only when the connector is enabled, its discovered manifest still contains the named tool, the owner grant is unexpired (ten minutes), the endpoint is a public default-port HTTPS URL, and argument/response limits are respected. See [Remote MCP connectors](mcp-connectors.md) for the complete policy.

## Operational implications

The agent can reason over owner messages and return provider-generated text. It can execute owner-authorized remote MCP calls using the narrow command above. It cannot independently browse, operate a shell, alter Android settings, install software, run arbitrary local code, or read arbitrary phone data. Adding any of those capabilities would require a separate security design, clear owner consent, explicit tool contracts, and physical-device validation.
