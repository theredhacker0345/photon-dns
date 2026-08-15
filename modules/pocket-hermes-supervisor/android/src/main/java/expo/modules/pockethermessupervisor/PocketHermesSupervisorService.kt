package expo.modules.pockethermessupervisor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

data class PocketHermesWorkerConfig(
  val telegramToken: String,
  val ownerChatId: String,
  val modelEndpoint: String?,
)

/**
 * Minimal FOSS foreground-service foundation for the future embedded Hermes
 * worker. The service does not execute a shell or download code; it only owns
 * the visible Android lifecycle and makes process telemetry available.
 */
class PocketHermesSupervisorService : Service() {
  private lateinit var workerExecutor: ExecutorService

  override fun onCreate() {
    super.onCreate()
    createChannel()
    workerExecutor = Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, "PocketHermesPythonSupervisor").apply { isDaemon = true }
    }
    if (!Python.isStarted()) {
      Python.start(AndroidPlatform(applicationContext))
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, createNotification())
    SupervisorRuntimeState.isRunning = true
    val config = intent?.toWorkerConfig()?.also(::saveWorkerConfig) ?: loadWorkerConfig()
    if (config == null) {
      SupervisorRuntimeState.workerStatus = "degraded"
      SupervisorRuntimeState.workerReason = "owner gateway configuration unavailable"
      stopSelf(startId)
      return START_NOT_STICKY
    }
    startWorker(config)
    return START_STICKY
  }

  override fun onDestroy() {
    stopWorker()
    SupervisorRuntimeState.isRunning = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Pocket Hermes host",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Visible while Pocket Hermes supervises the private agent host."
        setShowBadge(false)
      }
      getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
  }

  private fun createNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("Pocket Hermes is supervising")
      .setContentText("Private host supervision is active on this device.")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()
  }

  private fun startWorker(config: PocketHermesWorkerConfig) {
    workerExecutor.execute {
      try {
        val privateHome = File(filesDir, "pocket-hermes/runtime").apply { mkdirs() }
        Python.getInstance()
          .getModule("pocket_hermes_worker")
          .callAttr(
            "start",
            config.telegramToken,
            config.ownerChatId,
            privateHome.absolutePath,
            config.modelEndpoint,
            null,
          )
        SupervisorRuntimeState.workerStatus = "starting"
        SupervisorRuntimeState.workerReason = "private Telegram worker launch requested"
      } catch (error: Exception) {
        SupervisorRuntimeState.workerStatus = "degraded"
        SupervisorRuntimeState.workerReason = "embedded worker launch failed: ${error.javaClass.simpleName}"
      }
    }
  }

  private fun stopWorker() {
    if (!::workerExecutor.isInitialized) return
    workerExecutor.execute {
      try {
        Python.getInstance().getModule("pocket_hermes_worker").callAttr("stop")
        SupervisorRuntimeState.workerStatus = "stopped"
        SupervisorRuntimeState.workerReason = "foreground service stopped"
      } catch (error: Exception) {
        SupervisorRuntimeState.workerStatus = "degraded"
        SupervisorRuntimeState.workerReason = "embedded worker stop failed: ${error.javaClass.simpleName}"
      }
    }
    workerExecutor.shutdown()
  }

  private fun encryptedWorkerPreferences() = EncryptedSharedPreferences.create(
    this,
    WORKER_PREFERENCES,
    MasterKey.Builder(this).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  private fun saveWorkerConfig(config: PocketHermesWorkerConfig) {
    encryptedWorkerPreferences().edit()
      .putString(PREF_TELEGRAM_TOKEN, config.telegramToken)
      .putString(PREF_OWNER_CHAT_ID, config.ownerChatId)
      .putString(PREF_MODEL_ENDPOINT, config.modelEndpoint)
      .commit()
  }

  private fun loadWorkerConfig(): PocketHermesWorkerConfig? {
    return try {
      encryptedWorkerPreferences().run {
        val token = getString(PREF_TELEGRAM_TOKEN, null)
        val chatId = getString(PREF_OWNER_CHAT_ID, null)
        if (token.isNullOrBlank() || chatId.isNullOrBlank()) null
        else PocketHermesWorkerConfig(token, chatId, getString(PREF_MODEL_ENDPOINT, null))
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun Intent.toWorkerConfig(): PocketHermesWorkerConfig? {
    val token = getStringExtra(EXTRA_TELEGRAM_TOKEN)
    val chatId = getStringExtra(EXTRA_OWNER_CHAT_ID)
    if (token.isNullOrBlank() || chatId.isNullOrBlank()) return null
    return PocketHermesWorkerConfig(token, chatId, getStringExtra(EXTRA_MODEL_ENDPOINT))
  }

  companion object {
    private const val CHANNEL_ID = "pocket_hermes_host"
    private const val NOTIFICATION_ID = 2217
    private const val WORKER_PREFERENCES = "pocket-hermes-worker"
    private const val PREF_TELEGRAM_TOKEN = "telegram-token"
    private const val PREF_OWNER_CHAT_ID = "owner-chat-id"
    private const val PREF_MODEL_ENDPOINT = "model-endpoint"
    private const val EXTRA_TELEGRAM_TOKEN = "expo.modules.pockethermessupervisor.TELEGRAM_TOKEN"
    private const val EXTRA_OWNER_CHAT_ID = "expo.modules.pockethermessupervisor.OWNER_CHAT_ID"
    private const val EXTRA_MODEL_ENDPOINT = "expo.modules.pockethermessupervisor.MODEL_ENDPOINT"

    fun start(context: Context, config: PocketHermesWorkerConfig) {
      val intent = Intent(context, PocketHermesSupervisorService::class.java).apply {
        putExtra(EXTRA_TELEGRAM_TOKEN, config.telegramToken)
        putExtra(EXTRA_OWNER_CHAT_ID, config.ownerChatId)
        putExtra(EXTRA_MODEL_ENDPOINT, config.modelEndpoint)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, PocketHermesSupervisorService::class.java))
    }
  }
}
