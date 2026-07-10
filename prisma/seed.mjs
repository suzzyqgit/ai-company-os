import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const articles = [
  {
    id: "ai-article-outline",
    title: "AIで記事構成を作るための実践メモ",
    price: 980,
    pv: 12840,
    purchases: 326,
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    note: "構成テンプレートへの反応がよく、購入率も安定している。次回更新では導入文の事例を増やし、初心者向けの補足を追加する。",
  },
  {
    id: "prompt-management",
    title: "個人開発者向けプロンプト管理術",
    price: 1480,
    pv: 9420,
    purchases: 214,
    updatedAt: new Date("2026-07-08T00:00:00.000Z"),
    note: "価格は少し高めだが保存数が多い。購入前に価値が伝わるよう、目次とサンプルプロンプトの見せ方を改善したい。",
  },
  {
    id: "nextjs-small-tools",
    title: "Next.jsで作る小さな業務ツール入門",
    price: 1980,
    pv: 18760,
    purchases: 521,
    updatedAt: new Date("2026-07-06T00:00:00.000Z"),
    note: "PVと購入数が最も大きい主力記事。今後のアプリ開発ロードマップ記事への導線を追加すると、関連売上を伸ばせそう。",
  },
  {
    id: "note-sales-checklist",
    title: "売れる有料noteの改善チェックリスト",
    price: 780,
    pv: 6380,
    purchases: 188,
    updatedAt: new Date("2026-07-04T00:00:00.000Z"),
    note: "購入率は高いがPVが少ない。SNS投稿や関連記事からの内部リンクで流入を増やす余地がある。",
  },
  {
    id: "ai-rewrite-workflow",
    title: "AI時代の記事リライト運用フロー",
    price: 1280,
    pv: 15320,
    purchases: 402,
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    note: "リライト需要が強く、検索流入も伸びている。実例のビフォーアフターを追加すると、さらに購入判断しやすくなる。",
  },
];

for (const article of articles) {
  await prisma.article.upsert({
    where: { id: article.id },
    update: article,
    create: article,
  });
}

await prisma.$disconnect();
