import { StyleSheet, Text, View } from "react-native";

import type { ThemeColorPalette } from "@/constants/theme";
import type { ResourceHistorySample } from "@/lib/resource-history";

type ResourceHistoryChartProps = {
  history: ResourceHistorySample[];
  colors: ThemeColorPalette;
};

const chartMetrics = [
  { key: "cpuPercent" as const, label: "CPU", colorKey: "primary" as const },
  { key: "ramPercent" as const, label: "RAM", colorKey: "success" as const },
  { key: "workspacePercent" as const, label: "Private storage", colorKey: "warning" as const },
];

export function ResourceHistoryChart({ history, colors }: ResourceHistoryChartProps) {
  const samples = history.slice(-20);
  const latest = samples.at(-1);
  const summary = latest
    ? `Latest sample: CPU ${latest.cpuPercent}%, RAM ${latest.ramPercent}%, private storage ${latest.workspacePercent === null ? "unavailable" : `${latest.workspacePercent}%`}.`
    : "No Android resource history has been sampled yet.";

  return (
    <View accessibilityLabel={summary} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View><Text style={[styles.eyebrow, { color: colors.muted }]}>RESOURCE HISTORY</Text><Text style={[styles.title, { color: colors.foreground }]}>Recent host usage</Text></View>
        <Text style={[styles.sampleCount, { color: colors.muted }]}>{samples.length ? `${samples.length} samples` : "Waiting"}</Text>
      </View>
      {samples.length ? <>
        <View style={styles.legend}>{chartMetrics.map((metric) => <View key={metric.key} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors[metric.colorKey] }]} /><Text style={[styles.legendText, { color: colors.muted }]}>{metric.label}</Text></View>)}</View>
        <View style={styles.plot}>{samples.map((sample) => <View key={sample.sampledAt} style={styles.sampleColumn}>{chartMetrics.map((metric) => {
          const value = sample[metric.key] ?? 0;
          return <View key={metric.key} style={[styles.track, { backgroundColor: `${colors.border}88` }]}><View style={[styles.bar, { height: `${value}%`, backgroundColor: colors[metric.colorKey], opacity: sample[metric.key] === null ? 0.18 : 0.9 }]} /></View>;
        })}</View>)}</View>
        <View style={styles.axis}><Text style={[styles.axisText, { color: colors.muted }]}>Older</Text><Text style={[styles.axisText, { color: colors.muted }]}>Latest</Text></View>
      </> : <Text style={[styles.empty, { color: colors.muted }]}>The installed Android host adds one in-memory sample every 12 seconds. The dashboard keeps only the latest 30 samples and never writes them to task history.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 10 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, eyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9 }, title: { fontSize: 15, lineHeight: 20, fontWeight: "900", marginTop: 2 }, sampleCount: { fontSize: 10, fontWeight: "800" }, legend: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, legendItem: { flexDirection: "row", alignItems: "center", gap: 5 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { fontSize: 10, fontWeight: "700" }, plot: { height: 66, flexDirection: "row", alignItems: "flex-end", gap: 3 }, sampleColumn: { flex: 1, height: "100%", flexDirection: "row", alignItems: "flex-end", gap: 1.5 }, track: { flex: 1, height: "100%", borderRadius: 2, justifyContent: "flex-end", overflow: "hidden" }, bar: { width: "100%", minHeight: 1, borderRadius: 2 }, axis: { flexDirection: "row", justifyContent: "space-between" }, axisText: { fontSize: 9, fontWeight: "700" }, empty: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
