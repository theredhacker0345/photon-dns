import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PageHeader, PressableCard, SectionHeading } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { usePocketHermes } from "@/lib/pocket-hermes-store";

function formatDraftTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default function AgentScreen() {
  const colors = useColors();
  const { drafts, phase, addDraft } = usePocketHermes();
  const [draft, setDraft] = useState("");
  const submit = () => { if (draft.trim()) { addDraft(draft); setDraft(""); } };

  return (
    <ScreenContainer className="px-5">
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PageHeader eyebrow="PRIVATE TASK QUEUE" title="Agent console" detail="Draft instructions on this phone. The embedded Hermes relay will deliver them when the host is online." icon="forum" />
          <PressableCard style={[styles.bridgeNotice, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}28` }]}><View style={[styles.noticeIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="hub" size={21} color={colors.primary} /></View><View style={styles.noticeCopy}><View style={styles.noticeTitleRow}><Text style={[styles.noticeTitle, { color: colors.foreground }]}>Native relay {phase === "bridge_required" ? "is pending" : "is not connected"}</Text><View style={[styles.localBadge, { backgroundColor: `${colors.primary}16` }]}><Text style={[styles.localBadgeText, { color: colors.primary }]}>LOCAL</Text></View></View><Text style={[styles.noticeDetail, { color: colors.muted }]}>Nothing transmits from this preview. Drafts stay on the device until the bundled runtime is installed.</Text></View></PressableCard>

          <SectionHeading eyebrow="TASK INBOX" title="Saved instructions" action={<Text style={[styles.count, { color: colors.muted }]}>{drafts.length ? `${drafts.length} drafts` : "Empty"}</Text>} />
          {drafts.length ? drafts.map((item) => <PressableCard key={item.id} style={styles.draftCard}><View style={styles.draftMeta}><Text style={[styles.draftLabel, { color: colors.primary }]}>OWNER DRAFT</Text><Text style={[styles.draftTime, { color: colors.muted }]}>{formatDraftTime(item.createdAt)}</Text></View><Text style={[styles.draftBody, { color: colors.foreground }]}>{item.body}</Text><View style={styles.waitingRow}><MaterialIcons name="schedule" size={14} color={colors.warning} /><Text style={[styles.waitingText, { color: colors.warning }]}>Waiting for native runtime</Text></View></PressableCard>) : (
            <View style={[styles.empty, { borderColor: colors.border }]}><MaterialIcons name="mark-chat-unread" size={27} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No pending instructions</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>Use the composer below to stage a task for your private phone host.</Text></View>
          )}
        </ScrollView>
        <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <View style={styles.composerInputWrap}><Text style={[styles.composerLabel, { color: colors.muted }]}>STAGE FOR HERMES</Text><TextInput accessibilityLabel="Agent instruction" multiline value={draft} onChangeText={setDraft} placeholder="Draft an instruction for Hermes…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} textAlignVertical="top" /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Save instruction" onPress={submit} style={({ pressed }) => [styles.send, { backgroundColor: draft.trim() ? colors.primary : colors.border }, pressed && draft.trim() && styles.pressed]}><MaterialIcons name="arrow-upward" size={22} color="#FFFFFF" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingTop: 16, paddingBottom: 20, gap: 20 },
  bridgeNotice: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, noticeIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, noticeCopy: { flex: 1, gap: 4 }, noticeTitleRow: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "space-between" }, noticeTitle: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: "900" }, noticeDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, localBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }, localBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.75 }, count: { fontSize: 12, fontWeight: "700", paddingBottom: 2 },
  draftCard: { gap: 11 }, draftMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, draftLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }, draftTime: { fontSize: 11, fontWeight: "600" }, draftBody: { fontSize: 15, lineHeight: 22, fontWeight: "600" }, waitingRow: { flexDirection: "row", alignItems: "center", gap: 6 }, waitingText: { fontSize: 12, fontWeight: "800" },
  empty: { minHeight: 180, borderWidth: 1, borderStyle: "dashed", borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }, emptyTitle: { fontSize: 15, fontWeight: "900" }, emptyDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", textAlign: "center" },
  composer: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, paddingBottom: 10, alignItems: "flex-end" }, composerInputWrap: { flex: 1, gap: 5 }, composerLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 0.9, marginLeft: 2 }, input: { minHeight: 48, maxHeight: 112, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 13, fontSize: 14, lineHeight: 19, fontWeight: "500" }, send: { width: 50, height: 50, borderRadius: 17, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
