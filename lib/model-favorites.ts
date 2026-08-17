import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ModelCatalogEntry } from "@/lib/model-providers";

const FAVORITES_STORAGE_KEY = "pocket-hermes.favorite-models.v1";

export async function loadFavoriteModelIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveFavoriteModelIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage errors on restricted environments
  }
}
