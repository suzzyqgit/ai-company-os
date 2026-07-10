"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { BulkDailyMetricActionState } from "@/features/metrics/actions";
import { numberFormatter, yenFormatter } from "@/app/articles/utils";

type DailyMetricInputRow = {
  articleId: string;
  title: string;
  price: number;
  totalPv: number;
  totalPurchases: number;
  metric: {
    pv: number;
    purchases: number;
    revenue: number;
    masterTransitions: number;
  } | null;
};

type RowValues = {
  pv: string;
  purchases: string;
  revenue: string;
  masterTransitions: string;
};

type DailyMetricsBulkFormProps = {
  action: (
    previousState: BulkDailyMetricActionState,
    formData: FormData,
  ) => Promise<BulkDailyMetricActionState>;
  date: string;
  rows: DailyMetricInputRow[];
  redirectQuery: string;
};

function buildInitialValues(rows: DailyMetricInputRow[]) {
  return Object.fromEntries(
    rows.map((row) => [
      row.articleId,
      {
        pv: String(row.metric?.pv ?? 0),
        purchases: String(row.metric?.purchases ?? 0),
        revenue: String(row.metric?.revenue ?? 0),
        masterTransitions: String(row.metric?.masterTransitions ?? 0),
      },
    ]),
  ) as Record<string, RowValues>;
}

export default function DailyMetricsBulkForm({
  action,
  date,
  rows,
  redirectQuery,
}: DailyMetricsBulkFormProps) {
  const [actionState, formAction, isPending] = useActionState(action, {});
  const [values, setValues] = useState(() => buildInitialValues(rows));

  const totals = useMemo(
    () =>
      rows.reduce(
        (current, row) => {
          const rowValues = values[row.articleId];

          return {
            pv: current.pv + Number(rowValues?.pv || 0),
            purchases: current.purchases + Number(rowValues?.purchases || 0),
            revenue: current.revenue + Number(rowValues?.revenue || 0),
            masterTransitions:
              current.masterTransitions +
              Number(rowValues?.masterTransitions || 0),
          };
        },
        {
          pv: 0,
          purchases: 0,
          revenue: 0,
          masterTransitions: 0,
        },
      ),
    [rows, values],
  );

  function updateRowValue(
    articleId: string,
    field: keyof RowValues,
    value: string,
    price: number,
  ) {
    setValues((current) => {
      const row = current[articleId] ?? {
        pv: "0",
        purchases: "0",
        revenue: "0",
        masterTransitions: "0",
      };
      const nextRow = {
        ...row,
        [field]: value,
      };

      if (field === "purchases" && (row.revenue === "" || row.revenue === "0")) {
        const purchases = Number(value);
        nextRow.revenue =
          Number.isInteger(purchases) && purchases >= 0
            ? String(price * purchases)
            : row.revenue;
      }

      return {
        ...current,
        [articleId]: nextRow,
      };
    });
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="redirectQuery" value={redirectQuery} />

      {actionState.formError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {actionState.formError}
        </div>
      ) : null}

      {actionState.successMessage ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {actionState.successMessage}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">入力PV</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
            {numberFormatter.format(totals.pv)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">入力購入数</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
            {numberFormatter.format(totals.purchases)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">入力売上</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
            {yenFormatter.format(totals.revenue)}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">Master遷移数</p>
          <p className="mt-2 text-xl font-bold tabular-nums text-zinc-950">
            {numberFormatter.format(totals.masterTransitions)}
          </p>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[74rem] divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="sticky left-0 z-10 min-w-72 bg-zinc-100 px-5 py-3 text-left font-semibold text-zinc-700">
                  記事タイトル
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  価格
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  累計PV
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  累計購入数
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  対象日のPV
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  対象日の購入数
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  対象日の売上
                </th>
                <th className="px-5 py-3 text-right font-semibold text-zinc-700">
                  Master遷移数
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {rows.length > 0 ? (
                rows.map((row) => {
                  const rowValues = values[row.articleId];
                  const rowError = actionState.rowErrors?.[row.articleId];

                  return (
                    <tr key={row.articleId} className="hover:bg-zinc-50">
                      <td className="sticky left-0 z-10 bg-white px-5 py-4 align-top font-medium text-zinc-950">
                        <input
                          type="hidden"
                          name="articleId"
                          value={row.articleId}
                        />
                        <Link
                          href={`/articles/${row.articleId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {row.title}
                        </Link>
                        {row.metric ? (
                          <p className="mt-1 text-xs font-medium text-emerald-700">
                            入力済み
                          </p>
                        ) : null}
                        {rowError ? (
                          <p className="mt-2 text-xs font-medium text-red-600">
                            {rowError}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {yenFormatter.format(row.price)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(row.totalPv)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                        {numberFormatter.format(row.totalPurchases)}
                      </td>
                      <td className="px-5 py-4">
                        <input
                          name={`pv-${row.articleId}`}
                          type="number"
                          min="0"
                          value={rowValues?.pv ?? "0"}
                          onChange={(event) =>
                            updateRowValue(
                              row.articleId,
                              "pv",
                              event.target.value,
                              row.price,
                            )
                          }
                          className="h-10 w-28 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm tabular-nums shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          name={`purchases-${row.articleId}`}
                          type="number"
                          min="0"
                          value={rowValues?.purchases ?? "0"}
                          onChange={(event) =>
                            updateRowValue(
                              row.articleId,
                              "purchases",
                              event.target.value,
                              row.price,
                            )
                          }
                          className="h-10 w-28 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm tabular-nums shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          name={`revenue-${row.articleId}`}
                          type="number"
                          min="0"
                          value={rowValues?.revenue ?? "0"}
                          onChange={(event) =>
                            updateRowValue(
                              row.articleId,
                              "revenue",
                              event.target.value,
                              row.price,
                            )
                          }
                          className="h-10 w-32 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm tabular-nums shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <input
                          name={`masterTransitions-${row.articleId}`}
                          type="number"
                          min="0"
                          value={rowValues?.masterTransitions ?? "0"}
                          onChange={(event) =>
                            updateRowValue(
                              row.articleId,
                              "masterTransitions",
                              event.target.value,
                              row.price,
                            )
                          }
                          className="h-10 w-28 rounded-md border border-zinc-300 bg-white px-3 text-right text-sm tabular-nums shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-zinc-500"
                  >
                    条件に一致する記事はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          未登録で全て0の行は保存しません。既存レコードを0にした場合は0値で更新して保持します。
        </p>
        <button
          type="submit"
          disabled={isPending || rows.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isPending ? "保存中" : "一括保存"}
        </button>
      </div>
    </form>
  );
}
