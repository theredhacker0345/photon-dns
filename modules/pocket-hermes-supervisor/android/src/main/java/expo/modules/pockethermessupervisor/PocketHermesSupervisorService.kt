package expo.modules.pockethermessupervisor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * Minimal FOSS foreground-service foundation for the future embedded Hermes
 * worker. The service does not execute a shell or download code; it only owns
 * the visible Android lifecycle and makes process telemetry available.
 */
class PocketHermesSupervisorService : Service() {
  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, createNotification())
    SupervisorRuntimeState.isRunning = true
    return START_STICKY
  }

  override fun onDestroy() {
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

  companion object {
    private const val CHANNEL_ID = "pocket_hermes_host"
    private const val NOTIFICATION_ID = 2217

    fun start(context: Context) {
      val intent = Intent(context, PocketHermesSupervisorService::class.java)
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
