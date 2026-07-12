import sharp from "sharp";

type CropRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type NoteAccessPreprocessResult = {
  tableBuffer: Buffer;
  titleBuffer: Buffer;
  pvBuffer: Buffer;
  imageType: "image/png";
  metadata: {
    originalWidth: number;
    originalHeight: number;
    cropLeft: number;
    cropTop: number;
    cropWidth: number;
    cropHeight: number;
    titleCropWidth: number;
    pvCropLeft: number;
    pvCropWidth: number;
    outputWidth: number;
    outputHeight: number;
  };
};

function getTableCrop({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const cropLeft = Math.max(0, Math.round(width * 0.06));
  const cropTop = Math.max(0, Math.round(height * 0.22));
  const cropWidth = Math.max(1, Math.round(width * 0.88));
  const cropHeight = Math.max(1, Math.round(height * 0.72));

  return {
    left: Math.min(cropLeft, width - 1),
    top: Math.min(cropTop, height - 1),
    width: Math.min(cropWidth, width - cropLeft),
    height: Math.min(cropHeight, height - cropTop),
  };
}

export async function preprocessNoteAccessImage(
  inputBuffer: Buffer,
): Promise<NoteAccessPreprocessResult> {
  const source = sharp(inputBuffer, {
    limitInputPixels: false,
  });
  const metadata = await source.metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;

  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new Error("Invalid image size");
  }

  const crop = getTableCrop({
    width: originalWidth,
    height: originalHeight,
  });
  const resizeRatio = originalWidth < 2200 ? 2 : 1.5;
  const outputWidth = Math.round(crop.width * resizeRatio);
  const outputHeight = Math.round(crop.height * resizeRatio);

  function buildProcessedImage(input: CropRegion, width: number, height: number) {
    return sharp(inputBuffer, {
      limitInputPixels: false,
    })
      .extract(input)
      .grayscale()
      .normalize()
      .linear(1.25, -12)
      .sharpen()
      .resize({
        width: Math.round(width * resizeRatio),
        height: Math.round(height * resizeRatio),
        fit: "fill",
        kernel: "lanczos3",
      })
      .threshold(170)
      .png({
        compressionLevel: 0,
      })
      .withMetadata({
        density: 300,
      })
      .toBuffer();
  }

  const titleCropWidth = Math.round(crop.width * 0.74);
  const pvCropLeft = crop.left + Math.round(crop.width * 0.72);
  const pvCropWidth = crop.width - Math.round(crop.width * 0.72);
  const tableBuffer = await buildProcessedImage(crop, crop.width, crop.height);
  const titleBuffer = await buildProcessedImage(
    {
      left: crop.left,
      top: crop.top,
      width: titleCropWidth,
      height: crop.height,
    },
    titleCropWidth,
    crop.height,
  );
  const pvBuffer = await buildProcessedImage(
    {
      left: pvCropLeft,
      top: crop.top,
      width: pvCropWidth,
      height: crop.height,
    },
    pvCropWidth,
    crop.height,
  );

  return {
    tableBuffer,
    titleBuffer,
    pvBuffer,
    imageType: "image/png",
    metadata: {
      originalWidth,
      originalHeight,
      cropLeft: crop.left,
      cropTop: crop.top,
      cropWidth: crop.width,
      cropHeight: crop.height,
      titleCropWidth,
      pvCropLeft,
      pvCropWidth,
      outputWidth,
      outputHeight,
    },
  };
}
