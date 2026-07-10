import { NextRequest } from "next/server";
import {
  buildMetricsCsv,
  resolveMetricsExportPeriod,
} from "@/features/exports/csv";
import { getMetricsForCsvExport } from "@/features/exports/queries";

export const dynamic = "force-dynamic";

function encodeFilename(filename: string) {
  return encodeURIComponent(filename).replaceAll("%20", " ");
}

export async function GET(request: NextRequest) {
  const period = resolveMetricsExportPeriod(request.nextUrl.searchParams);
  const rows = await getMetricsForCsvExport({
    from: period.from,
    exclusiveTo: period.exclusiveTo,
  });
  const csv = buildMetricsCsv(rows);
  const encodedFilename = encodeFilename(period.filename);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${period.filename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
    },
  });
}
