import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { usePocketHermes } from "@/lib/pocket-hermes-store";
import { useColors } from "@/hooks/use-colors";
import type { ModelCatalogEntry } from "@/lib/model-providers";

export default function FavoritesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { modelCatalog, favoriteModelIds, toggleFavoriteModel, config, saveConfiguration } = usePocketHermes();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const favoriteModels = useMemo(() => {
    const map = new Map<string, ModelCatalogEntry>();
    for (const entry of modelCatalog) {
      map.set(entry.id, entry);
    }
    return favoriteModelIds.map((id) => map.get(id)).filter((item): item is ModelCatalogEntry => Boolean(item));
  }, [favoriteModelIds, modelCatalog]);

  const handleSelectFavorite = async (model: ModelCatalogEntry) => {
    try {
      setErrorMsg(null);
      const res = await saveConfiguration({
        hostName: config.hostName,
        allowedChatId: config.allowedChatId,
        modelProvider: model.provider,
        modelEndpoint: config.modelEndpoint,
        modelName: model.id,
        telegramToken: "",
      });
      if (res.ok) {
        router.push("/(tabs)/settings");
      } else {
        setErrorMsg(res.message);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to apply favorite model");
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="p-5">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}18` }]}>
            <MaterialIcons name="bookmark" size={26} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Model Favorites</Text>
          <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
            Bookmark preferred AI models from the provider catalog for quick review and one-tap host assignment.
          </Text>
        </View>

        {errorMsg ? (
          <View style={[styles.banner, { backgroundColor: `${colors.error}14`, borderColor: `${colors.error}44` }]}>
            <MaterialIcons name="error-outline" size={18} color={colors.error} />
            <Text style={[styles.bannerText, { color: colors.error }]}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>BOOKMARKED MODELS</Text>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{favoriteModels.length} Favorites saved</Text>
          </View>

          {favoriteModels.length ? (
            <FlatList
              data={favoriteModels}
              keyExtractor={(item) => `${item.provider}:${item.id}`}
              scrollEnabled={false}
              renderItem={({ item }) => {
                const isActive = config.modelName === item.id;
                return (
                  <View style={[styles.row, { borderTopColor: colors.border }]}>
                    <View style={[styles.modelIcon, { backgroundColor: isActive ? `${colors.success}18` : `${colors.primary}12` }]}>
                      <MaterialIcons name={isActive ? "check" : "memory"} size={17} color={isActive ? colors.success : colors.primary} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={1} style={[styles.modelId, { color: colors.foreground }]}>
                        {item.id}
                      </Text>
                      <Text style={[styles.modelMeta, { color: colors.muted }]}>
                        {item.provider.toUpperCase()} · {item.ownedBy ?? "Provider model"}
                        {item.contextWindow ? ` · ${item.contextWindow.toLocaleString()} ctx` : ""}
                      </Text>
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Select model ${item.id}`}
                        onPress={() => void handleSelectFavorite(item)}
                        style={({ pressed }) => [styles.actionButton, { backgroundColor: `${colors.primary}18`, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <Text style={[styles.actionButtonText, { color: colors.primary }]}>{isActive ? "Active" : "Use"}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove model ${item.id} from favorites`}
                        onPress={() => toggleFavoriteModel(item.id)}
                        style={({ pressed }) => [styles.iconButton, { backgroundColor: `${colors.error}14`, opacity: pressed ? 0.7 : 1 }]}
                      >
                        <MaterialIcons name="bookmark-remove" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          ) : (
            <View style={[styles.empty, { backgroundColor: colors.background }]}>
              <MaterialIcons name="bookmark-border" size={24} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No favorites bookmarked yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Go to Control (Settings) or Host Setup, browse the available provider models, and tap the bookmark icon on any model to add it here.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to Settings"
                onPress={() => router.push("/(tabs)/settings")}
                style={({ pressed }) => [styles.goButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.goButtonText, { color: colors.background }]}>Open Model Settings</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 16, paddingBottom: 32 },
  hero: { alignItems: "center", gap: 8, paddingVertical: 12 },
  heroIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 22, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { fontSize: 13, lineHeight: 18, textAlign: "center", fontWeight: "600", maxWidth: 320 },
  banner: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  bannerText: { flex: 1, fontSize: 12, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  cardHeader: { gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900" },
  row: { minHeight: 64, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  modelIcon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  modelId: { fontSize: 13, fontWeight: "900" },
  modelMeta: { fontSize: 10, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  actionButtonText: { fontSize: 11, fontWeight: "900" },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  empty: { borderRadius: 14, padding: 20, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 14, fontWeight: "900", textAlign: "center" },
  emptySubtitle: { fontSize: 11, lineHeight: 16, textAlign: "center", fontWeight: "600" },
  goButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  goButtonText: { fontSize: 12, fontWeight: "900" },
});
