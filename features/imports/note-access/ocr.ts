import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getExtensionFromImageType(imageType: string) {
  switch (imageType) {
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/png":
    default:
      return ".png";
  }
}

export async function runTesseractOcr({
  buffer,
  imageType,
}: {
  buffer: Buffer;
  imageType: string;
}) {
  const directory = await mkdtemp(join(tmpdir(), "note-access-"));
  const extension = getExtensionFromImageType(imageType);
  const inputPath = join(directory, `input${extension}`);

  try {
    await writeFile(inputPath, buffer);

    const result = await execFileAsync("tesseract", [
      inputPath,
      "stdout",
      "-l",
      "jpn",
      "--psm",
      "6",
    ]);

    return result.stdout;
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
}
