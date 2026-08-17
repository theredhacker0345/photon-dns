import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EventIcon, PressableCard, PrimaryButton, RuntimePill, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useHostAlerts } from "@/hooks/use-host-alerts";
import { useHostReadiness } from "@/hooks/use-host-readiness";
import { useSupervisorTelemetry } from "@/hooks/use-supervisor-telemetry";
import { usePocketHermes } from "@/lib/pocket-hermes-store";
import { getSupervisorTelemetryPresentation } from "@/lib/supervisor-telemetry";

function formatEventTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default function HostScreen() {
  const colors = useColors();
  const { config, phase, events, hydrated, prepareRuntime, stopHost } = usePocketHermes();
  const readiness = useHostReadiness();
  const { telemetry, status: telemetryStatus } = useSupervisorTelemetry();
  const { permission: alertPermission, enableAlerts } = useHostAlerts(readiness);
  const canPrepare = config.hasTelegramToken && Boolean(config.allowedChatId);
  const telemetryPresentation = getSupervisorTelemetryPresentation({ telemetry, status: telemetryStatus, platform: Platform.OS });

  if (!hydrated) {
    return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.primary} /></ScreenContainer>;
  }

  const phaseCopy = {
    unconfigured: { title: "Make this phone a private agent host.", detail: "Connect one Telegram bot and lock it to your own chat before anything can run." },
    ready: { title: "Your private host is set up.", detail: "Review local readiness, test the owner gateway, then prepare the embedded Hermes runtime." },
    running: { title: "Your private host is supervised.", detail: "Pocket Hermes is sampling this phone’s live host-process CPU and RAM through Android’s foreground supervisor." },
    bridge_required: { title: "Control plane is ready for its native bridge.", detail: "The Expo preview stores your setup locally; the production build adds the bundled Python/Hermes supervisor." },
    stopped: { title: "Host is paused.", detail: "No new runtime session will be requested until you prepare the host again." },
  }[phase];

  return (
    <ScreenContainer className="px-5" safeAreaClassName="bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.topline}>
          <View style={styles.brandCopy}><Text style={[styles.wordmark, { color: colors.foreground }]}>POCKET HERMES</Text><View style={styles.brandMeta}><View style={[styles.brandDot, { backgroundColor: phase === "unconfigured" ? colors.warning : colors.success }]} /><Text style={[styles.caption, { color: colors.muted }]}>PRIVATE ANDROID AGENT HOST</Text></View></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open host setup" onPress={() => router.push("/setup" as never)} style={({ pressed }) => [styles.settingsButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="settings" size={20} color={colors.foreground} /></Pressable>
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroAura, { backgroundColor: `${colors.primary}19` }]} />
          <View style={styles.heroCopy}><RuntimePill phase={phase} /><Text style={[styles.heroTitle, { color: colors.foreground }]}>{phaseCopy.title}</Text><Text style={[styles.heroDetail, { color: colors.muted }]}>{phaseCopy.detail}</Text></View>
          <View style={styles.heroRail}><View style={styles.heroRailItem}><MaterialIcons name="phone-android" size={15} color={colors.primary} /><Text style={[styles.heroRailText, { color: colors.foreground }]}>On this phone</Text></View><View style={[styles.heroRailDivider, { backgroundColor: colors.border }]} /><View style={styles.heroRailItem}><MaterialIcons name="lock" size={15} color={colors.primary} /><Text style={[styles.heroRailText, { color: colors.foreground }]}>Owner locked</Text></View></View>
          <View style={[styles.shield, { backgroundColor: colors.background, borderColor: `${colors.primary}33` }]}><MaterialIcons name="shield" size={30} color={colors.primary} /></View>
        </View>

        {phase === "unconfigured" ? <PrimaryButton label="Configure host" icon="lock-outline" onPress={() => router.push("/setup" as never)} /> : phase === "stopped" ? <PrimaryButton label="Prepare runtime" icon="play-arrow" onPress={() => void prepareRuntime()} disabled={!canPrepare} /> : (
          <View style={styles.actionRow}><View style={styles.primaryWrap}><PrimaryButton label={phase === "running" ? "Supervisor live" : phase === "ready" ? "Start supervisor" : "Review native bridge"} icon={phase === "running" ? "verified" : phase === "ready" ? "play-arrow" : "account-tree"} onPress={() => void prepareRuntime()} disabled={!canPrepare || phase === "running"} /></View><View style={styles.secondaryWrap}><SecondaryButton label="Pause" icon="pause" onPress={() => void stopHost()} /></View></View>
        )}

        {phase !== "unconfigured" ? <><SectionHeading eyebrow="HOST TELEMETRY" title="This phone, ready to host" action={<Text style={[styles.countText, { color: colors.muted }]}>{telemetryPresentation.statusLabel}</Text>} /><View style={styles.metricGrid}><MetricCard icon="smart-toy" label="Agent" value={telemetry ? telemetry.agentStatus[0].toUpperCase() + telemetry.agentStatus.slice(1) : phase === "ready" ? "Setup complete" : phase === "stopped" ? "Paused" : "Bridge required"} detail={telemetry ? "Supervisor live" : "Private runtime"} color={telemetry?.agentStatus === "degraded" || phase === "stopped" ? colors.warning : colors.success} colors={colors} /><MetricCard icon="memory" label="CPU" value={telemetryPresentation.cpu.value} detail={telemetryPresentation.cpu.detail} color={telemetry ? colors.success : colors.primary} colors={colors} /><MetricCard icon="developer-board" label="RAM" value={telemetryPresentation.ram.value} detail={telemetryPresentation.ram.detail} color={telemetry ? colors.success : colors.primary} colors={colors} /><MetricCard icon="battery-charging-full" label="Power" value={readiness.batteryPercent === null ? readiness.chargingLabel : `${readiness.batteryPercent}%`} detail={readiness.chargingLabel} color={readiness.isCharging ? colors.success : colors.warning} colors={colors} /><MetricCard icon="storage" label="Storage" value={readiness.freeStorageBytes === null ? "Checking…" : `${(readiness.freeStorageBytes / 1024 / 1024 / 1024).toFixed(1)} GB`} detail={readiness.storageReady === false ? "Reserve is low" : "Free for runtime"} color={readiness.storageReady === false ? colors.warning : colors.success} colors={colors} /></View>{telemetryPresentation.notice ? <View style={[styles.telemetryNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialIcons name="info-outline" size={17} color={colors.primary} /><Text style={[styles.telemetryNoticeText, { color: colors.muted }]}>{telemetryPresentation.notice}</Text></View> : null}<View style={styles.alertRow}><MaterialIcons name={alertPermission === "granted" ? "notifications-active" : "notifications-none"} size={18} color={alertPermission === "granted" ? colors.success : colors.warning} /><Text style={[styles.alertCopy, { color: colors.muted }]}>{alertPermission === "granted" ? "Low battery and storage alerts are on." : "Enable local alerts before leaving this host unattended."}</Text>{alertPermission !== "granted" ? <Pressable accessibilityRole="button" onPress={() => void enableAlerts()} style={({ pressed }) => [styles.alertAction, { borderColor: colors.border, backgroundColor: colors.surface }, pressed && styles.pressed]}><Text style={[styles.alertActionText, { color: colors.primary }]}>Enable</Text></Pressable> : null}</View>{phase === "ready" ? <SecondaryButton label="Test owner gateway" icon="telegram" onPress={() => router.push("/gateway-test" as never)} /> : null}</> : null}

        <SectionHeading eyebrow="HOST BOUNDARY" title="What runs here" />
        <View style={styles.boundaryGrid}>
          <PressableCard style={styles.boundaryCard}><View style={[styles.boundaryIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="lock" size={19} color={colors.primary} /></View><Text style={[styles.boundaryTitle, { color: colors.foreground }]}>App-private workspace</Text><Text style={[styles.boundaryDetail, { color: colors.muted }]}>Memory, schedules, and logs stay inside Pocket Hermes.</Text></PressableCard>
          <PressableCard style={styles.boundaryCard}><View style={[styles.boundaryIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="telegram" size={19} color={colors.primary} /></View><Text style={[styles.boundaryTitle, { color: colors.foreground }]}>Owner-only gateway</Text><Text style={[styles.boundaryDetail, { color: colors.muted }]}>Only your allowed Telegram chat can send instructions.</Text></PressableCard>
        </View>

        <SectionHeading eyebrow="LOCAL ACTIVITY" title="Host events" action={<Text style={[styles.countText, { color: colors.muted }]}>{events.length ? `${events.length} saved` : "No activity"}</Text>} />
        {events.length ? <PressableCard style={styles.eventCard}>{events.slice(0, 4).map((event, index) => <View key={event.id} style={[styles.eventRow, index !== 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.eventIcon, { backgroundColor: colors.background }]}><EventIcon severity={event.severity} /></View><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.foreground }]}>{event.title}</Text><Text style={[styles.eventDetail, { color: colors.muted }]} numberOfLines={2}>{event.detail}</Text></View><Text style={[styles.eventTime, { color: colors.muted }]}>{formatEventTime(event.createdAt)}</Text></View>)}</PressableCard> : (
          <PressableCard style={styles.emptyCard}><MaterialIcons name="history" size={22} color={colors.muted} /><View style={styles.eventCopy}><Text style={[styles.eventTitle, { color: colors.foreground }]}>No activity yet</Text><Text style={[styles.eventDetail, { color: colors.muted }]}>Your configuration and runtime events will be listed here.</Text></View></PressableCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function MetricCard({ icon, label, value, detail, color, colors }: { icon: ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; detail: string; color: string; colors: ReturnType<typeof useColors> }) {
  return <PressableCard style={styles.metricCard}><MaterialIcons name={icon} size={19} color={color} /><Text style={[styles.metricLabel, { color: colors.muted }]}>{label.toUpperCase()}</Text><Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1}>{value}</Text><Text style={[styles.metricDetail, { color: colors.muted }]} numberOfLines={1}>{detail}</Text></PressableCard>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 34, gap: 22 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandCopy: { gap: 4 }, wordmark: { fontSize: 17, fontWeight: "900", letterSpacing: 0.8 }, brandMeta: { flexDirection: "row", alignItems: "center", gap: 6 }, brandDot: { width: 6, height: 6, borderRadius: 3 }, caption: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  settingsButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 }, pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  hero: { minHeight: 236, borderRadius: 30, padding: 22, borderWidth: 1, overflow: "hidden", justifyContent: "space-between", gap: 17 }, heroAura: { width: 202, height: 202, borderRadius: 101, position: "absolute", right: -86, top: -58 },
  heroCopy: { gap: 12, maxWidth: "84%" }, heroTitle: { fontSize: 30, lineHeight: 35, fontWeight: "900", letterSpacing: -0.9 }, heroDetail: { fontSize: 14, lineHeight: 20, fontWeight: "500", maxWidth: "88%" },
  heroRail: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9, gap: 9 }, heroRailItem: { flexDirection: "row", alignItems: "center", gap: 5 }, heroRailText: { fontSize: 11, fontWeight: "800" }, heroRailDivider: { width: StyleSheet.hairlineWidth, height: 16 },
  shield: { position: "absolute", right: 18, bottom: 18, width: 55, height: 55, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionRow: { flexDirection: "row", gap: 10 }, primaryWrap: { flex: 1.38 }, secondaryWrap: { flex: 0.62 }, boundaryGrid: { flexDirection: "row", gap: 10 }, boundaryCard: { flex: 1, minHeight: 160, justifyContent: "space-between" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, metricCard: { width: "48.6%", gap: 5, minHeight: 126 }, metricLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 4 }, metricValue: { fontSize: 15, lineHeight: 19, fontWeight: "900" }, metricDetail: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  telemetryNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginTop: 1 }, telemetryNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" }, alertRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 3, marginTop: 2 }, alertCopy: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "700" }, alertAction: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }, alertActionText: { fontSize: 11, fontWeight: "900" },
  boundaryIcon: { width: 36, height: 36, borderRadius: 13, alignItems: "center", justifyContent: "center" }, boundaryTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900", marginTop: 8 }, boundaryDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, countText: { fontSize: 12, fontWeight: "700", paddingBottom: 2 },
  eventCard: { paddingVertical: 2, gap: 0 }, emptyCard: { flexDirection: "row", alignItems: "center", gap: 12 }, eventRow: { flexDirection: "row", gap: 10, paddingVertical: 14, alignItems: "flex-start" },
  eventIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" }, eventCopy: { flex: 1, gap: 3 }, eventTitle: { fontSize: 14, lineHeight: 18, fontWeight: "800" }, eventDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, eventTime: { fontSize: 11, fontWeight: "700", marginTop: 2 },
});
