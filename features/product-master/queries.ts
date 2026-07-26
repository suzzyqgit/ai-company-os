import { prisma } from "@/lib/prisma";
import { buildProductMasterManifest } from "./foundation";

export async function getProductMasterFoundationData() {
  const [
    manifest,
    productCount,
    articleCount,
    candidateProductCount,
    candidateArticleCount,
  ] = await Promise.all([
    buildProductMasterManifest({ prisma }),
    prisma.product.count(),
    prisma.article.count(),
    prisma.canonicalSalesRecord.count({
      where: {
        candidateProductId: {
          not: null,
        },
      },
    }),
    prisma.canonicalSalesRecord.count({
      where: {
        candidateArticleId: {
          not: null,
        },
      },
    }),
  ]);

  return {
    manifest,
    productCount,
    articleCount,
    candidateProductCount,
    candidateArticleCount,
    isInitialized:
      productCount >= manifest.productCount &&
      articleCount >= manifest.articleCount &&
      candidateProductCount >= manifest.canonicalRecordCount &&
      candidateArticleCount >= manifest.canonicalRecordCount,
  };
}
