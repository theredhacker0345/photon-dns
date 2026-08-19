package expo.modules.pockethermessupervisor

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * Android-local notifications owned by Pocket Relay. This implementation has
 * no push token, Firebase, Play Services, network operation, or remote payload.
 */
object PocketRelayLocalNotifications {
  private const val PREFERENCES = "pocket-relay-local-notifications"
  private const val ENABLED_KEY = "device-notifications-enabled"
  private const val BACKUP_REMINDER_ENABLED_KEY = "backup-reminder-enabled"
  private const val BACKUP_REMINDER_INTERVAL_DAYS_KEY = "backup-reminder-interval-days"
  private const val BACKUP_REMINDER_ACTION = "expo.modules.pockethermessupervisor.BACKUP_REMINDER"

  private const val BACKUP_CHANNEL_ID = "pocket-relay-backup-reminders"
  private const val BACKUP_REMINDER_NOTIFICATION_ID = 42001
  private const val TEST_NOTIFICATION_ID = 42002
  private const val SAFETY_NOTIFICATION_ID = 42003

  private const val NATIVE_BACKUP_REMINDER_ID = "native-backup-reminder"

  fun areDeviceNotificationsEnabled(context: Context): Boolean = preferences(context).getBoolean(ENABLED_KEY, true)

  fun setDeviceNotificationsEnabled(context: Context, enabled: Boolean) {
    preferences(context).edit().putBoolean(ENABLED_KEY, enabled).apply()
  }

  fun scheduleBackupReminder(context: Context, intervalDays: Int): String {
    require(intervalDays in setOf(7, 14, 30)) { "Pocket Relay supports 7-, 14-, or 30-day backup reminders." }
    require(canPostNotifications(context)) { "Android notification permission is required before scheduling a local backup reminder." }
    preferences(context).edit()
      .putBoolean(BACKUP_REMINDER_ENABLED_KEY, true)
      .putInt(BACKUP_REMINDER_INTERVAL_DAYS_KEY, intervalDays)
      .apply()
    schedulePersistedBackupReminder(context, intervalDays)
    return NATIVE_BACKUP_REMINDER_ID
  }

  fun cancelBackupReminder(context: Context) {
    val pendingIntent = backupReminderIntent(context)
    (context.getSystemService(AlarmManager::class.java)).cancel(pendingIntent)
    pendingIntent.cancel()
    preferences(context).edit().remove(BACKUP_REMINDER_ENABLED_KEY).remove(BACKUP_REMINDER_INTERVAL_DAYS_KEY).apply()
  }

  /** Re-arms the opt-in local reminder after a normal device boot or app upgrade. */
  fun restoreBackupReminder(context: Context) {
    val preferences = preferences(context)
    if (!preferences.getBoolean(BACKUP_REMINDER_ENABLED_KEY, false)) return
    val intervalDays = preferences.getInt(BACKUP_REMINDER_INTERVAL_DAYS_KEY, 14)
    if (intervalDays !in setOf(7, 14, 30) || !canPostNotifications(context)) return
    schedulePersistedBackupReminder(context, intervalDays)
  }

  fun sendTestNotification(context: Context) {
    post(context, TEST_NOTIFICATION_ID, "Pocket Relay notification test", "Local notifications are enabled and the Pocket Relay notification channel is working.")
  }

  fun sendSafetyAlert(context: Context, title: String, body: String) {
    require(title.length in 1..120 && body.length in 1..360) { "The local safety notification is outside Pocket Relay's safe size limit." }
    post(context, SAFETY_NOTIFICATION_ID, title, body)
  }

  fun showBackupReminder(context: Context) {
    post(context, BACKUP_REMINDER_NOTIFICATION_ID, "Create a Pocket Relay backup", "Open Settings to create a new password-protected backup. Your backup password is never stored.")
  }

  private fun schedulePersistedBackupReminder(context: Context, intervalDays: Int) {
    val intervalMillis = intervalDays * 24L * 60L * 60L * 1000L
    val firstReminderAt = System.currentTimeMillis() + intervalMillis
    context.getSystemService(AlarmManager::class.java).setInexactRepeating(
      AlarmManager.RTC_WAKEUP,
      firstReminderAt,
      intervalMillis,
      backupReminderIntent(context),
    )
  }

  private fun backupReminderIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context,
    BACKUP_REMINDER_NOTIFICATION_ID,
    Intent(context, PocketRelayBackupReminderReceiver::class.java).setAction(BACKUP_REMINDER_ACTION),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun post(context: Context, notificationId: Int, title: String, body: String) {
    require(canPostNotifications(context)) { "Device notifications are unavailable or disabled." }
    createChannel(context)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, BACKUP_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    if (launchIntent != null) {
      builder.setContentIntent(PendingIntent.getActivity(context, notificationId, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    context.getSystemService(NotificationManager::class.java).notify(
      notificationId,
      builder
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(android.R.drawable.stat_notify_more)
        .setAutoCancel(true)
        .build(),
    )
  }

  private fun canPostNotifications(context: Context): Boolean {
    if (!areDeviceNotificationsEnabled(context)) return false
    return Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  }

  private fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      BACKUP_CHANNEL_ID,
      "Pocket Relay local notifications",
      NotificationManager.IMPORTANCE_DEFAULT,
    ).apply {
      description = "Private backup reminders, safety alerts, and owner-triggered delivery tests."
      lockscreenVisibility = Notification.VISIBILITY_PRIVATE
      setShowBadge(false)
    }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun preferences(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}

/** Receives only the explicit, app-private AlarmManager intent for backup reminders. */
class PocketRelayBackupReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (intent?.action == "expo.modules.pockethermessupervisor.BACKUP_REMINDER") {
      PocketRelayLocalNotifications.showBackupReminder(context)
    }
  }
}
