import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ProviderConnectionStatusCard } from "@/components/provider-connection-status";
import type { ModelProviderId } from "@/lib/host-contracts";
import type { ModelCatalogEntry, ProviderConnectionStatus } from "@/lib/model-providers";
import { filterModelCatalog, type CatalogFilter } from "@/lib/model-catalog-filters";
type CatalogColors = { foreground: string; muted: string; background: string; surface: string; border: string; primary: string; success: string; warning: string; error: string };

const FILTERS: readonly { id: CatalogFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "vision", label: "Vision" },
  { id: "tools", label: "Tools" },
  { id: "long-context", label: "Long context" },
];

export function ModelCatalog({ provider, models, fetchedAt, selectedModel, loading, connection, onRefresh, onSelect, colors }: { provider: ModelProviderId; models: ModelCatalogEntry[]; fetchedAt: string | null; selectedModel: string; loading: boolean; connection: ProviderConnectionStatus; onRefresh: () => void; onSelect: (model: ModelCatalogEntry) => void; colors: CatalogColors }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const providerModels = useMemo(() => models.filter((model) => model.provider === provider), [models, provider]);
  const filteredModels = useMemo(() => filterModelCatalog(providerModels, query, filter), [filter, providerModels, query]);
  const updated = fetchedAt ? new Date(fetchedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Not fetched yet";
  const catalogSummary = providerModels.length ? `${filteredModels.length} of ${providerModels.length} models · updated ${updated}` : "Fetch the provider’s current model list, then choose one for the host.";

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ProviderConnectionStatusCard connection={connection} colors={colors} />
      <View style={styles.header}>
        <View style={styles.headingCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>PROVIDER CATALOG</Text><Text style={[styles.title, { color: colors.foreground }]}>Available models</Text><Text style={[styles.detail, { color: colors.muted }]}>{catalogSummary}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh model catalog" onPress={onRefresh} disabled={loading} style={({ pressed }) => [styles.refresh, { backgroundColor: `${colors.primary}14`, opacity: loading ? 0.45 : pressed ? 0.7 : 1 }]}><MaterialIcons name="refresh" size={20} color={colors.primary} /></Pressable>
      </View>
      <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={19} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search model IDs or owners" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search available models" style={[styles.searchInput, { color: colors.foreground }]} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear model search" onPress={() => setQuery("")} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}><MaterialIcons name="close" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} keyboardShouldPersistTaps="handled">
        {FILTERS.map((item) => { const selected = filter === item.id; return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(item.id)} style={({ pressed }) => [styles.filterChip, { backgroundColor: selected ? `${colors.primary}18` : colors.background, borderColor: selected ? `${colors.primary}55` : colors.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.filterText, { color: selected ? colors.primary : colors.muted }]}>{item.label}</Text></Pressable>; })}
      </ScrollView>
      {filteredModels.length ? <FlatList data={filteredModels.slice(0, 30)} keyExtractor={(item) => `${item.provider}:${item.id}`} scrollEnabled={false} renderItem={({ item }) => { const selected = selectedModel === item.id; return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onSelect(item)} style={({ pressed }) => [styles.row, { borderTopColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><View style={[styles.modelIcon, { backgroundColor: selected ? `${colors.success}18` : `${colors.primary}12` }]}><MaterialIcons name={selected ? "check" : "memory"} size={17} color={selected ? colors.success : colors.primary} /></View><View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.modelId, { color: colors.foreground }]}>{item.id}</Text><Text style={[styles.modelMeta, { color: colors.muted }]}>{item.ownedBy ?? "Provider model"}{item.contextWindow ? ` · ${item.contextWindow.toLocaleString()} context` : ""}{item.capabilities?.length ? ` · ${item.capabilities.slice(0, 2).join(", ")}` : ""}</Text></View>{selected ? <Text style={[styles.selected, { color: colors.success }]}>SELECTED</Text> : null}</Pressable>; }} /> : <View style={[styles.empty, { backgroundColor: colors.background }]}><MaterialIcons name={loading ? "sync" : "travel-explore"} size={20} color={colors.muted} /><Text style={[styles.emptyText, { color: colors.muted }]}>{loading ? "Contacting provider…" : providerModels.length ? "No models match this search or filter." : "No catalog loaded yet. Add the token, save setup, and refresh."}</Text></View>}
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
  searchBox: { minHeight: 45, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minHeight: 42, paddingVertical: 0, fontSize: 13, fontWeight: "600" },
  filterRow: { gap: 7 },
  filterChip: { minHeight: 31, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, justifyContent: "center" },
  filterText: { fontSize: 10, fontWeight: "900" },
  row: { minHeight: 58, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  modelIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  modelId: { fontSize: 13, fontWeight: "900" },
  modelMeta: { fontSize: 10, fontWeight: "600" },
  selected: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  empty: { minHeight: 64, borderRadius: 13, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
