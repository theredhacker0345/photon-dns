# Android Build Toolchain Notes

The sandbox release build uses the official Android command-line tools at `https://developer.android.com/tools`. The Android documentation states that `sdkmanager` installs packages into the Android SDK directory and recommends setting `ANDROID_HOME` for command-line builds. The local build therefore uses `/home/ubuntu/android-sdk` via `android/local.properties`.

The generated Expo SDK 54 Android project requires Android API 36, Build Tools 36.0.0, NDK 27.1.12297006, and a Java 21 compiler. These packages were installed locally with the official SDK manager; Java 21 uses the Ubuntu `openjdk-21-jdk-headless` package. The project builds arm64-v8a only.

The NDK configuration follows the official documentation at `https://developer.android.com/studio/projects/install-ndk`, which describes side-by-side NDK installation through the SDK manager and setting an exact version for reproducible Gradle builds.

The first native build attempts identified two sandbox prerequisites absent from the base environment: an Android SDK location and a Java compiler. Both were provisioned before retrying. A later attempt terminated during CMake compilation under the sandbox memory limit while Gradle was configured with a 2 GiB heap; the next attempt must reduce Gradle JVM memory and retain a single worker.
