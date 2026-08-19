import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { HostReadiness } from "@/hooks/use-host-readiness";
import type { HostRuntimePolicy } from "@/lib/host-contracts";

const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ALERT_STATE_KEY = "pocket-hermes.host-alert-cooldowns.v1";

export function useHostAlerts(readiness: HostReadiness, policy: HostRuntimePolicy, deviceNotificationsEnabled = true) {
  const [permission, setPermission] = useState<Notifications.PermissionStatus | "unavailable">("unavailable");
  const sentAlerts = useRef(new Set<string>());

  const enableAlerts = useCallback(async () => {
    if (Platform.OS === "web" || !deviceNotificationsEnabled) return false;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("host-readiness", {
        name: "Host readiness",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 120],
        lightColor: "#6750E8",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const result = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
    setPermission(result.status);
    return result.status === "granted";
  }, [deviceNotificationsEnabled]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    void Notifications.getPermissionsAsync().then((result) => setPermission(result.status));
  }, []);

  useEffect(() => {
    if (!deviceNotificationsEnabled || permission !== "granted") return;
    const issue = readiness.isCharging === false && readiness.batteryPercent !== null && readiness.batteryPercent < policy.lowBatteryPercent
      ? { key: "low-battery", title: "Pocket Relay needs power", body: `Battery is at ${readiness.batteryPercent}%. Plug in this host phone to keep the agent available.` }
      : readiness.storageReady === false
        ? { key: "low-storage", title: "Pocket Relay needs storage", body: "Free space is below the host reserve. Clear space before running the embedded runtime." }
        : null;
    if (!issue || sentAlerts.current.has(issue.key)) return;
    sentAlerts.current.add(issue.key);
    void (async () => {
      const raw = await AsyncStorage.getItem(ALERT_STATE_KEY).catch(() => null);
      const cooldowns = raw ? JSON.parse(raw) as Record<string, number> : {};
      const lastSentAt = cooldowns[issue.key] ?? 0;
      if (Date.now() - lastSentAt < ALERT_COOLDOWN_MS) return;
      await Notifications.scheduleNotificationAsync({ content: { title: issue.title, body: issue.body, data: { route: "/(tabs)" } }, trigger: null });
      await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify({ ...cooldowns, [issue.key]: Date.now() }));
    })();
  }, [deviceNotificationsEnabled, permission, policy.lowBatteryPercent, readiness.batteryPercent, readiness.isCharging, readiness.storageReady]);

  return { permission, enableAlerts, lowBatteryThreshold: policy.lowBatteryPercent };
}
