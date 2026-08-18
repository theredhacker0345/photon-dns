import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, View } from "react-native";

import type { ProviderConnectionStatus } from "@/lib/model-providers";

type StatusColors = {
  foreground: string;
  muted: string;
  background: string;
  border: string;
  primary: string;
  success: string;
  warning: string;
  error: string;
};

export function ProviderConnectionStatusCard({
  connection,
  colors,
}: {
  connection: ProviderConnectionStatus;
  colors: StatusColors;
}) {
  const tone = connection.authStatus === "authenticated" || connection.authStatus === "not_required"
    ? colors.success
    : connection.authStatus === "unauthorized"
      ? colors.error
      : connection.authStatus === "unavailable"
        ? colors.warning
        : colors.muted;
  const icon = connection.authStatus === "authenticated" || connection.authStatus === "not_required"
    ? "verified"
    : connection.authStatus === "unauthorized"
      ? "lock-outline"
      : connection.authStatus === "unavailable"
        ? "cloud-off"
        : "help-outline";
  const authentication = connection.authStatus === "authenticated"
    ? "Authenticated"
    : connection.authStatus === "not_required"
      ? "No token required"
    : connection.authStatus === "unauthorized"
      ? "Authentication failed"
      : connection.authStatus === "unavailable"
        ? "Provider unreachable"
        : connection.authStatus === "not_configured"
          ? "Token required"
          : "Not checked";
  const latency = typeof connection.latencyMs === "number" ? `${connection.latencyMs} ms` : "—";
  const checkedAt = connection.checkedAt
    ? new Date(connection.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Not checked";

  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]} accessibilityLabel={`Provider connection: ${authentication}; latency ${latency}`}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${tone}18` }]}><MaterialIcons name={icon} size={18} color={tone} /></View>
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>CONNECTION STATUS</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Selected provider</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: tone }]} />
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={[styles.metricLabel, { color: colors.muted }]}>AUTHENTICATION</Text><Text style={[styles.metricValue, { color: tone }]}>{authentication}</Text></View>
        <View style={styles.divider} />
        <View style={styles.metric}><Text style={[styles.metricLabel, { color: colors.muted }]}>LATENCY</Text><Text style={[styles.metricValue, { color: colors.foreground }]}>{latency}</Text></View>
        <View style={styles.divider} />
        <View style={styles.metric}><Text style={[styles.metricLabel, { color: colors.muted }]}>CHECKED</Text><Text style={[styles.metricValue, { color: colors.foreground }]}>{checkedAt}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 15, padding: 12, gap: 11 },
  header: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 33, height: 33, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 2 },
  eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  title: { fontSize: 13, fontWeight: "900" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  metrics: { flexDirection: "row", alignItems: "stretch", gap: 9 },
  metric: { flex: 1, gap: 3 },
  metricLabel: { fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  metricValue: { fontSize: 11, fontWeight: "900" },
  divider: { width: 1, backgroundColor: "#CBD5E1" },
});
