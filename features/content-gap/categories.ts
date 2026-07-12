export type ContentGapCategoryDefinition = {
  id: string;
  label: string;
  keywords: string[];
  searchIntents: string[];
  funnelRoles: string[];
};

export const contentGapCategories: ContentGapCategoryDefinition[] = [
  {
    id: "awareness",
    label: "認知",
    keywords: ["認知", "入口", "はじめ", "理由", "必要"],
    searchIntents: ["トレンド", "悩み解決"],
    funnelRoles: ["認知"],
  },
  {
    id: "beginner",
    label: "初心者向け",
    keywords: ["初心者", "入門", "最初", "はじめて", "基礎"],
    searchIntents: ["初心者向け"],
    funnelRoles: ["認知", "興味"],
  },
  {
    id: "comparison",
    label: "比較",
    keywords: ["比較", "違い", "選ぶ", "判断", "向き不向き"],
    searchIntents: ["比較"],
    funnelRoles: ["比較検討"],
  },
  {
    id: "failure",
    label: "失敗例",
    keywords: ["失敗", "避け", "落とし穴", "注意", "遠回り"],
    searchIntents: ["失敗回避"],
    funnelRoles: ["興味", "購入前教育"],
  },
  {
    id: "checklist",
    label: "チェックリスト",
    keywords: ["チェックリスト", "確認", "項目", "準備"],
    searchIntents: ["チェックリスト"],
    funnelRoles: ["購入前教育"],
  },
  {
    id: "faq",
    label: "FAQ",
    keywords: ["FAQ", "質問", "疑問", "不安", "よくある"],
    searchIntents: ["導入前の不安解消"],
    funnelRoles: ["購入前教育"],
  },
  {
    id: "glossary",
    label: "用語解説",
    keywords: ["用語", "意味", "とは", "前提", "基礎知識"],
    searchIntents: ["用語解説"],
    funnelRoles: ["認知", "興味"],
  },
  {
    id: "case",
    label: "事例",
    keywords: ["事例", "ケース", "実例", "体験"],
    searchIntents: ["事例"],
    funnelRoles: ["興味", "比較検討"],
  },
  {
    id: "review",
    label: "レビュー",
    keywords: ["レビュー", "感想", "評価", "使って", "買って"],
    searchIntents: ["比較"],
    funnelRoles: ["比較検討", "購入前教育"],
  },
  {
    id: "trend",
    label: "トレンド",
    keywords: ["トレンド", "最新", "今", "2026", "変化"],
    searchIntents: ["トレンド"],
    funnelRoles: ["認知"],
  },
  {
    id: "caution",
    label: "注意点",
    keywords: ["注意", "危険", "規約", "避ける", "NG"],
    searchIntents: ["失敗回避"],
    funnelRoles: ["購入前教育"],
  },
  {
    id: "prePurchase",
    label: "購入前教育",
    keywords: ["購入前", "買う前", "判断", "必要", "不安"],
    searchIntents: ["導入前の不安解消", "比較"],
    funnelRoles: ["購入前教育"],
  },
  {
    id: "cta",
    label: "CTA記事",
    keywords: ["次に読む", "導線", "送客", "CTA", "980円"],
    searchIntents: ["手順解説"],
    funnelRoles: ["980円記事への送客"],
  },
];
