import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { ModelCatalog } from "@/components/model-catalog";
import { ModelProviderPicker } from "@/components/model-provider-picker";
import { PageHeader, PressableCard, PrimaryButton, RuntimePill, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { ThemeOptions } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import type { ModelProviderId } from "@/lib/host-contracts";
import type { McpAuthMode } from "@/lib/mcp-contracts";
import { getProviderPreset, resolveProviderEndpoint, type ModelCatalogEntry } from "@/lib/model-providers";
import { usePocketHermes } from "@/lib/pocket-hermes-store";
import { useThemeContext } from "@/lib/theme-provider";

export default function SettingsScreen() {
  const colors = useColors();
  const { themeId, setThemeId } = useThemeContext();
  const { config, modelCatalog, modelCatalogFetchedAt, providerConnection, phase, mcpServers, mcpTools, mcpApprovals, saveConfiguration, clearActivity, clearSensitiveConfiguration, testModel, discoverModels, testProviderConnection, saveMcpServer, removeMcpServer, setMcpServerEnabled, approveMcpTool, revokeMcpToolApproval } = usePocketHermes();
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
  const [testingProvider, setTestingProvider] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpEndpoint, setMcpEndpoint] = useState("");
  const [mcpAuthMode, setMcpAuthMode] = useState<McpAuthMode>("bearer");
  const [mcpCredential, setMcpCredential] = useState("");
  const [savingMcp, setSavingMcp] = useState(false);
  const [mcpResult, setMcpResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const stale = !modelCatalogFetchedAt || Date.now() - new Date(modelCatalogFetchedAt).getTime() > 6 * 60 * 60 * 1000;
    const hasCurrentProvider = modelCatalog.some((model) => model.provider === config.modelProvider);
    if (!config.hasModelApiKey || (!stale && hasCurrentProvider)) return;
    setDiscoveringModels(true);
    void discoverModels({ provider: config.modelProvider, endpoint: config.modelEndpoint }).finally(() => setDiscoveringModels(false));
  }, [config.hasModelApiKey, config.modelProvider, config.modelEndpoint, modelCatalogFetchedAt, modelCatalog, discoverModels]);

  const save = async () => {
    if (modelProvider === "kilo" && !providerTestResult?.ok) {
      Alert.alert("Test Kilo Code first", "Use the Test Kilo Code connection button to verify the API key before saving this provider.");
      return;
    }
    const endpoint = resolveProviderEndpoint(modelProvider, modelEndpoint);
    if (endpoint !== modelEndpoint) setModelEndpoint(endpoint);
    setSaving(true);
    const result = await saveConfiguration({
      hostName,
      allowedChatId,
      modelProvider,
      modelEndpoint: endpoint,
      modelName,
      telegramToken: token,
      modelApiKey,
      policy: { ...config.policy, chargingAware, restartAfterBoot },
    });
    setSaving(false);
    if (result.ok) {
      setToken("");
      setModelApiKey("");
      if (endpoint && (modelApiKey.trim() || config.hasModelApiKey)) {
        setDiscoveringModels(true);
        void discoverModels({ provider: modelProvider, endpoint }).finally(() => setDiscoveringModels(false));
      }
    }
    Alert.alert(result.ok ? "Host configuration saved" : "Check your setup", result.message);
  };

  const selectProvider = (provider: ModelProviderId) => {
    setModelProvider(provider);
    setModelEndpoint(getProviderPreset(provider).defaultEndpoint);
    setModelName("");
    setProviderTestResult(null);
  };

  const refreshModels = async () => {
    const endpoint = resolveProviderEndpoint(modelProvider, modelEndpoint);
    if (endpoint !== modelEndpoint) setModelEndpoint(endpoint);
    setDiscoveringModels(true);
    const result = await discoverModels({ provider: modelProvider, endpoint, apiKey: modelApiKey });
    setDiscoveringModels(false);
    if (!result.ok) Alert.alert("Model catalog unavailable", result.message);
  };

  const selectModel = (model: ModelCatalogEntry) => setModelName(model.id);

  const testConnection = async () => {
    const endpoint = resolveProviderEndpoint(modelProvider, modelEndpoint);
    if (endpoint !== modelEndpoint) setModelEndpoint(endpoint);
    setTestingProvider(true);
    setProviderTestResult(null);
    try {
      const result = await testProviderConnection({ provider: modelProvider, endpoint, apiKey: modelApiKey });
      setProviderTestResult({ ok: result.ok, message: result.message });
    } finally {
      setTestingProvider(false);
    }
  };

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

  const verifyMcp = async () => {
    setSavingMcp(true);
    setMcpResult(null);
    try {
      const result = await saveMcpServer({ name: mcpName, endpoint: mcpEndpoint, authMode: mcpAuthMode, credential: mcpCredential });
      setMcpResult({ ok: result.ok, message: result.message });
      if (result.ok) {
        setMcpName("");
        setMcpEndpoint("");
        setMcpCredential("");
      }
    } finally {
      setSavingMcp(false);
    }
  };

  const removeMcp = (serverId: string, name: string) => {
    Alert.alert("Remove connector?", `Remove ${name}, its protected credential, discovered tools, and every outstanding approval from this phone?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void removeMcpServer(serverId) },
    ]);
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><PageHeader eyebrow="DEVICE CONTROL" title="Host settings" detail="Secure this phone before you let it host an agent from anywhere." icon="security" /><RuntimePill phase={phase} /></View>

        <SectionHeading eyebrow="APPEARANCE" title="Theme" />
        <PressableCard style={styles.themeCard}>
          <View style={styles.themeSelector}>
            {ThemeOptions.map((theme) => {
              const selected = themeId === theme.id;
              return (
                <Pressable
                  key={theme.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${theme.label} theme`}
                  accessibilityState={{ selected }}
                  onPress={() => setThemeId(theme.id)}
                  style={({ pressed }) => [
                    styles.themeOption,
                    { backgroundColor: selected ? `${colors.primary}16` : colors.background, borderColor: selected ? colors.primary : colors.border },
                    pressed && styles.themeOptionPressed,
                  ]}
                >
                  <View style={[styles.themeDot, { backgroundColor: theme.previewColor }]} />
                  <Text numberOfLines={1} style={[styles.themeOptionTitle, { color: selected ? colors.primary : colors.foreground }]}>{theme.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>{ThemeOptions.find((theme) => theme.id === themeId)?.description}</Text>
        </PressableCard>

        <SectionHeading eyebrow="IDENTITY" title="This phone" />
        <PressableCard style={[styles.formCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}22` }]}>
          <Label text="Host name" color={colors.muted} />
          <TextInput value={hostName} onChangeText={setHostName} placeholder="Pocket Agent Host" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="AI model provider" color={colors.muted} />
          <ModelProviderPicker selected={modelProvider} onChange={selectProvider} colors={colors} />
          <Label text="Model endpoint · HTTPS" color={colors.muted} />
          <TextInput value={modelEndpoint} onChangeText={(value) => { setModelEndpoint(value); setProviderTestResult(null); }} placeholder="https://your-provider.example/v1" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="Provider API token" color={colors.muted} />
          <TextInput value={modelApiKey} onChangeText={(value) => { setModelApiKey(value); setProviderTestResult(null); }} placeholder={config.hasModelApiKey ? "Leave blank to keep saved token" : "Paste provider API token"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.helper, { color: colors.muted }]}>The token is used only for the selected provider’s HTTPS model-list and inference requests. It is protected on Android and excluded from logs, history, and model records.</Text>
          <SecondaryButton label={testingProvider ? `Testing ${getProviderPreset(modelProvider).label}…` : `Test ${getProviderPreset(modelProvider).label} connection`} icon="network-check" onPress={() => void testConnection()} loading={testingProvider} disabled={testingProvider} />
          {providerTestResult ? <View style={[styles.connectionResult, { backgroundColor: `${providerTestResult.ok ? colors.success : colors.error}12`, borderColor: `${providerTestResult.ok ? colors.success : colors.error}3A` }]}><MaterialIcons name={providerTestResult.ok ? "check-circle" : "error-outline"} size={18} color={providerTestResult.ok ? colors.success : colors.error} /><Text style={[styles.connectionResultText, { color: providerTestResult.ok ? colors.success : colors.error }]}>{providerTestResult.message}</Text></View> : null}
          <ModelCatalog provider={modelProvider} models={modelCatalog} fetchedAt={modelCatalogFetchedAt} selectedModel={modelName} loading={discoveringModels} connection={providerConnection} onRefresh={() => void refreshModels()} onSelect={selectModel} colors={colors} />
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

        <SectionHeading eyebrow="REMOTE TOOLS" title="MCP connectors" />
        <PressableCard style={styles.formCard}>
          <View style={styles.securityHeader}><View style={[styles.lockIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="extension" size={18} color={colors.primary} /></View><Text style={[styles.securityTitle, { color: colors.foreground }]}>HTTPS remote MCP only</Text></View>
          <Text style={[styles.helper, { color: colors.muted }]}>Add a remote MCP server to discover its declared tools. Credentials stay in protected storage; discovered tools remain blocked until you approve each one for ten minutes.</Text>
          <Label text="Connector name" color={colors.muted} />
          <TextInput value={mcpName} onChangeText={setMcpName} placeholder="e.g. GitHub read-only" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="Remote MCP endpoint · HTTPS" color={colors.muted} />
          <TextInput value={mcpEndpoint} onChangeText={setMcpEndpoint} placeholder="https://mcp.example.com/mcp" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="Authentication" color={colors.muted} />
          <View style={styles.authSelector}>
            {(["bearer", "none"] as McpAuthMode[]).map((mode) => {
              const selected = mcpAuthMode === mode;
              return <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setMcpAuthMode(mode)} style={({ pressed }) => [styles.authOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}16` : colors.background }, pressed && styles.themeOptionPressed]}><Text style={[styles.authOptionText, { color: selected ? colors.primary : colors.foreground }]}>{mode === "bearer" ? "Bearer token" : "No auth"}</Text></Pressable>;
            })}
          </View>
          {mcpAuthMode === "bearer" ? <><Label text="Connector bearer token" color={colors.muted} /><TextInput value={mcpCredential} onChangeText={setMcpCredential} placeholder="Paste MCP server token" placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></> : null}
          <SecondaryButton label={savingMcp ? "Discovering tools…" : "Verify connector & discover tools"} icon="extension" onPress={() => void verifyMcp()} loading={savingMcp} disabled={savingMcp} />
          {mcpResult ? <View style={[styles.connectionResult, { backgroundColor: `${mcpResult.ok ? colors.success : colors.error}12`, borderColor: `${mcpResult.ok ? colors.success : colors.error}3A` }]}><MaterialIcons name={mcpResult.ok ? "check-circle" : "error-outline"} size={18} color={mcpResult.ok ? colors.success : colors.error} /><Text style={[styles.connectionResultText, { color: mcpResult.ok ? colors.success : colors.error }]}>{mcpResult.message}</Text></View> : null}
        </PressableCard>
        {mcpServers.map((server) => {
          const tools = mcpTools.filter((tool) => tool.serverId === server.id);
          return <PressableCard key={server.id} style={styles.mcpServerCard}>
            <View style={styles.mcpServerHeader}><View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>{server.name}</Text><Text numberOfLines={1} style={[styles.mcpEndpoint, { color: colors.muted }]}>{server.endpoint}</Text></View><Switch value={server.enabled} onValueChange={(value) => setMcpServerEnabled(server.id, value)} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={server.enabled ? colors.success : colors.muted} /></View>
            <Text style={[styles.helper, { color: colors.muted }]}>{server.toolCount} discovered tools · {server.latencyMs ? `${server.latencyMs} ms` : "checked"} · {server.hasCredential ? "credential protected" : "no credential"}</Text>
            {tools.map((tool) => {
              const approval = mcpApprovals.find((item) => item.serverId === server.id && item.toolName === tool.name && Date.parse(item.expiresAt) > Date.now());
              return <View key={`${server.id}-${tool.name}`} style={[styles.mcpToolRow, { borderColor: colors.border }]}><View style={styles.settingCopy}><Text style={[styles.mcpToolName, { color: colors.foreground }]}>{tool.name}</Text><Text numberOfLines={2} style={[styles.mcpToolDescription, { color: colors.muted }]}>{tool.description || "No tool description supplied by this server."}</Text></View><Pressable accessibilityRole="button" onPress={() => approval ? revokeMcpToolApproval(server.id, tool.name) : approveMcpTool(server.id, tool.name)} style={({ pressed }) => [styles.approvalButton, { backgroundColor: approval ? `${colors.warning}16` : `${colors.primary}16`, borderColor: approval ? `${colors.warning}55` : `${colors.primary}55` }, pressed && styles.themeOptionPressed]}><Text style={[styles.approvalButtonText, { color: approval ? colors.warning : colors.primary }]}>{approval ? "Revoke" : "Allow 10m"}</Text></Pressable></View>;
            })}
            <SecondaryButton label="Remove connector" icon="delete-outline" onPress={() => removeMcp(server.id, server.name)} danger />
          </PressableCard>;
        })}

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
  content: { paddingTop: 16, paddingBottom: 34, gap: 20 }, header: { gap: 11 }, themeCard: { gap: 11 }, themeSelector: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, themeOption: { flexGrow: 1, flexBasis: "30%", minWidth: 86, minHeight: 62, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 5 }, themeOptionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, themeDot: { width: 12, height: 12, borderRadius: 6 }, themeOptionTitle: { fontSize: 10, fontWeight: "900" }, formCard: { gap: 9 }, label: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { borderWidth: 1, minHeight: 50, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" }, helper: { fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 2 }, connectionResult: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 13, padding: 11 }, connectionResultText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 3 }, lockIcon: { width: 33, height: 33, borderRadius: 11, alignItems: "center", justifyContent: "center" }, securityTitle: { fontSize: 14, fontWeight: "900" }, webNotice: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 12, padding: 10, marginTop: 3 }, webNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 }, settingCopy: { flex: 1, gap: 3 }, settingTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, settingDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, runtimeGuide: { flexDirection: "row", alignItems: "center", gap: 12 }, guideIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, guideCopy: { flex: 1, gap: 3 }, guideTitle: { fontSize: 14, fontWeight: "900" }, guideDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, authSelector: { flexDirection: "row", gap: 8 }, authOption: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, authOptionText: { fontSize: 12, fontWeight: "900" }, mcpServerCard: { gap: 9 }, mcpServerHeader: { flexDirection: "row", alignItems: "center", gap: 12 }, mcpEndpoint: { fontSize: 11, fontWeight: "600" }, mcpToolRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 }, mcpToolName: { fontSize: 12, fontWeight: "900" }, mcpToolDescription: { fontSize: 11, lineHeight: 15, fontWeight: "500" }, approvalButton: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, approvalButtonText: { fontSize: 11, fontWeight: "900" }, footer: { fontSize: 12, lineHeight: 18, fontWeight: "500", textAlign: "center", paddingHorizontal: 12 },
});
