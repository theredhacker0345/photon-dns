import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { PageHeader, PressableCard, PrimaryButton, SectionHeading, SecondaryButton } from "@/components/pocket-hermes-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { usePocketHermes } from "@/lib/pocket-hermes-store";

export default function AutomationsScreen() {
  const colors = useColors();
  const { automations, addAutomation, setAutomationEnabled } = usePocketHermes();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [expression, setExpression] = useState("0 9 * * *");
  const [delivery, setDelivery] = useState("Telegram");

  const save = () => {
    if (!title.trim() || !expression.trim() || !delivery.trim()) return;
    addAutomation({ title: title.trim(), expression: expression.trim(), delivery: delivery.trim() });
    setTitle("");
    setExpression("0 9 * * *");
    setDelivery("Telegram");
    setIsModalOpen(false);
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><PageHeader eyebrow="ON-DEVICE SCHEDULER" title="Automations" detail="Create routines now. Hermes will run them locally and deliver through your approved gateway." icon="event-repeat" /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Create automation" onPress={() => setIsModalOpen(true)} style={({ pressed }) => [styles.add, { backgroundColor: colors.primary }, pressed && styles.pressed]}><MaterialIcons name="add" size={24} color="#FFFFFF" /></Pressable>
        </View>

        <PressableCard style={[styles.schedulerCard, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}28` }]}>
          <View style={[styles.schedulerIcon, { backgroundColor: `${colors.primary}18` }]}><MaterialIcons name="event-repeat" size={23} color={colors.primary} /></View>
          <View style={styles.schedulerCopy}><Text style={[styles.schedulerTitle, { color: colors.foreground }]}>Local scheduler</Text><Text style={[styles.schedulerDetail, { color: colors.muted }]}>Schedules are stored on this phone. The native runtime determines their next execution after it is installed.</Text></View>
        </PressableCard>

        <SectionHeading eyebrow="SAVED ON THIS DEVICE" title="Schedules" action={<Text style={[styles.count, { color: colors.muted }]}>{automations.length ? `${automations.length} saved` : "Empty"}</Text>} />
        {automations.length ? automations.map((automation) => (
          <PressableCard key={automation.id} style={styles.automationCard}>
            <View style={styles.automationTop}>
              <View style={[styles.miniIcon, { backgroundColor: `${colors.primary}16` }]}><MaterialIcons name="schedule" size={20} color={colors.primary} /></View>
              <View style={styles.automationCopy}><Text style={[styles.automationTitle, { color: colors.foreground }]}>{automation.title}</Text><Text style={[styles.automationDetail, { color: colors.muted }]}>{automation.expression} · {automation.delivery}</Text></View>
              <Switch value={automation.enabled} onValueChange={(value) => setAutomationEnabled(automation.id, value)} trackColor={{ false: colors.border, true: `${colors.success}AA` }} thumbColor={automation.enabled ? colors.success : colors.muted} />
            </View>
            <View style={[styles.runtimeLine, { borderTopColor: colors.border }]}><MaterialIcons name="verified-user" size={15} color={automation.enabled ? colors.success : colors.muted} /><Text style={[styles.runtimeLineText, { color: automation.enabled ? colors.success : colors.muted }]}>{automation.enabled ? "Enabled — awaiting native scheduler" : "Paused"}</Text></View>
          </PressableCard>
        )) : (
          <View style={[styles.empty, { borderColor: colors.border }]}><MaterialIcons name="auto-awesome-motion" size={28} color={colors.muted} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No automations saved</Text><Text style={[styles.emptyDetail, { color: colors.muted }]}>Create a repeatable job, then the on-device Hermes scheduler will own its execution.</Text><View style={styles.emptyAction}><SecondaryButton label="Create schedule" icon="add" onPress={() => setIsModalOpen(true)} /></View></View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={isModalOpen} onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New automation</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.muted }]}>Use a cron expression that the embedded Hermes scheduler can interpret.</Text>
            <Label text="Task name" color={colors.muted} />
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Daily project digest" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <Label text="Cron expression" color={colors.muted} />
            <TextInput value={expression} onChangeText={setExpression} placeholder="0 9 * * *" placeholderTextColor={colors.muted} autoCapitalize="none" style={[styles.field, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <Label text="Delivery" color={colors.muted} />
            <TextInput value={delivery} onChangeText={setDelivery} placeholder="Telegram" placeholderTextColor={colors.muted} style={[styles.field, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
            <View style={styles.sheetActions}><View style={styles.cancelWrap}><SecondaryButton label="Cancel" onPress={() => setIsModalOpen(false)} /></View><View style={styles.saveWrap}><PrimaryButton label="Save" icon="check" onPress={save} disabled={!title.trim() || !expression.trim() || !delivery.trim()} /></View></View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function Label({ text, color }: { text: string; color: string }) { return <Text style={[styles.label, { color }]}>{text.toUpperCase()}</Text>; }

const styles = StyleSheet.create({
  content: { paddingTop: 16, paddingBottom: 34, gap: 20 }, header: { flexDirection: "row", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }, headerCopy: { flex: 1 }, add: { width: 48, height: 48, borderRadius: 17, alignItems: "center", justifyContent: "center", marginTop: 2 }, pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  schedulerCard: { flexDirection: "row", gap: 13, alignItems: "center" }, schedulerIcon: { width: 43, height: 43, borderRadius: 15, alignItems: "center", justifyContent: "center" }, schedulerCopy: { flex: 1, gap: 3 }, schedulerTitle: { fontSize: 14, fontWeight: "900" }, schedulerDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, count: { fontSize: 12, fontWeight: "700", paddingBottom: 2 },
  automationCard: { gap: 13 }, automationTop: { flexDirection: "row", alignItems: "center", gap: 11 }, miniIcon: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, automationCopy: { flex: 1, gap: 3 }, automationTitle: { fontSize: 14, lineHeight: 18, fontWeight: "900" }, automationDetail: { fontSize: 12, lineHeight: 17, fontWeight: "500" }, runtimeLine: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }, runtimeLineText: { fontSize: 12, fontWeight: "800" },
  empty: { minHeight: 250, borderWidth: 1, borderStyle: "dashed", borderRadius: 22, alignItems: "center", justifyContent: "center", padding: 25, gap: 9 }, emptyTitle: { fontSize: 15, fontWeight: "900" }, emptyDetail: { fontSize: 13, lineHeight: 18, fontWeight: "500", textAlign: "center" }, emptyAction: { marginTop: 8 },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(6,8,18,0.46)" }, sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, padding: 22, gap: 10 }, handle: { width: 38, height: 4, borderRadius: 4, alignSelf: "center", marginBottom: 4 }, sheetTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }, sheetSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: "500", marginBottom: 6 }, label: { fontSize: 10, fontWeight: "900", letterSpacing: 0.9, marginTop: 3 }, field: { borderWidth: 1, minHeight: 48, borderRadius: 14, paddingHorizontal: 13, fontSize: 14, fontWeight: "600" }, sheetActions: { flexDirection: "row", gap: 10, marginTop: 12 }, cancelWrap: { flex: 0.9 }, saveWrap: { flex: 1.1 },
});
