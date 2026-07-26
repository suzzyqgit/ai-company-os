import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export type ProductMasterManifestItem = {
  productId: string;
  articleId: string;
  normalizedProductName: string;
  productName: string;
  articleTitle: string;
  canonicalRecordIds: string[];
  canonicalRecordCount: number;
  grossAmount: number;
  netAmount: number;
  observedUnitPrices: number[];
  articlePrice: number;
  mappingReason: string;
};

export type ProductMasterManifest = {
  manifestVersion: string;
  manifestFingerprint: string;
  productCount: number;
  articleCount: number;
  canonicalRecordCount: number;
  grossAmount: number;
  netAmount: number;
  items: ProductMasterManifestItem[];
};

export type ProductMasterInitializationResult = {
  manifest: ProductMasterManifest;
  createdProducts: number;
  updatedProducts: number;
  createdArticles: number;
  updatedArticles: number;
  updatedCanonicalRecords: number;
};

type CanonicalRecordForManifest = {
  id: string;
  productName: string;
  originalProductName: string;
  normalizedProductName: string;
  quantity: number;
  grossAmount: number;
  netAmount: number | null;
};

const manifestVersion = "product-master-foundation-v1";

function stableHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function buildProductId(normalizedProductName: string) {
  return `product-${stableHash(normalizedProductName)}`;
}

function buildArticleId(normalizedProductName: string) {
  return `article-${stableHash(normalizedProductName)}`;
}

function getUnitPrice(record: CanonicalRecordForManifest) {
  if (record.quantity <= 0 || record.grossAmount % record.quantity !== 0) {
    throw new Error(`Invalid unit price source record: ${record.id}`);
  }

  return record.grossAmount / record.quantity;
}

function buildFingerprint(items: ProductMasterManifestItem[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        items.map((item) => ({
          productId: item.productId,
          articleId: item.articleId,
          normalizedProductName: item.normalizedProductName,
          canonicalRecordIds: item.canonicalRecordIds,
          grossAmount: item.grossAmount,
          observedUnitPrices: item.observedUnitPrices,
        })),
      ),
    )
    .digest("hex");
}

export function buildProductMasterManifestFromRecords(
  records: CanonicalRecordForManifest[],
): ProductMasterManifest {
  const recordsByNormalizedName = new Map<string, CanonicalRecordForManifest[]>();

  for (const record of records) {
    if (record.normalizedProductName.trim() === "") {
      throw new Error(`Missing normalized product name: ${record.id}`);
    }

    const group = recordsByNormalizedName.get(record.normalizedProductName) ?? [];
    group.push(record);
    recordsByNormalizedName.set(record.normalizedProductName, group);
  }

  const items = [...recordsByNormalizedName.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalizedProductName, group]) => {
      const sortedGroup = [...group].sort((left, right) => left.id.localeCompare(right.id));
      const representative = sortedGroup[0];
      const unitPrices = [...new Set(sortedGroup.map(getUnitPrice))].sort(
        (left, right) => left - right,
      );
      const grossAmount = sortedGroup.reduce(
        (total, record) => total + record.grossAmount,
        0,
      );
      const netAmount = sortedGroup.reduce(
        (total, record) => total + (record.netAmount ?? 0),
        0,
      );

      return {
        productId: buildProductId(normalizedProductName),
        articleId: buildArticleId(normalizedProductName),
        normalizedProductName,
        productName: representative.productName,
        articleTitle: representative.originalProductName || representative.productName,
        canonicalRecordIds: sortedGroup.map((record) => record.id).sort(),
        canonicalRecordCount: sortedGroup.length,
        grossAmount,
        netAmount,
        observedUnitPrices: unitPrices,
        articlePrice: unitPrices[unitPrices.length - 1] ?? 0,
        mappingReason:
          "Initial Case No.004 mapping: one sold normalized product title becomes one Product and one Article.",
      } satisfies ProductMasterManifestItem;
    });

  return {
    manifestVersion,
    manifestFingerprint: buildFingerprint(items),
    productCount: items.length,
    articleCount: items.length,
    canonicalRecordCount: records.length,
    grossAmount: items.reduce((total, item) => total + item.grossAmount, 0),
    netAmount: items.reduce((total, item) => total + item.netAmount, 0),
    items,
  };
}

export async function buildProductMasterManifest({
  prisma,
}: {
  prisma: PrismaClient;
}) {
  const records = await prisma.canonicalSalesRecord.findMany({
    orderBy: [{ normalizedProductName: "asc" }, { id: "asc" }],
    select: {
      id: true,
      productName: true,
      originalProductName: true,
      normalizedProductName: true,
      quantity: true,
      grossAmount: true,
      netAmount: true,
    },
  });

  return buildProductMasterManifestFromRecords(records);
}

export async function initializeProductMasterFoundation({
  prisma,
}: {
  prisma: PrismaClient;
}): Promise<ProductMasterInitializationResult> {
  const manifest = await buildProductMasterManifest({ prisma });

  if (manifest.items.length === 0) {
    throw new Error("No CanonicalSalesRecord entries are available for Product Master initialization.");
  }

  return prisma.$transaction(async (transaction) => {
    let createdProducts = 0;
    let updatedProducts = 0;
    let createdArticles = 0;
    let updatedArticles = 0;
    let updatedCanonicalRecords = 0;

    for (const item of manifest.items) {
      const existingProduct = await transaction.product.findUnique({
        where: { id: item.productId },
        select: { id: true },
      });
      await transaction.product.upsert({
        where: { id: item.productId },
        update: {
          name: item.productName,
          status: "active",
        },
        create: {
          id: item.productId,
          name: item.productName,
          status: "active",
        },
      });
      if (existingProduct) {
        updatedProducts += 1;
      } else {
        createdProducts += 1;
      }

      const existingArticle = await transaction.article.findUnique({
        where: { id: item.articleId },
        select: { id: true },
      });
      await transaction.article.upsert({
        where: { id: item.articleId },
        update: {
          title: item.articleTitle,
          price: item.articlePrice,
          purchases: item.canonicalRecordCount,
          baselinePurchases: item.canonicalRecordCount,
          productId: item.productId,
        },
        create: {
          id: item.articleId,
          title: item.articleTitle,
          noteUrl: "",
          status: "active",
          price: item.articlePrice,
          pv: 0,
          purchases: item.canonicalRecordCount,
          baselinePv: 0,
          baselinePurchases: item.canonicalRecordCount,
          note: "Initialized from CanonicalSalesRecord by Case No.004 Product Master Foundation.",
          productId: item.productId,
        },
      });
      if (existingArticle) {
        updatedArticles += 1;
      } else {
        createdArticles += 1;
      }

      const canonicalUpdate = await transaction.canonicalSalesRecord.updateMany({
        where: {
          id: {
            in: item.canonicalRecordIds,
          },
        },
        data: {
          candidateArticleId: item.articleId,
          candidateProductId: item.productId,
          matchConfidence: 1,
        },
      });
      updatedCanonicalRecords += canonicalUpdate.count;
    }

    return {
      manifest,
      createdProducts,
      updatedProducts,
      createdArticles,
      updatedArticles,
      updatedCanonicalRecords,
    };
  });
}
