import { calculatePurchaseRate, numberFormatter, yenFormatter } from "@/app/articles/utils";
import { tokyoDateFormatter } from "@/features/metrics/calculators";

type DailyMetric = {
  id: string;
  date: Date;
  pv: number;
  purchases: number;
  revenue: number;
  masterTransitions: number;
};

type ArticleDailyMetricTableProps = {
  metrics: DailyMetric[];
};

export default function ArticleDailyMetricTable({
  metrics,
}: ArticleDailyMetricTableProps) {
  if (metrics.length === 0) {
    return (
      <p className="px-5 py-8 text-sm text-zinc-500">
        日次実績はまだ登録されていません。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-100">
          <tr>
            <th className="px-5 py-3 text-left font-semibold text-zinc-700">
              日付
            </th>
            <th className="px-5 py-3 text-right font-semibold text-zinc-700">
              PV
            </th>
            <th className="px-5 py-3 text-right font-semibold text-zinc-700">
              購入数
            </th>
            <th className="px-5 py-3 text-right font-semibold text-zinc-700">
              購入率
            </th>
            <th className="px-5 py-3 text-right font-semibold text-zinc-700">
              売上
            </th>
            <th className="px-5 py-3 text-right font-semibold text-zinc-700">
              Master遷移数
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {metrics.map((metric) => (
            <tr key={metric.id} className="hover:bg-zinc-50">
              <td className="whitespace-nowrap px-5 py-4 text-zinc-700">
                {tokyoDateFormatter.format(metric.date)}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                {numberFormatter.format(metric.pv)}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                {numberFormatter.format(metric.purchases)}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums font-medium text-zinc-950">
                {calculatePurchaseRate(metric.purchases, metric.pv).toFixed(2)}
                %
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                {yenFormatter.format(metric.revenue)}
              </td>
              <td className="whitespace-nowrap px-5 py-4 text-right tabular-nums text-zinc-700">
                {numberFormatter.format(metric.masterTransitions)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
