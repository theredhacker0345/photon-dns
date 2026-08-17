import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { PageHeader, PressableCard, PrimaryButton, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  deleteNativeSchedule,
  listNativeScheduleRuns,
  listNativeSchedules,
  setNativeScheduleEnabled,
  upsertNativeSchedule,
} from "@/lib/native-supervisor";
import type { NativeSupervisorSchedule, NativeSupervisorScheduleRun } from "@/modules/pocket-hermes-supervisor/src/PocketHermesSupervisorModule";

function formatMoment(value: string | null) {
  if (!value) return "Not run yet";
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime()) ? "Not run yet" : date.toLocaleString();
}

export default function AutomationsScreen() {
  const colors = useColors();
  const [schedules, setSchedules] = useState<NativeSupervisorSchedule[]>([]);
  const [runs, setRuns] = useState<NativeSupervisorScheduleRun[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [expression, setExpression] = useState("0 9 * * *");
  const [body, setBody] = useState("");
  const nativeAvailable = Platform.OS === "android";

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const [nextSchedules, nextRuns] = await Promise.all([listNativeSchedules(), listNativeScheduleRuns()]);
    setSchedules(nextSchedules);
    setRuns(nextRuns.slice().sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt)).slice(0, 5));
    setIsLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = async () => {
    if (!title.trim() || !expression.trim() || !body.trim() || isSaving) return;
    setIsSaving(true);
    setNotice(null);
    const saved = await upsertNativeSchedule({ id: `schedule-${Date.now().toString(36)}`, title: title.trim(), expression: expression.trim(), body: body.trim(), enabled: true });
    setIsSaving(false);
    if (!saved) {
      setNotice(nativeAvailable ? "The native scheduler rejected this schedule. Use a five-field cron expression and try again." : "Install the Android APK to create a private on-device schedule.");
      return;
    }
    setTitle("");
    setExpression("0 9 * * *");
    setBody("");
    setIsModalOpen(false);
    setNotice("Schedule saved on this Android device. It will deliver only to the configured private owner.");
    await refresh();
  };

  const toggle = async (schedule: NativeSupervisorSchedule, enabled: boolean) => {
    const updated = await setNativeScheduleEnabled(schedule.id, enabled);
    if (!updated) {
      setNotice("The Android scheduler could not update this schedule. Confirm the installed host is available.");
      return;
    }
    setSchedules((current) => current.map((item) => item.id === updated.id ? updated : item));
  };

  const remove = async (scheduleId: string) => {
    if (await deleteNativeSchedule(scheduleId)) {
      setSchedules((current) => current.filter((item) => item.id !== scheduleId));
      setNotice("Schedule removed from private Android storage.");
    } else {
      setNotice("The Android scheduler could not remove this schedule.");
    }
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><PageHeader eyebrow="ON-DEVICE SCHEDULER" title="Automations" detail="Validated schedules stay in private Android storage and deliver only through the owner-locked Telegram gateway." icon="event-repeat" /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Create automation" onPress={() => setIsModalOpen(true)} style={({ pressed }) => [styles.add, { backgroundColor: colors.primary }, pressed && styles.pressed]}><MaterialIcons name="add" size={24} color="#FFFFFF" /></Pressable>
        </View>

        <PressableCard style={[styles.schedulerCard, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}28` }]}>
          <View style={[styles.schedulerIcon, { backgroundColor: `${colors.primary}18` }]}><MaterialIcons name={nativeAvailable ? "verified-user" : "phone-android"} size={23} color={colors.primary} /></View>
          <View style={styles.schedulerCopy}><Text style={[styles.schedulerTitle, { color: colors.foreground }]}>{nativeAvailable ? "Private Android scheduler" : "Android APK required"}</Text><Text style={[styles.schedulerDetail, { color: colors.muted }]}>{nativeAvailable ? "Five-field cron schedules run in the foreground host with at most two attempts and retained run history." : "Web preview does not run the Android service. Install the APK to create or operate schedules."}</Text></View>
        </PressableCard>

        {notice ? <View style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.surface }]}><MaterialIcons name="info-outline" size={17} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.muted }]}>{notice}</Text></View> : null}

        <SectionHeading eyebrow="SAVED ON THIS DEVICE" title="Schedules" action={<Text style={[styles.count, { color: colors.muted }]}>{isLoading ? "Checking…" : schedules.length ? `${schedules.length} saved` : "Empty"}</Text>} />
        {schedules.length ? schedules.map((schedule) => (
          <PressableCard key={schedule.id} style={styles.automationCard}>
            <View style={styles.automationTop}>
              <View style={[styles.miniIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="schedule" size={20} color={colors.primary} /></View>
              <View style={styles.automationCopy}><Text style={[styles.automationTitle, { color: colors.foreground }]}>{schedule.title}</Text><Text style={[styles.automationDetail, { color: colors.muted }]}>{schedule.expression} · Private owner delivery</Text></View>
              <Switch value={schedule.enabled} onValueChange={(value) => void toggle(schedule, value)} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={schedule.enabled ? colors.success : colors.muted} />
            </View>
            <Text numberOfLines={2} style={[styles.jobPreview, { color: colors.muted }]}>{schedule.body}</Text>
            <View style={[styles.runtimeLine, { borderTopColor: colors.border }]}><MaterialIcons name={schedule.lastRunStatus === "failed" ? "warning-amber" : "verified-user"} size={15} color={schedule.lastRunStatus === "failed" ? colors.warning : schedule.enabled ? colors.success : colors.muted} /><Text style={[styles.runtimeLineText, { color: schedule.enabled ? colors.success : colors.muted }]}>{schedule.enabled ? `${schedule.lastRunStatus ?? "Ready"} · ${formatMoment(schedule.lastRunAt)}` : "Paused"}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${schedule.title}`} onPress={() => void remove(schedule.id)} hitSlop={8}><MaterialIcons name="delete-outline" size={18} color={colors.muted} /></Pressable></View>
          </PressableCard>
        )) : (
          <View style={[styles.empty, { borderColor: colors.border }]}><MaterialIcons name="auto-awesome-motion" size={28} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No private schedules saved</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>Create an owner-only routine. The Android host validates its cron expression before it is persisted.</Text><View style={styles.emptyAction}><SecondaryButton label="Create schedule" icon="add" onPress={() => setIsModalOpen(true)} /></View></View>
        )}

        <SectionHeading eyebrow="RECENT EXECUTION" title="Run history" action={<Text style={[styles.count, { color: colors.muted }]}>{runs.length ? `${runs.length} retained` : "Empty"}</Text>} />
        {runs.length ? runs.map((run) => <View key={run.id} style={[styles.run, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.runIcon, { backgroundColor: run.status === "failed" ? `${colors.warning}18` : `${colors.success}16` }]}><MaterialIcons name={run.status === "failed" ? "error-outline" : "send"} size={17} color={run.status === "failed" ? colors.warning : colors.success} /></View><View style={styles.runCopy}><Text style={[styles.runTitle, { color: colors.foreground }]}>{run.scheduleTitle}</Text><Text style={[styles.runDetail, { color: colors.muted }]}>{run.status} · attempt {run.attempt} · {formatMoment(run.updatedAt)}</Text>{run.reason ? <Text style={[styles.runReason, { color: colors.muted }]}>{run.reason}</Text> : null}</View></View>) : <Text style={[styles.emptyHistory, { color: colors.muted }]}>Runs appear here after the Android host executes a schedule.</Text>}
      </ScrollView>

      <Modal animationType="slide" transparent visible={isModalOpen} onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalShade}><View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}><View style={[styles.handle, { backgroundColor: colors.border }]} /><Text style={[styles.sheetTitle, { color: colors.foreground }]}>New private schedule</Text><Text style={[styles.sheetSubtitle, { color: colors.muted }]}>Use five cron fields: minute, hour, day, month, weekday. The completed task is routed only to your owner Telegram chat.</Text><Label text="Task name" color={colors.muted} /><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Daily project digest" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} /><Label text="Cron expression" color={colors.muted} /><TextInput value={expression} onChangeText={setExpression} placeholder="0 9 * * *" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.field, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} /><Label text="Hermes task" color={colors.muted} /><TextInput value={body} onChangeText={setBody} placeholder="e.g. Summarize today's project activity." placeholderTextColor={colors.muted} multiline textAlignVertical="top" style={[styles.field, styles.taskField, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} /><View style={styles.sheetActions}><View style={styles.cancelWrap}><SecondaryButton label="Cancel" onPress={() => setIsModalOpen(false)} /></View><View style={styles.saveWrap}><PrimaryButton label={isSaving ? "Saving…" : "Save private schedule"} icon="check" onPress={() => void save()} disabled={!title.trim() || !expression.trim() || !body.trim() || isSaving} /></View></View></View></View>
      </Modal>
    </ScreenContainer>
  );
}

