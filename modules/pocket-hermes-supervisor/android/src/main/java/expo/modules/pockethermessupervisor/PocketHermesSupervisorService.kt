package expo.modules.pockethermessupervisor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.app.PendingIntent
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Process
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
  val modelProvider: String?,
  val modelEndpoint: String?,
  val modelApiKey: String?,
  val modelName: String?,
  val mcpConfigJson: String? = null,
  val restartAfterBoot: Boolean = false,
  val chargingAware: Boolean = true,
  val lowBatteryPercent: Int = 20,
  val minimumFreeStorageBytes: Long = 2L * 1024L * 1024L * 1024L,
  val maximumCpuPercent: Int = 65,
  val maximumProcessRamBytes: Long = 512L * 1024L * 1024L,
  val maximumWorkspaceBytes: Long = 512L * 1024L * 1024L,
  val telegramProxyType: String = "none",
  val telegramProxyHost: String? = null,
  val telegramProxyPort: Int? = null,
  val telegramProxyCredential: String? = null,
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
  @Volatile private var consecutiveCpuLimitBreaches = 0
  @Volatile private var resourceLimitReason: String? = null
  @Volatile private var lastPolicyWarning: String? = null

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
    if (intent?.action == ACTION_UPDATE_MCP_CONFIG) {
      val existingConfig = activeConfig ?: loadWorkerConfig()
      if (existingConfig != null) {
        val updatedConfig = existingConfig.copy(
          mcpConfigJson = intent.getStringExtra(EXTRA_MCP_CONFIG_JSON)?.trim()?.ifBlank { null },
        )
        activeConfig = updatedConfig
        saveWorkerConfig(updatedConfig)
        workerExecutor.execute {
          try {
            Python.getInstance().getModule("pocket_hermes_worker")
              .callAttr("update_remote_mcp_config", updatedConfig.mcpConfigJson)
          } catch (_: Exception) {
            // The existing fail-closed worker policy remains active on a rejected update.
          }
        }
      }
      return START_STICKY
    }
    val config = intent?.toWorkerConfig()?.also(::saveWorkerConfig) ?: loadWorkerConfig()
    if (config == null) {
      SupervisorRuntimeState.markDegraded("owner gateway configuration unavailable")
      stopSelf(startId)
      return START_NOT_STICKY
    }
    val policyBlock = hostPolicyBlock(config)
    if (policyBlock != null) {
      SupervisorRuntimeState.markDegraded(policyBlock)
      publishPolicyWarning(policyBlock)
      stopSelf(startId)
      return START_NOT_STICKY
    }
    hostRequested = true
    activeConfig = config
    consecutiveCpuLimitBreaches = 0
    resourceLimitReason = null
    lastPolicyWarning = null
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
      val hostChannel = NotificationChannel(
        CHANNEL_ID,
        "Pocket Relay host",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Visible while Pocket Relay supervises the private agent host."
        setShowBadge(false)
      }
      val policyChannel = NotificationChannel(
        POLICY_ALERT_CHANNEL_ID,
        "Pocket Relay safety alerts",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Host battery and storage warnings that require owner attention."
        setShowBadge(false)
      }
      getSystemService(NotificationManager::class.java).createNotificationChannels(listOf(hostChannel, policyChannel))
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
      .setContentTitle("Pocket Relay is supervising")
      .setContentText("Private host supervision is active on this device.")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .build()
  }

  /**
   * React alert hooks exist only while the UI is mounted. The foreground
   * service therefore emits its own owner-visible warning for unattended hosts.
   */
  private fun publishPolicyWarning(message: String) {
    if (message == lastPolicyWarning) return
    lastPolicyWarning = message
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, POLICY_ALERT_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent != null) {
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      builder.setContentIntent(PendingIntent.getActivity(this, POLICY_ALERT_NOTIFICATION_ID, launchIntent, flags))
    }
    getSystemService(NotificationManager::class.java).notify(
      POLICY_ALERT_NOTIFICATION_ID,
      builder
        .setContentTitle("Pocket Relay needs attention")
        .setContentText(message)
        .setSmallIcon(android.R.drawable.stat_notify_error)
        .setAutoCancel(true)
        .build(),
    )
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
            config.modelProvider,
            config.mcpConfigJson,
            config.maximumWorkspaceBytes,
            config.telegramProxyType,
            config.telegramProxyHost,
            config.telegramProxyPort,
            config.telegramProxyCredential,
          )
        refreshWorkerHealth()
      } catch (error: Exception) {
        workerLaunchRequested = false
        SupervisorRuntimeState.markDegraded("embedded worker launch failed: ${error.javaClass.simpleName}")
      }
    }
  }

  /** Evaluated for direct starts, recovery, and boot restoration. */
  private fun hostPolicyBlock(
    config: PocketHermesWorkerConfig,
    workspaceUsedBytes: Long = privateWorkspaceBytes(),
    processRamBytes: Long = processPssBytes(),
  ): String? {
    if (filesDir.usableSpace < config.minimumFreeStorageBytes) return "host policy blocked runtime: insufficient free storage"
    if (workspaceUsedBytes > config.maximumWorkspaceBytes) return "host resource limit reached: private workspace quota"
    if (processRamBytes > config.maximumProcessRamBytes) return "host resource limit reached: RAM guardrail"
    if (!config.chargingAware) return null
    val battery = currentBatterySnapshot() ?: return "host policy blocked runtime: charging state unavailable"
    return if (battery.isCharging) null else "host policy blocked runtime: device is not charging"
  }

  private data class BatterySnapshot(val percent: Int?, val isCharging: Boolean)

  private fun currentBatterySnapshot(): BatterySnapshot? {
    val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return null
    val status = batteryIntent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    val level = batteryIntent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = batteryIntent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    val percent = if (level >= 0 && scale > 0) (level * 100 / scale).coerceIn(0, 100) else null
    return BatterySnapshot(percent, charging)
  }

  /** Warning-only policy signal for the active foreground host. */
  private fun hostPolicyWarning(config: PocketHermesWorkerConfig): String? {
    if (filesDir.usableSpace < config.minimumFreeStorageBytes) {
      return "Free storage is below the configured host reserve. The host will stop safely."
    }
    val battery = currentBatterySnapshot()
    if (!config.chargingAware && battery?.isCharging == false && battery.percent != null && battery.percent <= config.lowBatteryPercent) {
      return "Battery is at ${battery.percent}%. Connect power or enable charging-aware host mode."
    }
    return null
  }

  /** Enforces only this host process and its app-private workspace, never device-wide resources. */
  private fun resourceLimitBlock(
    config: PocketHermesWorkerConfig,
    workspaceUsedBytes: Long = privateWorkspaceBytes(),
    processRamBytes: Long = processPssBytes(),
  ): String? {
    if (workspaceUsedBytes > config.maximumWorkspaceBytes) return "host resource limit reached: private workspace quota"
    if (processRamBytes > config.maximumProcessRamBytes) return "host resource limit reached: RAM guardrail"
    val cpuPercent = SupervisorRuntimeState.sampleCpuPercent()
    consecutiveCpuLimitBreaches = if (cpuPercent > config.maximumCpuPercent) consecutiveCpuLimitBreaches + 1 else 0
    return if (consecutiveCpuLimitBreaches >= CPU_LIMIT_CONSECUTIVE_SAMPLES) {
      "host resource limit reached: sustained CPU guardrail"
    } else null
  }

  private fun processPssBytes(): Long {
    val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return (activityManager.getProcessMemoryInfo(intArrayOf(Process.myPid())).firstOrNull()?.totalPss ?: 0).toLong() * 1024L
  }

  private fun privateWorkspaceBytes(): Long = File(filesDir, "pocket-hermes/runtime")
    .walkTopDown()
    .filter { it.isFile }
    .sumOf { file -> runCatching { file.length() }.getOrDefault(0L) }
    .also(SupervisorRuntimeState::recordWorkspaceBytes)

  private fun stopForResourceLimit(reason: String) {
    hostRequested = false
    workerLaunchRequested = false
    resourceLimitReason = reason
    SupervisorRuntimeState.markDegraded(reason)
    workerExecutor.execute {
      runCatching { Python.getInstance().getModule("pocket_hermes_worker").callAttr("stop") }
    }
    stopSelf()
  }

  private fun stopWorker() {
    if (!::workerExecutor.isInitialized) return
    hostRequested = false
    workerLaunchRequested = false
    workerExecutor.execute {
      try {
        Python.getInstance().getModule("pocket_hermes_worker").callAttr("stop")
        val resourceLimit = resourceLimitReason
        if (resourceLimit == null) SupervisorRuntimeState.markStopped("foreground service stopped")
        else SupervisorRuntimeState.markDegraded(resourceLimit)
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
      activeConfig?.let { config ->
        val workspaceUsedBytes = privateWorkspaceBytes()
        val processRamBytes = processPssBytes()
        hostPolicyBlock(config, workspaceUsedBytes, processRamBytes)?.let { reason ->
          publishPolicyWarning(reason)
          stopForResourceLimit(reason)
          return
        }
        hostPolicyWarning(config)?.let(::publishPolicyWarning)
        resourceLimitBlock(config, workspaceUsedBytes, processRamBytes)?.let { reason ->
          stopForResourceLimit(reason)
          return
        }
      }
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
      .putString(PREF_MODEL_PROVIDER, config.modelProvider)
      .putString(PREF_MODEL_ENDPOINT, config.modelEndpoint)
      .putString(PREF_MODEL_API_KEY, config.modelApiKey)
      .putString(PREF_MODEL_NAME, config.modelName)
      .putString(PREF_TELEGRAM_PROXY_TYPE, config.telegramProxyType)
      .putString(PREF_TELEGRAM_PROXY_HOST, config.telegramProxyHost)
      .putInt(PREF_TELEGRAM_PROXY_PORT, config.telegramProxyPort ?: 0)
      .putString(PREF_TELEGRAM_PROXY_CREDENTIAL, config.telegramProxyCredential)
      .putString(PREF_MCP_CONFIG_JSON, config.mcpConfigJson)
      .putBoolean(PREF_RESTART_AFTER_BOOT, config.restartAfterBoot)
      .putBoolean(PREF_CHARGING_AWARE, config.chargingAware)
      .putInt(PREF_LOW_BATTERY_PERCENT, config.lowBatteryPercent)
      .putLong(PREF_MINIMUM_FREE_STORAGE_BYTES, config.minimumFreeStorageBytes)
      .putInt(PREF_MAXIMUM_CPU_PERCENT, config.maximumCpuPercent)
      .putLong(PREF_MAXIMUM_PROCESS_RAM_BYTES, config.maximumProcessRamBytes)
      .putLong(PREF_MAXIMUM_WORKSPACE_BYTES, config.maximumWorkspaceBytes)
      .commit()
  }

  private fun loadWorkerConfig(): PocketHermesWorkerConfig? {
    return try {
      encryptedWorkerPreferences().run {
        val token = getString(PREF_TELEGRAM_TOKEN, null)
        val chatId = getString(PREF_OWNER_CHAT_ID, null)
        val provider = getString(PREF_MODEL_PROVIDER, null)
        val endpoint = getString(PREF_MODEL_ENDPOINT, null)
        val apiKey = getString(PREF_MODEL_API_KEY, null)
        val modelName = getString(PREF_MODEL_NAME, null)
        val proxyType = getString(PREF_TELEGRAM_PROXY_TYPE, "none") ?: "none"
        val proxyHost = getString(PREF_TELEGRAM_PROXY_HOST, null)
        val proxyPort = getInt(PREF_TELEGRAM_PROXY_PORT, 0).takeIf { it in 1..65535 }
        val proxyCredential = getString(PREF_TELEGRAM_PROXY_CREDENTIAL, null)
        val mcpConfigJson = getString(PREF_MCP_CONFIG_JSON, null)
        if (token.isNullOrBlank() || chatId.isNullOrBlank() || endpoint.isNullOrBlank() || modelName.isNullOrBlank() || (!isLocalModelProvider(provider) && apiKey.isNullOrBlank())) null
        else PocketHermesWorkerConfig(
          token,
          chatId,
          provider,
          endpoint,
          apiKey,
          modelName,
          mcpConfigJson,
          getBoolean(PREF_RESTART_AFTER_BOOT, false),
          getBoolean(PREF_CHARGING_AWARE, true),
          getInt(PREF_LOW_BATTERY_PERCENT, 20),
          getLong(PREF_MINIMUM_FREE_STORAGE_BYTES, 2L * 1024L * 1024L * 1024L),
          getInt(PREF_MAXIMUM_CPU_PERCENT, 65).coerceIn(10, 95),
          getLong(PREF_MAXIMUM_PROCESS_RAM_BYTES, 512L * 1024L * 1024L).coerceIn(MINIMUM_PROCESS_RAM_BYTES, MAXIMUM_RESOURCE_BYTES),
          getLong(PREF_MAXIMUM_WORKSPACE_BYTES, 512L * 1024L * 1024L).coerceIn(MINIMUM_WORKSPACE_BYTES, MAXIMUM_RESOURCE_BYTES),
          proxyType,
          proxyHost,
          proxyPort,
          proxyCredential,
        )
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun Intent.toWorkerConfig(): PocketHermesWorkerConfig? {
    val token = getStringExtra(EXTRA_TELEGRAM_TOKEN)
    val chatId = getStringExtra(EXTRA_OWNER_CHAT_ID)
    val provider = getStringExtra(EXTRA_MODEL_PROVIDER)
    val endpoint = getStringExtra(EXTRA_MODEL_ENDPOINT)
    val apiKey = getStringExtra(EXTRA_MODEL_API_KEY)
    val modelName = getStringExtra(EXTRA_MODEL_NAME)
    val proxyType = getStringExtra(EXTRA_TELEGRAM_PROXY_TYPE) ?: "none"
    val proxyHost = getStringExtra(EXTRA_TELEGRAM_PROXY_HOST)
    val proxyPort = getIntExtra(EXTRA_TELEGRAM_PROXY_PORT, 0).takeIf { it in 1..65535 }
    val proxyCredential = getStringExtra(EXTRA_TELEGRAM_PROXY_CREDENTIAL)
    val mcpConfigJson = getStringExtra(EXTRA_MCP_CONFIG_JSON)
    if (token.isNullOrBlank() || chatId.isNullOrBlank() || endpoint.isNullOrBlank() || modelName.isNullOrBlank() || (!isLocalModelProvider(provider) && apiKey.isNullOrBlank())) return null
    return PocketHermesWorkerConfig(
      token,
      chatId,
      provider,
      endpoint,
      apiKey,
      modelName,
      mcpConfigJson,
      getBooleanExtra(EXTRA_RESTART_AFTER_BOOT, false),
      getBooleanExtra(EXTRA_CHARGING_AWARE, true),
      getIntExtra(EXTRA_LOW_BATTERY_PERCENT, 20),
      getLongExtra(EXTRA_MINIMUM_FREE_STORAGE_BYTES, 2L * 1024L * 1024L * 1024L),
      getIntExtra(EXTRA_MAXIMUM_CPU_PERCENT, 65).coerceIn(10, 95),
      getLongExtra(EXTRA_MAXIMUM_PROCESS_RAM_BYTES, 512L * 1024L * 1024L).coerceIn(MINIMUM_PROCESS_RAM_BYTES, MAXIMUM_RESOURCE_BYTES),
      getLongExtra(EXTRA_MAXIMUM_WORKSPACE_BYTES, 512L * 1024L * 1024L).coerceIn(MINIMUM_WORKSPACE_BYTES, MAXIMUM_RESOURCE_BYTES),
      proxyType,
      proxyHost,
      proxyPort,
      proxyCredential,
    )
  }

  companion object {
    private const val CHANNEL_ID = "pocket_hermes_host"
    private const val NOTIFICATION_ID = 2217
    private const val POLICY_ALERT_CHANNEL_ID = "pocket_hermes_safety"
    private const val POLICY_ALERT_NOTIFICATION_ID = 2218
    private const val WORKER_PREFERENCES = "pocket-hermes-worker"
    private const val PREF_TELEGRAM_TOKEN = "telegram-token"
    private const val PREF_OWNER_CHAT_ID = "owner-chat-id"
    private const val PREF_MODEL_PROVIDER = "model-provider"
    private const val PREF_MODEL_ENDPOINT = "model-endpoint"
    private const val PREF_MODEL_API_KEY = "model-api-key"
    private const val PREF_MODEL_NAME = "model-name"
    private const val PREF_TELEGRAM_PROXY_TYPE = "telegram-proxy-type"
    private const val PREF_TELEGRAM_PROXY_HOST = "telegram-proxy-host"
    private const val PREF_TELEGRAM_PROXY_PORT = "telegram-proxy-port"
    private const val PREF_TELEGRAM_PROXY_CREDENTIAL = "telegram-proxy-credential"
    private const val PREF_MCP_CONFIG_JSON = "mcp-config-json"
    private const val PREF_RESTART_AFTER_BOOT = "restart-after-boot"
    private const val PREF_CHARGING_AWARE = "charging-aware"
    private const val PREF_LOW_BATTERY_PERCENT = "low-battery-percent"
    private const val PREF_MINIMUM_FREE_STORAGE_BYTES = "minimum-free-storage-bytes"
    private const val PREF_MAXIMUM_CPU_PERCENT = "maximum-cpu-percent"
    private const val PREF_MAXIMUM_PROCESS_RAM_BYTES = "maximum-process-ram-bytes"
    private const val PREF_MAXIMUM_WORKSPACE_BYTES = "maximum-workspace-bytes"
    private const val EXTRA_TELEGRAM_TOKEN = "expo.modules.pockethermessupervisor.TELEGRAM_TOKEN"
    private const val EXTRA_OWNER_CHAT_ID = "expo.modules.pockethermessupervisor.OWNER_CHAT_ID"
    private const val EXTRA_MODEL_PROVIDER = "expo.modules.pockethermessupervisor.MODEL_PROVIDER"
    private const val EXTRA_MODEL_ENDPOINT = "expo.modules.pockethermessupervisor.MODEL_ENDPOINT"
    private const val EXTRA_MODEL_API_KEY = "expo.modules.pockethermessupervisor.MODEL_API_KEY"
    private const val EXTRA_MODEL_NAME = "expo.modules.pockethermessupervisor.MODEL_NAME"
    private const val EXTRA_TELEGRAM_PROXY_TYPE = "expo.modules.pockethermessupervisor.TELEGRAM_PROXY_TYPE"
    private const val EXTRA_TELEGRAM_PROXY_HOST = "expo.modules.pockethermessupervisor.TELEGRAM_PROXY_HOST"
    private const val EXTRA_TELEGRAM_PROXY_PORT = "expo.modules.pockethermessupervisor.TELEGRAM_PROXY_PORT"
    private const val EXTRA_TELEGRAM_PROXY_CREDENTIAL = "expo.modules.pockethermessupervisor.TELEGRAM_PROXY_CREDENTIAL"
    private const val EXTRA_MCP_CONFIG_JSON = "expo.modules.pockethermessupervisor.MCP_CONFIG_JSON"
    private const val ACTION_UPDATE_MCP_CONFIG = "expo.modules.pockethermessupervisor.UPDATE_MCP_CONFIG"
    private const val EXTRA_RESTART_AFTER_BOOT = "expo.modules.pockethermessupervisor.RESTART_AFTER_BOOT"
    private const val EXTRA_CHARGING_AWARE = "expo.modules.pockethermessupervisor.CHARGING_AWARE"
    private const val EXTRA_LOW_BATTERY_PERCENT = "expo.modules.pockethermessupervisor.LOW_BATTERY_PERCENT"
    private const val EXTRA_MINIMUM_FREE_STORAGE_BYTES = "expo.modules.pockethermessupervisor.MINIMUM_FREE_STORAGE_BYTES"
    private const val EXTRA_MAXIMUM_CPU_PERCENT = "expo.modules.pockethermessupervisor.MAXIMUM_CPU_PERCENT"
    private const val EXTRA_MAXIMUM_PROCESS_RAM_BYTES = "expo.modules.pockethermessupervisor.MAXIMUM_PROCESS_RAM_BYTES"
    private const val EXTRA_MAXIMUM_WORKSPACE_BYTES = "expo.modules.pockethermessupervisor.MAXIMUM_WORKSPACE_BYTES"
    private const val CPU_LIMIT_CONSECUTIVE_SAMPLES = 3
    private const val MINIMUM_PROCESS_RAM_BYTES = 128L * 1024L * 1024L
    private const val MINIMUM_WORKSPACE_BYTES = 64L * 1024L * 1024L
    private const val MAXIMUM_RESOURCE_BYTES = 8L * 1024L * 1024L * 1024L
    private const val MAX_RECOVERY_ATTEMPTS = 3
    private const val RECOVERY_COOLDOWN_MS = 60_000L

    private fun isLocalModelProvider(provider: String?) = provider == "ollama" || provider == "lmstudio"

    fun start(context: Context, config: PocketHermesWorkerConfig) {
      val intent = Intent(context, PocketHermesSupervisorService::class.java).apply {
        putExtra(EXTRA_TELEGRAM_TOKEN, config.telegramToken)
        putExtra(EXTRA_OWNER_CHAT_ID, config.ownerChatId)
        putExtra(EXTRA_MODEL_PROVIDER, config.modelProvider)
        putExtra(EXTRA_MODEL_ENDPOINT, config.modelEndpoint)
        putExtra(EXTRA_MODEL_API_KEY, config.modelApiKey)
        putExtra(EXTRA_MODEL_NAME, config.modelName)
        putExtra(EXTRA_TELEGRAM_PROXY_TYPE, config.telegramProxyType)
        putExtra(EXTRA_TELEGRAM_PROXY_HOST, config.telegramProxyHost)
        putExtra(EXTRA_TELEGRAM_PROXY_PORT, config.telegramProxyPort ?: 0)
        putExtra(EXTRA_TELEGRAM_PROXY_CREDENTIAL, config.telegramProxyCredential)
        putExtra(EXTRA_MCP_CONFIG_JSON, config.mcpConfigJson)
        putExtra(EXTRA_RESTART_AFTER_BOOT, config.restartAfterBoot)
        putExtra(EXTRA_CHARGING_AWARE, config.chargingAware)
        putExtra(EXTRA_LOW_BATTERY_PERCENT, config.lowBatteryPercent)
        putExtra(EXTRA_MINIMUM_FREE_STORAGE_BYTES, config.minimumFreeStorageBytes)
        putExtra(EXTRA_MAXIMUM_CPU_PERCENT, config.maximumCpuPercent)
        putExtra(EXTRA_MAXIMUM_PROCESS_RAM_BYTES, config.maximumProcessRamBytes)
        putExtra(EXTRA_MAXIMUM_WORKSPACE_BYTES, config.maximumWorkspaceBytes)
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

    fun updateMcpRuntimeConfig(context: Context, mcpConfigJson: String?) {
      val intent = Intent(context, PocketHermesSupervisorService::class.java).apply {
        action = ACTION_UPDATE_MCP_CONFIG
        putExtra(EXTRA_MCP_CONFIG_JSON, mcpConfigJson)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
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
