export const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export const numberFormatter = new Intl.NumberFormat("ja-JP");

export const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calculatePurchaseRate(purchases: number, pv: number) {
  if (pv === 0) {
    return 0;
  }

  return (purchases / pv) * 100;
}

export function formatDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
