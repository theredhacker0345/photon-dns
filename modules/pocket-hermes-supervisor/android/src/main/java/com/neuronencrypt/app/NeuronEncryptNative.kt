package com.neuronencrypt.app

import java.util.concurrent.atomic.AtomicBoolean

/** JNI declaration for the vendored, audited Neuron Encrypt bridge. */
class NeuronEncryptNative {
  companion object {
    init {
      System.loadLibrary("neuron_encrypt_jni")
    }

    @JvmStatic
    external fun nativeEncrypt(
      inputFd: Int,
      outputFd: Int,
      password: ByteArray,
      sourceSize: Long,
      progressListener: ProgressListener,
      cancelFlag: AtomicBoolean,
    ): Int

    @JvmStatic
    external fun nativeDecrypt(
      inputFd: Int,
      outputFd: Int,
      password: ByteArray,
      totalSize: Long,
      progressListener: ProgressListener,
      cancelFlag: AtomicBoolean,
    ): Int
  }
}

fun interface ProgressListener {
  fun onProgress(progress: Float, message: String)
}
