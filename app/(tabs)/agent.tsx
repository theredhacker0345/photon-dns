import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { PressableCard, SectionHeading } from "@/components/pocket-hermes-ui";
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
          <View style={styles.header}><Text style={[styles.title, { color: colors.foreground }]}>Agent console</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Draft tasks locally. The native bridge dispatches them to your embedded Hermes runtime.</Text></View>
          <PressableCard style={styles.bridgeNotice}><View style={[styles.noticeIcon, { backgroundColor: `${colors.primary}14` }]}><MaterialIcons name="hub" size={21} color={colors.primary} /></View><View style={styles.noticeCopy}><Text style={[styles.noticeTitle, { color: colors.foreground }]}>Native relay {phase === "bridge_required" ? "is pending" : "is not connected"}</Text><Text style={[styles.noticeDetail, { color: colors.muted }]}>This preview does not transmit agent prompts. Drafts remain on this device until the bundled runtime is installed.</Text></View></PressableCard>

          <SectionHeading eyebrow="TASK INBOX" title="Saved instructions" action={<Text style={[styles.count, { color: colors.muted }]}>{drafts.length ? `${drafts.length} drafts` : "Empty"}</Text>} />
          {drafts.length ? drafts.map((item) => <PressableCard key={item.id} style={styles.draftCard}><View style={styles.draftMeta}><Text style={[styles.draftLabel, { color: colors.primary }]}>OWNER DRAFT</Text><Text style={[styles.draftTime, { color: colors.muted }]}>{formatDraftTime(item.createdAt)}</Text></View><Text style={[styles.draftBody, { color: colors.foreground }]}>{item.body}</Text><View style={styles.waitingRow}><MaterialIcons name="schedule" size={14} color={colors.warning} /><Text style={[styles.waitingText, { color: colors.warning }]}>Waiting for native runtime</Text></View></PressableCard>) : (
            <View style={[styles.empty, { borderColor: colors.border }]}><MaterialIcons name="mark-chat-unread" size={27} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No pending instructions</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>Use the composer below to stage a task for your private phone host.</Text></View>
          )}
        </ScrollView>
        <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TextInput accessibilityLabel="Agent instruction" multiline value={draft} onChangeText={setDraft} placeholder="Draft an instruction for Hermes…" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} textAlignVertical="top" />
          <Pressable accessibilityRole="button" accessibilityLabel="Save instruction" onPress={submit} style={({ pressed }) => [styles.send, { backgroundColor: draft.trim() ? colors.primary : colors.border }, pressed && draft.trim() && styles.pressed]}><MaterialIcons name="arrow-upward" size={22} color="#FFFFFF" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingTop: 14, paddingBottom: 20, gap: 18 }, header: { gap: 6 }, title: { fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.7 }, subtitle: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  bridgeNotice: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, noticeIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" }, noticeCopy: { flex: 1, gap: 3 }, noticeTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, noticeDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, count: { fontSize: 12, fontWeight: "700", paddingBottom: 2 },
  draftCard: { gap: 11 }, draftMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, draftLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9 }, draftTime: { fontSize: 11, fontWeight: "600" }, draftBody: { fontSize: 15, lineHeight: 22, fontWeight: "600" }, waitingRow: { flexDirection: "row", alignItems: "center", gap: 6 }, waitingText: { fontSize: 12, fontWeight: "800" },
  empty: { minHeight: 180, borderWidth: 1, borderStyle: "dashed", borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }, emptyTitle: { fontSize: 15, fontWeight: "900" }, emptyDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", textAlign: "center" },
  composer: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, paddingBottom: 10, alignItems: "flex-end" }, input: { flex: 1, minHeight: 48, maxHeight: 112, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingTop: 13, fontSize: 14, lineHeight: 19, fontWeight: "500" }, send: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
});
