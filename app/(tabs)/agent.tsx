import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";

import { PageHeader, PressableCard, SecondaryButton, SectionHeading } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { approveNativeCodeJob, cancelNativeTask, compressNativeContext, enqueueNativeTask, formatBytes, getNativeCodeSandboxStatus, getNativeContextStatus, getSupervisorHealth, listNativeCodeAuditLog, listNativeConversation, listNativeTasks, proposeNativeCodeJob, resetNativeConversation, revokeNativeCodeJob, runNativeApprovedCodeJob, setNativeCodeSandboxEnabled } from "@/lib/native-supervisor";
import type { NativeCodeAuditEntry, NativeCodeJobProposal, NativeCodeJobResult, NativeCodeSandboxStatus, NativeSupervisorContext, NativeSupervisorConversationEntry, NativeSupervisorTask } from "@/modules/pocket-hermes-supervisor/src/PocketHermesSupervisorModule";

function formatTaskTime(value: string) {
  const timestamp = Number(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(Number.isFinite(timestamp) ? timestamp : value));
}

function formatTokens(value: number) {
  return new Intl.NumberFormat(undefined, { notation: value >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: value >= 1_000_000 ? 1 : 0 }).format(value);
}

function taskTone(status: NativeSupervisorTask["status"], colors: ReturnType<typeof useColors>) {
  if (status === "succeeded") return colors.success;
  if (status === "failed" || status === "cancelled") return colors.warning;
  return colors.primary;
}

function auditTone(status: NativeCodeAuditEntry["status"], colors: ReturnType<typeof useColors>) {
  if (status === "ok") return colors.success;
  if (status === "rejected") return colors.warning;
  return colors.error;
}

function conversationOriginLabel(origin: NativeSupervisorConversationEntry["origin"]) {
  if (origin === "app") return "THIS PHONE";
  if (origin === "telegram") return "TELEGRAM";
  if (origin === "schedule") return "SCHEDULE";
  return "SYSTEM";
}

function ContextCard({ context, ready, compressing, onCompress }: { context: NativeSupervisorContext | null; ready: boolean; compressing: boolean; onCompress: () => void }) {
  const colors = useColors();
  const available = Boolean(context?.available);
  const percentage = available ? Math.min(100, Math.max(0, context?.percentage ?? 0)) : 0;
  const detail = Platform.OS === "web"
    ? "Install the Android APK to inspect the live Hermes context window."
    : available
      ? `${formatTokens(context?.usedTokens ?? 0)} of ${formatTokens(context?.totalTokens ?? 0)} tokens in the active owner session.`
      : context?.reason ?? "Context usage appears after the first completed owner task.";
  const compressEnabled = ready && available && !compressing;

  return <PressableCard style={styles.contextCard}>
    <View style={styles.contextTopline}>
      <View style={styles.contextLabelRow}><MaterialIcons name="data-usage" size={18} color={colors.primary} /><Text style={[styles.contextLabel, { color: colors.foreground }]}>Context window</Text></View>
      <Text style={[styles.contextPercent, { color: available ? colors.primary : colors.muted }]}>{available ? `${percentage}%` : "—"}</Text>
    </View>
    <View style={[styles.contextTrack, { backgroundColor: colors.border }]}><View style={[styles.contextFill, { backgroundColor: colors.primary, width: `${percentage}%` }]} /></View>
    <Text style={[styles.contextDetail, { color: colors.muted }]}>{detail}</Text>
    {available && context?.thresholdTokens ? <Text style={[styles.contextMeta, { color: colors.muted }]}>Auto-compression threshold: {formatTokens(context.thresholdTokens)} tokens · Manual compresses: {context.compressionCount}</Text> : null}
    <SecondaryButton label="Compress context" icon="compress" onPress={onCompress} disabled={!compressEnabled} loading={compressing} />
    <Text style={[styles.contextHint, { color: colors.muted }]}>Creates a compact provider summary of earlier turns. If compression cannot finish safely, Hermes leaves the conversation unchanged.</Text>
  </PressableCard>;
}

