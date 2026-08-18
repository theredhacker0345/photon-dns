import { useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";

import { PressableCard, PrimaryButton, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { type HostReadiness, useHostReadiness } from "@/hooks/use-host-readiness";
import { ModelCatalog } from "@/components/model-catalog";
import { ModelProviderPicker } from "@/components/model-provider-picker";
import { TelegramRouteStatus } from "@/components/telegram-route-status";
import { isAllowedModelEndpoint, isSafeTelegramProxyConfiguration, requiresModelApiKey, type ModelProviderId, type TelegramProxyType } from "@/lib/host-contracts";
import { getProviderPreset, type ModelCatalogEntry } from "@/lib/model-providers";
import { isValidTelegramChatId } from "@/lib/pocket-hermes-policy";
import { usePocketHermes } from "@/lib/pocket-hermes-store";

type SetupStep = 0 | 1 | 2 | 3;

const steps = [
  { number: "01", label: "Device", title: "Name and protect this host", detail: "Pocket Relay stays app-private. The phone owner controls when its embedded runtime may run.", icon: "phone-android" as const },
  { number: "02", label: "Telegram", title: "Lock remote access to you", detail: "Your bot only accepts messages from the owner chat ID you choose here.", icon: "lock" as const },
  { number: "03", label: "Model", title: "Choose a model connection", detail: "A model endpoint is optional for setup. It will only be used by the embedded runtime in a native build.", icon: "hub" as const },
  { number: "04", label: "Policy", title: "Set host behavior", detail: "Review the local boundaries before Pocket Relay prepares the private runtime.", icon: "verified-user" as const },
];

export default function HostSetupScreen() {
  const colors = useColors();
  const { config, modelCatalog, modelCatalogFetchedAt, providerConnection, saveConfiguration, discoverModels, testGateway } = usePocketHermes();
  const [step, setStep] = useState<SetupStep>(0);
  const [hostName, setHostName] = useState(config.hostName);
  const [allowedChatId, setAllowedChatId] = useState(config.allowedChatId);
  const [modelProvider, setModelProvider] = useState<ModelProviderId>(config.modelProvider);
  const [modelEndpoint, setModelEndpoint] = useState(config.modelEndpoint);
  const [modelName, setModelName] = useState(config.modelName);
  const [modelApiKey, setModelApiKey] = useState("");
  const [token, setToken] = useState("");
  const [telegramProxyType, setTelegramProxyType] = useState<TelegramProxyType>(config.telegramProxy.type);
  const [telegramProxyHost, setTelegramProxyHost] = useState(config.telegramProxy.host);
  const [telegramProxyPort, setTelegramProxyPort] = useState(config.telegramProxy.port?.toString() ?? "");
  const [telegramProxyCredential, setTelegramProxyCredential] = useState("");
  const [chargingAware, setChargingAware] = useState(true);
  const [restartAfterBoot, setRestartAfterBoot] = useState(config.policy.restartAfterBoot);
  const [saving, setSaving] = useState(false);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const readiness = useHostReadiness();
  const telegramProxy = useMemo(() => ({
    type: telegramProxyType,
    host: telegramProxyType === "none" ? "" : telegramProxyHost.trim(),
    port: telegramProxyType === "none" ? null : Number(telegramProxyPort),
    hasCredentials: config.telegramProxy.hasCredentials || Boolean(telegramProxyCredential.trim()),
  }), [config.telegramProxy.hasCredentials, telegramProxyCredential, telegramProxyHost, telegramProxyPort, telegramProxyType]);

  const selectProvider = (provider: ModelProviderId) => {
    setModelProvider(provider);
    setModelEndpoint(getProviderPreset(provider).defaultEndpoint);
    setModelName("");
  };

  const refreshModels = async () => {
    setDiscoveringModels(true);
    const result = await discoverModels({ provider: modelProvider, endpoint: modelEndpoint, apiKey: modelApiKey });
    setDiscoveringModels(false);
    if (!result.ok) Alert.alert("Model catalog unavailable", result.message);
  };

  const selectModel = (model: ModelCatalogEntry) => setModelName(model.id);

  const current = steps[step];
  const hasUsableToken = Boolean(token.trim()) || config.hasTelegramToken;
  const stepReady = useMemo(() => {
    if (step === 0) return Boolean(hostName.trim());
    if (step === 1) return hasUsableToken && isValidTelegramChatId(allowedChatId.trim()) && isSafeTelegramProxyConfiguration(telegramProxy);
    if (step === 2) return Boolean(modelEndpoint.trim()) && isAllowedModelEndpoint(modelEndpoint, modelProvider) && Boolean(modelName.trim()) && (!requiresModelApiKey(modelProvider) || Boolean(modelApiKey.trim()) || config.hasModelApiKey);
    return true;
  }, [allowedChatId, config.hasModelApiKey, hasUsableToken, hostName, modelApiKey, modelEndpoint, modelName, modelProvider, step, telegramProxy]);

  const validationHint = step === 0
    ? "Give this phone a recognisable name."
    : step === 1
      ? !hasUsableToken ? "Add a Telegram bot token to continue." : !isValidTelegramChatId(allowedChatId.trim()) ? "Use a positive numeric owner chat ID. Groups are intentionally rejected." : !isSafeTelegramProxyConfiguration(telegramProxy) ? "Choose None or provide a proxy hostname and port from 1 to 65535." : ""
      : step === 2 && !modelEndpoint.trim()
        ? "Choose a provider endpoint."
      : step === 2 && !isAllowedModelEndpoint(modelEndpoint, modelProvider)
          ? requiresModelApiKey(modelProvider) ? "Use a full HTTPS URL." : "Use a numeric private-LAN HTTP address or HTTPS URL."
          : step === 2 && requiresModelApiKey(modelProvider) && !modelApiKey.trim() && !config.hasModelApiKey
            ? "Add the provider token, refresh the catalog, and choose a model."
            : step === 2 && !modelName.trim()
              ? "Refresh the catalog and choose a model before continuing."
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
      modelProvider,
      modelEndpoint,
      modelName,
      modelApiKey,
      telegramToken: token,
      telegramProxy: { type: telegramProxy.type, host: telegramProxy.host, port: telegramProxy.port },
      telegramProxyCredential,
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
    setTelegramProxyCredential("");
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
        {step === 1 ? <TelegramStep token={token} setToken={setToken} allowedChatId={allowedChatId} setAllowedChatId={setAllowedChatId} hasTelegramToken={config.hasTelegramToken} proxyType={telegramProxyType} setProxyType={setTelegramProxyType} proxyHost={telegramProxyHost} setProxyHost={setTelegramProxyHost} proxyPort={telegramProxyPort} setProxyPort={setTelegramProxyPort} proxyCredential={telegramProxyCredential} setProxyCredential={setTelegramProxyCredential} hasProxyCredential={config.telegramProxy.hasCredentials} testGateway={testGateway} colors={colors} /> : null}
        {step === 2 ? <ModelStep modelProvider={modelProvider} setModelProvider={selectProvider} modelEndpoint={modelEndpoint} setModelEndpoint={setModelEndpoint} modelName={modelName} setModelName={setModelName} modelApiKey={modelApiKey} setModelApiKey={setModelApiKey} hasModelApiKey={config.hasModelApiKey} modelCatalog={modelCatalog} modelCatalogFetchedAt={modelCatalogFetchedAt} providerConnection={providerConnection} discoveringModels={discoveringModels} refreshModels={refreshModels} selectModel={selectModel} colors={colors} /> : null}
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

function TelegramStep({ token, setToken, allowedChatId, setAllowedChatId, hasTelegramToken, proxyType, setProxyType, proxyHost, setProxyHost, proxyPort, setProxyPort, proxyCredential, setProxyCredential, hasProxyCredential, testGateway, colors }: { token: string; setToken: (value: string) => void; allowedChatId: string; setAllowedChatId: (value: string) => void; hasTelegramToken: boolean; proxyType: TelegramProxyType; setProxyType: (value: TelegramProxyType) => void; proxyHost: string; setProxyHost: (value: string) => void; proxyPort: string; setProxyPort: (value: string) => void; proxyCredential: string; setProxyCredential: (value: string) => void; hasProxyCredential: boolean; testGateway: ReturnType<typeof usePocketHermes>["testGateway"]; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.stepContent}><PressableCard style={[styles.statusCard, { backgroundColor: `${colors.success}0E`, borderColor: `${colors.success}2A` }]}><MaterialIcons name={hasTelegramToken ? "lock" : "vpn-key"} size={19} color={colors.success} /><Text style={[styles.statusText, { color: colors.foreground }]}>{hasTelegramToken ? "A protected bot token is already saved." : "Your token is encrypted immediately after setup."}</Text></PressableCard><FieldLabel label="Telegram bot token" color={colors.muted} /><TextInput value={token} onChangeText={setToken} placeholder={hasTelegramToken ? "Leave blank to keep saved token" : "Paste token from BotFather"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label="Allowed owner user ID" color={colors.muted} /><TextInput value={allowedChatId} onChangeText={setAllowedChatId} placeholder="e.g. 123456789" placeholderTextColor={colors.muted} keyboardType="number-pad" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><PressableCard style={[styles.chatHelp, { backgroundColor: `${colors.primary}0C`, borderColor: `${colors.primary}22` }]}><MaterialIcons name="help-outline" size={19} color={colors.primary} /><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>How to find your private user ID</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>Open Telegram, message @userinfobot, then copy its positive numeric user ID here. Groups and negative chat IDs are intentionally rejected.</Text></View></PressableCard><FieldLabel label="Telegram network route · optional" color={colors.muted} /><View style={styles.proxySelector}>{(["none", "http", "socks5"] as TelegramProxyType[]).map((mode) => { const selected = proxyType === mode; return <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setProxyType(mode)} style={({ pressed }) => [styles.proxyOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}16` : colors.background }, pressed && styles.proxyOptionPressed]}><Text style={[styles.proxyOptionText, { color: selected ? colors.primary : colors.foreground }]}>{mode === "none" ? "None" : mode === "http" ? "HTTP" : "SOCKS5"}</Text></Pressable>; })}</View>{proxyType !== "none" ? <><FieldLabel label="Proxy hostname" color={colors.muted} /><TextInput value={proxyHost} onChangeText={setProxyHost} placeholder="proxy.example.net" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label="Proxy port" color={colors.muted} /><TextInput value={proxyPort} onChangeText={setProxyPort} placeholder="1080" placeholderTextColor={colors.muted} keyboardType="number-pad" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label={hasProxyCredential ? "Replace proxy username:password · optional" : "Proxy username:password · optional"} color={colors.muted} /><TextInput value={proxyCredential} onChangeText={setProxyCredential} placeholder={hasProxyCredential ? "Leave blank to keep protected credential" : "username:password"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></> : null}<Text style={[styles.helper, { color: colors.muted }]}>The proxy is used only for Telegram. Model and HTTPS MCP traffic never inherit this route; proxy credentials stay protected.</Text><TelegramRouteStatus telegramToken={token} hasSavedTelegramToken={hasTelegramToken} proxy={{ type: proxyType, host: proxyHost, port: proxyType === "none" ? null : Number(proxyPort) }} proxyCredential={proxyCredential} testGateway={testGateway} /></View>;
}

function ModelStep({ modelProvider, setModelProvider, modelEndpoint, setModelEndpoint, modelName, setModelName, modelApiKey, setModelApiKey, hasModelApiKey, modelCatalog, modelCatalogFetchedAt, providerConnection, discoveringModels, refreshModels, selectModel, colors }: { modelProvider: ModelProviderId; setModelProvider: (value: ModelProviderId) => void; modelEndpoint: string; setModelEndpoint: (value: string) => void; modelName: string; setModelName: (value: string) => void; modelApiKey: string; setModelApiKey: (value: string) => void; hasModelApiKey: boolean; modelCatalog: ModelCatalogEntry[]; modelCatalogFetchedAt: string | null; providerConnection: import("@/lib/model-providers").ProviderConnectionStatus; discoveringModels: boolean; refreshModels: () => Promise<void>; selectModel: (model: ModelCatalogEntry) => void; colors: ReturnType<typeof useColors> }) {
  const needsToken = requiresModelApiKey(modelProvider);
  return <View style={styles.stepContent}><FieldLabel label="AI model provider" color={colors.muted} /><ModelProviderPicker selected={modelProvider} onChange={setModelProvider} colors={colors} /><FieldLabel label={needsToken ? "Model endpoint · HTTPS" : "Model endpoint · private LAN"} color={colors.muted} /><TextInput value={modelEndpoint} onChangeText={setModelEndpoint} placeholder={needsToken ? "https://your-provider.example/v1" : "http://192.168.1.20:11434/v1"} placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><FieldLabel label={needsToken ? "Provider API token" : "Provider API token · optional"} color={colors.muted} /><TextInput value={modelApiKey} onChangeText={setModelApiKey} placeholder={needsToken ? (hasModelApiKey ? "Leave blank to keep saved token" : "Paste provider API token") : "Leave blank unless your LAN server uses bearer auth"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><Text style={[styles.helper, { color: colors.muted }]}>{needsToken ? "The token is protected on Android. It is used to ask the selected provider for its current model catalog and later for agent inference." : "Ollama and LM Studio accept HTTP only at a numeric private-LAN address on the same trusted network. A bearer token is optional and remains protected on Android."}</Text>{modelProvider === "kilo" ? <PressableCard style={[styles.infoCard, { backgroundColor: `${colors.primary}0C`, borderColor: `${colors.primary}22` }]}><MaterialIcons name="hub" size={19} color={colors.primary} /><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Kilo Code gateway</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>Pocket Relay uses Kilo’s OpenAI-compatible gateway at api.kilo.ai. Paste your Kilo API key, refresh the catalog, and choose the model ID it returns.</Text></View></PressableCard> : null}<ModelCatalog provider={modelProvider} models={modelCatalog} fetchedAt={modelCatalogFetchedAt} selectedModel={modelName} loading={discoveringModels} connection={providerConnection} onRefresh={() => void refreshModels()} onSelect={selectModel} colors={colors} /><FieldLabel label="Selected model" color={colors.muted} /><TextInput value={modelName} onChangeText={setModelName} placeholder="Choose a model above or enter its ID" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><PressableCard style={styles.infoCard}><View style={[styles.infoIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="memory" size={19} color={colors.primary} /></View><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Keep the first install lightweight</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>No local model files are added during initial setup. Optional offline models remain a later, explicit download.</Text></View></PressableCard></View>;
}

function PolicyStep({ chargingAware, setChargingAware, restartAfterBoot, setRestartAfterBoot, hostName, hasToken, allowedChatId, modelEndpoint, readiness, colors }: { chargingAware: boolean; setChargingAware: (value: boolean) => void; restartAfterBoot: boolean; setRestartAfterBoot: (value: boolean) => void; hostName: string; hasToken: boolean; allowedChatId: string; modelEndpoint: string; readiness: HostReadiness; colors: ReturnType<typeof useColors> }) {
  const storageValue = readiness.freeStorageBytes === null ? "Checking storage…" : `${(readiness.freeStorageBytes / 1024 / 1024 / 1024).toFixed(1)} GB free`;
  return <View style={styles.stepContent}><PressableCard style={styles.policyRow}><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Charging-aware host mode</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>Recommend power before a long-running agent session and surface readiness clearly.</Text></View><Switch value={chargingAware} onValueChange={setChargingAware} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={chargingAware ? colors.success : colors.muted} /></PressableCard><PressableCard style={styles.policyRow}><View style={styles.infoCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Restart after boot</Text><Text style={[styles.infoDetail, { color: colors.muted }]}>After device unlock, an enabled host can restore its protected foreground session.</Text></View><Switch value={restartAfterBoot} onValueChange={setRestartAfterBoot} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={restartAfterBoot ? colors.success : colors.muted} /></PressableCard><View style={styles.readinessGrid}><PressableCard style={styles.readinessCard}><MaterialIcons name="battery-charging-full" size={20} color={readiness.isCharging ? colors.success : colors.warning} /><Text style={[styles.readinessLabel, { color: colors.foreground }]}>Power</Text><Text style={[styles.readinessDetail, { color: colors.muted }]}>{readiness.batteryPercent === null ? readiness.chargingLabel : `${readiness.batteryPercent}% · ${readiness.chargingLabel}`}</Text></PressableCard><PressableCard style={styles.readinessCard}><MaterialIcons name="storage" size={20} color={readiness.storageReady ? colors.success : colors.warning} /><Text style={[styles.readinessLabel, { color: colors.foreground }]}>Storage</Text><Text style={[styles.readinessDetail, { color: colors.muted }]}>{storageValue}</Text></PressableCard></View><View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.summaryEyebrow, { color: colors.muted }]}>HOST READINESS</Text><SummaryRow icon="phone-android" label="Device" value={hostName.trim() || "Pocket Relay"} ok colors={colors} /><SummaryRow icon="telegram" label="Owner gateway" value={hasToken && isValidTelegramChatId(allowedChatId.trim()) ? "Locked to one chat" : "Needs attention"} ok={hasToken && isValidTelegramChatId(allowedChatId.trim())} colors={colors} /><SummaryRow icon="battery-charging-full" label="Power" value={readiness.chargingLabel} ok={readiness.isCharging === true || !chargingAware} colors={colors} /><SummaryRow icon="storage" label="Storage" value={storageValue} ok={readiness.storageReady !== false} colors={colors} /><SummaryRow icon="terminal" label="Runtime" value="Private bundle, no Termux" ok colors={colors} /></View></View>;
}

function SummaryRow({ icon, label, value, ok, colors }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string; ok: boolean; colors: ReturnType<typeof useColors> }) { return <View style={styles.summaryRow}><MaterialIcons name={icon} size={18} color={ok ? colors.success : colors.warning} /><View style={styles.summaryCopy}><Text style={[styles.summaryLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.summaryValue, { color: colors.muted }]}>{value}</Text></View><MaterialIcons name={ok ? "check-circle" : "error-outline"} size={19} color={ok ? colors.success : colors.warning} /></View>; }
function FieldLabel({ label, color }: { label: string; color: string }) { return <Text style={[styles.fieldLabel, { color }]}>{label.toUpperCase()}</Text>; }

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 26, gap: 19 }, topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, stepCounter: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5 }, progressItem: { alignItems: "center", gap: 6, minWidth: 53 }, progressDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" }, progressNumber: { fontSize: 12, fontWeight: "900" }, progressLabel: { fontSize: 10, fontWeight: "800" },
  hero: { borderWidth: 1, borderRadius: 28, padding: 22, gap: 10, overflow: "hidden" }, heroAura: { position: "absolute", width: 170, height: 170, borderRadius: 85, right: -60, top: -55 }, heroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 2 }, eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.15 }, title: { fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -0.7, maxWidth: "92%" }, detail: { fontSize: 14, lineHeight: 20, fontWeight: "500", maxWidth: "91%" },
  stepContent: { gap: 9 }, fieldLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" }, helper: { fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 1 },
  infoCard: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 5 }, infoIcon: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center" }, infoCopy: { flex: 1, gap: 3 }, infoTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, infoDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, statusCard: { flexDirection: "row", gap: 9, alignItems: "center", borderWidth: 1 }, statusText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" }, chatHelp: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1 }, proxySelector: { flexDirection: "row", gap: 8 }, proxyOption: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }, proxyOptionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, proxyOptionText: { fontSize: 11, fontWeight: "900" },
  readinessGrid: { flexDirection: "row", gap: 9 }, readinessCard: { flex: 1, gap: 5, minHeight: 116 }, readinessLabel: { fontSize: 13, fontWeight: "900" }, readinessDetail: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  policyRow: { flexDirection: "row", gap: 12, alignItems: "center" }, summary: { borderWidth: 1, borderRadius: 22, padding: 15, gap: 12, marginTop: 3 }, summaryEyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: "900" }, summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 }, summaryCopy: { flex: 1, gap: 1 }, summaryLabel: { fontSize: 13, fontWeight: "800" }, summaryValue: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  validation: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 14, padding: 11 }, validationText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" }, actions: { flexDirection: "row", gap: 10, alignItems: "stretch" }, backWrap: { flex: 0.6 }, continueWrap: { flex: 1.4 }, footer: { fontSize: 11, lineHeight: 16, fontWeight: "500", textAlign: "center", paddingHorizontal: 12 },
});
