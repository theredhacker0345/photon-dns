# Pydantic Core 2.46.4 — Vendored Source Provenance

Pocket Relay vendors this source tree because the embedded Hermes Agent requires
`pydantic-core` on Android, while Chaquopy does not provide the required
Android ABI wheel. This checkout is an **offline build input**, not a runtime
download mechanism.

| Field | Recorded value |
| --- | --- |
| Upstream project | `pydantic/pydantic-core` |
| Distribution source | `https://files.pythonhosted.org/packages/9d/56/921726b776ace8d8f5db44c4ef961006580d91dc52b803c489fafd1aa249/pydantic_core-2.46.4.tar.gz` |
| Version | `2.46.4` |
| Upstream source archive SHA-256 | `62f875393d7f270851f20523dd2e29f082bcc82292d66db2b64ea71f64b6e1c1` |
| Upstream license | MIT (`LICENSE` retained verbatim) |
| Rust dependency lock | `Cargo.lock` retained; SHA-256 `c3c27fc600d7dafd149229c6501271dbc5f6b4f7b1bfa116b32e77217c2b5038` |
| Rust source closure | 103 crates from `Cargo.lock`, copied into `vendor/` through `cargo vendor --locked --versioned-dirs` |
| Cargo source replacement | `.cargo/config.toml` replaces crates.io with `vendor/` |
| Vendored tree SHA-256 | `087267c473a90349404c3b259193cffc8902bfa22f94bd99a2b71eefe5dddd14` |

The tree digest is calculated before this file is added from the committed
source entries, using the following portable algorithm. This intentionally
excludes ignored Cargo build output, so it remains identical in a clean
F-Droid checkout and after local validation:

```sh
git -C ../.. ls-tree -r --name-only HEAD -- third_party/pydantic-core \
  | sed -e 's|^third_party/pydantic-core/|./|' -e '/^\.\/UPSTREAM\.md$/d' \
  | LC_ALL=C sort \
  | xargs -d '\n' sha256sum \
  | sha256sum
```

`scripts/build-pydantic-core-android-wheel.sh` verifies the recorded committed
source-tree digest before cross-compilation, enables Cargo offline mode, and
refuses to build when the checked-in source closure is incomplete or altered.
