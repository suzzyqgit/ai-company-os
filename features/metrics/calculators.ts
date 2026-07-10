const tokyoTimeZone = "Asia/Tokyo";
const tokyoOffsetHours = 9;
const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDateInputToTokyoDate(value: string) {
  if (!dateInputPattern.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const utcMidnight = new Date(Date.UTC(year, month - 1, day));

  if (
    utcMidnight.getUTCFullYear() !== year ||
    utcMidnight.getUTCMonth() !== month - 1 ||
    utcMidnight.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(
    Date.UTC(year, month - 1, day) - tokyoOffsetHours * 60 * 60 * 1000,
  );
}

export function formatTokyoDateInputValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tokyoTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export const tokyoDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: tokyoTimeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calculateArticleTotalFromDailyMetrics({
  baselinePv,
  baselinePurchases,
  dailyPv,
  dailyPurchases,
}: {
  baselinePv: number;
  baselinePurchases: number;
  dailyPv: number;
  dailyPurchases: number;
}) {
  return {
    pv: baselinePv + dailyPv,
    purchases: baselinePurchases + dailyPurchases,
  };
}