function CodeSandboxCard({ sandbox, source, proposal, result, busy, onSourceChange, onToggle, onPropose, onApprove, onRun, onRevoke }: {
  sandbox: NativeCodeSandboxStatus | null;
  source: string;
  proposal: NativeCodeJobProposal | null;
  result: NativeCodeJobResult | null;
  busy: boolean;
  onSourceChange: (value: string) => void;
  onToggle: () => void;
  onPropose: () => void;
  onApprove: () => void;
  onRun: () => void;
  onRevoke: () => void;
}) {
  const colors = useColors();
  const enabled = Boolean(sandbox?.enabled);
  const hasSource = source.trim().length > 0;
  const runnable = enabled && Boolean(proposal?.hash) && !busy;
  const preview = Platform.OS === "web";
  return <PressableCard style={sandboxStyles.card}>
    <View style={sandboxStyles.header}><View style={sandboxStyles.titleRow}><MaterialIcons name="code" size={18} color={colors.primary} /><Text style={[sandboxStyles.title, { color: colors.foreground }]}>Code sandbox</Text></View><View style={[sandboxStyles.badge, { backgroundColor: `${enabled ? colors.success : colors.muted}18` }]}><Text style={[sandboxStyles.badgeText, { color: enabled ? colors.success : colors.muted }]}>{preview ? "APK ONLY" : enabled ? "ARMED" : "OFF"}</Text></View></View>
    <Text style={[sandboxStyles.detail, { color: colors.muted }]}>Owner-approved JavaScript only. No terminal, filesystem, network, module, plugin, or Android API access. Approvals expire after 10 minutes.</Text>
    <View style={[sandboxStyles.policy, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[sandboxStyles.policyText, { color: colors.muted }]}>{sandbox ? `${sandbox.defaultTimeoutMs} ms · ${Math.round(sandbox.defaultMemoryBytes / 1024 / 1024)} MiB · ${Math.round(sandbox.defaultMaxOutputBytes / 1024)} KiB output · ${sandbox.activeApprovals} active approval${sandbox.activeApprovals === 1 ? "" : "s"}` : "Install the Android APK to configure the isolated executor."}</Text></View>
    <TextInput accessibilityLabel="Owner JavaScript source" multiline editable={!busy && !preview} value={source} onChangeText={onSourceChange} placeholder="Example: [1, 2, 3].map(x => x * x).join(', ')" placeholderTextColor={colors.muted} style={[sandboxStyles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} textAlignVertical="top" />
    {proposal ? <Text style={[sandboxStyles.hash, { color: colors.muted }]}>SEALED SHA-256 · {proposal.hash.slice(0, 12)}… · {proposal.sourceBytes} bytes</Text> : null}
    {result ? <View style={[sandboxStyles.result, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[sandboxStyles.resultLabel, { color: result.status === "ok" ? colors.success : colors.warning }]}>{result.status.toUpperCase()}{result.truncated ? " · TRUNCATED" : ""}</Text><Text selectable style={[sandboxStyles.resultText, { color: colors.foreground }]}>{result.output}</Text></View> : null}
    <View style={sandboxStyles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Toggle code sandbox" onPress={onToggle} disabled={busy || preview} style={({ pressed }) => [sandboxStyles.action, { backgroundColor: enabled ? `${colors.warning}18` : `${colors.primary}18`, borderColor: enabled ? `${colors.warning}50` : `${colors.primary}50` }, (pressed || busy || preview) && sandboxStyles.disabled]}><Text style={[sandboxStyles.actionText, { color: enabled ? colors.warning : colors.primary }]}>{enabled ? "Disable" : "Enable"}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Seal code proposal" onPress={onPropose} disabled={!hasSource || busy || preview} style={({ pressed }) => [sandboxStyles.action, { borderColor: colors.border }, (!hasSource || pressed || busy || preview) && sandboxStyles.disabled]}><Text style={[sandboxStyles.actionText, { color: colors.foreground }]}>Seal</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Approve code proposal" onPress={onApprove} disabled={!hasSource || !enabled || busy || preview} style={({ pressed }) => [sandboxStyles.action, { borderColor: colors.border }, (!hasSource || !enabled || pressed || busy || preview) && sandboxStyles.disabled]}><Text style={[sandboxStyles.actionText, { color: colors.foreground }]}>Approve</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Run approved code" onPress={onRun} disabled={!runnable || preview} style={({ pressed }) => [sandboxStyles.action, { backgroundColor: runnable ? colors.primary : colors.border, borderColor: runnable ? colors.primary : colors.border }, (!runnable || pressed || preview) && sandboxStyles.disabled]}><Text style={[sandboxStyles.actionText, { color: runnable ? "#FFFFFF" : colors.muted }]}>{busy ? "Running…" : "Run"}</Text></Pressable>
    </View>
    {proposal ? <Pressable accessibilityRole="button" onPress={onRevoke} disabled={busy || preview} style={({ pressed }) => [sandboxStyles.revoke, { borderColor: colors.border }, (pressed || busy || preview) && sandboxStyles.disabled]}><MaterialIcons name="block" size={13} color={colors.muted} /><Text style={[sandboxStyles.revokeText, { color: colors.muted }]}>Revoke this source hash</Text></Pressable> : null}
  </PressableCard>;
}

function CodeAuditLogCard({ entries, available, loaded, refreshing, onRefresh }: {
  entries: NativeCodeAuditEntry[];
  available: boolean;
  loaded: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const colors = useColors();
  const visibleEntries = entries.slice(0, 8);
  return <PressableCard style={auditStyles.card}>
    <View style={auditStyles.header}>
      <View style={auditStyles.titleRow}><MaterialIcons name="history" size={18} color={colors.primary} /><Text style={[auditStyles.title, { color: colors.foreground }]}>Execution history</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh code execution history" onPress={onRefresh} disabled={!available || refreshing} style={({ pressed }) => [auditStyles.refresh, { borderColor: colors.border }, (pressed || !available || refreshing) && auditStyles.disabled]}><MaterialIcons name={refreshing ? "hourglass-top" : "refresh"} size={14} color={colors.primary} /><Text style={[auditStyles.refreshText, { color: colors.primary }]}>{refreshing ? "Checking" : "Refresh"}</Text></Pressable>
    </View>
    <Text style={[auditStyles.detail, { color: colors.muted }]}>Private metadata only. Source, output, error text, credentials, and approval records are never shown here.</Text>
    {!available ? <View style={[auditStyles.empty, { borderColor: colors.border }]}><MaterialIcons name="phonelink-lock" size={22} color={colors.muted} /><Text style={[auditStyles.emptyTitle, { color: colors.foreground }]}>History unavailable</Text><Text style={[auditStyles.emptyDetail, { color: colors.muted }]}>The Android isolated executor must be available before its private audit metadata can be read.</Text></View> : !loaded || refreshing && !visibleEntries.length ? <View style={[auditStyles.empty, { borderColor: colors.border }]}><MaterialIcons name="hourglass-top" size={22} color={colors.muted} /><Text style={[auditStyles.emptyDetail, { color: colors.muted }]}>Checking the encrypted local ledger…</Text></View> : visibleEntries.length ? <View style={auditStyles.entries}>{visibleEntries.map((entry) => { const tone = auditTone(entry.status, colors); return <View key={`${entry.occurredAt}-${entry.hash}`} style={[auditStyles.entry, { borderColor: colors.border }]}><View style={auditStyles.entryTopline}><Text style={[auditStyles.status, { color: tone }]}>{entry.status.toUpperCase()}</Text><Text style={[auditStyles.time, { color: colors.muted }]}>{formatTaskTime(entry.occurredAt)}</Text></View><Text style={[auditStyles.meta, { color: colors.muted }]}>Job {entry.hash.slice(0, 12)}… · {formatBytes(entry.outputBytes)} metadata{entry.truncated ? " · output limited" : ""}{entry.timedOut ? " · deadline reached" : ""}</Text></View>; })}</View> : <View style={[auditStyles.empty, { borderColor: colors.border }]}><MaterialIcons name="shield" size={22} color={colors.muted} /><Text style={[auditStyles.emptyTitle, { color: colors.foreground }]}>No code executions yet</Text><Text style={[auditStyles.emptyDetail, { color: colors.muted }]}>Executed or rejected owner-approved jobs will appear as redacted metadata on this phone.</Text></View>}
  </PressableCard>;
}

export default function AgentScreen() {
  const colors = useColors();
  const isFocused = useIsFocused();
  const [body, setBody] = useState("");
  const [tasks, setTasks] = useState<NativeSupervisorTask[]>([]);
  const [conversation, setConversation] = useState<NativeSupervisorConversationEntry[]>([]);
  const [hostState, setHostState] = useState<"running" | "starting" | "degraded" | "stopped" | "preview">(Platform.OS === "web" ? "preview" : "stopped");
  const [context, setContext] = useState<NativeSupervisorContext | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [sandbox, setSandbox] = useState<NativeCodeSandboxStatus | null>(null);
  const [codeSource, setCodeSource] = useState("");
  const [codeProposal, setCodeProposal] = useState<NativeCodeJobProposal | null>(null);
  const [codeResult, setCodeResult] = useState<NativeCodeJobResult | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [auditEntries, setAuditEntries] = useState<NativeCodeAuditEntry[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditRefreshing, setAuditRefreshing] = useState(false);
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [resettingConversation, setResettingConversation] = useState(false);

  const refreshAuditLog = useCallback(async () => {
    if (Platform.OS !== "android") return;
    setAuditRefreshing(true);
    const nextEntries = await listNativeCodeAuditLog();
    setAuditEntries(nextEntries);
    setAuditLoaded(true);
    setAuditRefreshing(false);
  }, []);

  const refresh = useCallback(async () => {
    if (Platform.OS === "web") return;
    const [nextTasks, nextConversation, health, nextContext, nextSandbox] = await Promise.all([listNativeTasks(), listNativeConversation(), getSupervisorHealth(), getNativeContextStatus(), getNativeCodeSandboxStatus()]);
    setTasks(nextTasks.slice().reverse());
    setConversation(nextConversation);
    setHostState(health?.state ?? "stopped");
    setContext(nextContext);
    setSandbox(nextSandbox);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    void refresh();
    void refreshAuditLog();
    const interval = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(interval);
  }, [isFocused, refresh, refreshAuditLog]);

  const submit = async () => {
    const taskBody = body.trim();
    if (!taskBody || submitting) return;
    if (Platform.OS === "web") {
      setNotice("Preview mode cannot run Hermes tasks. Install the Android APK and start the private host.");
      return;
    }
    setSubmitting(true);
    const task = await enqueueNativeTask({ id: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, body: taskBody });
    if (!task) {
      setNotice("The Android host is not ready. Save protected configuration, start the host, then try again.");
    } else {
      setBody("");
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      setNotice("Owner task queued. Its reply will appear here and is mirrored once to your authorized Telegram chat.");
      void refresh();
    }
    setSubmitting(false);
  };

  const cancel = async (taskId: string) => {
    const task = await cancelNativeTask(taskId);
    if (task) {
      setTasks((current) => current.map((item) => item.id === task.id ? task : item));
      setNotice("Queued task cancelled.");
    }
  };

  const confirmConversationReset = () => {
    if (Platform.OS === "web") {
      setNotice("Preview mode cannot clear Android-private conversation context.");
      return;
    }
    Alert.alert(
      "Clear shared conversation?",
      "This clears the redacted transcript on this phone and resets the owner’s shared model context. It does not delete messages already stored by Telegram.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear & reset",
          style: "destructive",
          onPress: () => void (async () => {
            setResettingConversation(true);
            const cleared = await resetNativeConversation();
            if (cleared) {
              setConversation([]);
              setContext(null);
              setNotice("Shared conversation history and model context were reset on this phone.");
              await refresh();
            } else {
              setNotice("The private conversation could not be reset. Confirm the host is running, then try again.");
            }
            setResettingConversation(false);
          })(),
        },
      ],
    );
  };

  const compress = async () => {
    if (Platform.OS === "web") {
      setNotice("Preview mode cannot inspect or compress the private Hermes context.");
      return;
    }
    if (!isReady || !context?.available || compressing) return;
    setCompressing(true);
    const result = await compressNativeContext();
    if (!result) {
      setNotice("Context compression is unavailable. Confirm the private host is running, then try again.");
    } else {
      setContext(result.context);
      setNotice(result.message);
    }
    setCompressing(false);
    void refresh();
  };

  const mutateSandbox = async (operation: () => Promise<NativeCodeSandboxStatus | null>, success: string) => {
    if (Platform.OS === "web" || codeBusy) { setNotice("Preview mode cannot change the Android code-sandbox policy."); return; }
    setCodeBusy(true);
    const next = await operation();
    if (next) { setSandbox(next); setNotice(success); } else setNotice("Code-sandbox policy update was unavailable. Confirm the Android APK is installed.");
    setCodeBusy(false);
  };

  const sealCode = async () => {
    if (Platform.OS === "web" || codeBusy || !codeSource.trim()) { setNotice("Enter JavaScript source on the installed Android APK before sealing it."); return; }
    setCodeBusy(true);
    const next = await proposeNativeCodeJob(codeSource);
    if (next) { setCodeProposal(next); setCodeResult(null); setNotice("Source sealed. Enable the sandbox, then approve this exact hash to run it."); } else setNotice("The source could not be sealed. Maximum source size is 24 KiB.");
    setCodeBusy(false);
  };

  const approveCode = async () => {
    if (Platform.OS === "web" || codeBusy || !sandbox?.enabled || !codeSource.trim()) { setNotice("Enable the Android code sandbox before approving a sealed source."); return; }
    setCodeBusy(true);
    const next = await approveNativeCodeJob(codeSource);
    if (next?.approved) { setNotice("Exact source hash approved for 10 minutes. Run remains owner-initiated."); await refresh(); } else setNotice("Code approval was unavailable.");
    setCodeBusy(false);
  };

  const runCode = async () => {
    if (Platform.OS === "web" || codeBusy || !codeProposal?.hash) { setNotice("Seal and approve the exact source on Android before running it."); return; }
    setCodeBusy(true);
    const next = await runNativeApprovedCodeJob({ source: codeSource });
    if (next) { setCodeResult(next); setNotice(next.status === "ok" ? "Isolated code job completed." : "Isolated code job ended without exposing host details."); await Promise.all([refresh(), refreshAuditLog()]); } else setNotice("The isolated executor was unavailable.");
    setCodeBusy(false);
  };

  const revokeCode = async () => {
    if (!codeProposal?.hash) return;
    if (Platform.OS === "web" || codeBusy) { setNotice("Preview mode cannot revoke Android code approvals."); return; }
    setCodeBusy(true);
    const next = await revokeNativeCodeJob(codeProposal.hash);
    if (next?.revoked) { setNotice("The source-hash approval was revoked."); await refresh(); } else setNotice("Code approval revocation was unavailable.");
    setCodeBusy(false);
  };

  const isReady = Platform.OS !== "web" && hostState === "running";
  const statusTitle = Platform.OS === "web" ? "Preview mode" : isReady ? "Private host is online" : hostState === "starting" ? "Private host is starting" : "Private host is offline";
  const statusDetail = Platform.OS === "web"
    ? "The browser preview has no Android foreground service. Install the APK to submit or view private runtime tasks."
    : isReady
      ? "Tasks run one at a time through the installed Hermes runtime and stay in private app storage."
      : "Start the configured Android host before submitting a task. Completed history remains private on this phone.";

  return <ScreenContainer className="px-5"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="PRIVATE RUNTIME" title="Agent" detail="Send private owner tasks to this phone's Hermes runtime." icon="forum" />
      <PressableCard style={[styles.bridgeNotice, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}28` }]}><View style={[styles.noticeIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name={isReady ? "verified-user" : "smartphone"} size={21} color={colors.primary} /></View><View style={styles.noticeCopy}><View style={styles.noticeTitleRow}><Text style={[styles.noticeTitle, { color: colors.foreground }]}>{statusTitle}</Text><View style={[styles.localBadge, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.localBadgeText, { color: colors.primary }]}>{Platform.OS === "web" ? "PREVIEW" : hostState.toUpperCase()}</Text></View></View><Text style={[styles.noticeDetail, { color: colors.muted }]}>{statusDetail}</Text></View></PressableCard>
      {notice ? <View style={[styles.inlineNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialIcons name="info-outline" size={16} color={colors.primary} /><Text style={[styles.inlineNoticeText, { color: colors.muted }]}>{notice}</Text></View> : null}
      <SectionHeading eyebrow="SHARED OWNER CHAT" title="Conversation" action={<Text style={[styles.count, { color: colors.muted }]}>{conversation.length ? `${conversation.length} turns` : "Empty"}</Text>} />
      <Text style={[styles.conversationHint, { color: colors.muted }]}>This private, bounded timeline combines this phone and your authorized Telegram chat. App replies are mirrored to Telegram once; Telegram messages remain visible in Telegram too.</Text>
      {conversation.length ? <View style={styles.conversationList}>{conversation.map((entry) => {
        const isAssistant = entry.role === "assistant";
        return <View key={entry.id} style={[styles.turn, isAssistant ? styles.turnAssistant : styles.turnOwner, { backgroundColor: isAssistant ? `${colors.primary}12` : colors.surface, borderColor: isAssistant ? `${colors.primary}2D` : colors.border }]}>
          <View style={styles.turnMeta}><Text style={[styles.turnLabel, { color: isAssistant ? colors.primary : colors.muted }]}>{isAssistant ? "POCKET RELAY" : conversationOriginLabel(entry.origin)}</Text><Text style={[styles.turnTime, { color: colors.muted }]}>{formatTaskTime(String(entry.createdAt))}</Text></View>
          <Text selectable style={[styles.turnBody, { color: colors.foreground }]}>{entry.body}</Text>
        </View>;
      })}</View> : <View style={[styles.empty, { borderColor: colors.border }]}><MaterialIcons name="mark-chat-unread" size={27} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No shared conversation yet</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>{Platform.OS === "web" ? "Install the Android APK to use the shared owner conversation." : "Start the host, then send a message here or from your authorized Telegram chat."}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel="Clear shared conversation and reset context" onPress={confirmConversationReset} disabled={resettingConversation || Platform.OS === "web"} style={({ pressed }) => [styles.resetConversation, { borderColor: colors.border }, (pressed || resettingConversation || Platform.OS === "web") && styles.pressed]}><MaterialIcons name="restart-alt" size={15} color={colors.muted} /><Text style={[styles.resetConversationText, { color: colors.muted }]}>{resettingConversation ? "Resetting shared context…" : "Clear shared conversation & context"}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={advancedVisible ? "Hide owner tools and safeguards" : "Show owner tools and safeguards"} accessibilityState={{ expanded: advancedVisible }} onPress={() => setAdvancedVisible((visible) => !visible)} style={({ pressed }) => [advancedStyles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
        <View style={advancedStyles.copy}><Text style={[advancedStyles.title, { color: colors.foreground }]}>Owner tools & safeguards</Text><Text style={[advancedStyles.detail, { color: colors.muted }]}>Context controls, isolated JavaScript, and execution metadata</Text></View><MaterialIcons name={advancedVisible ? "expand-less" : "expand-more"} size={24} color={colors.primary} />
      </Pressable>
      {advancedVisible ? <View style={advancedStyles.content}>
        <ContextCard context={context} ready={isReady} compressing={compressing} onCompress={() => void compress()} />
        <CodeSandboxCard sandbox={sandbox} source={codeSource} proposal={codeProposal} result={codeResult} busy={codeBusy} onSourceChange={(value) => { setCodeSource(value); setCodeProposal(null); setCodeResult(null); }} onToggle={() => void mutateSandbox(() => setNativeCodeSandboxEnabled(!sandbox?.enabled), sandbox?.enabled ? "Code execution disabled and future runs rejected." : "Code execution armed. Every source still needs a short-lived owner approval.")} onPropose={() => void sealCode()} onApprove={() => void approveCode()} onRun={() => void runCode()} onRevoke={() => void revokeCode()} />
        {Platform.OS === "android" ? <CodeAuditLogCard entries={auditEntries} available={sandbox !== null} loaded={auditLoaded} refreshing={auditRefreshing} onRefresh={() => void refreshAuditLog()} /> : null}
      </View> : null}
    </ScrollView>
    <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.border }]}><View style={styles.composerInputWrap}><Text style={[styles.composerLabel, { color: colors.muted }]}>SEND TO HERMES</Text><TextInput accessibilityLabel="Owner Hermes task" multiline editable={!submitting} value={body} onChangeText={setBody} placeholder="Ask your private Hermes host…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} textAlignVertical="top" /></View><Pressable accessibilityRole="button" accessibilityLabel="Submit owner task" onPress={() => void submit()} style={({ pressed }) => [styles.send, { backgroundColor: body.trim() && !submitting ? colors.primary : colors.border }, pressed && body.trim() && !submitting && styles.pressed]}><MaterialIcons name={submitting ? "hourglass-top" : "arrow-upward"} size={22} color="#FFFFFF" /></Pressable></View>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingTop: 16, paddingBottom: 20, gap: 20 }, bridgeNotice: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, noticeIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, noticeCopy: { flex: 1, gap: 4 }, noticeTitleRow: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }, noticeTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "900" }, noticeDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, localBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }, localBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.75 }, contextCard: { gap: 10 }, contextTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, contextLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 }, contextLabel: { fontSize: 15, fontWeight: "900" }, contextPercent: { fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] }, contextTrack: { height: 7, borderRadius: 99, overflow: "hidden" }, contextFill: { height: "100%", borderRadius: 99, minWidth: 0 }, contextDetail: { fontSize: 12, lineHeight: 17, fontWeight: "600" }, contextMeta: { fontSize: 11, lineHeight: 16, fontWeight: "600" }, contextHint: { fontSize: 10, lineHeight: 14, fontWeight: "500" }, count: { fontSize: 12, fontWeight: "700", paddingBottom: 2 }, inlineNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 14, padding: 11, marginTop: -6 }, inlineNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" }, conversationHint: { marginTop: -10, fontSize: 11, lineHeight: 16, fontWeight: "600" }, conversationList: { gap: 9 }, turn: { gap: 6, borderWidth: 1, borderRadius: 17, padding: 12 }, turnOwner: { alignSelf: "flex-start", maxWidth: "94%" }, turnAssistant: { alignSelf: "flex-end", maxWidth: "94%" }, turnMeta: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }, turnLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.75 }, turnTime: { fontSize: 10, fontWeight: "700" }, turnBody: { fontSize: 14, lineHeight: 20, fontWeight: "500" }, resetConversation: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: -8 }, resetConversationText: { fontSize: 11, fontWeight: "800" }, empty: { minHeight: 180, borderWidth: 1, borderStyle: "dashed", borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }, emptyTitle: { fontSize: 15, fontWeight: "900" }, emptyDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", textAlign: "center" }, composer: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, paddingBottom: 10, alignItems: "flex-end" }, composerInputWrap: { flex: 1, gap: 5 }, composerLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9, marginLeft: 2 }, input: { minHeight: 48, maxHeight: 112, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 13, fontSize: 14, lineHeight: 19, fontWeight: "500" }, send: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});

const advancedStyles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 13 },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 13, fontWeight: "900" },
  detail: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  content: { gap: 14 },
});

const sandboxStyles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: 15, fontWeight: "900" },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  badgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  detail: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
  policy: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },
  policyText: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
  input: { minHeight: 80, maxHeight: 130, borderWidth: 1, borderRadius: 14, padding: 11, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 12, lineHeight: 18 },
  hash: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  action: { minHeight: 33, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 11, fontWeight: "900" },
  revoke: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  revokeText: { fontSize: 10, fontWeight: "800" },
  result: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  resultLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  resultText: { fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }), fontSize: 11, lineHeight: 16 },
  disabled: { opacity: 0.52 },
});

const auditStyles = StyleSheet.create({
  card: { gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontSize: 15, fontWeight: "900" },
  refresh: { minHeight: 31, flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, justifyContent: "center" },
  refreshText: { fontSize: 10, fontWeight: "900" },
  detail: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
  entries: { gap: 7 },
  entry: { gap: 4, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  entryTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  status: { fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  time: { fontSize: 10, fontWeight: "700" },
  meta: { fontSize: 10, lineHeight: 15, fontWeight: "600" },
  empty: { minHeight: 104, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 15, padding: 16 },
  emptyTitle: { fontSize: 13, fontWeight: "900" },
  emptyDetail: { fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.52 },
});
