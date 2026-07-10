import {
  divideRate,
  resolveAnalyticsPeriod,
} from "@/features/analytics/calculators";
import {
  formatTokyoDateInputValue,
  normalizeDateInputToTokyoDate,
} from "@/features/metrics/calculators";

export const metricsCsvHeaders = [
  "date",
  "articleId",
  "title",
  "price",
  "pv",
  "purchases",
  "conversionRate",
  "revenue",
  "masterTransitions",
  "masterTransitionRate",
] as const;

export type MetricsCsvRow = {
  date: Date;
  articleId: string;
  title: string;
  price: number;
  pv: number;
  purchases: number;
  revenue: number;
  masterTransitions: number;
};

export type MetricsExportPeriod = {
  from: Date;
  exclusiveTo: Date;
  fromInput: string;
  toInput: string;
  filename: string;
};

const bom = "\uFEFF";
const millisecondsPerDay = 24 * 60 * 60 * 1000;

function escapeCsvField(value: string | number) {
  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

function formatRate(numerator: number, denominator: number) {
  return divideRate(numerator, denominator).toFixed(2);
}

function createCsvLine(values: Array<string | number>) {
  return values.map(escapeCsvField).join(",");
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function getTodayInput() {
  return formatTokyoDateInputValue(new Date());
}

export function buildMetricsCsv(rows: MetricsCsvRow[]) {
  const lines = [
    createCsvLine([...metricsCsvHeaders]),
    ...rows.map((row) =>
      createCsvLine([
        formatTokyoDateInputValue(row.date),
        row.articleId,
        row.title,
        row.price,
        row.pv,
        row.purchases,
        formatRate(row.purchases, row.pv),
        row.revenue,
        row.masterTransitions,
        formatRate(row.masterTransitions, row.purchases),
      ]),
    ),
  ];

  return `${bom}${lines.join("\r\n")}\r\n`;
}

export function resolveMetricsExportPeriod(searchParams: URLSearchParams) {
  if (searchParams.get("scope") === "day") {
    const requestedDate = searchParams.get("date") ?? "";
    const date =
      normalizeDateInputToTokyoDate(requestedDate) ??
      normalizeDateInputToTokyoDate(getTodayInput());

    if (date === null) {
      throw new Error("Failed to resolve export date");
    }

    const dateInput = formatTokyoDateInputValue(date);

    return {
      from: date,
      exclusiveTo: addDays(date, 1),
      fromInput: dateInput,
      toInput: dateInput,
      filename: `note-metrics_${dateInput}.csv`,
    } satisfies MetricsExportPeriod;
  }

  const period = resolveAnalyticsPeriod({
    range: searchParams.get("range") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  return {
    from: period.from,
    exclusiveTo: period.exclusiveTo,
    fromInput: period.fromInput,
    toInput: period.toInput,
    filename: `note-metrics_${period.fromInput}_${period.toInput}.csv`,
  } satisfies MetricsExportPeriod;
}
