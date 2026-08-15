import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { HostReadiness } from "@/hooks/use-host-readiness";

const LOW_BATTERY_PERCENT = 25;

export function useHostAlerts(readiness: HostReadiness) {
  const [permission, setPermission] = useState<Notifications.PermissionStatus | "unavailable">("unavailable");
  const sentAlerts = useRef(new Set<string>());

  const enableAlerts = useCallback(async () => {
    if (Platform.OS === "web") return false;
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
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    void Notifications.getPermissionsAsync().then((result) => setPermission(result.status));
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;
    const issue = readiness.isCharging === false && readiness.batteryPercent !== null && readiness.batteryPercent < LOW_BATTERY_PERCENT
      ? { key: "low-battery", title: "Pocket Hermes needs power", body: `Battery is at ${readiness.batteryPercent}%. Plug in this host phone to keep the agent available.` }
      : readiness.storageReady === false
        ? { key: "low-storage", title: "Pocket Hermes needs storage", body: "Free space is below the host reserve. Clear space before running the embedded runtime." }
        : null;
    if (!issue || sentAlerts.current.has(issue.key)) return;
    sentAlerts.current.add(issue.key);
    void Notifications.scheduleNotificationAsync({ content: { title: issue.title, body: issue.body, data: { route: "/(tabs)" } }, trigger: null });
  }, [permission, readiness.batteryPercent, readiness.isCharging, readiness.storageReady]);

  return { permission, enableAlerts, lowBatteryThreshold: LOW_BATTERY_PERCENT };
}
