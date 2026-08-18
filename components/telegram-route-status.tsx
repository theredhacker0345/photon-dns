import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { PressableCard, SecondaryButton } from "@/components/pocket-hermes-ui";
import { useColors } from "@/hooks/use-colors";
import { isSafeTelegramProxyConfiguration, type PublicTelegramProxyConfiguration, type TelegramProxyType } from "@/lib/host-contracts";
import type { GatewayTestInput, GatewayTestResult } from "@/lib/pocket-hermes-store";

type DraftTelegramProxy = Pick<PublicTelegramProxyConfiguration, "type" | "host" | "port">;

const routeLabel = (type: TelegramProxyType) => type === "none" ? "Direct" : type === "http" ? "HTTP proxy" : "SOCKS5 proxy";

export function TelegramRouteStatus({
  telegramToken,
  hasSavedTelegramToken,
  proxy,
  proxyCredential,
  testGateway,
}: {
  telegramToken: string;
  hasSavedTelegramToken: boolean;
  proxy: DraftTelegramProxy;
  proxyCredential: string;
  testGateway: (input?: GatewayTestInput) => Promise<GatewayTestResult>;
}) {
  const colors = useColors();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GatewayTestResult | null>(null);
  const normalizedProxy = useMemo(() => ({
    type: proxy.type,
    host: proxy.type === "none" ? "" : proxy.host.trim(),
    port: proxy.type === "none" ? null : proxy.port,
    hasCredentials: Boolean(proxyCredential.trim()),
  }), [proxy.host, proxy.port, proxy.type, proxyCredential]);
  const routeReady = isSafeTelegramProxyConfiguration(normalizedProxy);
  const canCheck = routeReady && (Boolean(telegramToken.trim()) || hasSavedTelegramToken);

  useEffect(() => {
    setResult(null);
  }, [hasSavedTelegramToken, normalizedProxy.host, normalizedProxy.port, normalizedProxy.type, proxyCredential, telegramToken]);

  const checkRoute = async () => {
    if (!canCheck || checking) return;
    setChecking(true);
    try {
      setResult(await testGateway({
        telegramToken,
        telegramProxy: { type: normalizedProxy.type, host: normalizedProxy.host, port: normalizedProxy.port },
        telegramProxyCredential: proxyCredential,
      }));
    } finally {
      setChecking(false);
    }
  };

  const status = checking
    ? { icon: "sync" as const, color: colors.primary, title: `Checking ${routeLabel(proxy.type)}…`, detail: Platform.OS === "web" && proxy.type !== "none" ? "The installed Android build is required to run a proxy route check." : "Verifying the bot token through this route. No Telegram message is sent." }
    : result
      ? { icon: result.ok ? "check-circle" as const : "error-outline" as const, color: result.ok ? colors.success : colors.error, title: result.ok ? `${routeLabel(proxy.type)} reachable` : `${routeLabel(proxy.type)} needs attention`, detail: result.ok && result.botName ? `${result.message} Connected as ${result.botName}.` : result.message }
      : !routeReady
        ? { icon: "error-outline" as const, color: colors.warning, title: `${routeLabel(proxy.type)} needs a valid endpoint`, detail: "Enter a hostname and port from 1 to 65535, or select Direct." }
        : !(telegramToken.trim() || hasSavedTelegramToken)
          ? { icon: "vpn-key" as const, color: colors.warning, title: `${routeLabel(proxy.type)} is waiting for a bot token`, detail: "Add a bot token to run a live route check." }
          : { icon: "network-check" as const, color: colors.muted, title: `${routeLabel(proxy.type)} ready to verify`, detail: "Run a live credential check before saving or starting the gateway." };

  return (
    <PressableCard style={[styles.card, { backgroundColor: `${status.color}10`, borderColor: `${status.color}35` }]}>
      <View style={[styles.icon, { backgroundColor: `${status.color}18` }]}>{checking ? <ActivityIndicator size="small" color={status.color} /> : <MaterialIcons name={status.icon} size={19} color={status.color} />}</View>
      <View style={styles.copy}><Text style={[styles.title, { color: colors.foreground }]}>{status.title}</Text><Text style={[styles.detail, { color: colors.muted }]}>{status.detail}</Text></View>
      <SecondaryButton label={checking ? `Checking ${proxy.type === "none" ? "Direct" : proxy.type.toUpperCase()}…` : `Check ${proxy.type === "none" ? "Direct" : proxy.type.toUpperCase()}`} icon="network-check" onPress={() => void checkRoute()} loading={checking} disabled={!canCheck || checking} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, padding: 12 },
  icon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 12, lineHeight: 16, fontWeight: "900" },
  detail: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
});
