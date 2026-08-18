# Secure Code-Execution Sandbox Design

**Author:** Manus AI  
**Status:** Proposed design; no runtime implementation in this document  
**Decision:** Add an owner-approved, capability-free JavaScript evaluation tier in a new Android isolated process. Keep the existing CPython/Hermes host out of the execution trust boundary.

## Executive decision

Pocket Agent Host should **not** add an Android shell, Termux, `subprocess`, a general Python REPL, Docker-like environment, or arbitrary package installation. Those choices would conflict with the app’s explicit non-goal of avoiding a general-purpose remote shell and would make permission, persistence, and F-Droid review substantially harder.

Instead, the first release should provide a deliberately small **JavaScript data-transformation sandbox**. The model may propose code, but it cannot execute that code directly. The owner reviews and approves an immutable source hash for a single run or a scheduled job. A custom native QuickJS embedding then evaluates the approved source in a separate Android service declared with `android:isolatedProcess="true"`, `android:exported="false"`, and no permissions. Android documents that an isolated-process service has no permissions of its own and can communicate only through the service API. [1]

> **Security invariant:** No untrusted program runs in the existing privileged foreground-host process, sees provider/Telegram/MCP credentials, receives Android permissions, accesses the real filesystem, imports a module, starts a process, or opens a network socket.

| Question | Proposed answer |
|---|---|
| What language is supported first? | Pure ECMAScript, evaluated by a custom embedded QuickJS runtime; no TypeScript transpilation, Node.js APIs, shell, Python, or package manager. |
| Can the AI run code autonomously? | No. It creates a code-run proposal. The owner approves the source hash and declared limits. A scheduled job may repeat only the same approved hash. |
| Can code access the phone or the internet? | No. The isolated service has no permissions. The QuickJS runtime exposes neither `std`, `os`, native module loading, Android/JNI callbacks, filesystem APIs, nor network APIs. |
| Can code persist files? | No in version 1. Inputs and outputs are in-memory JSON only. The parent app stores the owner-approved job specification in app-private storage. |
| How is resource abuse constrained? | Wall-clock interrupt, QuickJS heap and stack caps, input/source/output bounds, a parent-enforced hard timeout, serial execution, and the host’s existing CPU/RAM/workspace policy. |
| How does it remain F-Droid compatible? | Vendor pinned FLOSS QuickJS source, build it deterministically with the Android NDK, include license/SBOM evidence, and prohibit runtime downloads of engines, modules, or executables. [5] [6] |

## Scope and threat model

The sandbox protects the Android host, its credentials, and the owner from **model-generated or remotely supplied code that is incorrect, hostile, excessively resource-hungry, or trying to escape its declared task**. It does not promise to defend a device that is rooted, compromised at the OS/kernel level, or intentionally modified by its owner. It also cannot make unsafe external MCP servers safe; remote MCP remains a separate opt-in surface.

| Asset | Main risk | Required control |
|---|---|---|
| Telegram and provider credentials | Program reads, prints, or exfiltrates secrets. | Place secrets only in the existing supervisor process; pass none over the sandbox Binder protocol. |
| Device filesystem and private workspace | Program reads arbitrary data or creates unbounded files. | Version 1 exposes no filesystem. Inputs and results are bounded in-memory JSON; no scratch directory is mounted. |
| Network and LAN | Program becomes a scanning, proxy, or exfiltration client. | Isolated Android service with no permissions; no host network bridge; no QuickJS `std`/`os`; deny all imports. |
| Battery, CPU, RAM, and output channel | Infinite loops, heap growth, output flooding, or repeated scheduling. | Time interrupt, native memory/stack caps, parent kill timer, bounded output, serial queue, per-job schedule limits, existing guardrails. |
| Owner approval | Model alters approved code after review. | Canonical UTF-8 source plus policy is SHA-256 hashed; every changed byte, argument schema, or limit requires fresh approval. |
| Android IPC | A malicious app invokes the executor or sends oversized/malformed payloads. | Non-exported internal service, explicit bind only, typed versioned request/response contract, strict size/schema checks, one-time nonce, and no intents from third parties. |

## Why an isolated custom QuickJS embedding

Android already isolates application data by default, but the current Python host still shares the application UID and carries network and protected-storage responsibilities. It is therefore an unsuitable place to evaluate untrusted programs. Android’s isolated-process service mechanism instead creates a service process with no permissions. [1] Android security guidance also recommends minimizing permissions, using internal storage for private data, treating external storage as untrusted, and avoiding unverified dynamic executable loading. [2]

