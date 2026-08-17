import { useEffect, useRef, useState } from "react";

import { getSupervisorTelemetry, type SupervisorTelemetry } from "@/lib/native-supervisor";
import type { HostRuntimePolicy } from "@/lib/host-contracts";
import { appendResourceHistory, getResourceHistorySample, type ResourceHistorySample } from "@/lib/resource-history";
import { defaultHostRuntimePolicy } from "@/lib/host-contracts";
import { isSupervisorTelemetryFresh, type SupervisorTelemetryStatus } from "@/lib/supervisor-telemetry";

export type SupervisorTelemetryState = {
  telemetry: SupervisorTelemetry | null;
  history: ResourceHistorySample[];
  status: SupervisorTelemetryStatus;
  refreshedAt: string | null;
};

const initialState: SupervisorTelemetryState = { telemetry: null, history: [], status: "loading", refreshedAt: null };

/** Polls native telemetry and retains only a volatile, bounded chart history for the dashboard session. */
export function useSupervisorTelemetry(policy: HostRuntimePolicy = defaultHostRuntimePolicy) {
  const [state, setState] = useState<SupervisorTelemetryState>(initialState);
  const hasReceivedNativeSample = useRef(false);
  const policyRef = useRef(policy);
  policyRef.current = policy;

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const telemetry = await getSupervisorTelemetry();
      if (!mounted) return;
      const status: SupervisorTelemetryStatus = telemetry
        ? !isSupervisorTelemetryFresh(telemetry) ? "stale" : hasReceivedNativeSample.current ? "live" : "sampling"
        : "bridge-required";
      if (telemetry) hasReceivedNativeSample.current = true;
      setState((previous) => ({
        telemetry,
        history: telemetry ? appendResourceHistory(previous.history, getResourceHistorySample({ telemetry, policy: policyRef.current })) : previous.history,
        status,
        refreshedAt: telemetry?.sampledAt ?? null,
      }));
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 12_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return state;
}
