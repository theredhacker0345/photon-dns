import { Platform } from "react-native";
import {
  defaultBackupReminderConfiguration,
  describeBackupReminderInterval,
  type BackupReminderConfiguration,
  type BackupReminderIntervalDays,
} from "./backup-reminder-contracts";

export {
  BACKUP_REMINDER_INTERVALS,
  defaultBackupReminderConfiguration,
  describeBackupReminderInterval,
  isBackupReminderIntervalDays,
  normalizeBackupReminderConfiguration,
  type BackupReminderConfiguration,
  type BackupReminderIntervalDays,
} from "./backup-reminder-contracts";

export type BackupReminderResult = {
  ok: boolean;
  message: string;
  configuration: BackupReminderConfiguration;
};

const BACKUP_REMINDER_CHANNEL = "pocket-relay-backup-reminders";

async function loadNotifications() {
  return import("expo-notifications");
}

async function prepareBackupReminderNotifications() {
  const Notifications = await loadNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(BACKUP_REMINDER_CHANNEL, {
      name: "Encrypted backup reminders",
      description: "Optional reminders to create a Pocket Relay encrypted backup.",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 120],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  return Notifications;
}

/**
 * Creates a local, repeatable device notification. It does not use a push token,
 * contact a server, include backup contents, or reveal any credential state.
 */
export async function scheduleBackupReminder(
  current: BackupReminderConfiguration,
  intervalDays: BackupReminderIntervalDays,
): Promise<BackupReminderResult> {
  if (Platform.OS !== "android") {
    return { ok: false, message: "Backup reminders are available in the installed Android app.", configuration: current };
  }
  try {
    const Notifications = await prepareBackupReminderNotifications();
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") {
      return { ok: false, message: "Android notification permission is required before Pocket Relay can schedule a private backup reminder.", configuration: current };
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Create a Pocket Relay backup",
        body: "Open Settings to create a new password-protected backup. Your backup password is never stored.",
        data: { route: "backup-reminder" },
        ...(Platform.OS === "android" ? { android: { channelId: BACKUP_REMINDER_CHANNEL } } : {}),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: intervalDays * 24 * 60 * 60, repeats: true },
    });
    if (current.notificationId) await Notifications.cancelScheduledNotificationAsync(current.notificationId).catch(() => undefined);
    const configuration: BackupReminderConfiguration = { enabled: true, intervalDays, notificationId };
    return { ok: true, message: `${describeBackupReminderInterval(intervalDays)} backup reminder enabled on this device.`, configuration };
  } catch {
    return { ok: false, message: "Pocket Relay could not schedule the local backup reminder on this device.", configuration: current };
  }
}

export async function disableBackupReminder(current: BackupReminderConfiguration): Promise<BackupReminderResult> {
  if (Platform.OS !== "android") {
    return { ok: true, message: "Backup reminders are disabled.", configuration: defaultBackupReminderConfiguration };
  }
  try {
    if (current.notificationId) {
      const Notifications = await loadNotifications();
      await Notifications.cancelScheduledNotificationAsync(current.notificationId).catch(() => undefined);
    }
    return { ok: true, message: "Backup reminder disabled on this device.", configuration: defaultBackupReminderConfiguration };
  } catch {
    return { ok: false, message: "Pocket Relay could not cancel the local backup reminder.", configuration: current };
  }
}
