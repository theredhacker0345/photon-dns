# README Benchmark Notes

**Purpose.** These notes preserve the external documentation research used for the Pocket Agent Host README refresh. The project README itself should remain a concise user and contributor entry point; source-specific details belong in the linked project documents.

| Reference | Useful pattern | Application to Pocket Agent Host |
|---|---|---|
| [Android Architecture Samples](https://github.com/android/architecture-samples) | Opens with purpose, identifies intended audience, explicitly states scope limits, then gives a short setup path and license. | State the dedicated-phone host purpose, name the exact boundary (no public terminal or general shell), and separate first-use setup from contributor build instructions. |
| [GitHub ReadME Project: First OSS Contribution](https://github.com/readme/guides/first-oss-contribution) | Treats `README.md` as the landing page and links readers to contribution, community, and license material. | Link to `CONTRIBUTING.md`, the copyright policy, threat model, privacy material, SBOM, and F-Droid handoff guidance rather than duplicating their full contents. |
| [Awesome README](https://github.com/matiassingers/awesome-readme) | Highlights the recurring value of a clear description, visual proof, concise installation, navigation, feature overview, architecture, and contribution guidance. | Use the existing real dashboard screenshot and icon once, place a short highlights section before deeper technical material, and add a navigable table of contents. |
| [How to write a good README](https://github.com/banesullivan/README) | Prioritizes an approachable elevator pitch, answers whether the project solves a reader's problem, makes license status clear, and separates user installation from development detail. | Use a direct value statement; provide device requirements and an APK/source-build distinction; avoid claiming a consumer-ready download where the repository only provides reproducible source and a manual CI build path. |

## Design decisions adopted

1. **Progressive disclosure.** The first screenful should explain what the project is, how it stays private, and which readers it is for. Detailed architecture and operational policy should follow through well-linked sections.
2. **Operational honesty.** Use scoped language for verification, Android requirements, release status, and hardware testing. Do not imply that a general-purpose sandbox, terminal, cloud service, or public APK download exists when it does not.
3. **Fast orientation.** Present a concise feature overview, the four-stage first-run path, a mobile screenshot, and a high-level architecture diagram before development guidance.
4. **Contributor readiness.** Link to the GPL-3.0-only license, contributor policy, security/privacy documents, SBOM/license audit, and manual GitLab CI APK process.

## Sources

1. https://github.com/android/architecture-samples
2. https://github.com/readme/guides/first-oss-contribution
3. https://github.com/matiassingers/awesome-readme
4. https://github.com/banesullivan/README
