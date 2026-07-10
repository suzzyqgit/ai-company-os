import { prisma } from "@/lib/prisma";
import type { MetricsCsvRow } from "./csv";

export async function getMetricsForCsvExport({
  from,
  exclusiveTo,
}: {
  from: Date;
  exclusiveTo: Date;
}): Promise<MetricsCsvRow[]> {
  const metrics = await prisma.articleDailyMetric.findMany({
    where: {
      date: {
        gte: from,
        lt: exclusiveTo,
      },
    },
    include: {
      article: {
        select: {
          id: true,
          title: true,
          price: true,
        },
      },
    },
    orderBy: [
      {
        date: "desc",
      },
      {
        article: {
          title: "asc",
        },
      },
    ],
  });

  return metrics.map((metric) => ({
    date: metric.date,
    articleId: metric.articleId,
    title: metric.article.title,
    price: metric.article.price,
    pv: metric.pv,
    purchases: metric.purchases,
    revenue: metric.revenue,
    masterTransitions: metric.masterTransitions,
  }));
}
