import { useEffect, useState } from "react";

import { getSupervisorTelemetry, type SupervisorTelemetry } from "@/lib/native-supervisor";

export type SupervisorTelemetryState = {
  telemetry: SupervisorTelemetry | null;
  status: "live" | "bridge-required";
  refreshedAt: string | null;
};

const initialState: SupervisorTelemetryState = { telemetry: null, status: "bridge-required", refreshedAt: null };

export function useSupervisorTelemetry() {
  const [state, setState] = useState<SupervisorTelemetryState>(initialState);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const telemetry = await getSupervisorTelemetry();
      if (!mounted) return;
      setState({ telemetry, status: telemetry ? "live" : "bridge-required", refreshedAt: telemetry?.sampledAt ?? null });
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 12_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return state;
}
