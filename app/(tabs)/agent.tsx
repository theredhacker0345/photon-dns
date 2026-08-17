import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PageHeader, PressableCard, SectionHeading } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { cancelNativeTask, enqueueNativeTask, getSupervisorHealth, listNativeTasks } from "@/lib/native-supervisor";
import type { NativeSupervisorTask } from "@/modules/pocket-hermes-supervisor/src/PocketHermesSupervisorModule";

function formatTaskTime(value: string) {
  const timestamp = Number(value);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(Number.isFinite(timestamp) ? timestamp : value));
}

function taskTone(status: NativeSupervisorTask["status"], colors: ReturnType<typeof useColors>) {
  if (status === "succeeded") return colors.success;
  if (status === "failed" || status === "cancelled") return colors.warning;
  return colors.primary;
}

export default function AgentScreen() {
  const colors = useColors();
  const [body, setBody] = useState("");
  const [tasks, setTasks] = useState<NativeSupervisorTask[]>([]);
  const [hostState, setHostState] = useState<"running" | "starting" | "degraded" | "stopped" | "preview">(Platform.OS === "web" ? "preview" : "stopped");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (Platform.OS === "web") return;
    const [nextTasks, health] = await Promise.all([listNativeTasks(), getSupervisorHealth()]);
    setTasks(nextTasks.slice().reverse());
    setHostState(health?.state ?? "stopped");
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(interval);
  }, [refresh]);

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
      setNotice("Owner task queued in the private Hermes runtime.");
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

  const isReady = Platform.OS !== "web" && hostState === "running";
  const statusTitle = Platform.OS === "web" ? "Preview mode" : isReady ? "Private host is online" : hostState === "starting" ? "Private host is starting" : "Private host is offline";
  const statusDetail = Platform.OS === "web"
    ? "The browser preview has no Android foreground service. Install the APK to submit or view private runtime tasks."
    : isReady
      ? "Tasks run one at a time through the installed Hermes runtime and stay in private app storage."
      : "Start the configured Android host before submitting a task. Completed history remains private on this phone.";

  return <ScreenContainer className="px-5"><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="PRIVATE RUNTIME TASKS" title="Agent console" detail="Submit owner tasks to the embedded Hermes runtime." icon="forum" />
      <PressableCard style={[styles.bridgeNotice, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}28` }]}><View style={[styles.noticeIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name={isReady ? "verified-user" : "smartphone"} size={21} color={colors.primary} /></View><View style={styles.noticeCopy}><View style={styles.noticeTitleRow}><Text style={[styles.noticeTitle, { color: colors.foreground }]}>{statusTitle}</Text><View style={[styles.localBadge, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.localBadgeText, { color: colors.primary }]}>{Platform.OS === "web" ? "PREVIEW" : hostState.toUpperCase()}</Text></View></View><Text style={[styles.noticeDetail, { color: colors.muted }]}>{statusDetail}</Text></View></PressableCard>
      {notice ? <View style={[styles.inlineNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}><MaterialIcons name="info-outline" size={16} color={colors.primary} /><Text style={[styles.inlineNoticeText, { color: colors.muted }]}>{notice}</Text></View> : null}
      <SectionHeading eyebrow="RUNTIME HISTORY" title="Owner task queue" action={<Text style={[styles.count, { color: colors.muted }]}>{tasks.length ? `${tasks.length} tasks` : "Empty"}</Text>} />
      {tasks.length ? tasks.map((item) => { const tone = taskTone(item.status, colors); return <PressableCard key={item.id} style={styles.taskCard}><View style={styles.taskMeta}><Text style={[styles.taskLabel, { color: tone }]}>{item.status.toUpperCase()}</Text><Text style={[styles.taskTime, { color: colors.muted }]}>{formatTaskTime(item.updatedAt || item.createdAt)}</Text></View><Text style={[styles.taskBody, { color: colors.foreground }]}>{item.body}</Text>{item.result ? <View style={[styles.resultBox, { backgroundColor: colors.surface }]}><Text style={[styles.resultLabel, { color: colors.muted }]}>HERMES RESULT</Text><Text style={[styles.resultText, { color: colors.foreground }]}>{item.result}</Text></View> : null}{item.reason ? <Text style={[styles.reasonText, { color: colors.warning }]}>{item.reason}</Text> : null}{item.status === "queued" ? <Pressable accessibilityRole="button" onPress={() => void cancel(item.id)} style={({ pressed }) => [styles.cancel, { borderColor: colors.border }, pressed && styles.pressed]}><MaterialIcons name="close" size={14} color={colors.muted} /><Text style={[styles.cancelText, { color: colors.muted }]}>Cancel queued task</Text></Pressable> : null}</PressableCard>; }) : <View style={[styles.empty, { borderColor: colors.border }]}><MaterialIcons name="mark-chat-unread" size={27} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No runtime tasks yet</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>{Platform.OS === "web" ? "Install the Android APK to use the private task queue." : "Start the host, then submit an owner task below."}</Text></View>}
    </ScrollView>
    <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.border }]}><View style={styles.composerInputWrap}><Text style={[styles.composerLabel, { color: colors.muted }]}>SEND TO HERMES</Text><TextInput accessibilityLabel="Owner Hermes task" multiline editable={!submitting} value={body} onChangeText={setBody} placeholder="Ask your private Hermes host…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} textAlignVertical="top" /></View><Pressable accessibilityRole="button" accessibilityLabel="Submit owner task" onPress={() => void submit()} style={({ pressed }) => [styles.send, { backgroundColor: body.trim() && !submitting ? colors.primary : colors.border }, pressed && body.trim() && !submitting && styles.pressed]}><MaterialIcons name={submitting ? "hourglass-top" : "arrow-upward"} size={22} color="#FFFFFF" /></Pressable></View>
  </KeyboardAvoidingView></ScreenContainer>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingTop: 16, paddingBottom: 20, gap: 20 }, bridgeNotice: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, noticeIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, noticeCopy: { flex: 1, gap: 4 }, noticeTitleRow: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }, noticeTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "900" }, noticeDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, localBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }, localBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.75 }, count: { fontSize: 12, fontWeight: "700", paddingBottom: 2 }, inlineNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 14, padding: 11, marginTop: -6 }, inlineNoticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" }, taskCard: { gap: 11 }, taskMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, taskLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }, taskTime: { fontSize: 11, fontWeight: "600" }, taskBody: { fontSize: 15, lineHeight: 22, fontWeight: "600" }, resultBox: { borderRadius: 14, padding: 11, gap: 4 }, resultLabel: { fontSize: 9, letterSpacing: 0.8, fontWeight: "900" }, resultText: { fontSize: 13, lineHeight: 19, fontWeight: "500" }, reasonText: { fontSize: 12, lineHeight: 17, fontWeight: "800" }, cancel: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 }, cancelText: { fontSize: 11, fontWeight: "800" }, empty: { minHeight: 180, borderWidth: 1, borderStyle: "dashed", borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }, emptyTitle: { fontSize: 15, fontWeight: "900" }, emptyDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", textAlign: "center" }, composer: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, paddingBottom: 10, alignItems: "flex-end" }, composerInputWrap: { flex: 1, gap: 5 }, composerLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9, marginLeft: 2 }, input: { minHeight: 48, maxHeight: 112, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 13, fontSize: 14, lineHeight: 19, fontWeight: "500" }, send: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
