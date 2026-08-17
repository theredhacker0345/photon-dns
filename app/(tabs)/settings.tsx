import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { ModelCatalog } from "@/components/model-catalog";
import { ModelProviderPicker } from "@/components/model-provider-picker";
import { PageHeader, PressableCard, PrimaryButton, RuntimePill, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { ModelProviderId } from "@/lib/host-contracts";
import { getProviderPreset, type ModelCatalogEntry } from "@/lib/model-providers";
import { usePocketHermes } from "@/lib/pocket-hermes-store";

export default function SettingsScreen() {
  const colors = useColors();
  const { config, modelCatalog, modelCatalogFetchedAt, phase, saveConfiguration, clearActivity, clearSensitiveConfiguration, testModel, discoverModels } = usePocketHermes();
  const [hostName, setHostName] = useState(config.hostName);
  const [allowedChatId, setAllowedChatId] = useState(config.allowedChatId);
  const [modelProvider, setModelProvider] = useState<ModelProviderId>(config.modelProvider);
  const [modelEndpoint, setModelEndpoint] = useState(config.modelEndpoint);
  const [modelName, setModelName] = useState(config.modelName);
  const [modelApiKey, setModelApiKey] = useState("");
  const [token, setToken] = useState("");
  const [chargingAware, setChargingAware] = useState(config.policy.chargingAware);
  const [restartAfterBoot, setRestartAfterBoot] = useState(config.policy.restartAfterBoot);
  const [saving, setSaving] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [discoveringModels, setDiscoveringModels] = useState(false);

  useEffect(() => {
    const stale = !modelCatalogFetchedAt || Date.now() - new Date(modelCatalogFetchedAt).getTime() > 6 * 60 * 60 * 1000;
    const hasCurrentProvider = modelCatalog.some((model) => model.provider === config.modelProvider);
    if (!config.hasModelApiKey || (!stale && hasCurrentProvider)) return;
    setDiscoveringModels(true);
    void discoverModels({ provider: config.modelProvider, endpoint: config.modelEndpoint }).finally(() => setDiscoveringModels(false));
  }, [config.hasModelApiKey, config.modelProvider, config.modelEndpoint, modelCatalogFetchedAt, modelCatalog, discoverModels]);

  const save = async () => {
    setSaving(true);
    const result = await saveConfiguration({
      hostName,
      allowedChatId,
      modelProvider,
      modelEndpoint,
      modelName,
      telegramToken: token,
      modelApiKey,
      policy: { ...config.policy, chargingAware, restartAfterBoot },
    });
    setSaving(false);
    if (result.ok) {
      setToken("");
      setModelApiKey("");
      if (modelEndpoint && (modelApiKey.trim() || config.hasModelApiKey)) {
        setDiscoveringModels(true);
        void discoverModels({ provider: modelProvider, endpoint: modelEndpoint }).finally(() => setDiscoveringModels(false));
      }
    }
    Alert.alert(result.ok ? "Host configuration saved" : "Check your setup", result.message);
  };

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

  const clear = () => {
    Alert.alert("Clear local activity?", "This clears local drafts and event history. Your protected Telegram token is not removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearActivity },
    ]);
  };

  const removeCredentials = () => {
    Alert.alert("Remove protected credentials?", "This removes the Telegram bot token and model API key from encrypted storage and prevents the host from restarting until both are added again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove credentials", style: "destructive", onPress: () => void clearSensitiveConfiguration() },
    ]);
  };

  const verifyModel = async () => {
    setTestingModel(true);
    const result = await testModel();
    setTestingModel(false);
    Alert.alert(result.ok ? "Model endpoint verified" : "Model endpoint needs attention", result.message);
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><PageHeader eyebrow="DEVICE CONTROL" title="Host settings" detail="Secure this phone before you let it host an agent from anywhere." icon="security" /><RuntimePill phase={phase} /></View>

        <SectionHeading eyebrow="IDENTITY" title="This phone" />
        <PressableCard style={[styles.formCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}22` }]}>
          <Label text="Host name" color={colors.muted} />
          <TextInput value={hostName} onChangeText={setHostName} placeholder="Pocket Agent Host" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="AI model provider" color={colors.muted} />
          <ModelProviderPicker selected={modelProvider} onChange={selectProvider} colors={colors} />
          <Label text="Model endpoint · HTTPS" color={colors.muted} />
          <TextInput value={modelEndpoint} onChangeText={setModelEndpoint} placeholder="https://your-provider.example/v1" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="Provider API token" color={colors.muted} />
          <TextInput value={modelApiKey} onChangeText={setModelApiKey} placeholder={config.hasModelApiKey ? "Leave blank to keep saved token" : "Paste provider API token"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.helper, { color: colors.muted }]}>The token is used only for the selected provider’s HTTPS model-list and inference requests. It is protected on Android and excluded from logs, history, and model records.</Text>
          <ModelCatalog provider={modelProvider} models={modelCatalog} fetchedAt={modelCatalogFetchedAt} selectedModel={modelName} loading={discoveringModels} onRefresh={() => void refreshModels()} onSelect={selectModel} colors={colors} />
          <Label text="Selected model" color={colors.muted} />
          <TextInput value={modelName} onChangeText={setModelName} placeholder="Choose a model above or enter its ID" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.helper, { color: colors.muted }]}>Refresh whenever the provider changes its catalog. The last successful catalog is kept locally without the API token.</Text>
        </PressableCard>

        <SectionHeading eyebrow="REMOTE ACCESS" title="Telegram gateway" />
        <PressableCard style={styles.formCard}>
          <View style={styles.securityHeader}><View style={[styles.lockIcon, { backgroundColor: `${colors.success}16` }]}><MaterialIcons name="lock" size={18} color={colors.success} /></View><Text style={[styles.securityTitle, { color: colors.foreground }]}>{config.hasTelegramToken ? "Bot token protected on device" : "Bot token not added"}</Text></View>
          <Label text="Telegram bot token" color={colors.muted} />
          <TextInput value={token} onChangeText={setToken} placeholder={config.hasTelegramToken ? "Leave blank to keep saved token" : "Paste token from BotFather"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="Private owner Telegram user ID" color={colors.muted} />
          <TextInput value={allowedChatId} onChangeText={setAllowedChatId} placeholder="e.g. 123456789" placeholderTextColor={colors.muted} keyboardType="number-pad" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.helper, { color: colors.muted }]}>Pocket Agent Host accepts one private owner identity only. Group IDs are intentionally rejected because a group can contain other users.</Text>
          {Platform.OS === "web" ? <View style={[styles.webNotice, { backgroundColor: `${colors.warning}16` }]}><MaterialIcons name="warning-amber" size={17} color={colors.warning} /><Text style={[styles.webNoticeText, { color: colors.warning }]}>Web preview uses temporary browser storage. Use Android for Keystore protection.</Text></View> : null}
        </PressableCard>

        <PrimaryButton label={saving ? "Saving secure setup…" : "Save protected setup"} icon="lock" onPress={save} disabled={saving} />
        <SecondaryButton label={testingModel ? "Testing saved model…" : "Test saved model endpoint"} icon="network-check" onPress={testingModel ? () => undefined : verifyModel} />

        <SectionHeading eyebrow="RUNTIME POLICY" title="Host behavior" />
        <PressableCard style={styles.settingRow}><View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Charging-aware host mode</Text><Text style={[styles.settingDetail, { color: colors.muted }]}>The runtime can refuse long work when the device is not ready for a 24/7 session.</Text></View><Switch value={chargingAware} onValueChange={setChargingAware} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={chargingAware ? colors.success : colors.muted} /></PressableCard>
        <PressableCard style={styles.settingRow}><View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Restart host after boot</Text><Text style={[styles.settingDetail, { color: colors.muted }]}>When enabled, the Android boot receiver restarts the foreground host only after the device unlocks.</Text></View><Switch value={restartAfterBoot} onValueChange={setRestartAfterBoot} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={restartAfterBoot ? colors.success : colors.muted} /></PressableCard>

        <PressableCard style={styles.runtimeGuide}><View style={[styles.guideIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="terminal" size={20} color={colors.primary} /></View><View style={styles.guideCopy}><Text style={[styles.guideTitle, { color: colors.foreground }]}>No separate terminal</Text><Text style={[styles.guideDetail, { color: colors.muted }]}>The production build privately embeds and supervises the Hermes runtime. Termux does not appear on the phone.</Text></View></PressableCard>

        <SectionHeading eyebrow="LOCAL DATA" title="Privacy controls" />
        <SecondaryButton label="Clear local activity" icon="delete-outline" onPress={clear} danger />
        <SecondaryButton label="Remove protected credentials" icon="key-off" onPress={removeCredentials} danger />
        <Text style={[styles.footer, { color: colors.muted }]}>Pocket Agent Host is designed as a FOSS, app-private host. Secrets are excluded from activity history and diagnostics.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Label({ text, color }: { text: string; color: string }) { return <Text style={[styles.label, { color }]}>{text.toUpperCase()}</Text>; }

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 34, gap: 20 }, header: { gap: 11 }, formCard: { gap: 9 }, label: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { borderWidth: 1, minHeight: 50, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" }, helper: { fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 2 },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 3 }, lockIcon: { width: 33, height: 33, borderRadius: 11, alignItems: "center", justifyContent: "center" }, securityTitle: { fontSize: 14, fontWeight: "900" }, webNotice: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 12, padding: 10, marginTop: 3 }, webNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 }, settingCopy: { flex: 1, gap: 3 }, settingTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, settingDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, runtimeGuide: { flexDirection: "row", alignItems: "center", gap: 12 }, guideIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, guideCopy: { flex: 1, gap: 3 }, guideTitle: { fontSize: 14, fontWeight: "900" }, guideDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, footer: { fontSize: 12, lineHeight: 18, fontWeight: "500", textAlign: "center", paddingHorizontal: 12 },
});
