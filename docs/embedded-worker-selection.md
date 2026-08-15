# Embedded Worker Selection — CPython, Hermes, and ARM64

## Selected foundation

Pocket Hermes will target **Python 3.11 on `arm64-v8a`** for the first embedded Hermes worker. Hermes Agent 0.20.1 supports Python `>=3.11,<3.14`, and the project’s existing Android/Termux constraints confirm that Android-specific dependency handling is needed. [1] [2]

The Android build integration candidate is **Chaquopy 17.0.0**, an MIT-licensed Python SDK for Android. It supports Python 3.10–3.14, Android Gradle Plugin 7.3–9.2, and API level 24+, matching Pocket Hermes’ existing Android minimum. It can run Python in an Android library module and packages an interpreter, source code, and third-party requirements through Gradle. [3] [4] [5]

| Decision | Selection | Reason |
|---|---|---|
| **Python version** | 3.11 | Meets the upstream Hermes constraint while remaining compatible with the sandbox build Python and the selected Android SDK. [1] [4] |
| **Android ABI** | `arm64-v8a` | Fits modern dedicated spare phones and avoids shipping unnecessary emulator or 32-bit interpreter assets. [4] |
| **Runtime integration** | Chaquopy in the app-local supervisor module | Supports Kotlin↔Python calls and is licensed MIT. [3] [5] |
| **Worker entry point** | A constrained `pocket_hermes_worker` launcher | Starts only the Telegram gateway profile, not Hermes’ TUI, browser tools, arbitrary package installation, or unrestricted terminal tools. |
| **Dependency source** | Upstream Hermes lock/requirements, pinned and verified during build | Avoids runtime package installation and allows SBOM generation before distribution. |

## Important implementation restriction

Android’s official Python guidance states that Python must run in embedded mode: `libpython`, the standard library, and app code are packaged privately inside the Android application. It also recommends building Android wheels with `cibuildwheel` where needed. [5] The Pocket Hermes runtime must therefore ship a version-pinned bundle rather than exposing an interactive Python installation or a general-purpose shell.

The upstream Hermes core includes native-extension dependencies such as `pydantic-core`, `cryptography`, `psutil`, and Pillow. Those wheels must be resolved for CPython 3.11 / Android ARM64 before an APK can honestly be called runnable. The upcoming SBOM generator treats missing hashes, missing licenses, or unsupported Android wheels as build-stopping errors rather than silently falling back to a desktop wheel.

## References

[1]: https://raw.githubusercontent.com/NousResearch/hermes-agent/main/pyproject.toml "Hermes Agent 0.20.1 project metadata and Python constraint"
[2]: https://raw.githubusercontent.com/NousResearch/hermes-agent/main/constraints-termux.txt "Hermes Agent Android dependency constraints"
[3]: https://github.com/chaquo/chaquopy "Chaquopy GitHub repository — MIT license"
[4]: https://chaquo.com/chaquopy/doc/current/versions.html "Chaquopy 17.0 version support matrix"
[5]: https://docs.python.org/3/using/android.html "Python documentation — Using Python on Android"
