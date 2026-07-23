import { classifyImageOcr, extractSnapshotFromOcr, normalizeSnapshot, validateSnapshot } from "./image.ts";
import { buildPhase1AImportOutput } from "./phase1a-output.ts";
import type { ImportOutput } from "./output-schema.ts";
import type { SourceInspection } from "./types.ts";

export function buildNoteAccessSnapshotImportOutput({
  inspection,
  ocrText,
  importedAt,
  importedBy,
  pipelineVersion,
}: {
  inspection: SourceInspection;
  ocrText: string;
  importedAt: string;
  importedBy: string;
  pipelineVersion: string;
}): ImportOutput {
  const classification = classifyImageOcr({ ocrText });
  const extraction =
    classification.sourceKind === "note_access_dashboard"
      ? extractSnapshotFromOcr(ocrText)
      : null;
  const normalizedSnapshot = extraction
    ? normalizeSnapshot({ classification, extraction, inspection })
    : null;
  const validation = validateSnapshot(normalizedSnapshot);

  return buildPhase1AImportOutput({
    inspection,
    classification,
    extraction,
    validation,
    importedAt,
    importedBy,
    pipelineVersion,
  });
}
