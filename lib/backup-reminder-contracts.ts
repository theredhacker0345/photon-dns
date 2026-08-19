export const BACKUP_REMINDER_INTERVALS = [7, 14, 30] as const;
export type BackupReminderIntervalDays = (typeof BACKUP_REMINDER_INTERVALS)[number];

export type BackupReminderConfiguration = {
  enabled: boolean;
  intervalDays: BackupReminderIntervalDays;
  notificationId: string | null;
};

export const defaultBackupReminderConfiguration: BackupReminderConfiguration = {
  enabled: false,
  intervalDays: 14,
  notificationId: null,
};

export function isBackupReminderIntervalDays(value: unknown): value is BackupReminderIntervalDays {
  return typeof value === "number" && BACKUP_REMINDER_INTERVALS.includes(value as BackupReminderIntervalDays);
}

export function normalizeBackupReminderConfiguration(value: unknown): BackupReminderConfiguration {
  if (!value || typeof value !== "object") return defaultBackupReminderConfiguration;
  const candidate = value as Partial<BackupReminderConfiguration>;
  const intervalDays = isBackupReminderIntervalDays(candidate.intervalDays) ? candidate.intervalDays : defaultBackupReminderConfiguration.intervalDays;
  const notificationId = typeof candidate.notificationId === "string" && candidate.notificationId.trim() ? candidate.notificationId.trim().slice(0, 160) : null;
  return {
    enabled: candidate.enabled === true && Boolean(notificationId),
    intervalDays,
    notificationId,
  };
}

export function describeBackupReminderInterval(intervalDays: BackupReminderIntervalDays) {
  return intervalDays === 7 ? "Every week" : intervalDays === 14 ? "Every 2 weeks" : "Every month";
}