QuickJS is appropriate for the **narrow first tier** because it is compact, has no external dependency in its core engine, and its embedding API exposes a memory limit and an interrupt handler. [3] However, its command-line standard library explicitly includes filesystem, process, environment, and network-adjacent operations. Therefore, Pocket Agent Host must **not** invoke the `qjs` command-line interpreter or initialize the `std`/`os` modules. A safe embedding uses only the engine core and deliberately registers the minimal pure-data globals described below.

| Option | Decision | Reason |
|---|---|---|
| Existing CPython/Chaquopy worker | Reject for untrusted execution. | It runs in the privileged app host path and CPython language-level restrictions are not an OS security boundary. |
| Termux, `subprocess`, shell, PRoot, or a local Linux distribution | Reject. | It creates a general remote shell and broadens filesystem/process attack surface; it is contrary to the app’s stated runtime boundary. |
| WebView JavaScript | Reject. | It adds renderer/WebView complexity and potentially network-facing APIs without providing a tighter owner-facing capability model. |
| **Custom QuickJS core in an isolated process** | **Adopt for version 1.** | Small FOSS interpreter with practical memory and interruption controls when embedded without the command-line standard library. [3] |
| WASM/wasm3 capability-free modules | Defer to version 3. | wasm3 supports Android, gas metering, and linear-memory limits, but is in minimal maintenance and is less ergonomic for owner-authored scripts. [4] |
| Remote executor | Optional future connector only. | It is not self-hosted on the phone and transfers code/data to another system; it must never be the default. |

## Version 1 capability contract

The owner sees this feature as **“Code sandbox (data transformations)”**, not “terminal” or “VPS.” It is disabled by default. A first use explains that code runs locally but has neither device access nor internet access.

### Allowed language surface

The executor evaluates one ECMAScript program with a frozen JSON input object. It offers `JSON`, `Math`, strings, arrays, objects, typed arrays, and a bounded `console.log` sink. The program returns a JSON-serializable `result` or sets a single `result` variable. Date/time, randomness, `eval`, `Function`, dynamic `import()`, static imports, native modules, `SharedArrayBuffer`, Workers, and host-object reflection are removed or never registered. The exact QuickJS build configuration must be audited before enabling a language feature.

The only data crossing the boundary is a strict request and response envelope:

```text
ExecutionRequest v1
  runId: UUID
  sourceUtf8: <= 64 KiB
  sourceSha256: 32 bytes
  inputJsonUtf8: <= 32 KiB
  policy: { maxWallMs: 50..5000, maxHeapBytes: 1..16 MiB,
            maxStackBytes: 64 KiB..1 MiB, maxOutputBytes: 1..32 KiB }
  approvalNonce: 128-bit one-time value

ExecutionResponse v1
  runId, outcome: success | timeout | memory_limit | policy_denied | runtime_error
  resultJsonUtf8: <= 32 KiB
  stdoutUtf8: <= 32 KiB (truncated marker when necessary)
  diagnostics: fixed error code and bounded safe message
  elapsedMs, sourceSha256
```

The service rejects data that is invalid UTF-8, exceeds a byte limit, has an unexpected schema/version, fails source-hash verification, or has an expired/reused approval nonce. No input, output, or error is interpreted as an Android intent, SQL fragment, shell string, URI, or dynamically loaded program.

### Explicitly denied capabilities

| Denied capability | Enforcement point |
|---|---|
| Shell commands, child processes, or package installation | No shell binary/process API in the interpreter; no native host callback; isolated service has no app permissions. |
| Real filesystem, external storage, contacts, camera, microphone, location, clipboard, or Android APIs | No Binder method exposes them; no JavaScript bridge exports them; no file mount in version 1. |
| Internet, LAN, localhost, DNS, WebSocket, or HTTP | No `INTERNET` permission in the isolated process; no network callback and no QuickJS `std.urlGet`/`os` module. |
| Module/package imports and dynamic executable downloads | Custom module loader rejects every import; engine/module source is bundled at build time; no runtime download path. |
| Existing host credentials, Telegram configuration, MCP tokens, or model context | The parent passes only the reviewed JSON input. Secrets remain in Keystore-backed host state. |
| Unapproved repeat execution | Source and policy hash change invalidates approval; schedules refer only to a sealed job ID and hash. |

## Architecture

```text
Owner Telegram / Console
          │  model proposes code; no execute permission
          ▼
Privileged host supervisor ──► Owner approval UI ──► sealed CodeJob
   (credentials, Telegram,                      │  source hash + limits
    schedules, resource policy)                  ▼
          │ explicit internal Binder request
          │ no credentials / no MCP handles / bounded JSON
          ▼
CodeSandboxService :isolated
  android:isolatedProcess=true
  android:exported=false
          │
          ▼
Custom QuickJS JNI core
  no std/os, no imports, no native modules,
  no network/filesystem/process callbacks
          │
          ▼
bounded JSON result + logs ──► supervisor ──► owner-only delivery
```

