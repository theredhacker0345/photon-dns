# Defensive QuickJS Sandbox Review

**Scope:** The Android-local QuickJS executor, its JNI evaluator, the isolated Binder service, the main-process approval policy, and the owner controls.  
**Out of scope by design:** Shell execution, Termux integration, root access, package installation, arbitrary Python execution, native compilation, and local MCP/stdio transports.

## Conclusion

The code-execution feature is a **narrow, owner-approved JavaScript evaluator**, not a phone-hosted terminal or a general development environment. It uses Android's non-exported isolated-service boundary and a QuickJS core with no host callbacks. The review intentionally rejected the supplied shell/Python proposal: command whitelists and import blacklists cannot provide an equivalent confinement boundary.

| Boundary | Verified implementation | Defensive result |
|---|---|---|
| Process identity | `QuickJsSandboxService` is non-exported and declared as `isolatedProcess=true`. | The evaluator receives a separate Android UID and has no app-private credential access. |
| Native runtime | Pinned source-built QuickJS core; no `quickjs-libc`, `js_std`, or OS module helpers are linked. | No terminal, filesystem, process, network, package, or Android API is registered for JavaScript. |
| Language capabilities | Module loader always fails; blocking is disabled; stack, memory, source, output, and interrupt limits are configured in JNI. | Imports, WASI-style host bindings, and blocking waits fail closed. |
| Authorization | A source SHA-256 hash requires a local owner approval that expires after ten minutes. | Any source edit invalidates the approval. |
| Execution envelope | Jobs use one fixed envelope: **750 ms**, **16 MiB**, and **8 KiB** result output. Per-run resource overrides are rejected. | Approval cannot be re-used for a more permissive job. |
| IPC and lifecycle | Binder input is capped at 32 KiB. The host waits only for the fixed envelope plus a short grace period, then unbinds and requests service stop. | A failed executor cannot keep the privileged control-plane call waiting indefinitely. |
| Audit storage | Approval expiry records and audit records are encrypted; expired approvals are removed and audit history is capped at 50 records. | Sandbox bookkeeping cannot grow indefinitely in private storage. |

## Repairs Added by This Review

The first implementation accepted optional timeout, memory, and output values within broad maximums. That meant an approval for ordinary execution could be reused with a different, more permissive resource envelope. The policy now accepts only omitted values or the exact fixed defaults.

The first implementation also relied solely on QuickJS's cooperative interrupt handler. A parent-side Binder response deadline now ensures the privileged host unbinds and requests executor shutdown if the isolated service does not return within the fixed execution envelope. This is defense in depth; the isolated service remains one request per binding.

Finally, encrypted audit and expired-approval records are now pruned. Audit records include only the source hash, result status, timestamp, result byte count, truncation, and timeout metadata—never source text, credentials, or result content.

## Residual Risks and Explicit Limits

> Android isolated processes are an important containment layer, not a replacement for a patched operating system or a secure device. A compromised OS, kernel, boot chain, or accessibility/root tool can defeat app-level controls.

QuickJS interruption is cooperative while JavaScript executes. The parent deadline limits host waiting and tears down the bound service, but a physical-device test must confirm prompt process cleanup on the target Android/OEM build. JavaScript can still perform CPU and memory work until the configured limit is reached; it cannot perform I/O because no I/O capability is present.

The evaluator returns bounded output to the local owner interface. It must never be treated as a safe place for secrets: approved source can still format data the owner provided directly in that source. The agent itself cannot silently approve code, alter a sealed source hash, schedule a code job, or reach this executor through Telegram.

## Physical-Device Verification

Before relying on code execution, test on the target dedicated phone with notification permission granted and developer diagnostics available:

1. Approve `1 + 1`, execute it, and verify the bounded result is returned.
2. Alter one character and verify execution is rejected until the owner approves the new hash.
3. Attempt `import "x"`, `fetch(...)`, `process`, `require`, and `new Function("...")`; confirm imports and unavailable host APIs fail without host impact.
4. Run an intentional loop and verify a timeout is returned near the fixed envelope and the executor does not remain active.
5. Request oversized source and Binder payloads; verify rejection without an application crash.
6. Repeat more than 50 approved runs and verify private audit storage remains bounded.

## References

- [Android service declaration and isolated-process attributes](https://developer.android.com/guide/topics/manifest/service-element)
- [Android application sandbox fundamentals](https://source.android.com/docs/security/app-sandbox)
- [QuickJS upstream source repository](https://github.com/bellard/quickjs)
- [F-Droid inclusion policy](https://f-droid.org/en/docs/Inclusion_Policy/)
