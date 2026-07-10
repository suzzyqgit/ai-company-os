"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ArticleFormActionState } from "./actions";
import { calculatePurchaseRate } from "./utils";

export type ArticleFormValues = {
  title: string;
  price: string;
  pv: string;
  purchases: string;
  updatedAt: string;
  memo: string;
};

type ArticleFormProps = {
  action: (
    previousState: ArticleFormActionState,
    formData: FormData,
  ) => Promise<ArticleFormActionState>;
  cancelHref: string;
  formTitle: string;
  initialValues: ArticleFormValues;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-medium text-red-600">{message}</p>;
}

export default function ArticleForm({
  action,
  cancelHref,
  formTitle,
  initialValues,
}: ArticleFormProps) {
  const [actionState, formAction, isPending] = useActionState(action, {});
  const [values, setValues] = useState<ArticleFormValues>(initialValues);

  const previewPurchaseRate = useMemo(() => {
    const pv = Number(values.pv);
    const purchases = Number(values.purchases);

    if (
      !Number.isFinite(pv) ||
      !Number.isFinite(purchases) ||
      pv < 0 ||
      purchases < 0
    ) {
      return "算出不可";
    }

    return `${calculatePurchaseRate(purchases, pv).toFixed(2)}%`;
  }, [values.purchases, values.pv]);

  function updateValue(field: keyof ArticleFormValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="text-base font-semibold">{formTitle}</h2>
        </div>

        <div className="grid gap-5 p-5">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-zinc-700"
            >
              タイトル
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={values.title}
              onChange={(event) => updateValue("title", event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
            <FieldError message={actionState.fieldErrors?.title} />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label
                htmlFor="price"
                className="block text-sm font-medium text-zinc-700"
              >
                価格
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                required
                value={values.price}
                onChange={(event) => updateValue("price", event.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
              <FieldError message={actionState.fieldErrors?.price} />
            </div>

            <div>
              <label
                htmlFor="pv"
                className="block text-sm font-medium text-zinc-700"
              >
                PV
              </label>
              <input
                id="pv"
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
                htmlFor="purchases"
                className="block text-sm font-medium text-zinc-700"
              >
                購入数
              </label>
              <input
                id="purchases"
                name="purchases"
                type="number"
                min="0"
                required
                value={values.purchases}
                onChange={(event) =>
                  updateValue("purchases", event.target.value)
                }
                className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
              <FieldError message={actionState.fieldErrors?.purchases} />
            </div>
          </div>

          <div>
            <label
              htmlFor="updatedAt"
              className="block text-sm font-medium text-zinc-700"
            >
              更新日
            </label>
            <input
              id="updatedAt"
              name="updatedAt"
              type="date"
              required
              value={values.updatedAt}
              onChange={(event) => updateValue("updatedAt", event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 sm:max-w-xs"
            />
            <FieldError message={actionState.fieldErrors?.updatedAt} />
          </div>

          <div>
            <label
              htmlFor="memo"
              className="block text-sm font-medium text-zinc-700"
            >
              メモ
            </label>
            <textarea
              id="memo"
              name="memo"
              rows={7}
              value={values.memo}
              onChange={(event) => updateValue("memo", event.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
            <FieldError message={actionState.fieldErrors?.memo} />
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        {actionState.formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {actionState.formError}
          </div>
        ) : null}

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">購入率</p>
          <p className="mt-3 text-2xl font-bold tabular-nums text-zinc-950">
            {previewPurchaseRate}
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            購入率は購入数 ÷ PV × 100 で自動算出されるため、編集項目には含めていません。
          </p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {isPending ? "保存中" : "保存"}
            </button>
            <Link
              href={cancelHref}
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              キャンセル
            </Link>
          </div>
        </div>
      </aside>
    </form>
  );
}