function Label({ text, color }: { text: string; color: string }) { return <Text style={[styles.label, { color }]}>{text.toUpperCase()}</Text>; }

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 34, gap: 20 }, header: { flexDirection: "row", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }, headerCopy: { flex: 1 }, add: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 2 }, pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  schedulerCard: { flexDirection: "row", gap: 13, alignItems: "center" }, schedulerIcon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center" }, schedulerCopy: { flex: 1, gap: 3 }, schedulerTitle: { fontSize: 14, fontWeight: "900" }, schedulerDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1, borderRadius: 14 }, noticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "600" }, count: { fontSize: 12, fontWeight: "700", paddingBottom: 2 },
  automationCard: { gap: 11 }, automationTop: { flexDirection: "row", alignItems: "center", gap: 11 }, miniIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, automationCopy: { flex: 1, gap: 3 }, automationTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, automationDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, jobPreview: { fontSize: 12, lineHeight: 17, fontWeight: "500", paddingHorizontal: 2 }, runtimeLine: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }, runtimeLineText: { flex: 1, fontSize: 11, fontWeight: "800" },
  empty: { minHeight: 210, borderWidth: 1, borderStyle: "dashed", borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 25, gap: 9 }, emptyTitle: { fontSize: 15, fontWeight: "900" }, emptyDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", textAlign: "center" }, emptyAction: { marginTop: 8 }, run: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: 16, padding: 11 }, runIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" }, runCopy: { flex: 1, gap: 2 }, runTitle: { fontSize: 13, fontWeight: "900" }, runDetail: { fontSize: 11, lineHeight: 15, fontWeight: "600" }, runReason: { fontSize: 11, lineHeight: 15, fontWeight: "500" }, emptyHistory: { fontSize: 12, lineHeight: 17, fontWeight: "600", paddingHorizontal: 3, marginTop: -8 },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(6,8,18,0.46)" }, sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, padding: 22, gap: 10 }, handle: { width: 38, height: 4, borderRadius: 4, alignSelf: "center", marginBottom: 4 }, sheetTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }, sheetSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: "500", marginBottom: 6 }, label: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { borderWidth: 1, minHeight: 48, borderRadius: 14, paddingHorizontal: 13, fontSize: 14, fontWeight: "600" }, taskField: { minHeight: 92, paddingTop: 12 }, sheetActions: { flexDirection: "row", gap: 10, marginTop: 12 }, cancelWrap: { flex: 0.9 }, saveWrap: { flex: 1.1 },
});
