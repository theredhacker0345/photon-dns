package expo.modules.pockethermessupervisor

import android.os.ParcelFileDescriptor
import com.neuronencrypt.app.NeuronEncryptNative
import com.neuronencrypt.app.ProgressListener
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * File-only adapter around Neuron Encrypt. Callers must place source and output
 * files inside the app cache/private directory; no arbitrary provider URI is
 * handed to native code and decrypted content is never automatically applied.
 */
internal object EncryptedBackupFiles {
  private const val minimumPassphraseBytes = 12

  fun encrypt(input: File, output: File, passphrase: String) {
    check(input.isFile) { "The temporary backup payload is unavailable." }
    run(input, output, passphrase, encrypting = true)
  }

  fun decrypt(input: File, output: File, passphrase: String) {
    check(input.isFile) { "The selected backup file is unavailable." }
    run(input, output, passphrase, encrypting = false)
  }

  private fun run(input: File, output: File, passphrase: String, encrypting: Boolean) {
    val password = passphrase.toByteArray(Charsets.UTF_8)
    require(password.size >= minimumPassphraseBytes) { "Use a backup password with at least 12 characters." }
    output.parentFile?.mkdirs()
    output.delete()
    try {
      ParcelFileDescriptor.open(input, ParcelFileDescriptor.MODE_READ_ONLY).use { source ->
        ParcelFileDescriptor.open(
          output,
          ParcelFileDescriptor.MODE_CREATE or ParcelFileDescriptor.MODE_READ_WRITE or ParcelFileDescriptor.MODE_TRUNCATE,
        ).use { destination ->
          val code = if (encrypting) {
            NeuronEncryptNative.nativeEncrypt(
              source.fd,
              destination.fd,
              password,
              input.length(),
              ProgressListener { _, _ -> },
              AtomicBoolean(false),
            )
          } else {
            NeuronEncryptNative.nativeDecrypt(
              source.fd,
              destination.fd,
              password,
              input.length(),
              ProgressListener { _, _ -> },
              AtomicBoolean(false),
            )
          }
          check(code == 0) { "Encrypted backup operation failed." }
        }
      }
    } catch (error: Throwable) {
      output.delete()
      throw IllegalStateException(error.message ?: "Encrypted backup operation failed.", error)
    } finally {
      password.fill(0)
    }
  }
}
