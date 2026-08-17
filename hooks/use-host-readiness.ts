import * as Battery from "expo-battery";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export type HostReadiness = {
  batteryPercent: number | null;
  chargingLabel: string;
  isCharging: boolean | null;
  batteryOptimizationEnabled: boolean | null;
  freeStorageBytes: number | null;
  storageReady: boolean | null;
  source: "native" | "preview" | "unavailable";
};

const initialReadiness: HostReadiness = {
  batteryPercent: null,
  chargingLabel: "Reading device power…",
  isCharging: null,
  batteryOptimizationEnabled: null,
  freeStorageBytes: null,
  storageReady: null,
  source: "unavailable",
};

function batteryLabel(state: Battery.BatteryState) {
  if (state === Battery.BatteryState.CHARGING) return "Charging";
  if (state === Battery.BatteryState.FULL) return "Full / plugged in";
  if (state === Battery.BatteryState.UNPLUGGED) return "On battery";
  return "Power state unavailable";
}

function isChargingState(state: Battery.BatteryState) {
  return state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
}

export function useHostReadiness(minimumHostStorageBytes = 2 * 1024 * 1024 * 1024) {
  const [readiness, setReadiness] = useState<HostReadiness>(initialReadiness);

  useEffect(() => {
    if (Platform.OS === "web") {
      setReadiness({ ...initialReadiness, chargingLabel: "Android device required", source: "preview" });
      return;
    }

    let active = true;
    let batteryLevelSubscription: Battery.Subscription | undefined;
    let batteryStateSubscription: Battery.Subscription | undefined;

    const updatePower = (level: number, state: Battery.BatteryState, optimizationEnabled: boolean | null, freeStorageBytes: number | null) => {
      if (!active) return;
      setReadiness({
        batteryPercent: level >= 0 ? Math.round(level * 100) : null,
        chargingLabel: batteryLabel(state),
        isCharging: isChargingState(state),
        batteryOptimizationEnabled: optimizationEnabled,
        freeStorageBytes,
        storageReady: freeStorageBytes === null ? null : freeStorageBytes >= minimumHostStorageBytes,
        source: "native",
      });
    };

    void (async () => {
      try {
        const available = await Battery.isAvailableAsync();
        const freeStorageBytes = await FileSystem.getFreeDiskStorageAsync().catch(() => null);
        if (!available) {
          if (active) setReadiness({ ...initialReadiness, freeStorageBytes, storageReady: freeStorageBytes === null ? null : freeStorageBytes >= minimumHostStorageBytes, chargingLabel: "Power state unavailable", source: "unavailable" });
          return;
        }
        const [level, state, optimizationEnabled] = await Promise.all([
          Battery.getBatteryLevelAsync(),
          Battery.getBatteryStateAsync(),
          Battery.isBatteryOptimizationEnabledAsync().catch(() => null),
        ]);
        updatePower(level, state, optimizationEnabled, freeStorageBytes);
        batteryLevelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
          setReadiness((current) => ({ ...current, batteryPercent: batteryLevel >= 0 ? Math.round(batteryLevel * 100) : null }));
        });
        batteryStateSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
          setReadiness((current) => ({ ...current, chargingLabel: batteryLabel(batteryState), isCharging: isChargingState(batteryState) }));
        });
      } catch {
        if (active) setReadiness({ ...initialReadiness, chargingLabel: "Device check unavailable", source: "unavailable" });
      }
    })();

    return () => {
      active = false;
      batteryLevelSubscription?.remove();
      batteryStateSubscription?.remove();
    };
  }, []);

  return readiness;
}
