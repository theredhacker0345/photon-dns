import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ProviderConnectionStatusCard } from "@/components/provider-connection-status";
import type { ModelProviderId } from "@/lib/host-contracts";
import type { ModelCatalogEntry, ProviderConnectionStatus } from "@/lib/model-providers";
import { filterModelCatalog, type CatalogFilter } from "@/lib/model-catalog-filters";
import { usePocketHermes } from "@/lib/pocket-hermes-store";
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
  const { toggleFavoriteModel, isFavoriteModel } = usePocketHermes();

  const filteredModels = useMemo(() => filterModelCatalog(models, query, filter), [models, query, filter]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>MODEL CATALOG ({models.length})</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Select {provider.toUpperCase()} Model</Text>
          <Text style={[styles.detail, { color: colors.muted }]}>
            {fetchedAt ? `Catalog fetched ${fetchedAt}` : "Connect your token and refresh to discover available models"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh model catalog"
          onPress={onRefresh}
          disabled={loading}
          style={({ pressed }) => [styles.refresh, { backgroundColor: `${colors.primary}18`, opacity: pressed || loading ? 0.6 : 1 }]}
        >
          <MaterialIcons name="refresh" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <ProviderConnectionStatusCard connection={connection} colors={colors} />

      <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={17} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search models by name or family"
          placeholder="Search models (e.g. gpt, sonnet, llama)…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.searchInput, { color: colors.foreground }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search query">
            <MaterialIcons name="close" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((item) => {
          const selected = filter === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item.id)}
              style={({ pressed }) => [
                styles.filterChip,
                { backgroundColor: selected ? `${colors.primary}18` : colors.background, borderColor: selected ? `${colors.primary}55` : colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.filterText, { color: selected ? colors.primary : colors.muted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filteredModels.length ? (
        <FlatList
          data={filteredModels.slice(0, 30)}
          keyExtractor={(item) => `${item.provider}:${item.id}`}
          scrollEnabled={false}
          renderItem={({ item }) => {
            const selected = selectedModel === item.id;
            const isFav = isFavoriteModel(item.id);
            return (
              <View style={[styles.row, { borderTopColor: colors.border }]}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.modelIcon, { backgroundColor: selected ? `${colors.success}18` : `${colors.primary}12` }]}>
                    <MaterialIcons name={selected ? "check" : "memory"} size={17} color={selected ? colors.success : colors.primary} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text numberOfLines={1} style={[styles.modelId, { color: colors.foreground }]}>
                      {item.id}
                    </Text>
                    <Text style={[styles.modelMeta, { color: colors.muted }]}>
                      {item.ownedBy ?? "Provider model"}
                      {item.contextWindow ? ` · ${item.contextWindow.toLocaleString()} context` : ""}
                      {item.capabilities?.length ? ` · ${item.capabilities.slice(0, 2).join(", ")}` : ""}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.rowActions}>
                  {selected ? <Text style={[styles.selected, { color: colors.success }]}>ACTIVE</Text> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isFav ? `Remove ${item.id} from favorites` : `Bookmark ${item.id} as favorite`}
                    onPress={() => toggleFavoriteModel(item.id)}
                    style={({ pressed }) => [styles.starButton, { backgroundColor: isFav ? `${colors.warning}22` : `${colors.muted}15`, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <MaterialIcons name={isFav ? "bookmark" : "bookmark-border"} size={18} color={isFav ? colors.warning : colors.muted} />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.background }]}>
          <MaterialIcons name={loading ? "sync" : "travel-explore"} size={20} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {loading ? "Contacting provider…" : models.length ? "No models match this search or filter." : "No catalog loaded yet. Add the token, save setup, and refresh."}
          </Text>
        </View>
      )}
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
  row: { minHeight: 58, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  modelIcon: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  modelId: { fontSize: 13, fontWeight: "900" },
  modelMeta: { fontSize: 10, fontWeight: "600" },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  selected: { fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  starButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { minHeight: 64, borderRadius: 13, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: "600" },
});
