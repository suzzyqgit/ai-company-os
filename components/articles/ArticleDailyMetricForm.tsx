"use client";

import { useActionState, useState } from "react";
import type { DailyMetricActionState } from "@/features/metrics/actions";

type ArticleDailyMetricFormProps = {
  action: (
    previousState: DailyMetricActionState,
    formData: FormData,
  ) => Promise<DailyMetricActionState>;
  articlePrice: number;
  defaultDate: string;
};

type MetricFormValues = {
  date: string;
  pv: string;
  purchases: string;
  revenue: string;
  masterTransitions: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

export default function ArticleDailyMetricForm({
  action,
  articlePrice,
  defaultDate,
}: ArticleDailyMetricFormProps) {
  const [actionState, formAction, isPending] = useActionState(action, {});
  const [isRevenueEdited, setIsRevenueEdited] = useState(false);
  const [values, setValues] = useState<MetricFormValues>({
    date: "",
    pv: "",
    purchases: "",
    revenue: "",
    masterTransitions: "",
  });

  function updateValue(field: keyof MetricFormValues, value: string) {
    setValues((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === "purchases" && !isRevenueEdited) {
        const purchases = Number(value);
        next.revenue =
          Number.isInteger(purchases) && purchases >= 0
            ? String(articlePrice * purchases)
            : "";
      }

      return next;
    });
  }

  return (
    <form action={formAction} className="grid gap-4">
      {actionState.formError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {actionState.formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <label
            htmlFor="metric-date"
            className="block text-sm font-medium text-zinc-700"
          >
            日付
          </label>
          <input
            id="metric-date"
            name="date"
            type="date"
            required
            defaultValue={defaultDate}
            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <FieldError message={actionState.fieldErrors?.date} />
        </div>

        <div>
          <label
            htmlFor="metric-pv"
            className="block text-sm font-medium text-zinc-700"
          >
            PV
          </label>
          <input
            id="metric-pv"
            name="pv"
            type="number"
            min="0"
            required
            value={values.pv}
            onChange={(event) => updateValue("pv", event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <FieldError message={actionState.fieldErrors?.pv} />
        </div>

        <div>
          <label
            htmlFor="metric-purchases"
            className="block text-sm font-medium text-zinc-700"
          >
            購入数
          </label>
          <input
            id="metric-purchases"
            name="purchases"
            type="number"
            min="0"
            required
            value={values.purchases}
            onChange={(event) => updateValue("purchases", event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <FieldError message={actionState.fieldErrors?.purchases} />
        </div>

        <div>
          <label
            htmlFor="metric-revenue"
            className="block text-sm font-medium text-zinc-700"
          >
            売上
          </label>
          <input
            id="metric-revenue"
            name="revenue"
            type="number"
            min="0"
            required
            value={values.revenue}
            onChange={(event) => {
              setIsRevenueEdited(true);
              updateValue("revenue", event.target.value);
            }}
            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <FieldError message={actionState.fieldErrors?.revenue} />
        </div>

        <div>
          <label
            htmlFor="metric-master-transitions"
            className="block text-sm font-medium text-zinc-700"
          >
            Master遷移数
          </label>
          <input
            id="metric-master-transitions"
            name="masterTransitions"
            type="number"
            min="0"
            required
            value={values.masterTransitions}
            onChange={(event) =>
              updateValue("masterTransitions", event.target.value)
            }
            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <FieldError message={actionState.fieldErrors?.masterTransitions} />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          売上は当日の実績として保存します。購入数入力時に現在価格から候補を入れますが、手動修正できます。
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isPending ? "保存中" : "日次実績を保存"}
        </button>
      </div>
    </form>
  );
}
