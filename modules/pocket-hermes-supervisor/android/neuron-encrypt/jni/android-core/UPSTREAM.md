# Neuron Encrypt Android cryptographic core provenance

This directory contains the GPL-3.0-only cryptographic modules used by Pocket
Relay's Android JNI library. It is derived from **Neuron Encrypt 2.1.2** at
<https://gitlab.com/theredhacker0345/neuron-encrypt>.

The copied upstream source files are `src/crypto.rs`, `src/error.rs`, and
`src/utils.rs`, along with the upstream `LICENSE`. `src/lib.rs` and this
manifest are Pocket Relay integration files that expose precisely those modules
as a non-published Android library. The upstream desktop application, CLI, and
their GUI-only dependencies are intentionally excluded: none is linked into the
JNI library and including them would needlessly enlarge the F-Droid-audited
offline dependency closure.

Any update must preserve the upstream encryption-file compatibility contract,
review this provenance record, regenerate the locked Android-core dependency
closure, and validate the JNI encrypt/decrypt round trip.
