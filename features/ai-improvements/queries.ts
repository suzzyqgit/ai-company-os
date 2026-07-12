import { prisma } from "@/lib/prisma";
import { generateRuleBasedImprovements } from "./rules";

export async function getTodayAiImprovements() {
  const articles = await prisma.article.findMany({
    where: {
      status: "active",
    },
    select: {
      id: true,
      title: true,
      price: true,
      pv: true,
      purchases: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return generateRuleBasedImprovements(articles).slice(0, 10);
}
