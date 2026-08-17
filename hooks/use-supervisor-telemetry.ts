import { useEffect, useRef, useState } from "react";

import { getSupervisorTelemetry, type SupervisorTelemetry } from "@/lib/native-supervisor";
import type { SupervisorTelemetryStatus } from "@/lib/supervisor-telemetry";

export type SupervisorTelemetryState = {
  telemetry: SupervisorTelemetry | null;
  status: SupervisorTelemetryStatus;
  refreshedAt: string | null;
};

const initialState: SupervisorTelemetryState = { telemetry: null, status: "loading", refreshedAt: null };

export function useSupervisorTelemetry() {
  const [state, setState] = useState<SupervisorTelemetryState>(initialState);
  const hasReceivedNativeSample = useRef(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const telemetry = await getSupervisorTelemetry();
      if (!mounted) return;
      const status: SupervisorTelemetryStatus = telemetry
        ? hasReceivedNativeSample.current ? "live" : "sampling"
        : "bridge-required";
      if (telemetry) hasReceivedNativeSample.current = true;
      setState({ telemetry, status, refreshedAt: telemetry?.sampledAt ?? null });
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 12_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return state;
}
