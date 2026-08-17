# Release License Verification

This record closes the non-standard metadata findings from the generated JavaScript and Python dependency SBOMs. It is evidence for the automated release gate, not a replacement for retaining upstream notices.

| Component family | Observed metadata | Classification | Evidence |
|---|---|---|---|
| `argparse` | `Python-2.0` | FOSS-compatible | Python Software Foundation License 2.0 identifier. |
| `caniuse-lite` | `CC-BY-4.0` | FOSS-compatible | Creative Commons Attribution 4.0. Attribution must be retained where applicable. |
| `chownr`, `glob`, `lru-cache`, `minimatch`, `path-scurry`, `sax`, `tar`, `yallist` | `BlueOak-1.0.0` | FOSS-compatible | Blue Oak Model License 1.0.0 is a permissive open-source license. |
| `distro` | Apache classifier wording | FOSS-compatible | Apache License 2.0 metadata in the bundled distribution. |
| `Jinja2` | BSD classifier wording | FOSS-compatible | BSD license classifier in the bundled distribution. |
| `python-dateutil` | Apache/BSD classifier wording | FOSS-compatible | Dual Apache 2.0/BSD metadata in the bundled distribution. |
| `requireg@0.2.2` | `Unknown` in SBOM metadata | MIT | The installed package includes `node_modules/requireg/LICENSE`; its package metadata declares MIT. |
| `seq-queue@0.0.5` | `Unknown` in SBOM metadata | MIT | The installed package includes `node_modules/seq-queue/LICENSE`, whose text is the MIT License. |

The release audit accepts only explicit FOSS classifications or the two source-backed overrides above. It fails for all `manual-review` and `blocked` findings. Maintainers must rerun `pnpm sbom:js`, `pnpm sbom`, and `pnpm audit:licenses` from the clean release source before publishing.
