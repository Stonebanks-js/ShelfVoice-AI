// Phone photos to what the bill reader takes (doc 02, doc 03 uploads): a
// JPEG no larger than 1600 px on its longest side and under 3 MB. Drawing
// the photo onto a canvas and encoding it again keeps only the pixels, so
// EXIF data, including the GPS location, never leaves the phone.
export const MAX_SIDE = 1600;
export const MAX_BYTES = 3 * 1024 * 1024;

export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function prepareJpeg(file: Blob): Promise<{ bytes: Uint8Array<ArrayBuffer>; width: number; height: number }> {
  // "from-image" applies the camera's rotation before the EXIF is dropped.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Step the quality down until it fits; a 1600 px photo rarely needs it.
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_BYTES) return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
  }
  throw new Error("photo too large");
}
