import { buildCatalog } from "@/lib/production-catalog";
import { prisma } from "@/lib/prisma";

export const CUSTOM_CATALOG_DATE = "__CATALOG__";

export async function loadCustomCatalogRows() {
  if (typeof prisma.priceSetting?.findMany !== "function") return [];
  return (await prisma.priceSetting.findMany({
    where: { priceDate: CUSTOM_CATALOG_DATE, scope: { in: ["CUSTOM_CATEGORY", "CUSTOM_ITEM"] } },
    orderBy: [{ scope: "asc" }, { productName: "asc" }, { productKey: "asc" }],
  })) || [];
}

export async function loadCatalogWithCustomItems() {
  const rows = await loadCustomCatalogRows();
  const categoryLabels = new Map(rows.filter((row) => row.scope === "CUSTOM_CATEGORY").map((row) => [row.categoryKey, row.productName]));
  const items = rows
    .filter((row) => row.scope === "CUSTOM_ITEM")
    .map((row) => ({
      scope: "ITEM",
      productType: row.productType || "bottle",
      productKey: row.productKey,
      categoryKey: row.categoryKey,
      categoryLabel: categoryLabels.get(row.categoryKey) || row.categoryKey,
      productName: row.productName,
      capacity: Number(row.capacity || 0),
      bottlesPerCard: Number(row.bottlesPerCard || row.capacity || 1),
    }));
  const builtIn = buildCatalog();
  const seen = new Set(builtIn.map((item) => item.productKey));
  return [...builtIn, ...items.filter((item) => !seen.has(item.productKey))];
}

export function customCategoriesFromRows(rows = []) {
  return rows
    .filter((row) => row.scope === "CUSTOM_CATEGORY")
    .map((row) => ({
      key: row.categoryKey,
      label: row.categoryLabel || row.productName,
      description: row.note || "Custom category",
      productType: row.productType || "bottle",
      custom: true,
    }));
}
