import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

import type { HostReadiness } from "@/hooks/use-host-readiness";
import type { HostRuntimePolicy } from "@/lib/host-contracts";
import { sendNativeHostSafetyAlert } from "@/lib/native-supervisor";

const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ALERT_STATE_KEY = "pocket-hermes.host-alert-cooldowns.v1";

export function useHostAlerts(readiness: HostReadiness, policy: HostRuntimePolicy, deviceNotificationsEnabled = true) {
  const [permission, setPermission] = useState<"granted" | "denied" | "unavailable">("unavailable");
  const sentAlerts = useRef(new Set<string>());

  const enableAlerts = useCallback(async () => {
    if (Platform.OS === "web" || !deviceNotificationsEnabled) return false;
    if (Platform.OS !== "android" || Number(Platform.Version) < 33) {
      setPermission("granted");
      return true;
    }
    const current = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    const granted = current || (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) === PermissionsAndroid.RESULTS.GRANTED;
    setPermission(granted ? "granted" : "denied");
    return granted;
  }, [deviceNotificationsEnabled]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (Platform.OS !== "android" || Number(Platform.Version) < 33) {
      setPermission("granted");
      return;
    }
    void PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then((granted) => setPermission(granted ? "granted" : "denied"));
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
      if (await sendNativeHostSafetyAlert(issue.title, issue.body)) {
        await AsyncStorage.setItem(ALERT_STATE_KEY, JSON.stringify({ ...cooldowns, [issue.key]: Date.now() }));
      }
    })();
  }, [deviceNotificationsEnabled, permission, policy.lowBatteryPercent, readiness.batteryPercent, readiness.isCharging, readiness.storageReady]);

  return { permission, enableAlerts, lowBatteryThreshold: policy.lowBatteryPercent };
}
