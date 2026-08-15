import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";

import { PressableCard, PrimaryButton, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { usePocketHermes } from "@/lib/pocket-hermes-store";

export default function GatewayTestScreen() {
  const colors = useColors();
  const { config, testGateway } = usePocketHermes();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; botName?: string } | null>(null);

  const runCheck = async () => {
    setChecking(true);
    setResult(await testGateway());
    setChecking(false);
  };

  return <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><View style={styles.topline}><SecondaryButton label="Back" icon="arrow-back" onPress={() => router.back()} /><Text style={[styles.caption, { color: colors.muted }]}>FINAL CONFIRMATION</Text></View><View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="verified-user" size={29} color={colors.primary} /></View><Text style={[styles.eyebrow, { color: colors.primary }]}>GATEWAY CHECK</Text><Text style={[styles.title, { color: colors.foreground }]}>Confirm your private route.</Text><Text style={[styles.detail, { color: colors.muted }]}>Pocket Hermes can safely verify the saved Telegram bot credential before you hand this phone its host role.</Text></View><PressableCard style={styles.card}><View style={[styles.rowIcon, { backgroundColor: `${colors.success}14` }]}><MaterialIcons name="lock" size={20} color={colors.success} /></View><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>What this checks</Text><Text style={[styles.cardDetail, { color: colors.muted }]}>It asks Telegram to identify the saved bot. It does not send a message, read chat history, or expose your token.</Text></View></PressableCard><PressableCard style={styles.card}><View style={[styles.rowIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="person" size={20} color={colors.primary} /></View><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Owner lock staged</Text><Text style={[styles.cardDetail, { color: colors.muted }]}>Chat {config.allowedChatId || "not configured"} is the only allowed owner route. The embedded gateway enforces this lock when it starts.</Text></View></PressableCard>{result ? <View style={[styles.result, { backgroundColor: `${result.ok ? colors.success : colors.error}12`, borderColor: `${result.ok ? colors.success : colors.error}33` }]}><MaterialIcons name={result.ok ? "check-circle" : "error-outline"} size={22} color={result.ok ? colors.success : colors.error} /><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{result.ok ? `${result.botName ?? "Bot"} is verified` : "Gateway check needs attention"}</Text><Text style={[styles.cardDetail, { color: colors.muted }]}>{result.message}</Text></View></View> : null}<View style={styles.actions}><PrimaryButton label={checking ? "Checking Telegram…" : "Test gateway safely"} icon="telegram" onPress={runCheck} disabled={checking || !config.hasTelegramToken} />{checking ? <ActivityIndicator color={colors.primary} /> : null}{result?.ok ? <SecondaryButton label="Open host dashboard" icon="dashboard" onPress={() => router.replace("/(tabs)" as never)} /> : null}</View><Text style={[styles.footer, { color: colors.muted }]}>Connection testing uses the protected token only in memory. Pocket Hermes never shows it on screen or stores it in activity history.</Text></ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 28, gap: 14 }, topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, caption: { fontSize: 10, fontWeight: "900", letterSpacing: 1 }, hero: { borderWidth: 1, borderRadius: 28, padding: 22, gap: 9 }, icon: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 2 }, eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1 }, title: { fontSize: 29, lineHeight: 34, fontWeight: "900", letterSpacing: -0.8 }, detail: { fontSize: 14, lineHeight: 20, fontWeight: "500" }, card: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 3 }, cardTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, cardDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, result: { flexDirection: "row", borderWidth: 1, borderRadius: 18, padding: 15, gap: 11, alignItems: "flex-start" }, actions: { gap: 11, alignItems: "center", marginTop: 4 }, footer: { fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center", paddingHorizontal: 10, marginTop: 3 },
});
