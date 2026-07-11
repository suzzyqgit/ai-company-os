"use client";

import { useActionState } from "react";
import {
  migrateToProductionAction,
  type ProductionMigrationActionState,
} from "./actions";

type ProductionMigrationFormProps = {
  hasTargets: boolean;
  hasRelatedData: boolean;
};

const initialState: ProductionMigrationActionState = {};

export default function ProductionMigrationForm({
  hasTargets,
  hasRelatedData,
}: ProductionMigrationFormProps) {
  const [state, formAction, isPending] = useActionState(
    migrateToProductionAction,
    initialState,
  );

  return (
    <form action={formAction} className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-zinc-950">
          実運用へ移行
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          現在DBに存在する記事を削除し、実際のnote記事だけを登録できる空の状態にします。この操作は取り消せません。
        </p>
      </div>

      {hasRelatedData ? (
        <label className="mt-5 flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <input
            type="checkbox"
            name="confirmRelatedDeletion"
            className="mt-1 size-4 rounded border-red-300 text-red-600 focus:ring-red-600"
          />
          <span>
            日次実績またはAI分析に紐付くデータも削除されることを確認しました。
          </span>
        </label>
      ) : null}

      {state.formError ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {state.formError}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {hasTargets
            ? "削除対象一覧を確認してから実行してください。"
            : "削除対象の記事はありません。"}
        </p>
        <button
          type="submit"
          disabled={!hasTargets || isPending}
          className="inline-flex h-10 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-red-300"
        >
          {isPending ? "移行中" : "実運用へ移行する"}
        </button>
      </div>
    </form>
  );
}
