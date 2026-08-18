import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { ModelCatalog } from "@/components/model-catalog";
import { ModelProviderPicker } from "@/components/model-provider-picker";
import { PageHeader, PressableCard, PrimaryButton, RuntimePill, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { TelegramRouteStatus } from "@/components/telegram-route-status";
import { ThemeOptions } from "@/constants/theme";
import { useColors } from "@/hooks/use-colors";
import { useSupervisorTelemetry } from "@/hooks/use-supervisor-telemetry";
import { defaultHostRuntimePolicy, requiresModelApiKey, type ModelProviderId, type TelegramProxyType } from "@/lib/host-contracts";
import type { McpAuthMode } from "@/lib/mcp-contracts";
import { getProviderPreset, resolveProviderEndpoint, type ModelCatalogEntry } from "@/lib/model-providers";
import { usePocketHermes } from "@/lib/pocket-hermes-store";
import { getRecommendedResourceLimits, getResourceLimitWarnings } from "@/lib/resource-guardrails";
import { useThemeContext } from "@/lib/theme-provider";

export default function SettingsScreen() {
  const colors = useColors();
  const isFocused = useIsFocused();
  const { themeId, setThemeId } = useThemeContext();
  const { config, modelCatalog, modelCatalogFetchedAt, providerConnection, phase, mcpServers, mcpTools, mcpApprovals, providerConnections, activeProviderConnectionId, saveConfiguration, selectProviderConnection, removeProviderConnection, clearActivity, clearSensitiveConfiguration, testGateway, testModel, discoverModels, testProviderConnection, saveMcpServer, removeMcpServer, setMcpServerEnabled, approveMcpTool, revokeMcpToolApproval } = usePocketHermes();
  const { telemetry } = useSupervisorTelemetry(defaultHostRuntimePolicy, isFocused);
  const [hostName, setHostName] = useState(config.hostName);
  const [allowedChatId, setAllowedChatId] = useState(config.allowedChatId);
  const [modelProvider, setModelProvider] = useState<ModelProviderId>(config.modelProvider);
  const [modelEndpoint, setModelEndpoint] = useState(config.modelEndpoint);
  const [modelName, setModelName] = useState(config.modelName);
  const [modelApiKey, setModelApiKey] = useState("");
  const [token, setToken] = useState("");
  const [telegramProxyType, setTelegramProxyType] = useState<TelegramProxyType>(config.telegramProxy.type);
  const [telegramProxyHost, setTelegramProxyHost] = useState(config.telegramProxy.host);
  const [telegramProxyPort, setTelegramProxyPort] = useState(config.telegramProxy.port ? String(config.telegramProxy.port) : "");
  const [telegramProxyCredential, setTelegramProxyCredential] = useState("");
  const [clearTelegramProxyCredential, setClearTelegramProxyCredential] = useState(false);
  const [chargingAware, setChargingAware] = useState(config.policy.chargingAware);
  const [restartAfterBoot, setRestartAfterBoot] = useState(config.policy.restartAfterBoot);
  const [lowBatteryPercent, setLowBatteryPercent] = useState(String(config.policy.lowBatteryPercent));
  const [minimumFreeStorageMb, setMinimumFreeStorageMb] = useState(String(Math.round(config.policy.minimumFreeStorageBytes / (1024 * 1024))));
  const [maximumCpuPercent, setMaximumCpuPercent] = useState(String(config.policy.maximumCpuPercent));
  const [maximumProcessRamMb, setMaximumProcessRamMb] = useState(String(Math.round(config.policy.maximumProcessRamBytes / (1024 * 1024))));
  const [maximumWorkspaceMb, setMaximumWorkspaceMb] = useState(String(Math.round(config.policy.maximumWorkspaceBytes / (1024 * 1024))));
  const [warningThresholdPercent, setWarningThresholdPercent] = useState(String(config.policy.warningThresholdPercent));
  const [criticalThresholdPercent, setCriticalThresholdPercent] = useState(String(config.policy.criticalThresholdPercent));
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
  const [addingProvider, setAddingProvider] = useState(false);
  const activeProviderConnection = providerConnections.find((connection) => connection.id === activeProviderConnectionId) ?? null;
  const selectedProviderRequiresApiKey = requiresModelApiKey(modelProvider);
  const editingResourcePolicy = {
    ...config.policy,
    lowBatteryPercent: Number(lowBatteryPercent),
    minimumFreeStorageBytes: Number(minimumFreeStorageMb) * 1024 * 1024,
    maximumCpuPercent: Number(maximumCpuPercent),
    maximumProcessRamBytes: Number(maximumProcessRamMb) * 1024 * 1024,
    maximumWorkspaceBytes: Number(maximumWorkspaceMb) * 1024 * 1024,
    warningThresholdPercent: Number(warningThresholdPercent),
    criticalThresholdPercent: Number(criticalThresholdPercent),
  };
  const resourceWarnings = getResourceLimitWarnings({ telemetry, policy: editingResourcePolicy });
  const recommendedLimits = getRecommendedResourceLimits({ telemetry, policy: config.policy });

  useEffect(() => {
    const stale = !modelCatalogFetchedAt || Date.now() - new Date(modelCatalogFetchedAt).getTime() > 6 * 60 * 60 * 1000;
    const hasCurrentProvider = modelCatalog.some((model) => model.provider === config.modelProvider);
    if ((requiresModelApiKey(config.modelProvider) && !config.hasModelApiKey) || (!stale && hasCurrentProvider)) return;
    setDiscoveringModels(true);
    void discoverModels({ provider: config.modelProvider, endpoint: config.modelEndpoint }).finally(() => setDiscoveringModels(false));
  }, [config.hasModelApiKey, config.modelProvider, config.modelEndpoint, modelCatalogFetchedAt, modelCatalog, discoverModels]);

  useEffect(() => {
    if (addingProvider) return;
    setModelProvider(config.modelProvider);
    setModelEndpoint(config.modelEndpoint);
    setModelName(config.modelName);
    setModelApiKey("");
    setProviderTestResult(null);
  }, [addingProvider, config.modelEndpoint, config.modelName, config.modelProvider]);

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
      telegramProxy: {
        type: telegramProxyType,
        host: telegramProxyHost,
        port: telegramProxyType === "none" ? null : Number(telegramProxyPort),
      },
      telegramProxyCredential,
      clearTelegramProxyCredential,
      modelApiKey,
      providerConnectionId: addingProvider ? null : activeProviderConnectionId,
      createProviderConnection: addingProvider || !activeProviderConnectionId,
      policy: {
        ...config.policy,
        chargingAware,
        restartAfterBoot,
        lowBatteryPercent: Number(lowBatteryPercent),
        minimumFreeStorageBytes: Number(minimumFreeStorageMb) * 1024 * 1024,
        maximumCpuPercent: Number(maximumCpuPercent),
        maximumProcessRamBytes: Number(maximumProcessRamMb) * 1024 * 1024,
        maximumWorkspaceBytes: Number(maximumWorkspaceMb) * 1024 * 1024,
        warningThresholdPercent: Number(warningThresholdPercent),
        criticalThresholdPercent: Number(criticalThresholdPercent),
      },
    });
    setSaving(false);
    if (result.ok) {
      setToken("");
      setTelegramProxyCredential("");
      setClearTelegramProxyCredential(false);
      setModelApiKey("");
      setAddingProvider(false);
      if (endpoint && (modelApiKey.trim() || config.hasModelApiKey || !requiresModelApiKey(modelProvider))) {
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

  const beginNewProvider = () => {
    setAddingProvider(true);
    selectProvider("openai");
    setModelApiKey("");
  };

  const activateProvider = async (connectionId: string) => {
    setAddingProvider(false);
    await selectProviderConnection(connectionId);
  };

  const removeProvider = (connectionId: string, label: string) => {
    Alert.alert("Remove saved provider?", `Remove ${label} and its protected API token from this phone? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void removeProviderConnection(connectionId) },
    ]);
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

  const applyRecommendedLimits = () => {
    if (!recommendedLimits) {
      Alert.alert("Android capacity required", "Install Pocket Relay on the dedicated Android phone and wait for a native capacity sample before applying recommendations.");
      return;
    }
    setMaximumCpuPercent(String(recommendedLimits.maximumCpuPercent));
    setMaximumProcessRamMb(String(Math.round(recommendedLimits.maximumProcessRamBytes / (1024 * 1024))));
    setMaximumWorkspaceMb(String(Math.round(recommendedLimits.maximumWorkspaceBytes / (1024 * 1024))));
    Alert.alert("Recommended limits applied", "Review the values, then choose Save protected setup to apply them to the Android supervisor.");
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

        <SectionHeading eyebrow="MODEL ACCESS" title="Saved providers" />
        <PressableCard style={styles.providerConnectionsCard}>
          {providerConnections.length ? (
            <View style={styles.providerConnectionList}>
              {providerConnections.map((connection) => {
                const active = connection.id === activeProviderConnectionId;
                const providerLabel = getProviderPreset(connection.provider).label;
                return (
                  <Pressable
                    key={connection.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${connection.label || providerLabel} provider connection`}
                    accessibilityHint="Long press to remove this saved provider and its protected API token."
                    accessibilityState={{ selected: active }}
                    onPress={() => void activateProvider(connection.id)}
                    onLongPress={() => removeProvider(connection.id, connection.label || providerLabel)}
                    style={({ pressed }) => [
                      styles.providerConnectionRow,
                      { backgroundColor: active ? `${colors.primary}12` : colors.background, borderColor: active ? `${colors.primary}62` : colors.border },
                      pressed && styles.themeOptionPressed,
                    ]}
                  >
                    <View style={[styles.providerConnectionIcon, { backgroundColor: active ? `${colors.primary}1C` : `${colors.muted}14` }]}>
                      <MaterialIcons name={active ? "check" : "cloud-queue"} size={18} color={active ? colors.primary : colors.muted} />
                    </View>
                    <View style={styles.providerConnectionCopy}>
                      <Text numberOfLines={1} style={[styles.providerConnectionTitle, { color: colors.foreground }]}>{connection.label || providerLabel}</Text>
                      <Text numberOfLines={1} style={[styles.providerConnectionDetail, { color: colors.muted }]}>{providerLabel} · {connection.hasApiKey ? "token protected" : requiresModelApiKey(connection.provider) ? "token needed" : "no token required"}</Text>
                      <Text numberOfLines={1} style={[styles.providerConnectionEndpoint, { color: colors.muted }]}>{connection.endpoint}</Text>
                    </View>
                    {active ? <Text style={[styles.providerActiveLabel, { color: colors.primary }]}>ACTIVE</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.helper, { color: colors.muted }]}>No provider is saved yet. Add one to keep its protected API token separate from your other model providers.</Text>
          )}
          <SecondaryButton label="Add provider" icon="add" onPress={beginNewProvider} />
          {providerConnections.length ? <Text style={[styles.helper, { color: colors.muted }]}>Tap a provider to make it active. Long press one to remove its metadata and protected API token.</Text> : null}
        </PressableCard>

        <SectionHeading eyebrow="IDENTITY" title="This phone" />
        <PressableCard style={[styles.formCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}22` }]}>
          <Label text="Host name" color={colors.muted} />
          <TextInput value={hostName} onChangeText={setHostName} placeholder="Pocket Relay" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          {addingProvider || !activeProviderConnection ? <>
            <Label text="AI model provider" color={colors.muted} />
            <ModelProviderPicker selected={modelProvider} onChange={selectProvider} colors={colors} />
            <Label text={selectedProviderRequiresApiKey ? "Model endpoint · HTTPS" : "Model endpoint · private LAN"} color={colors.muted} />
            <TextInput value={modelEndpoint} onChangeText={(value) => { setModelEndpoint(value); setProviderTestResult(null); }} placeholder={selectedProviderRequiresApiKey ? "https://your-provider.example/v1" : "http://192.168.1.20:11434/v1"} placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            <Label text={selectedProviderRequiresApiKey ? "Provider API token" : "Provider API token · optional"} color={colors.muted} />
            <TextInput value={modelApiKey} onChangeText={(value) => { setModelApiKey(value); setProviderTestResult(null); }} placeholder={selectedProviderRequiresApiKey ? (config.hasModelApiKey ? "Leave blank to keep saved token" : "Paste provider API token") : "Leave blank unless your LAN server uses bearer auth"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            <Text style={[styles.helper, { color: colors.muted }]}>{selectedProviderRequiresApiKey ? "The token is used only for the selected provider’s HTTPS model-list and inference requests. It is protected on Android and excluded from logs, history, and model records." : "Ollama and LM Studio may use HTTP only at a numeric private-LAN address on the same trusted network. A bearer token is optional and stays protected on Android."}</Text>
            <SecondaryButton label={testingProvider ? `Testing ${getProviderPreset(modelProvider).label}…` : `Test ${getProviderPreset(modelProvider).label} connection`} icon="network-check" onPress={() => void testConnection()} loading={testingProvider} disabled={testingProvider} />
            {providerTestResult ? <View style={[styles.connectionResult, { backgroundColor: `${providerTestResult.ok ? colors.success : colors.error}12`, borderColor: `${providerTestResult.ok ? colors.success : colors.error}3A` }]}><MaterialIcons name={providerTestResult.ok ? "check-circle" : "error-outline"} size={18} color={providerTestResult.ok ? colors.success : colors.error} /><Text style={[styles.connectionResultText, { color: providerTestResult.ok ? colors.success : colors.error }]}>{providerTestResult.message}</Text></View> : null}
            <ModelCatalog provider={modelProvider} models={modelCatalog} fetchedAt={modelCatalogFetchedAt} selectedModel={modelName} loading={discoveringModels} connection={providerConnection} onRefresh={() => void refreshModels()} onSelect={selectModel} colors={colors} />
            <Label text="Selected model" color={colors.muted} />
            <TextInput value={modelName} onChangeText={setModelName} placeholder="Choose a model above or enter its ID" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            <Text style={[styles.helper, { color: colors.muted }]}>Refresh whenever the provider changes its catalog. The last successful catalog is kept locally without the API token.</Text>
          </> : <View style={[styles.activeProviderSummary, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.activeProviderSummaryHeader}><MaterialIcons name="check-circle" size={18} color={colors.success} /><Text style={[styles.activeProviderSummaryTitle, { color: colors.foreground }]}>Active provider</Text></View>
            <Text style={[styles.activeProviderSummaryValue, { color: colors.foreground }]}>{getProviderPreset(activeProviderConnection.provider).label}</Text>
            <Text numberOfLines={1} style={[styles.activeProviderSummaryDetail, { color: colors.muted }]}>{activeProviderConnection.endpoint}</Text>
            <Text style={[styles.activeProviderSummaryDetail, { color: colors.muted }]}>{config.modelName || "No model selected"} · {activeProviderConnection.hasApiKey ? "API token protected" : requiresModelApiKey(activeProviderConnection.provider) ? "API token needed" : "No token required"}</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>Use Saved providers above to switch connections or add another. API tokens are never displayed here.</Text>
          </View>}
        </PressableCard>

        <SectionHeading eyebrow="REMOTE ACCESS" title="Telegram gateway" />
        <PressableCard style={styles.formCard}>
          <View style={styles.securityHeader}><View style={[styles.lockIcon, { backgroundColor: `${colors.success}16` }]}><MaterialIcons name="lock" size={18} color={colors.success} /></View><Text style={[styles.securityTitle, { color: colors.foreground }]}>{config.hasTelegramToken ? "Bot token protected on device" : "Bot token not added"}</Text></View>
          <Label text="Telegram bot token" color={colors.muted} />
          <TextInput value={token} onChangeText={setToken} placeholder={config.hasTelegramToken ? "Leave blank to keep saved token" : "Paste token from BotFather"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Label text="Private owner Telegram user ID" color={colors.muted} />
          <TextInput value={allowedChatId} onChangeText={setAllowedChatId} placeholder="e.g. 123456789" placeholderTextColor={colors.muted} keyboardType="number-pad" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
          <Text style={[styles.helper, { color: colors.muted }]}>Pocket Relay accepts one private owner identity only. Group IDs are intentionally rejected because a group can contain other users.</Text>
          <Label text="Telegram network route" color={colors.muted} />
          <View style={styles.authSelector}>
            {(["none", "http", "socks5"] as TelegramProxyType[]).map((type) => {
              const selected = telegramProxyType === type;
              const label = type === "none" ? "Direct" : type === "http" ? "HTTP" : "SOCKS5";
              return <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setTelegramProxyType(type); if (type === "none") setClearTelegramProxyCredential(true); }} style={({ pressed }) => [styles.authOption, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}16` : colors.background }, pressed && styles.themeOptionPressed]}><Text style={[styles.authOptionText, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text></Pressable>;
            })}
          </View>
          {telegramProxyType !== "none" ? <>
            <Text style={[styles.helper, { color: colors.muted }]}>Routes only Telegram through the selected proxy. Model-provider and MCP traffic keep their own direct, HTTPS-only paths.</Text>
            <View style={styles.resourceFields}>
              <View style={styles.resourceField}><Label text="Proxy host" color={colors.muted} /><TextInput value={telegramProxyHost} onChangeText={setTelegramProxyHost} placeholder="proxy.example.net" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
              <View style={styles.resourceField}><Label text="Port" color={colors.muted} /><TextInput value={telegramProxyPort} onChangeText={setTelegramProxyPort} placeholder={telegramProxyType === "http" ? "8080" : "1080"} placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={5} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            </View>
            <Label text="Proxy username:password · optional" color={colors.muted} />
            <TextInput value={telegramProxyCredential} onChangeText={(value) => { setTelegramProxyCredential(value); setClearTelegramProxyCredential(false); }} placeholder={config.telegramProxy.hasCredentials && !clearTelegramProxyCredential ? "Protected credential saved — leave blank to keep" : "username:password"} placeholderTextColor={colors.muted} secureTextEntry autoCapitalize="none" autoCorrect={false} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
            {config.telegramProxy.hasCredentials && !clearTelegramProxyCredential ? <Pressable accessibilityRole="button" onPress={() => setClearTelegramProxyCredential(true)} style={({ pressed }) => [styles.inlineDangerButton, { borderColor: `${colors.error}55`, backgroundColor: `${colors.error}12` }, pressed && styles.themeOptionPressed]}><Text style={[styles.inlineDangerText, { color: colors.error }]}>Clear saved proxy credential when I save</Text></Pressable> : null}
            {clearTelegramProxyCredential ? <Text style={[styles.helper, { color: colors.warning }]}>The saved proxy credential will be removed when you save this setup.</Text> : null}
          </> : null}
          <TelegramRouteStatus
            telegramToken={token}
            hasSavedTelegramToken={config.hasTelegramToken}
            proxy={{ type: telegramProxyType, host: telegramProxyHost, port: telegramProxyType === "none" ? null : Number(telegramProxyPort) }}
            proxyCredential={telegramProxyCredential}
            testGateway={testGateway}
          />
          {Platform.OS === "web" ? <View style={[styles.webNotice, { backgroundColor: `${colors.warning}16` }]}><MaterialIcons name="warning-amber" size={17} color={colors.warning} /><Text style={[styles.webNoticeText, { color: colors.warning }]}>Web preview uses temporary browser storage. Use Android for Keystore protection.</Text></View> : null}
        </PressableCard>

        <PrimaryButton label={saving ? "Saving secure setup…" : "Save protected setup"} icon="lock" onPress={save} disabled={saving} />
        <SecondaryButton label={testingModel ? "Testing saved model…" : "Test saved model endpoint"} icon="network-check" onPress={testingModel ? () => undefined : verifyModel} />

        <SectionHeading eyebrow="RUNTIME POLICY" title="Host behavior" />
        <PressableCard style={styles.settingRow}><View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Charging-aware host mode</Text><Text style={[styles.settingDetail, { color: colors.muted }]}>The native host stops safely if power is removed while this protection is enabled.</Text></View><Switch value={chargingAware} onValueChange={setChargingAware} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={chargingAware ? colors.success : colors.muted} /></PressableCard>
        <PressableCard style={styles.settingRow}><View style={styles.settingCopy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Restart host after boot</Text><Text style={[styles.settingDetail, { color: colors.muted }]}>When enabled, the Android boot receiver restarts the foreground host only after the device unlocks.</Text></View><Switch value={restartAfterBoot} onValueChange={setRestartAfterBoot} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={restartAfterBoot ? colors.success : colors.muted} /></PressableCard>

        <PressableCard style={styles.resourceCard}>
          <View style={styles.securityHeader}><View style={[styles.lockIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="tune" size={18} color={colors.primary} /></View><Text style={[styles.securityTitle, { color: colors.foreground }]}>Host resource guardrails</Text></View>
          <Text style={[styles.helper, { color: colors.muted }]}>These limits supervise only Pocket Relay’s private process and workspace. They do not expose a terminal, install packages, or give the model access to the rest of your phone.</Text>
          <View style={[styles.recommendationCard, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}35` }]}>
            <View style={styles.recommendationCopy}><Text style={[styles.recommendationTitle, { color: colors.foreground }]}>Recommended for this phone</Text><Text style={[styles.recommendationDetail, { color: colors.muted }]}>{recommendedLimits ? `${recommendedLimits.deviceSummary}. Conservative limits leave room for Android.` : "Available after the installed Android host reports this phone’s capacity."}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Apply recommended resource limits" onPress={applyRecommendedLimits} style={({ pressed }) => [styles.recommendationButton, { borderColor: colors.primary, backgroundColor: colors.background }, pressed && styles.themeOptionPressed]}><MaterialIcons name="auto-fix-high" size={16} color={colors.primary} /><Text style={[styles.recommendationButtonText, { color: colors.primary }]}>Apply</Text></Pressable>
          </View>
            <View style={styles.resourceFields}>
            <View style={styles.resourceField}><Label text="Battery warning · %" color={colors.muted} /><TextInput value={lowBatteryPercent} onChangeText={setLowBatteryPercent} keyboardType="number-pad" maxLength={2} placeholder={String(defaultHostRuntimePolicy.lowBatteryPercent)} placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <View style={styles.resourceField}><Label text="Free storage reserve · MB" color={colors.muted} /><TextInput value={minimumFreeStorageMb} onChangeText={setMinimumFreeStorageMb} keyboardType="number-pad" maxLength={4} placeholder={String(defaultHostRuntimePolicy.minimumFreeStorageBytes / (1024 * 1024))} placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <View style={styles.resourceField}><Label text="CPU guard · %" color={colors.muted} /><TextInput value={maximumCpuPercent} onChangeText={setMaximumCpuPercent} keyboardType="number-pad" maxLength={2} placeholder="65" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <View style={styles.resourceField}><Label text="RAM guard · MB" color={colors.muted} /><TextInput value={maximumProcessRamMb} onChangeText={setMaximumProcessRamMb} keyboardType="number-pad" maxLength={4} placeholder="512" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <View style={styles.resourceField}><Label text="Workspace quota · MB" color={colors.muted} /><TextInput value={maximumWorkspaceMb} onChangeText={setMaximumWorkspaceMb} keyboardType="number-pad" maxLength={4} placeholder="512" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <View style={styles.resourceField}><Label text="Visual warning · %" color={colors.muted} /><TextInput value={warningThresholdPercent} onChangeText={setWarningThresholdPercent} keyboardType="number-pad" maxLength={2} placeholder="80" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
            <View style={styles.resourceField}><Label text="Visual critical · %" color={colors.muted} /><TextInput value={criticalThresholdPercent} onChangeText={setCriticalThresholdPercent} keyboardType="number-pad" maxLength={2} placeholder="95" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View>
          </View>
          <Text style={[styles.helper, { color: colors.muted }]}>Battery warning accepts 5–80%. The free-storage reserve must be at least 512 MB. With charging-aware mode off, the Android host sends a native warning at the battery threshold; crossing the storage reserve, a RAM/workspace limit, or a sustained CPU limit stops or refuses work safely.</Text>
          {resourceWarnings.length ? <View style={[styles.resourceWarning, { backgroundColor: `${resourceWarnings.some((warning) => warning.severity === "critical") ? colors.error : colors.warning}14`, borderColor: `${resourceWarnings.some((warning) => warning.severity === "critical") ? colors.error : colors.warning}52` }]}><MaterialIcons name="warning-amber" size={19} color={resourceWarnings.some((warning) => warning.severity === "critical") ? colors.error : colors.warning} /><View style={styles.warningCopy}>{resourceWarnings.map((warning) => <View key={warning.resource}><Text style={[styles.warningTitle, { color: warning.severity === "critical" ? colors.error : colors.warning }]}>{warning.title}</Text><Text style={[styles.warningDetail, { color: colors.muted }]}>{warning.detail}</Text></View>)}</View></View> : null}
        </PressableCard>

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
        <Text style={[styles.footer, { color: colors.muted }]}>Pocket Relay is designed as a FOSS, app-private host. Secrets are excluded from activity history and diagnostics.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Label({ text, color }: { text: string; color: string }) { return <Text style={[styles.label, { color }]}>{text.toUpperCase()}</Text>; }

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 34, gap: 20 }, header: { gap: 11 }, themeCard: { gap: 11 }, themeSelector: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, themeOption: { flexGrow: 1, flexBasis: "30%", minWidth: 86, minHeight: 62, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 5 }, themeOptionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, themeDot: { width: 12, height: 12, borderRadius: 6 }, themeOptionTitle: { fontSize: 10, fontWeight: "900" }, providerConnectionsCard: { gap: 9 }, providerConnectionList: { gap: 7 }, providerConnectionRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 68, borderWidth: 1, borderRadius: 14, padding: 10 }, providerConnectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" }, providerConnectionCopy: { flex: 1, gap: 2 }, providerConnectionTitle: { fontSize: 13, fontWeight: "900" }, providerConnectionDetail: { fontSize: 11, lineHeight: 15, fontWeight: "700" }, providerConnectionEndpoint: { fontSize: 10, lineHeight: 14, fontWeight: "600" }, providerActiveLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }, activeProviderSummary: { gap: 4, borderWidth: 1, borderRadius: 14, padding: 12 }, activeProviderSummaryHeader: { flexDirection: "row", alignItems: "center", gap: 7 }, activeProviderSummaryTitle: { fontSize: 12, fontWeight: "900" }, activeProviderSummaryValue: { fontSize: 15, fontWeight: "900", marginTop: 2 }, activeProviderSummaryDetail: { fontSize: 12, lineHeight: 17, fontWeight: "600" }, formCard: { gap: 9 }, label: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { borderWidth: 1, minHeight: 50, borderRadius: 16, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" }, helper: { fontSize: 12, lineHeight: 17, fontWeight: "500", marginTop: 2 }, connectionResult: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 13, padding: 11 }, connectionResultText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  securityHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 3 }, lockIcon: { width: 33, height: 33, borderRadius: 11, alignItems: "center", justifyContent: "center" }, securityTitle: { fontSize: 14, fontWeight: "900" }, webNotice: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 12, padding: 10, marginTop: 3 }, webNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" }, inlineDangerButton: { alignSelf: "flex-start", minHeight: 34, borderWidth: 1, borderRadius: 10, justifyContent: "center", paddingHorizontal: 10 }, inlineDangerText: { fontSize: 11, fontWeight: "900" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12 }, settingCopy: { flex: 1, gap: 3 }, settingTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, settingDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, resourceCard: { gap: 9 }, recommendationCard: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 13, padding: 10 }, recommendationCopy: { flex: 1, gap: 2 }, recommendationTitle: { fontSize: 12, fontWeight: "900" }, recommendationDetail: { fontSize: 11, lineHeight: 15, fontWeight: "600" }, recommendationButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 11, paddingHorizontal: 9 }, recommendationButtonText: { fontSize: 11, fontWeight: "900" }, resourceFields: { gap: 8 }, resourceField: { gap: 2 }, resourceWarning: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 13, padding: 10 }, warningCopy: { flex: 1, gap: 7 }, warningTitle: { fontSize: 12, fontWeight: "900" }, warningDetail: { fontSize: 11, lineHeight: 15, fontWeight: "600" }, runtimeGuide: { flexDirection: "row", alignItems: "center", gap: 12 }, guideIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, guideCopy: { flex: 1, gap: 3 }, guideTitle: { fontSize: 14, fontWeight: "900" }, guideDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, authSelector: { flexDirection: "row", gap: 8 }, authOption: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, authOptionText: { fontSize: 12, fontWeight: "900" }, mcpServerCard: { gap: 9 }, mcpServerHeader: { flexDirection: "row", alignItems: "center", gap: 12 }, mcpEndpoint: { fontSize: 11, fontWeight: "600" }, mcpToolRow: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 }, mcpToolName: { fontSize: 12, fontWeight: "900" }, mcpToolDescription: { fontSize: 11, lineHeight: 15, fontWeight: "500" }, approvalButton: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" }, approvalButtonText: { fontSize: 11, fontWeight: "900" }, footer: { fontSize: 12, lineHeight: 18, fontWeight: "500", textAlign: "center", paddingHorizontal: 12 },
});