The existing `PocketHermesSupervisorService` remains the **policy decision point**. It verifies that the app host is active, checks the existing resource guardrails, validates the sealed job, starts or binds to the isolated executor, enforces a parent timeout, receives the bounded result, and sends it only to the configured owner. The isolated service never reads the shared preferences, SecureStore values, task database, workspace, or Telegram configuration.

The isolated service should be short-lived. Each execution creates a fresh QuickJS runtime and context, handles one request, clears native buffers, returns a response, and stops. If the elapsed time reaches the policy deadline, the QuickJS interrupt callback aborts evaluation. If the callback does not complete promptly, the parent unbinds and kills the isolated process. A clean runtime per run prevents global state, compiled artifacts, and accidental cross-job persistence.

## Project integration map

The executor must be introduced as a **new native boundary**, not as a new method on `pocket_hermes_worker.py`. The existing worker shares Chaquopy, the app process, protected configuration, task persistence, and outbound network responsibilities; giving it an evaluator would collapse the intended isolation.

| Existing location | Change required | Security purpose |
|---|---|---|
| `modules/pocket-hermes-supervisor/android/src/main/AndroidManifest.xml` | Register `CodeSandboxService` with `android:isolatedProcess="true"`, `android:exported="false"`, no intent filter, and `android:stopWithTask="false"`. Do not add any sandbox-specific permission. | Creates an internal, permissionless process that third-party apps cannot bind to. |
| `modules/pocket-hermes-supervisor/android/build.gradle` | Add a pinned QuickJS source build through CMake/NDK, an ABI restriction of `arm64-v8a`, deterministic compiler/linker flags, and SBOM/license inputs. Do not add a Maven binary interpreter or runtime downloader. | Preserves a source-built, reviewable, F-Droid-compatible native dependency. |
| `modules/pocket-hermes-supervisor/android/src/main/cpp/` | Add a small JNI wrapper owning only `JSRuntime`, `JSContext`, a deny-all module loader, constrained globals, memory/stack limits, an interrupt handler, and JSON buffer copying. | Keeps the interpreter bridge minimal and makes forbidden APIs absent rather than merely hidden in JavaScript. |
| `CodeSandboxService.kt` and `CodeSandboxContracts.kt` (new) | Define a versioned internal Binder contract, strict byte limits, sealed request/response types, one-run lifecycle, and explicit zeroization/cleanup. | Prevents intent spoofing, oversized IPC, implicit serialization, and long-lived cross-job state. |
| `PocketHermesSupervisorService.kt` | Add a parent-side `executeApprovedCodeJob` coordinator that verifies the approval hash/nonces, checks host resource policy, enforces a hard deadline, and redacts/bounds delivery. | Maintains owner and resource policy in the only privileged decision point. |
| `PocketHermesSupervisorModule.kt` and `modules/.../src/PocketHermesSupervisorModule.ts` | Add proposal, owner-approval, list, revoke, and run-result APIs. Do not expose raw Binder/service handles to JavaScript. | Keeps React Native as a control plane rather than an executor transport. |
| `lib/host-contracts.ts`, `lib/native-supervisor.ts`, and `lib/pocket-hermes-store.tsx` | Add canonical `CodeExecutionPolicy`, sealed job metadata, approval state, and redacted result contracts. | Ensures the UI cannot accidentally issue a run with unvalidated limits or mutable source. |
| `app/(tabs)/agent.tsx`, `app/(tabs)/settings.tsx`, and setup copy | Add an off-by-default setting, a readable approval sheet, source-hash display, one-off approval/revoke controls, and an explicit no-terminal/no-network disclosure. | Makes the owner—not the model—the authority for each execution capability. |
| `tests/`, `docs/threat-model.md`, SBOM/license scripts, and F-Droid metadata | Add source, contract, fuzz, native, physical-device, license, and reproducibility gates. | Makes the security claim release-verifiable rather than a UI assertion. |

## Owner approval and scheduling

The model’s only new host-facing action is `propose_code_run`, which produces a review card rather than execution. The card displays the language, code, SHA-256 digest, input shape, resource envelope, expected result format, and an unambiguous list of denied capabilities. The owner may run it once, reject it, or create a sealed schedule.

A scheduled `CodeJob` persists `{jobId, sourceCiphertext, sourceHash, inputTemplate, policy, approvedAt, approvalVersion}` in app-private protected storage. Any code, template, or policy change creates a new hash and resets the approval state. A schedule cannot fetch, compile, or replace code at runtime. This preserves useful automations such as JSON transformations or calculations without allowing a model to mutate executable behavior after review.

