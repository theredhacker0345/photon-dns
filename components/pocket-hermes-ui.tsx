import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { HostPhase } from "@/lib/pocket-hermes-store";

export function PressableCard({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }, style, onPress && pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export function PageHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string; icon: keyof typeof MaterialIcons.glyphMap }) {
  const colors = useColors();
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderCopy}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.pageDetail, { color: colors.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

export function RuntimePill({ phase }: { phase: HostPhase }) {
  const colors = useColors();
  const definition = {
    unconfigured: { label: "SETUP REQUIRED", color: colors.warning },
    ready: { label: "HOST READY", color: colors.success },
    running: { label: "SUPERVISOR LIVE", color: colors.success },
    bridge_required: { label: "BRIDGE PENDING", color: colors.primary },
    stopped: { label: "HOST PAUSED", color: colors.muted },
  }[phase];
  return <View style={[styles.pill, { backgroundColor: `${definition.color}1A` }]}><View style={[styles.dot, { backgroundColor: definition.color }]} /><Text style={[styles.pillText, { color: definition.color }]}>{definition.label}</Text></View>;
}

export function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  const colors = useColors();
  return <View style={styles.sectionHeading}><View style={styles.headingCopy}>{eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}<Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text></View>{action}</View>;
}

export function EventIcon({ severity }: { severity: "info" | "success" | "warning" }) {
  const colors = useColors();
  const icon = severity === "success" ? "verified" : severity === "warning" ? "priority-high" : "info-outline";
  const color = severity === "success" ? colors.success : severity === "warning" ? colors.warning : colors.primary;
  return <MaterialIcons name={icon} size={18} color={color} />;
}

export function PrimaryButton({ label, icon, onPress, disabled = false, accessibilityLabel }: { label: string; icon?: keyof typeof MaterialIcons.glyphMap; onPress: () => void; disabled?: boolean; accessibilityLabel?: string }) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>{icon ? <MaterialIcons name={icon} size={19} color="#FFFFFF" /> : null}<Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

export function SecondaryButton({ label, icon, onPress, danger = false, disabled = false, loading = false, accessibilityLabel }: { label: string; icon?: keyof typeof MaterialIcons.glyphMap; onPress: () => void; danger?: boolean; disabled?: boolean; loading?: boolean; accessibilityLabel?: string }) {
  const colors = useColors();
  const color = danger ? colors.error : colors.foreground;
  const unavailable = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: unavailable, busy: loading }} disabled={unavailable} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, { borderColor: danger ? `${colors.error}66` : colors.border, backgroundColor: colors.surfaceInset }, unavailable && styles.disabled, pressed && !unavailable && styles.pressed]}>{loading ? <ActivityIndicator size="small" color={color} /> : icon ? <MaterialIcons name={icon} size={18} color={color} /> : null}<Text style={[styles.secondaryButtonText, { color }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  pageHeader: { alignItems: "flex-start" },
  pageHeaderCopy: { gap: 3 },
  pageTitle: { fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.55 },
  pageDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", maxWidth: 330 },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  headingCopy: { gap: 3, flexShrink: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.1, fontWeight: "800" },
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  primaryButton: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1 },
  secondaryButtonText: { fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
