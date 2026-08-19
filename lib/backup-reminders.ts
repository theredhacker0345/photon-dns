import { PermissionsAndroid, Platform } from "react-native";
import {
  defaultBackupReminderConfiguration,
  describeBackupReminderInterval,
  type BackupReminderConfiguration,
  type BackupReminderIntervalDays,
} from "./backup-reminder-contracts";
import { disableNativeBackupReminder, scheduleNativeBackupReminder, sendNativeTestNotification } from "./native-supervisor";

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

export type NotificationTestResult = {
  ok: boolean;
  message: string;
};

/** Android 13+ requires an owner-approved runtime notification permission. */
async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  if (Number(Platform.Version) < 33) return true;
  const currentlyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (currentlyGranted) return true;
  return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Creates a repeatable, device-local Android reminder through the private native
 * bridge. It uses neither a push token nor a server and includes no backup data.
 */
export async function scheduleBackupReminder(
  current: BackupReminderConfiguration,
  intervalDays: BackupReminderIntervalDays,
): Promise<BackupReminderResult> {
  if (Platform.OS !== "android") {
    return { ok: false, message: "Backup reminders are available in the installed Android app.", configuration: current };
  }
  try {
    if (!await requestAndroidNotificationPermission()) {
      return { ok: false, message: "Android notification permission is required before Pocket Relay can schedule a private backup reminder.", configuration: current };
    }
    const notificationId = await scheduleNativeBackupReminder(intervalDays);
    if (!notificationId) {
      return { ok: false, message: "Pocket Relay could not schedule the local backup reminder on this device.", configuration: current };
    }
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
    if (!await disableNativeBackupReminder()) throw new Error("Native reminder cancellation failed.");
    return { ok: true, message: "Backup reminder disabled on this device.", configuration: defaultBackupReminderConfiguration };
  } catch {
    return { ok: false, message: "Pocket Relay could not cancel the local backup reminder.", configuration: current };
  }
}

/**
 * Sends one private, device-local Android notification. This does not use a
 * push token, contact a server, or include configuration or credential data.
 */
export async function sendTestNotification(deviceNotificationsEnabled: boolean): Promise<NotificationTestResult> {
  if (Platform.OS !== "android") {
    return { ok: false, message: "Test notifications are available in the installed Android app." };
  }
  if (!deviceNotificationsEnabled) {
    return { ok: false, message: "Turn on Device notifications before sending a local test notification." };
  }
  try {
    if (!await requestAndroidNotificationPermission()) {
      return { ok: false, message: "Android notification permission is required before Pocket Relay can send a local test notification." };
    }
    if (!await sendNativeTestNotification()) {
      return { ok: false, message: "Pocket Relay could not send the local test notification on this device." };
    }
    return { ok: true, message: "A private Pocket Relay test notification was sent to this device." };
  } catch {
    return { ok: false, message: "Pocket Relay could not send the local test notification on this device." };
  }
}
