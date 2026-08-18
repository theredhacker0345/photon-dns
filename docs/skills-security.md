# Owner-Approved Skills

Pocket Relay skills are **small, capability-free QuickJS packages** for deterministic JSON transformations. They are not plugins with Android, shell, filesystem, network, Python, compiler, or connector access. A skill must define a `skill.json` manifest, an exact SHA-256 source hash, a FOSS SPDX license, empty permissions, and bounded input/output schemas. The only accepted skill type is `quickjs` with the fixed `main.js` entrypoint.

| Stage | Owner-visible control | Enforcement boundary |
|---|---|---|
| GitHub import | Paste a public GitHub URL and inspect the staged manifest/source | HTTPS only; GitHub reference resolves to a commit SHA; only `skill.json` and `main.js` are fetched; byte, schema, license, and source-hash checks apply. |
| Hermes creation | Ask Hermes for a pure transformation draft | The request constrains the response to one manifest and `run(input)` source. Hermes cannot install, activate, approve, or execute the draft. |
| Installation | Explicit checkbox confirms review before inactive installation | Staging and installed bytes remain inside Android app-private storage. |
| Execution | Owner taps **Approve & run** and supplies reviewed JSON input | The exact source hash is sealed under the existing time-limited owner approval and executes in the non-exported isolated QuickJS process. |
| Removal | Owner confirms deletion | Private package files and the active native source approval are revoked together. |

> **No automatic execution occurs.** Importing, AI drafting, installing, enabling, and running are separate actions. A skill never receives secrets, Telegram credentials, provider credentials, MCP credentials, or a network transport.

The executor passes the input as a parsed QuickJS value to a synchronous `run(input)` function. It does not interpolate owner data into JavaScript source. Both sides of the bridge enforce an 8 KiB input ceiling; the isolated process keeps the established runtime limits and serializes results as JSON before the app validates the declared output schema.

## GitHub package format

```text
skill.json
main.js
```

`main.js` must define `function run(input) { ... }` and return a JSON-serializable value compatible with the manifest's `outputSchema`. Repositories must declare one of Pocket Relay's accepted FOSS SPDX identifiers. Branch names are never trusted as immutable package identity: the importer records the resolved commit SHA and fingerprints the exact entrypoint bytes.

## Intentional exclusions

Python, executable archives, npm packages, dynamic imports, native libraries, filesystem access, local/stdio MCP, HTTP requests, shell commands, compilers, background daemons, and auto-run schedules are excluded. These restrictions preserve Pocket Relay’s offline-code-execution boundary while allowing useful data-only skills such as parsing, formatting, validation, and structured transformation.
