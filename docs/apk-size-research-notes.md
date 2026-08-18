# APK Size Optimization Research Notes

## Measured baseline

The retained Pocket Relay release APK measured 119 MiB on disk and 137.34 MiB uncompressed. The largest entries were `assets/chaquopy/requirements-common.imy` at 32.05 MiB, `classes.dex`/`classes2.dex`/`classes3.dex`/`classes4.dex` totaling 26.15 MiB uncompressed, `assets/chaquopy/stdlib-common.imy` at 4.60 MiB, and native libraries including React Native, CPython, Chaquopy crypto, and Hermes. The APK also contained React Native native libraries for `x86`, `x86_64`, and `armeabi-v7a` despite the intended arm64-v8a release target.

## Research findings

1. Chaquopy's official 17.0 documentation states that each ABI adds several megabytes plus any native requirement payload, and explicitly documents `abiFilters` as the mechanism for selecting supported ABIs. It lists `armeabi-v7a`, `arm64-v8a`, `x86`, and `x86_64`, and notes that Python 3.11 supports both 32-bit and 64-bit ABIs. Source: https://chaquo.com/chaquopy/doc/current/android.html

2. Android's official documentation states that ABI splits generate separate APKs containing only architecture-specific code and resources. It also recommends Android App Bundles where the distribution channel supports them, because the store can serve only the device-specific code and resources. Source: https://developer.android.com/build/configure-apk-splits

3. Chaquopy issue #448 records that normal Android resource shrinking and minification do not materially reduce embedded Python package payloads; the maintainer's guidance is to remove unnecessary ABIs and use smaller purpose-built packages where possible. Source: https://github.com/chaquo/chaquopy/issues/448

4. The Chaquopy documentation exposes `pip` requirements as the main Python payload control. The current Pocket Relay worker is intentionally Telegram-only, so unused upstream extras and packages should be removed only after import/runtime validation. Source: https://chaquo.com/chaquopy/doc/current/android.html

## Optimization hypotheses

The highest-confidence first optimization is enforcing a true arm64-v8a-only Android package at the application module level, not only setting the React Native architecture property. This should remove x86, x86_64, and armeabi-v7a native payloads from the universal APK. The next opportunity is reducing the Python requirements manifest after tracing imports and testing the worker. Android App Bundle or per-ABI APK distribution can reduce download size further, but F-Droid's delivery model must be confirmed before relying on it as the only artifact strategy.

## 2026-08-17 follow-up: measured ABI reduction

The rebuilt arm64-only APK measures 87,029,790 bytes on disk (approximately 83 MiB as reported by `du`), with SHA-256 `47898b7edae41241d6969ccc8d2d96975d20e2ee7945d0ba6603e506edcba61b`. Its only native ABI directory is `lib/arm64-v8a/`, containing 24,682,432 uncompressed bytes. The prior universal release was reported as 119 MiB, so narrowing the package to arm64-v8a removed approximately 32 MiB (about 27%) from the APK.

The largest remaining compressed APK entries are `assets/chaquopy/requirements-common.imy` at 33,603,626 bytes, `classes.dex` through `classes4.dex` totaling approximately 31 MiB, `lib/arm64-v8a/libreactnative.so` at 5.87 MiB, `lib/arm64-v8a/libpython3.11.so` at 5.14 MiB, `lib/arm64-v8a/libcrypto_python.so` at 3.55 MiB, and `assets/index.android.bundle` at 3.40 MiB.

The official Chaquopy FAQ says to review Python source directories and the pip requirements list, and recommends reducing ABIs. It specifically notes that because of Chaquopy’s native packaging, ordinary APK splits and app bundles will not help much; for a release, use an ABI-specific product flavor or equivalent ABI filter. Source: https://chaquo.com/chaquopy/doc/current/faq.html

The official Chaquopy Gradle documentation confirms that each ABI adds several MiB plus native requirement size, and documents `ndk { abiFilters "arm64-v8a" }`. Source: https://chaquo.com/chaquopy/doc/current/android.html

Android’s official size guidance recommends code/resource shrinking and native-binary reduction, but Chaquopy’s own ABI caveat takes precedence for this embedded-Python architecture. Sources: https://developer.android.com/topic/performance/reduce-apk-size and https://developer.android.com/build/configure-apk-splits

The source-controlled implementation is `plugins/with-arm64-only.js`, registered in `app.config.ts`; the generated project contains the matching `ndk { abiFilters "arm64-v8a" }` block. The optimized build completed successfully with the existing Chaquopy worker and wheel set.


## 2026-08-17 final measured optimization pass

The release build now applies three source-controlled reductions: an `arm64-v8a`-only ABI filter, R8 plus Android resource shrinking, and removal of unused direct Expo multimedia/browser/awake-screen dependencies and the unused direct `react-native-svg` package. The rebuilt APK is 73,732,724 bytes (70.31 MiB) with SHA-256 `fdfd1ca6a835044a8b395f42203f6d412841abd1139ec06b01be5cb46f6afccd`, verified from the rebuilt file. The immediately previous R8 + pruned-dependency APK was 73,814,748 bytes; the earlier arm64-only/R8 baseline was 77,002,900 bytes; the original multi-ABI, non-shrunk artifact was approximately 119 MiB. The final artifact contains only `arm64-v8a` native libraries, Chaquopy CPython 3.11 assets, and the required supervisor runtime. SBOM validation remains 62 components.

The largest unavoidable payload remains the embedded Chaquopy common Python archive at about 29.26 MiB uncompressed, followed by CPython, OpenSSL, React Native, Hermes, and the worker’s Python standard library. Further material reduction would require replacing the embedded CPython/Hermes architecture or removing required runtime functionality rather than ordinary Android packaging changes.
