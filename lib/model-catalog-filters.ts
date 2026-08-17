import type { ModelCatalogEntry } from "@/lib/model-providers";

export type CatalogFilter = "all" | "vision" | "tools" | "long-context";

export function matchesModelCatalogFilter(model: ModelCatalogEntry, filter: CatalogFilter) {
  if (filter === "all") return true;
  if (filter === "long-context") return typeof model.contextWindow === "number" && model.contextWindow >= 32_000;
  const capabilities = model.capabilities?.map((item) => item.toLowerCase()) ?? [];
  return capabilities.some((item) => item.includes(filter));
}

export function filterModelCatalog(models: ModelCatalogEntry[], query: string, filter: CatalogFilter) {
  const normalizedQuery = query.trim().toLowerCase();
  return models.filter((model) => {
    const searchable = `${model.id} ${model.displayName} ${model.ownedBy ?? ""}`.toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery)) && matchesModelCatalogFilter(model, filter);
  });
}
