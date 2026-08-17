import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { ModelProviderId } from "@/lib/host-contracts";
import type { ModelCatalogEntry } from "@/lib/model-providers";

export function ModelCatalog({ provider, models, fetchedAt, selectedModel, loading, onRefresh, onSelect, colors }: { provider: ModelProviderId; models: ModelCatalogEntry[]; fetchedAt: string | null; selectedModel: string; loading: boolean; onRefresh: () => void; onSelect: (model: ModelCatalogEntry) => void; colors: { foreground: string; muted: string; background: string; surface: string; border: string; primary: string; success: string } }) {
  const providerModels = models.filter((model) => model.provider === provider);
  const updated = fetchedAt ? new Date(fetchedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not fetched yet";
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headingCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>PROVIDER CATALOG</Text><Text style={[styles.title, { color: colors.foreground }]}>Available models</Text><Text style={[styles.detail, { color: colors.muted }]}>{providerModels.length ? `${providerModels.length} models found · updated ${updated}` : "Fetch the provider’s current model list, then choose one for the host."}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh model catalog" onPress={onRefresh} disabled={loading} style={({ pressed }) => [styles.refresh, { backgroundColor: `${colors.primary}14`, opacity: loading ? 0.45 : pressed ? 0.7 : 1 }]}><MaterialIcons name="refresh" size={20} color={colors.primary} /></Pressable>
      </View>
      {providerModels.length ? <FlatList data={providerModels.slice(0, 30)} keyExtractor={(item) => `${item.provider}:${item.id}`} scrollEnabled={false} renderItem={({ item }) => { const selected = selectedModel === item.id; return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onSelect(item)} style={({ pressed }) => [styles.row, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><View style={[styles.modelIcon, { backgroundColor: selected ? `${colors.success}18` : `${colors.primary}12` }]}><MaterialIcons name={selected ? "check" : "memory"} size={17} color={selected ? colors.success : colors.primary} /></View><View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.modelId, { color: colors.foreground }]}>{item.id}</Text><Text style={[styles.modelMeta, { color: colors.muted }]}>{item.ownedBy ?? "Provider model"}{item.contextWindow ? ` · ${item.contextWindow.toLocaleString()} context` : ""}</Text></View>{selected ? <Text style={[styles.selected, { color: colors.success }]}>SELECTED</Text> : null}</Pressable>; }} /> : <View style={[styles.empty, { backgroundColor: colors.background }]}><MaterialIcons name={loading ? "sync" : "travel-explore"} size={20} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>{loading ? "Contacting provider…" : "No catalog loaded yet. Add the token, save setup, and refresh."}</Text></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: "900" },
  detail: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
  refresh: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 58, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  modelIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  modelId: { fontSize: 13, fontWeight: "900" },
  modelMeta: { fontSize: 10, fontWeight: "600" },
  selected: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  empty: { minHeight: 64, borderRadius: 13, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
