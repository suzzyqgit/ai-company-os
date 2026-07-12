import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeDateInputToTokyoDate } from "@/features/metrics/calculators";
import { syncArticleTotalsFromDailyMetrics } from "@/features/metrics/queries";
import { getSignedPurchases, getSignedRevenue } from "./calculator";
import type { ParsedNoteSaleRow } from "./types";

type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function getExistingArticlesByTitle(titles: string[]) {
  const articles = await prisma.article.findMany({
    where: {
      title: {
        in: titles,
      },
    },
    select: {
      id: true,
      title: true,
      price: true,
    },
  });

  return new Map(articles.map((article) => [article.title, article]));
}

export async function getExistingTransactionIds(transactionIds: string[]) {
  if (transactionIds.length === 0) {
    return new Set<string>();
  }

  const transactions = await prisma.noteSaleTransaction.findMany({
    where: {
      transactionId: {
        in: transactionIds,
      },
    },
    select: {
      transactionId: true,
    },
  });

  return new Set(transactions.map((transaction) => transaction.transactionId));
}

async function recomputeDailyMetricFromTransactions({
  client,
  articleId,
  date,
}: {
  client: PrismaTransaction;
  articleId: string;
  date: Date;
}) {
  const transactions = await client.noteSaleTransaction.findMany({
    where: {
      articleId,
      date,
    },
    select: {
      type: true,
      amount: true,
    },
  });

  const nextPurchases = transactions.reduce(
    (total, transaction) => total + getSignedPurchases(transaction.type),
    0,
  );
  const nextRevenue = transactions.reduce(
    (total, transaction) =>
      total + getSignedRevenue(transaction.type, transaction.amount),
    0,
  );

  await client.articleDailyMetric.upsert({
    where: {
      articleId_date: {
        articleId,
        date,
      },
    },
    update: {
      purchases: nextPurchases,
      revenue: nextRevenue,
    },
    create: {
      articleId,
      date,
      pv: 0,
      purchases: nextPurchases,
      revenue: nextRevenue,
      masterTransitions: 0,
    },
  });
}

export async function importNoteSaleTransactions({
  rows,
  shouldUpdatePrices,
}: {
  rows: ParsedNoteSaleRow[];
  shouldUpdatePrices: boolean;
}) {
  return prisma.$transaction(async (transaction) => {
    const uniqueTransactionIds = Array.from(
      new Set(rows.map((row) => row.transactionId)),
    );
    const existingTransactions =
      uniqueTransactionIds.length > 0
        ? await transaction.noteSaleTransaction.findMany({
            where: {
              transactionId: {
                in: uniqueTransactionIds,
              },
            },
            select: {
              transactionId: true,
            },
          })
        : [];
    const existingTransactionIds = new Set(
      existingTransactions.map((existing) => existing.transactionId),
    );
    const seenInPayload = new Set<string>();
    const rowsToImport = rows.filter((row) => {
      if (existingTransactionIds.has(row.transactionId)) {
        return false;
      }

      if (seenInPayload.has(row.transactionId)) {
        existingTransactionIds.add(row.transactionId);
        return false;
      }

      seenInPayload.add(row.transactionId);
      return true;
    });

    const titles = Array.from(new Set(rowsToImport.map((row) => row.title)));
    const existingArticles = await transaction.article.findMany({
      where: {
        title: {
          in: titles,
        },
      },
      select: {
        id: true,
        title: true,
        price: true,
      },
    });
    const articleByTitle = new Map(
      existingArticles.map((article) => [article.title, article]),
    );
    let createdArticles = 0;
    let updatedArticles = 0;

    for (const title of titles) {
      if (!articleByTitle.has(title)) {
        const rowsForArticle = rowsToImport.filter((row) => row.title === title);
        const latestSale = rowsForArticle
          .filter((row) => row.type === "販売")
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
        const created = await transaction.article.create({
          data: {
            title,
            noteUrl: "",
            status: "active",
            price: latestSale?.amount ?? 0,
            pv: 0,
            purchases: 0,
            baselinePv: 0,
            baselinePurchases: 0,
            note: "",
          },
          select: {
            id: true,
            title: true,
            price: true,
          },
        });

        articleByTitle.set(title, created);
        createdArticles += 1;
      }
    }

    if (shouldUpdatePrices) {
      for (const [title, article] of articleByTitle) {
        const latestSale = rowsToImport
          .filter((row) => row.title === title && row.type === "販売")
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

        if (latestSale && article.price !== latestSale.amount) {
          await transaction.article.update({
            where: {
              id: article.id,
            },
            data: {
              price: latestSale.amount,
            },
          });
          updatedArticles += 1;
        }
      }
    }

    const affectedPairs = new Map<string, { articleId: string; date: Date }>();
    const affectedArticleIds = new Set<string>();
    let newTransactions = 0;
    let duplicateSkipped = rows.length - rowsToImport.length;
    let netPurchases = 0;
    let netRevenue = 0;

    for (const row of rowsToImport) {
      const article = articleByTitle.get(row.title);
      const date = normalizeDateInputToTokyoDate(row.dateInput);

      if (!article || date === null) {
        throw new Error("Invalid import payload");
      }

      try {
        await transaction.noteSaleTransaction.create({
          data: {
            transactionId: row.transactionId,
            articleId: article.id,
            occurredAt: new Date(row.occurredAt),
            date,
            type: row.type,
            contentType: row.contentType,
            title: row.title,
            amount: row.amount,
            sourceFile: row.fileName,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          duplicateSkipped += 1;
          continue;
        }

        throw error;
      }

      newTransactions += 1;
      netPurchases += getSignedPurchases(row.type);
      netRevenue += getSignedRevenue(row.type, row.amount);
      affectedArticleIds.add(article.id);
      affectedPairs.set(`${article.id}:${row.dateInput}`, {
        articleId: article.id,
        date,
      });
    }

    for (const pair of affectedPairs.values()) {
      await recomputeDailyMetricFromTransactions({
        client: transaction,
        articleId: pair.articleId,
        date: pair.date,
      });
    }

    for (const articleId of affectedArticleIds) {
      await syncArticleTotalsFromDailyMetrics(articleId, transaction);
    }

    return {
      createdArticles,
      updatedArticles,
      newTransactions,
      duplicateSkipped,
      errorRows: 0,
      updatedDailyMetrics: affectedPairs.size,
      netPurchases,
      netRevenue,
      affectedArticleIds: Array.from(affectedArticleIds),
    };
  });
}