The default limits should be conservative: **2 seconds wall time, 8 MiB interpreter heap, 256 KiB stack, 16 KiB input, 16 KiB output, one run at a time, and no more than six scheduled code runs per hour**. The owner can select values inside fixed safe bounds, but cannot disable all limits. Existing host CPU/RAM/workspace policy remains an outer guardrail and can defer or refuse new runs when the host is degraded.

## F-Droid and supply-chain requirements

QuickJS is MIT licensed, so it is license-compatible with a GPL-3.0-only application as a bundled dependency, provided attribution and source obligations are preserved. The repository should vendor a pinned upstream source archive or source subtree, record the commit/version and SHA-256, compile it with a pinned NDK/toolchain, and add it to the release SBOM and license audit. F-Droid requires FLOSS dependencies and source-build transparency; it also requires explicit user consent before downloading executable binaries. [5] Therefore, version 1 must not support downloading JavaScript packages, WASM, native modules, bytecode, compilers, or alternate runtimes.

Before F-Droid submission, maintainers must check that the new NDK library builds deterministically. F-Droid notes that native components are particularly sensitive for reproducibility. [6] The build should eliminate timestamps, absolute build paths, and non-deterministic archive ordering, then compare unsigned release artifacts with the project’s reproducibility process.

## Implementation sequence

| Phase | Deliverable | Exit criterion |
|---|---|---|
| 0. Policy and UX | `CodeExecutionPolicy`, settings disclosure, owner approval card, sealed-job data model, and threat-model update; all execution remains disabled. | No model or schedule can call an executor. |
| 1. Native isolation | Non-exported `CodeSandboxService` in an isolated process, typed Binder contract, fresh process lifecycle, and parent kill switch. | Instrumented test proves no direct app-permission/API access and rejects malformed/oversized IPC. |
| 2. Interpreter core | Pinned QuickJS JNI build with core-only globals, deny-all module loader, memory/stack/wall/output limits, and bounded console/result bridge. | Adversarial scripts cannot import, access filesystem/network/process APIs, exceed quotas, or survive a timeout. |
| 3. Owner flow | `propose_code_run`, approval hash, one-off run, owner-only result delivery, and sealed scheduled job. | A changed byte or policy revokes approval; non-owner Telegram traffic cannot trigger a run. |
| 4. Release hardening | SBOM, license evidence, deterministic-build check, fuzzing, physical-device/OEM tests, and updated F-Droid metadata. | Release gate passes and no feature claim exceeds physical-device evidence. |
| 5. Optional WASM tier | Separate capability-free WebAssembly module path, only after an independent security review. | WASM does not reuse QuickJS privileges or introduce WASI/network/filesystem imports. |

## Validation plan

Unit tests should cover canonical source hashing, policy bounds, approval invalidation, schema validation, output truncation, and schedule sealing. Native source-contract tests must require `isolatedProcess=true`, `exported=false`, a deny-all module loader, no `std`/`os` initialization, no `INTERNET` permission on the executor component, and a parent-enforced kill path.

The native test corpus should include infinite loops, recursive stack exhaustion, large arrays/strings, regular-expression stress cases, repeated console output, malformed UTF-8, Binder-size pressure, import attempts, `eval`/`Function` attempts, path traversal strings, URL strings, JavaScript prototype pollution payloads, and attempts to access `process`, `require`, `fetch`, `XMLHttpRequest`, `Deno`, `Bun`, `std`, and `os`. Each case must end in a bounded result, timeout, or policy error—never a host crash or delayed schedule execution.

Physical-device acceptance must verify that an execution has no network access even though the primary app uses Telegram/model networking; that it cannot read app-private host data; that a kill timeout recovers the foreground host; that a reboot does not resurrect an unapproved run; and that screen lock/OEM power management do not cause secret-bearing fallback paths. A fuzzing campaign against the Binder decoder and the QuickJS integration is required before a public “sandboxed code execution” claim.

## Decisions that require owner approval

This design intentionally stops before implementation. The owner must approve the additional native dependency, an isolated-service architecture, the JavaScript-only version-1 scope, and the proposed owner-confirmation model. The safest default is **one-off approval only**; sealed scheduled jobs should be enabled only after phase 3 validation.

## References

[1]: https://developer.android.com/guide/topics/manifest/service-element "Android Developers: `<service>`"
[2]: https://developer.android.com/privacy-and-security/security-tips "Android Developers: Security Checklist"
[3]: https://bellard.org/quickjs/quickjs.html "QuickJS JavaScript Engine Documentation"
[4]: https://github.com/wasm3/wasm3 "wasm3: WebAssembly Interpreter"
[5]: https://f-droid.org/en/docs/Inclusion_Policy/ "F-Droid Inclusion Policy"
[6]: https://f-droid.org/en/docs/Reproducible_Builds/ "F-Droid Reproducible Builds"
