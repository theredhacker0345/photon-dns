package expo.modules.pockethermessupervisor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.PendingIntent
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

data class PocketHermesWorkerConfig(
  val telegramToken: String,
  val ownerChatId: String,
  val modelEndpoint: String?,
  val modelApiKey: String?,
  val modelName: String?,
  val restartAfterBoot: Boolean = false,
  val chargingAware: Boolean = true,
  val lowBatteryPercent: Int = 20,
  val minimumFreeStorageBytes: Long = 2L * 1024L * 1024L * 1024L,
)

/**
 * Minimal FOSS foreground-service foundation for the future embedded Hermes
 * worker. The service does not execute a shell or download code; it only owns
 * the visible Android lifecycle and makes process telemetry available.
 */
class PocketHermesSupervisorService : Service() {
  private lateinit var workerExecutor: ExecutorService
  private lateinit var healthExecutor: ScheduledExecutorService
  @Volatile private var workerLaunchRequested = false
  @Volatile private var hostRequested = false
  @Volatile private var activeConfig: PocketHermesWorkerConfig? = null
  @Volatile private var recoveryAttempts = 0
  @Volatile private var lastRecoveryAt = 0L

  override fun onCreate() {
    super.onCreate()
    createChannel()
    workerExecutor = Executors.newSingleThreadExecutor { runnable ->
      Thread(runnable, "PocketHermesPythonSupervisor").apply { isDaemon = true }
    }
    healthExecutor = Executors.newSingleThreadScheduledExecutor { runnable ->
      Thread(runnable, "PocketHermesWorkerHealth").apply { isDaemon = true }
    }
    if (!Python.isStarted()) {
      Python.start(AndroidPlatform(applicationContext))
    }
    healthExecutor.scheduleWithFixedDelay({ refreshWorkerHealth() }, 5, 15, TimeUnit.SECONDS)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, createNotification())
    val config = intent?.toWorkerConfig()?.also(::saveWorkerConfig) ?: loadWorkerConfig()
    if (config == null) {
      SupervisorRuntimeState.markDegraded("owner gateway configuration unavailable")
      stopSelf(startId)
      return START_NOT_STICKY
    }
    val policyBlock = hostPolicyBlock(config)
    if (policyBlock != null) {
      SupervisorRuntimeState.markDegraded(policyBlock)
      stopSelf(startId)
      return START_NOT_STICKY
    }
    hostRequested = true
    activeConfig = config
    startWorker(config)
    return START_STICKY
  }

  override fun onDestroy() {
    stopWorker()
    if (::healthExecutor.isInitialized) healthExecutor.shutdownNow()
    SupervisorRuntimeState.markStopped("foreground service stopped")
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Pocket Agent Host host",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Visible while Pocket Agent Host supervises the private agent host."
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

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent != null) {
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      builder.setContentIntent(PendingIntent.getActivity(this, 0, launchIntent, flags))
    }

    return builder
      .setContentTitle("Pocket Agent Host is supervising")
      .setContentText("Private host supervision is active on this device.")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()
  }

  private fun startWorker(config: PocketHermesWorkerConfig) {
    if (workerLaunchRequested) return
    workerLaunchRequested = true
    SupervisorRuntimeState.markStarting("private Telegram worker launch requested")
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
            config.modelApiKey,
            config.modelName,
          )
        refreshWorkerHealth()
      } catch (error: Exception) {
        workerLaunchRequested = false
        SupervisorRuntimeState.markDegraded("embedded worker launch failed: ${error.javaClass.simpleName}")
      }
    }
  }

  /** Evaluated for direct starts, recovery, and boot restoration. */
  private fun hostPolicyBlock(config: PocketHermesWorkerConfig): String? {
    if (filesDir.usableSpace < config.minimumFreeStorageBytes) return "host policy blocked runtime: insufficient free storage"
    if (!config.chargingAware) return null
    val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      ?: return "host policy blocked runtime: charging state unavailable"
    val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    return if (charging) null else "host policy blocked runtime: device is not charging"
  }

  private fun stopWorker() {
    if (!::workerExecutor.isInitialized) return
    hostRequested = false
    workerLaunchRequested = false
    workerExecutor.execute {
      try {
        Python.getInstance().getModule("pocket_hermes_worker").callAttr("stop")
        SupervisorRuntimeState.markStopped("foreground service stopped")
      } catch (error: Exception) {
        SupervisorRuntimeState.markDegraded("embedded worker stop failed: ${error.javaClass.simpleName}")
      }
    }
    workerExecutor.shutdown()
  }

  private fun refreshWorkerHealth() {
    try {
      if (!Python.isStarted()) return
      val raw = Python.getInstance().getModule("pocket_hermes_worker").callAttr("status_json").toString()
      val health = JSONObject(raw)
      val status = health.optString("status", "degraded")
      SupervisorRuntimeState.updateWorkerHealth(
        status,
        health.optString("reason", "worker health unavailable"),
        health.optLong("lastHeartbeatAt", 0L).takeIf { it > 0L },
      )
      if (status == "running") {
        recoveryAttempts = 0
        SupervisorRuntimeState.clearRecoveryAttempts()
      } else if ((status == "degraded" || status == "stopped") && hostRequested) {
        attemptBoundedRecovery()
      }
    } catch (error: Exception) {
      SupervisorRuntimeState.markDegraded("worker health refresh failed: ${error.javaClass.simpleName}")
    }
  }

  private fun attemptBoundedRecovery() {
    val now = System.currentTimeMillis()
    if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      SupervisorRuntimeState.markDegraded("worker recovery limit reached; owner action required")
      return
    }
    val config = activeConfig ?: loadWorkerConfig() ?: run {
      SupervisorRuntimeState.markDegraded("worker recovery configuration unavailable")
      return
    }
    lastRecoveryAt = now
    recoveryAttempts += 1
    SupervisorRuntimeState.recordRecoveryAttempt(recoveryAttempts)
    workerLaunchRequested = false
    startWorker(config)
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
      .putString(PREF_MODEL_API_KEY, config.modelApiKey)
      .putString(PREF_MODEL_NAME, config.modelName)
      .putBoolean(PREF_RESTART_AFTER_BOOT, config.restartAfterBoot)
      .putBoolean(PREF_CHARGING_AWARE, config.chargingAware)
      .putInt(PREF_LOW_BATTERY_PERCENT, config.lowBatteryPercent)
      .putLong(PREF_MINIMUM_FREE_STORAGE_BYTES, config.minimumFreeStorageBytes)
      .commit()
  }

  private fun loadWorkerConfig(): PocketHermesWorkerConfig? {
    return try {
      encryptedWorkerPreferences().run {
        val token = getString(PREF_TELEGRAM_TOKEN, null)
        val chatId = getString(PREF_OWNER_CHAT_ID, null)
        val endpoint = getString(PREF_MODEL_ENDPOINT, null)
        val apiKey = getString(PREF_MODEL_API_KEY, null)
        val modelName = getString(PREF_MODEL_NAME, null)
        if (token.isNullOrBlank() || chatId.isNullOrBlank() || endpoint.isNullOrBlank() || apiKey.isNullOrBlank() || modelName.isNullOrBlank()) null
        else PocketHermesWorkerConfig(
          token,
          chatId,
          endpoint,
          apiKey,
          modelName,
          getBoolean(PREF_RESTART_AFTER_BOOT, false),
          getBoolean(PREF_CHARGING_AWARE, true),
          getInt(PREF_LOW_BATTERY_PERCENT, 20),
          getLong(PREF_MINIMUM_FREE_STORAGE_BYTES, 2L * 1024L * 1024L * 1024L),
        )
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun Intent.toWorkerConfig(): PocketHermesWorkerConfig? {
    val token = getStringExtra(EXTRA_TELEGRAM_TOKEN)
    val chatId = getStringExtra(EXTRA_OWNER_CHAT_ID)
    val endpoint = getStringExtra(EXTRA_MODEL_ENDPOINT)
    val apiKey = getStringExtra(EXTRA_MODEL_API_KEY)
    val modelName = getStringExtra(EXTRA_MODEL_NAME)
    if (token.isNullOrBlank() || chatId.isNullOrBlank() || endpoint.isNullOrBlank() || apiKey.isNullOrBlank() || modelName.isNullOrBlank()) return null
    return PocketHermesWorkerConfig(
      token,
      chatId,
      endpoint,
      apiKey,
      modelName,
      getBooleanExtra(EXTRA_RESTART_AFTER_BOOT, false),
      getBooleanExtra(EXTRA_CHARGING_AWARE, true),
      getIntExtra(EXTRA_LOW_BATTERY_PERCENT, 20),
      getLongExtra(EXTRA_MINIMUM_FREE_STORAGE_BYTES, 2L * 1024L * 1024L * 1024L),
    )
  }

  companion object {
    private const val CHANNEL_ID = "pocket_hermes_host"
    private const val NOTIFICATION_ID = 2217
    private const val WORKER_PREFERENCES = "pocket-hermes-worker"
    private const val PREF_TELEGRAM_TOKEN = "telegram-token"
    private const val PREF_OWNER_CHAT_ID = "owner-chat-id"
    private const val PREF_MODEL_ENDPOINT = "model-endpoint"
    private const val PREF_MODEL_API_KEY = "model-api-key"
    private const val PREF_MODEL_NAME = "model-name"
    private const val PREF_RESTART_AFTER_BOOT = "restart-after-boot"
    private const val PREF_CHARGING_AWARE = "charging-aware"
    private const val PREF_LOW_BATTERY_PERCENT = "low-battery-percent"
    private const val PREF_MINIMUM_FREE_STORAGE_BYTES = "minimum-free-storage-bytes"
    private const val EXTRA_TELEGRAM_TOKEN = "expo.modules.pockethermessupervisor.TELEGRAM_TOKEN"
    private const val EXTRA_OWNER_CHAT_ID = "expo.modules.pockethermessupervisor.OWNER_CHAT_ID"
    private const val EXTRA_MODEL_ENDPOINT = "expo.modules.pockethermessupervisor.MODEL_ENDPOINT"
    private const val EXTRA_MODEL_API_KEY = "expo.modules.pockethermessupervisor.MODEL_API_KEY"
    private const val EXTRA_MODEL_NAME = "expo.modules.pockethermessupervisor.MODEL_NAME"
    private const val EXTRA_RESTART_AFTER_BOOT = "expo.modules.pockethermessupervisor.RESTART_AFTER_BOOT"
    private const val EXTRA_CHARGING_AWARE = "expo.modules.pockethermessupervisor.CHARGING_AWARE"
    private const val EXTRA_LOW_BATTERY_PERCENT = "expo.modules.pockethermessupervisor.LOW_BATTERY_PERCENT"
    private const val EXTRA_MINIMUM_FREE_STORAGE_BYTES = "expo.modules.pockethermessupervisor.MINIMUM_FREE_STORAGE_BYTES"
    private const val MAX_RECOVERY_ATTEMPTS = 3
    private const val RECOVERY_COOLDOWN_MS = 60_000L

    fun start(context: Context, config: PocketHermesWorkerConfig) {
      val intent = Intent(context, PocketHermesSupervisorService::class.java).apply {
        putExtra(EXTRA_TELEGRAM_TOKEN, config.telegramToken)
        putExtra(EXTRA_OWNER_CHAT_ID, config.ownerChatId)
        putExtra(EXTRA_MODEL_ENDPOINT, config.modelEndpoint)
        putExtra(EXTRA_MODEL_API_KEY, config.modelApiKey)
        putExtra(EXTRA_MODEL_NAME, config.modelName)
        putExtra(EXTRA_RESTART_AFTER_BOOT, config.restartAfterBoot)
        putExtra(EXTRA_CHARGING_AWARE, config.chargingAware)
        putExtra(EXTRA_LOW_BATTERY_PERCENT, config.lowBatteryPercent)
        putExtra(EXTRA_MINIMUM_FREE_STORAGE_BYTES, config.minimumFreeStorageBytes)
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

    fun clearPersistedConfiguration(context: Context) {
      stop(context)
      try {
        EncryptedSharedPreferences.create(
          context,
          WORKER_PREFERENCES,
          MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
          EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
          EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        ).edit().clear().commit()
      } catch (_: Exception) {
        // The JavaScript caller still clears its own protected values. Never leak
        // configuration detail through an error message from this cleanup path.
      }
    }

    fun shouldRestartAfterBoot(context: Context): Boolean {
      return try {
        val preferences = EncryptedSharedPreferences.create(
          context,
          WORKER_PREFERENCES,
          MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
          EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
          EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
        preferences.getBoolean(PREF_RESTART_AFTER_BOOT, false)
          && !preferences.getString(PREF_TELEGRAM_TOKEN, null).isNullOrBlank()
          && !preferences.getString(PREF_OWNER_CHAT_ID, null).isNullOrBlank()
          && !preferences.getString(PREF_MODEL_ENDPOINT, null).isNullOrBlank()
          && !preferences.getString(PREF_MODEL_API_KEY, null).isNullOrBlank()
          && !preferences.getString(PREF_MODEL_NAME, null).isNullOrBlank()
      } catch (_: Exception) {
        false
      }
    }

    fun startFromPersistedConfiguration(context: Context) {
      val intent = Intent(context, PocketHermesSupervisorService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }
  }
}
