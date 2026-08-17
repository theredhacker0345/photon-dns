import { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";

import { PressableCard, PrimaryButton, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { type HostReadiness, useHostReadiness } from "@/hooks/use-host-readiness";
import { isValidTelegramChatId } from "@/lib/pocket-hermes-policy";
import { usePocketHermes } from "@/lib/pocket-hermes-store";

type SetupStep = 0 | 1 | 2 | 3;

const steps = [
  { number: "01", label: "Device", title: "Name and protect this host", detail: "Pocket Hermes stays app-private. The phone owner controls when its embedded runtime may run.", icon: "phone-android" as const },
  { number: "02", label: "Telegram", title: "Lock remote access to you", detail: "Your bot only accepts messages from the owner chat ID you choose here.", icon: "lock" as const },
  { number: "03", label: "Model", title: "Choose a model connection", detail: "A model endpoint is optional for setup. It will only be used by the embedded runtime in a native build.", icon: "hub" as const },
  { number: "04", label: "Policy", title: "Set host behavior", detail: "Review the local boundaries before Pocket Hermes prepares the private runtime.", icon: "verified-user" as const },
];

export default function HostSetupScreen() {
  const colors = useColors();
  const { config, saveConfiguration } = usePocketHermes();
  const [step, setStep] = useState<SetupStep>(0);
  const [hostName, setHostName] = useState(config.hostName);
  const [allowedChatId, setAllowedChatId] = useState(config.allowedChatId);
  const [modelEndpoint, setModelEndpoint] = useState(config.modelEndpoint);
  const [modelName, setModelName] = useState(config.modelName);
  const [modelApiKey, setModelApiKey] = useState("");
  const [token, setToken] = useState("");
  const [chargingAware, setChargingAware] = useState(true);
  const [restartAfterBoot, setRestartAfterBoot] = useState(config.policy.restartAfterBoot);
  const [saving, setSaving] = useState(false);
  const readiness = useHostReadiness();

  const current = steps[step];
  const hasUsableToken = Boolean(token.trim()) || config.hasTelegramToken;
  const stepReady = useMemo(() => {
    if (step === 0) return Boolean(hostName.trim());
    if (step === 1) return hasUsableToken && isValidTelegramChatId(allowedChatId.trim());
    if (step === 2) return !modelEndpoint.trim() || /^https:\/\//i.test(modelEndpoint.trim());
    return true;
  }, [allowedChatId, hasUsableToken, hostName, modelEndpoint, step]);

  const validationHint = step === 0
    ? "Give this phone a recognisable name."
    : step === 1
      ? !hasUsableToken ? "Add a Telegram bot token to continue." : "Use a numeric owner chat ID. Group IDs may begin with a minus sign."
      : step === 2 && modelEndpoint.trim() && !/^https:\/\//i.test(modelEndpoint.trim())
        ? "Use a full HTTPS URL."
        : "";

  const continueSetup = async () => {
    if (!stepReady) return;
    if (step < 3) {
      setStep((currentStep) => (currentStep + 1) as SetupStep);
      return;
    }
    setSaving(true);
    const result = await saveConfiguration({
      hostName,
      allowedChatId,
      modelEndpoint,
      modelName,
      modelApiKey,
      telegramToken: token,
      policy: { ...config.policy, chargingAware, restartAfterBoot },
    });
    setSaving(false);
    if (!result.ok) {
      Alert.alert("Check your setup", result.message);
      setStep(1);
      return;
    }
    setToken("");
    setModelApiKey("");
    Alert.alert("Protected setup saved", "Run a safe Telegram credential check before opening the host dashboard.", [{ text: "Test gateway", onPress: () => router.replace("/gateway-test" as never) }]);
  };

  return (
    <ScreenContainer className="px-5" edges={["top", "bottom", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topline}>
          <SecondaryButton label="Exit setup" icon="close" onPress={() => router.back()} />
          <Text style={[styles.stepCounter, { color: colors.muted }]}>STEP {step + 1} OF 4</Text>
        </View>

        <View style={styles.progressRow} accessibilityLabel={`Host setup step ${step + 1} of 4`}>
          {steps.map((item, index) => {
            const active = index === step;
            const complete = index < step;
            return <View key={item.label} style={styles.progressItem}><View style={[styles.progressDot, { backgroundColor: complete || active ? colors.primary : colors.surface, borderColor: complete || active ? colors.primary : colors.border }]}>{complete ? <MaterialIcons name="check" size={14} color="#FFFFFF" /> : <Text style={[styles.progressNumber, { color: active ? "#FFFFFF" : colors.muted }]}>{index + 1}</Text>}</View><Text style={[styles.progressLabel, { color: active ? colors.foreground : colors.muted }]}>{item.label}</Text></View>;
          })}
        </View>

        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroAura, { backgroundColor: `${colors.primary}18` }]} />
          <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name={current.icon} size={25} color={colors.primary} /></View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{current.number} · {current.label.toUpperCase()}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{current.title}</Text>
          <Text style={[styles.detail, { color: colors.muted }]}>{current.detail}</Text>
        </View>

        {step === 0 ? <DeviceStep hostName={hostName} setHostName={setHostName} colors={colors} /> : null}
        {step === 1 ? <TelegramStep token={token} setToken={setToken} allowedChatId={allowedChatId} setAllowedChatId={setAllowedChatId} hasTelegramToken={config.hasTelegramToken} colors={colors} /> : null}
        {step === 2 ? <ModelStep modelEndpoint={modelEndpoint} setModelEndpoint={setModelEndpoint} modelName={modelName} setModelName={setModelName} modelApiKey={modelApiKey} setModelApiKey={setModelApiKey} hasModelApiKey={config.hasModelApiKey} colors={colors} /> : null}
        {step === 3 ? <PolicyStep chargingAware={chargingAware} setChargingAware={setChargingAware} restartAfterBoot={restartAfterBoot} setRestartAfterBoot={setRestartAfterBoot} hostName={hostName} hasToken={hasUsableToken} allowedChatId={allowedChatId} modelEndpoint={modelEndpoint} readiness={readiness} colors={colors} /> : null}

        {validationHint ? <View style={[styles.validation, { backgroundColor: `${colors.warning}14` }]}><MaterialIcons name="info-outline" size={18} color={colors.warning} /><Text style={[styles.validationText, { color: colors.warning }]}>{validationHint}</Text></View> : null}

        <View style={styles.actions}>
          {step > 0 ? <View style={styles.backWrap}><SecondaryButton label="Back" icon="arrow-back" onPress={() => setStep((currentStep) => (currentStep - 1) as SetupStep)} /></View> : null}
          <View style={styles.continueWrap}><PrimaryButton label={step === 3 ? (saving ? "Saving protected setup…" : "Finish secure setup") : "Continue"} icon={step === 3 ? "verified-user" : "arrow-forward"} onPress={continueSetup} disabled={!stepReady || saving} /></View>
        </View>
        <Text style={[styles.footer, { color: colors.muted }]}>Credentials are protected with Android Keystore in native builds. {Platform.OS === "web" ? "This browser preview uses temporary session storage." : "Secrets never enter normal app preferences or activity history."}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function DeviceStep({ hostName, setHostName, colors }: { hostName: string; setHostName: (value: string) => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.stepContent}><FieldLabel label="Host name" color={colors.muted} /><TextInput value={hostName} onChangeText={setHostName} placeholder="e.g. Living room host" placeholderTextColor={colors.muted} returnKeyType="done" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><PressableCard style={styles.infoCard}><View style={[styles.infoIcon, { backgroundColor: `${colors.success}16` }]}><MaterialIcons name="enhanced-encryption" size={19} color={colors.success} /></View><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Private by default</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>The bundled Hermes workspace, schedules, and logs remain inside this app’s private storage.</Text></View></PressableCard></View>;
}

function TelegramStep({ token, setToken, allowedChatId, setAllowedChatId, hasTelegramToken, colors }: { token: string; setToken: (value: string) => void; allowedChatId: string; setAllowedChatId: (value: string) => void; hasTelegramToken: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.stepContent}><PressableCard style={[styles.statusCard, { backgroundColor: `${colors.success}0E`, borderColor: `${colors.success}2A` }]}><MaterialIcons name={hasTelegramToken ? "lock" : "vpn-key"} size={19} color={colors.success} /><Text style={[styles.statusText, { color: colors.foreground }]}>{hasTelegramToken ? "A protected bot token is already saved." : "Your token is encrypted immediately after setup."}</Text></PressableCard><FieldLabel label="Telegram bot token" color={colors.muted} /><TextInput value={token} onChangeText={setToken} placeholder={hasTelegramToken ? "Leave blank to keep saved token" : "Paste token from BotFather"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label="Allowed owner chat ID" color={colors.muted} /><TextInput value={allowedChatId} onChangeText={setAllowedChatId} placeholder="e.g. 123456789" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><PressableCard style={[styles.chatHelp, { backgroundColor: `${colors.primary}0C`, borderColor: `${colors.primary}22` }]}><MaterialIcons name="help-outline" size={19} color={colors.primary} /><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>How to find your chat ID</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>Open Telegram, message @userinfobot, then copy its numeric ID here. For a group, add the bot first—the ID may begin with a minus sign.</Text></View></PressableCard><Text style={[styles.helper, { color: colors.muted }]}>The embedded gateway must reject every incoming chat except this owner allowlist.</Text></View>;
}

function ModelStep({ modelEndpoint, setModelEndpoint, modelName, setModelName, modelApiKey, setModelApiKey, hasModelApiKey, colors }: { modelEndpoint: string; setModelEndpoint: (value: string) => void; modelName: string; setModelName: (value: string) => void; modelApiKey: string; setModelApiKey: (value: string) => void; hasModelApiKey: boolean; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.stepContent}><FieldLabel label="Model endpoint · HTTPS" color={colors.muted} /><TextInput value={modelEndpoint} onChangeText={setModelEndpoint} placeholder="https://your-provider.example/v1" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label="Model name" color={colors.muted} /><TextInput value={modelName} onChangeText={setModelName} placeholder="e.g. gpt-4o-mini" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label="Model API key" color={colors.muted} /><TextInput value={modelApiKey} onChangeText={setModelApiKey} placeholder={hasModelApiKey ? "Leave blank to keep saved key" : "Paste provider API key"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><Text style={[styles.helper, { color: colors.muted }]}>The worker will not start until the endpoint, model name, and protected model key are saved. Model computation stays with your selected provider; the host remains on this phone.</Text><PressableCard style={styles.infoCard}><View style={[styles.infoIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="memory" size={19} color={colors.primary} /></View><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Keep the first install lightweight</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>No local model files are added during initial setup. Optional offline models remain a later, explicit download.</Text></View></PressableCard></View>;
}

function PolicyStep({ chargingAware, setChargingAware, restartAfterBoot, setRestartAfterBoot, hostName, hasToken, allowedChatId, modelEndpoint, readiness, colors }: { chargingAware: boolean; setChargingAware: (value: boolean) => void; restartAfterBoot: boolean; setRestartAfterBoot: (value: boolean) => void; hostName: string; hasToken: boolean; allowedChatId: string; modelEndpoint: string; readiness: HostReadiness; colors: ReturnType<typeof useColors> }) {
  const storageValue = readiness.freeStorageBytes === null ? "Checking storage…" : `${(readiness.freeStorageBytes / 1024 / 1024 / 1024).toFixed(1)} GB free`;
  return <View style={styles.stepContent}><PressableCard style={styles.policyRow}><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Charging-aware host mode</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>Recommend power before a long-running agent session and surface readiness clearly.</Text></View><Switch value={chargingAware} onValueChange={setChargingAware} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={chargingAware ? colors.success : colors.muted} /></PressableCard><PressableCard style={styles.policyRow}><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Restart after boot</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>After device unlock, an enabled host can restore its protected foreground session.</Text></View><Switch value={restartAfterBoot} onValueChange={setRestartAfterBoot} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={restartAfterBoot ? colors.success : colors.muted} /></PressableCard><View style={styles.readinessGrid}><PressableCard style={styles.readinessCard}><MaterialIcons name="battery-charging-full" size={20} color={readiness.isCharging ? colors.success : colors.warning} /><Text style={[styles.readinessLabel, { color: colors.foreground }]}>Power</Text><Text style={[styles.readinessDetail, { color: colors.muted }]}>{readiness.batteryPercent === null ? readiness.chargingLabel : `${readiness.batteryPercent}% · ${readiness.chargingLabel}`}</Text></PressableCard><PressableCard style={styles.readinessCard}><MaterialIcons name="storage" size={20} color={readiness.storageReady ? colors.success : colors.warning} /><Text style={[styles.readinessLabel, { color: colors.foreground }]}>Storage</Text><Text style={[styles.readinessDetail, { color: colors.muted }]}>{storageValue}</Text></PressableCard></View><View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.summaryEyebrow, { color: colors.muted }]}>HOST READINESS</Text><SummaryRow icon="phone-android" label="Device" value={hostName.trim() || "Pocket Hermes"} ok colors={colors} /><SummaryRow icon="telegram" label="Owner gateway" value={hasToken && isValidTelegramChatId(allowedChatId.trim()) ? "Locked to one chat" : "Needs attention"} ok={hasToken && isValidTelegramChatId(allowedChatId.trim())} colors={colors} /><SummaryRow icon="battery-charging-full" label="Power" value={readiness.chargingLabel} ok={readiness.isCharging === true || !chargingAware} colors={colors} /><SummaryRow icon="storage" label="Storage" value={storageValue} ok={readiness.storageReady !== false} colors={colors} /><SummaryRow icon="terminal" label="Runtime" value="Private bundle, no Termux" ok colors={colors} /></View></View>;
}

function SummaryRow({ icon, label, value, ok, colors }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; ok: boolean; colors: ReturnType<typeof useColors> }) { return <View style={styles.summaryRow}><MaterialIcons name={icon} size={18} color={ok ? colors.success : colors.warning} /><View style={styles.summaryCopy}><Text style={[styles.summaryLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.summaryValue, { color: colors.muted }]}>{value}</Text></View><MaterialIcons name={ok ? "check-circle" : "error-outline"} size={19} color={ok ? colors.success : colors.warning} /></View>; }
function FieldLabel({ label, color }: { label: string; color: string }) { return <Text style={[styles.fieldLabel, { color }]}>{label.toUpperCase()}</Text>; }

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 26, gap: 19 }, topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, stepCounter: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5 }, progressItem: { alignItems: "center", gap: 6, minWidth: 53 }, progressDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" }, progressNumber: { fontSize: 12, fontWeight: "900" }, progressLabel: { fontSize: 10, fontWeight: "800" },
  hero: { borderWidth: 1, borderRadius: 28, padding: 22, gap: 10, overflow: "hidden" }, heroAura: { position: "absolute", width: 170, height: 170, borderRadius: 85, right: -60, top: -55 }, heroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 2 }, eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.15 }, title: { fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.7, maxWidth: "92%" }, detail: { fontSize: 14, lineHeight: 20, fontWeight: "500", maxWidth: "91%" },
  stepContent: { gap: 9 }, fieldLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" }, helper: { fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 1 },
  infoCard: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 5 }, infoIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" }, infoCopy: { flex: 1, gap: 3 }, infoTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, infoDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, statusCard: { flexDirection: "row", gap: 9, alignItems: "center", borderWidth: 1 }, statusText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" }, chatHelp: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1 },
  readinessGrid: { flexDirection: "row", gap: 9 }, readinessCard: { flex: 1, gap: 5, minHeight: 116 }, readinessLabel: { fontSize: 13, fontWeight: "900" }, readinessDetail: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  policyRow: { flexDirection: "row", gap: 12, alignItems: "center" }, summary: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 12, marginTop: 3 }, summaryEyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: "900" }, summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 }, summaryCopy: { flex: 1, gap: 1 }, summaryLabel: { fontSize: 13, fontWeight: "800" }, summaryValue: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  validation: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 14, padding: 11 }, validationText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" }, actions: { flexDirection: "row", gap: 10, alignItems: "stretch" }, backWrap: { flex: 0.6 }, continueWrap: { flex: 1.4 }, footer: { fontSize: 11, lineHeight: 16, fontWeight: "500", textAlign: "center", paddingHorizontal: 12 },
});
