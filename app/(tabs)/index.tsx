import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { EventIcon, PressableCard, PrimaryButton, RuntimePill, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ResourceHistoryChart } from "@/components/resource-history-chart";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useHostAlerts } from "@/hooks/use-host-alerts";
import { useHostReadiness } from "@/hooks/use-host-readiness";
import { useSupervisorTelemetry } from "@/hooks/use-supervisor-telemetry";
import { getHomePhasePresentation } from "@/lib/home-dashboard-presentation";
import { usePocketHermes } from "@/lib/pocket-hermes-store";
import { getResourceLimitWarnings } from "@/lib/resource-guardrails";
import { getSupervisorTelemetryPresentation } from "@/lib/supervisor-telemetry";

function formatEventTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function formatFreeStorage(bytes: number | null) {
  return bytes === null ? "Checking…" : `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function HostScreen() {
  const colors = useColors();
  const isFocused = useIsFocused();
  const { config, phase, events, hydrated, prepareRuntime, stopHost } = usePocketHermes();
  const readiness = useHostReadiness(config.policy.minimumFreeStorageBytes);
  const { telemetry, status: telemetryStatus, history: telemetryHistory } = useSupervisorTelemetry(config.policy, isFocused);
  const { permission: alertPermission, enableAlerts } = useHostAlerts(readiness, config.policy);
  const canPrepare = config.hasTelegramToken && Boolean(config.allowedChatId);
  const presentation = getHomePhasePresentation(phase);
  const telemetryPresentation = getSupervisorTelemetryPresentation({ telemetry, status: telemetryStatus, platform: Platform.OS });
  const resourceWarnings = getResourceLimitWarnings({ telemetry, policy: config.policy });
  const hasCriticalWarning = resourceWarnings.some((warning) => warning.severity === "critical");
  const storageWarning = resourceWarnings.find((warning) => warning.resource === "workspace");

  if (!hydrated) {
    return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.primary} /></ScreenContainer>;
  }

  const action = phase === "unconfigured"
    ? <PrimaryButton label="Configure host" icon="lock-outline" onPress={() => router.push("/setup" as never)} />
    : phase === "stopped"
      ? <PrimaryButton label="Prepare runtime" icon="play-arrow" onPress={() => void prepareRuntime(readiness)} disabled={!canPrepare} />
      : phase === "running"
        ? <View style={styles.actionRow}><View style={styles.primaryWrap}><PrimaryButton label="Supervisor live" icon="verified" onPress={() => void prepareRuntime(readiness)} disabled /></View><View style={styles.secondaryWrap}><SecondaryButton label="Pause" icon="pause" onPress={() => void stopHost()} /></View></View>
        : phase === "ready"
          ? <View style={styles.actionRow}><View style={styles.primaryWrap}><PrimaryButton label="Start supervisor" icon="play-arrow" onPress={() => void prepareRuntime(readiness)} disabled={!canPrepare} /></View><View style={styles.secondaryWrap}><SecondaryButton label="Test gateway" icon="telegram" onPress={() => router.push("/gateway-test" as never)} /></View></View>
          : <View style={styles.actionRow}><View style={styles.primaryWrap}><PrimaryButton label="Review native bridge" icon="phone-android" onPress={() => void prepareRuntime(readiness)} disabled={!canPrepare} /></View><View style={styles.secondaryWrap}><SecondaryButton label="Setup" icon="settings" onPress={() => router.push("/setup" as never)} /></View></View>;

  return (
    <ScreenContainer className="px-5" safeAreaClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topline}>
          <View style={styles.brandCopy}>
            <Text style={[styles.wordmark, { color: colors.foreground }]}>POCKET AGENT HOST</Text>
            <View style={styles.brandMeta}>
              <View style={[styles.brandDot, { backgroundColor: phase === "unconfigured" || phase === "stopped" ? colors.warning : colors.success }]} />
              <Text style={[styles.caption, { color: colors.muted }]}>PRIVATE ANDROID HOST</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open host setup" onPress={() => router.push("/setup" as never)} style={({ pressed }) => [styles.settingsButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
            <MaterialIcons name="settings" size={21} color={colors.foreground} />
          </Pressable>
        </View>

        <View accessibilityLabel={`${presentation.title} Next step: ${presentation.nextStep}.`} style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroCopy}>
            <RuntimePill phase={phase} />
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>{presentation.title}</Text>
            <Text style={[styles.heroDetail, { color: colors.muted }]}>{presentation.detail}</Text>
          </View>
          <View style={[styles.nextStep, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.nextStepIcon, { backgroundColor: `${colors.primary}18` }]}><MaterialIcons name={presentation.nextIcon} size={19} color={colors.primary} /></View>
            <View style={styles.nextStepCopy}>
              <Text style={[styles.nextStepLabel, { color: colors.primary }]}>NEXT STEP</Text>
              <Text style={[styles.nextStepTitle, { color: colors.foreground }]}>{presentation.nextStep}</Text>
              <Text style={[styles.nextStepDetail, { color: colors.muted }]}>{presentation.nextDetail}</Text>
            </View>
          </View>
          <View style={styles.heroRail}>
            <View style={styles.heroRailItem}><MaterialIcons name="phone-android" size={15} color={colors.primary} /><Text style={[styles.heroRailText, { color: colors.foreground }]}>On this phone</Text></View>
            <View style={[styles.heroRailDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroRailItem}><MaterialIcons name="lock" size={15} color={colors.primary} /><Text style={[styles.heroRailText, { color: colors.foreground }]}>Owner locked</Text></View>
          </View>
        </View>

        {action}

        {phase !== "unconfigured" ? <>
          <SectionHeading eyebrow="HOST PULSE" title="At a glance" action={<View style={[styles.telemetryStatus, { backgroundColor: `${telemetryStatus === "live" ? colors.success : colors.primary}18` }]}><View style={[styles.telemetryStatusDot, { backgroundColor: telemetryStatus === "live" ? colors.success : colors.primary }]} /><Text style={[styles.telemetryStatusText, { color: telemetryStatus === "live" ? colors.success : colors.primary }]}>{telemetryPresentation.statusLabel}</Text></View>} />
          <View style={styles.metricGrid}>
            <MetricCard icon="smart-toy" label="Agent" value={telemetry ? telemetry.agentStatus[0].toUpperCase() + telemetry.agentStatus.slice(1) : phase === "ready" ? "Ready" : phase === "stopped" ? "Paused" : "Android APK"} detail={telemetry ? "Native supervisor" : "Private runtime"} color={telemetry?.agentStatus === "degraded" || phase === "stopped" ? colors.warning : colors.success} colors={colors} />
            <MetricCard icon="battery-charging-full" label="Power" value={readiness.batteryPercent === null ? readiness.chargingLabel : `${readiness.batteryPercent}%`} detail={readiness.chargingLabel} color={readiness.isCharging ? colors.success : colors.warning} colors={colors} />
            <MetricCard icon="memory" label="CPU" value={telemetryPresentation.cpu.value} detail={telemetryPresentation.cpu.detail} color={resourceWarnings.some((warning) => warning.resource === "cpu" && warning.severity === "critical") ? colors.error : resourceWarnings.some((warning) => warning.resource === "cpu") ? colors.warning : telemetry ? colors.success : colors.primary} colors={colors} />
            <MetricCard icon="developer-board" label="RAM" value={telemetryPresentation.ram.value} detail={telemetryPresentation.ram.detail} color={resourceWarnings.some((warning) => warning.resource === "ram" && warning.severity === "critical") ? colors.error : resourceWarnings.some((warning) => warning.resource === "ram") ? colors.warning : telemetry ? colors.success : colors.primary} colors={colors} />
          </View>
          <PressableCard style={[styles.storageCard, { borderColor: readiness.storageReady === false || storageWarning?.severity === "critical" ? `${colors.error}88` : colors.border }]}>
            <View style={[styles.storageIcon, { backgroundColor: `${readiness.storageReady === false || storageWarning?.severity === "critical" ? colors.error : storageWarning ? colors.warning : colors.success}18` }]}><MaterialIcons name="storage" size={20} color={readiness.storageReady === false || storageWarning?.severity === "critical" ? colors.error : storageWarning ? colors.warning : colors.success} /></View>
            <View style={styles.storageCopy}><Text style={[styles.storageLabel, { color: colors.muted }]}>PRIVATE STORAGE</Text><Text style={[styles.storageValue, { color: colors.foreground }]}>{formatFreeStorage(readiness.freeStorageBytes)} free</Text><Text style={[styles.storageDetail, { color: colors.muted }]}>{storageWarning?.detail ?? (readiness.storageReady === false ? "The configured reserve is low." : "The configured reserve is available for runtime work.")}</Text></View>
            <View style={[styles.readinessBadge, { backgroundColor: `${readiness.storageReady === false || storageWarning?.severity === "critical" ? colors.error : storageWarning ? colors.warning : colors.success}18` }]}><Text style={[styles.readinessBadgeText, { color: readiness.storageReady === false || storageWarning?.severity === "critical" ? colors.error : storageWarning ? colors.warning : colors.success }]}>{readiness.storageReady === false || storageWarning?.severity === "critical" ? "CHECK" : storageWarning ? "WATCH" : "READY"}</Text></View>
          </PressableCard>
          {resourceWarnings.length ? <View style={[styles.resourceAlert, { backgroundColor: `${hasCriticalWarning ? colors.error : colors.warning}13`, borderColor: `${hasCriticalWarning ? colors.error : colors.warning}55` }]}><MaterialIcons name="warning-amber" size={19} color={hasCriticalWarning ? colors.error : colors.warning} /><View style={styles.resourceAlertCopy}><Text style={[styles.resourceAlertTitle, { color: hasCriticalWarning ? colors.error : colors.warning }]}>{hasCriticalWarning ? "Action needed on this host" : "Resource limit approaching"}</Text>{resourceWarnings.map((warning) => <Text key={warning.resource} style={[styles.resourceAlertDetail, { color: colors.muted }]}>{warning.detail}</Text>)}</View></View> : null}
          {telemetryPresentation.notice ? <View style={[styles.telemetryNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialIcons name="info-outline" size={17} color={colors.primary} /><Text style={[styles.telemetryNoticeText, { color: colors.muted }]}>{telemetryPresentation.notice}</Text></View> : null}
          <View style={[styles.alertCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.alertIcon, { backgroundColor: `${alertPermission === "granted" ? colors.success : colors.warning}18` }]}><MaterialIcons name={alertPermission === "granted" ? "notifications-active" : "notifications-none"} size={18} color={alertPermission === "granted" ? colors.success : colors.warning} /></View><View style={styles.alertCopy}><Text style={[styles.alertTitle, { color: colors.foreground }]}>{alertPermission === "granted" ? "Safety alerts are on" : "Turn on safety alerts"}</Text><Text style={[styles.alertDetail, { color: colors.muted }]}>{alertPermission === "granted" ? "You will be warned about low battery and storage." : "Get a local warning before this unattended host becomes unsafe."}</Text></View>{alertPermission !== "granted" ? <Pressable accessibilityRole="button" accessibilityLabel="Enable local host safety alerts" onPress={() => void enableAlerts()} style={({ pressed }) => [styles.alertAction, { borderColor: colors.border, backgroundColor: colors.background }, pressed && styles.pressed]}><Text style={[styles.alertActionText, { color: colors.primary }]}>Enable</Text></Pressable> : null}</View>
          <ResourceHistoryChart history={telemetryHistory} colors={colors} />
        </> : null}

        <SectionHeading eyebrow="TRUST BOUNDARY" title="Built for a private host" />
        <View style={styles.boundaryGrid}>
          <PressableCard style={styles.boundaryCard}><View style={[styles.boundaryIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="lock" size={19} color={colors.primary} /></View><Text style={[styles.boundaryTitle, { color: colors.foreground }]}>App-private workspace</Text><Text style={[styles.boundaryDetail, { color: colors.muted }]}>Memory, schedules, and logs stay inside this host.</Text></PressableCard>
          <PressableCard style={styles.boundaryCard}><View style={[styles.boundaryIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="telegram" size={19} color={colors.primary} /></View><Text style={[styles.boundaryTitle, { color: colors.foreground }]}>Owner-only gateway</Text><Text style={[styles.boundaryDetail, { color: colors.muted }]}>Only your allowed Telegram chat can send instructions.</Text></PressableCard>
        </View>

        <SectionHeading eyebrow="LOCAL ACTIVITY" title="Latest host events" action={<Text style={[styles.countText, { color: colors.muted }]}>{events.length ? `${events.length} saved` : "No activity"}</Text>} />
        {events.length ? <PressableCard style={styles.eventCard}>{events.slice(0, 4).map((event, index) => <View key={event.id} style={[styles.eventRow, index !== 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.eventIcon, { backgroundColor: colors.background }]}><EventIcon severity={event.severity} /></View><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text><Text style={[styles.eventDetail, { color: colors.muted }]} numberOfLines={2}>{event.detail}</Text></View><Text style={[styles.eventTime, { color: colors.muted }]}>{formatEventTime(event.createdAt)}</Text></View>)}</PressableCard> : <PressableCard style={styles.emptyCard}><MaterialIcons name="history" size={22} color={colors.muted} /><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.foreground }]}>No activity yet</Text><Text style={[styles.eventDetail, { color: colors.muted }]}>Setup and runtime events will appear here when this phone becomes active.</Text></View></PressableCard>}
      </ScrollView>
    </ScreenContainer>
  );
}

function MetricCard({ icon, label, value, detail, color, colors }: { icon: ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; detail: string; color: string; colors: ReturnType<typeof useColors> }) {
  return <PressableCard style={styles.metricCard}><View style={styles.metricTopline}><View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}><MaterialIcons name={icon} size={18} color={color} /></View><Text style={[styles.metricLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text></View><Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text><Text style={[styles.metricDetail, { color: colors.muted }]} numberOfLines={1}>{detail}</Text></PressableCard>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 32, gap: 18 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandCopy: { gap: 4 },
  wordmark: { fontSize: 17, fontWeight: "900", letterSpacing: 0.8 },
  brandMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandDot: { width: 6, height: 6, borderRadius: 3 },
  caption: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  settingsButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  hero: { borderRadius: 20, padding: 18, borderWidth: 1, gap: 16 },
  heroCopy: { gap: 10 },
  heroTitle: { fontSize: 27, lineHeight: 32, fontWeight: "900", letterSpacing: -0.8 },
  heroDetail: { fontSize: 13, lineHeight: 19, fontWeight: "500" },
  nextStep: { flexDirection: "row", alignItems: "flex-start", gap: 11, borderRadius: 14, padding: 12, borderWidth: 1 },
  nextStepIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nextStepCopy: { flex: 1, gap: 2 },
  nextStepLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  nextStepTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" },
  nextStepDetail: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
  heroRail: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7, gap: 8 },
  heroRailItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroRailText: { fontSize: 10, fontWeight: "800" },
  heroRailDivider: { width: StyleSheet.hairlineWidth, height: 14 },
  actionRow: { flexDirection: "row", gap: 8 },
  primaryWrap: { flex: 1.45 },
  secondaryWrap: { flex: 0.9 },
  telemetryStatus: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20 },
  telemetryStatusDot: { width: 6, height: 6, borderRadius: 3 },
  telemetryStatusText: { fontSize: 10, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metricCard: { width: "48.7%", gap: 5, minHeight: 116 },
  metricTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  metricLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  metricValue: { fontSize: 15, lineHeight: 19, fontWeight: "900", marginTop: 1 },
  metricDetail: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
  storageCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13 },
  storageIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  storageCopy: { flex: 1, gap: 2 },
  storageLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9 },
  storageValue: { fontSize: 15, lineHeight: 19, fontWeight: "900" },
  storageDetail: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
  readinessBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6 },
  readinessBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  telemetryNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 1 },
  telemetryNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  resourceAlert: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  resourceAlertCopy: { flex: 1, gap: 3 },
  resourceAlertTitle: { fontSize: 12, fontWeight: "900" },
  resourceAlertDetail: { fontSize: 11, lineHeight: 16, fontWeight: "700" },
  alertCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  alertIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alertCopy: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 12, lineHeight: 16, fontWeight: "900" },
  alertDetail: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
  alertAction: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  alertActionText: { fontSize: 11, fontWeight: "900" },
  boundaryGrid: { flexDirection: "row", gap: 8 },
  boundaryCard: { flex: 1, minHeight: 132, justifyContent: "space-between" },
  boundaryIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  boundaryTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 8 },
  boundaryDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  countText: { fontSize: 12, fontWeight: "700", paddingBottom: 2 },
  eventCard: { paddingVertical: 2, gap: 0 },
  emptyCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  eventRow: { flexDirection: "row", gap: 10, paddingVertical: 14, alignItems: "flex-start" },
  eventIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  eventCopy: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" },
  eventDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" },
  eventTime: { fontSize: 11, fontWeight: "700", marginTop: 2 },
});
