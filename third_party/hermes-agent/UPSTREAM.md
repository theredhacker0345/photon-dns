# Vendored Hermes Agent Provenance

This directory contains the complete **build-required Python package source subset**
for Pocket Relay's embedded Hermes Agent wheel. It is intentionally not a fork and
is not updated by the Android build.

| Field | Recorded value |
|---|---|
| Upstream repository | `https://github.com/NousResearch/hermes-agent.git` |
| Upstream revision | `165c889e5b4277b56dadd42949a4112c1e6175a6` |
| Upstream package version | `0.20.1` |
| Upstream license | MIT, preserved in `LICENSE` |
| Imported files | 1,126 files required by upstream `pyproject.toml` package discovery, declared `py-modules`, and package-data rules |
| Scope intentionally excluded | Git history, tests, unrelated top-level documentation, website, desktop application, optional skills, installer assets, unrelated development tooling, and the two non-runtime high-resolution achievement screenshots |
| Stable content digest | `052ef8ebe1defc3307288b534299f63951afe9c6bd3aeffd9bfd44375f18735a` |

The content digest is SHA-256 over a lexicographically sorted stream of each
vendored relative path followed by that file's SHA-256. `UPSTREAM.md` is excluded
from the digest so this explanatory record can be updated without changing the
verified upstream source content. The Pocket Relay wheel builder recomputes this
digest and fails closed if it does not match.

The vendor scope comprises the exact packages included by the pinned upstream
`[tool.setuptools.packages.find]` configuration (`agent`, `tools`, `hermes_cli`,
`gateway`, `tui_gateway`, `cron`, `acp_adapter`, `plugins`, and `providers`), all
declared top-level Python modules, `pyproject.toml`, `README.md`, and the upstream
MIT license. It includes the package-data paths declared by the upstream build
metadata. This lets the Android wheel be built completely offline from reviewed
source while avoiding unrelated upstream repositories and generated assets. The
omitted screenshots were upstream documentation-only PNG files exceeding 1 MB;
they are neither imported nor referenced by the Android wheel build.
