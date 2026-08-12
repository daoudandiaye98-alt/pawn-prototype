/** Verkleinert ein Bild browserseitig auf höchstens 1600px Kante, WebP bevorzugt.
 * Ursprünglich in Apply.tsx (PART 40), PART 51 hierher ausgelagert, damit First Move (/start)
 * dieselbe Kompression ohne Duplikat nutzen kann. */
export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp", 0.85);
  let ext = "webp";
  if (!blob) {
    blob = await toBlob("image/jpeg", 0.85);
    ext = "jpg";
  }
  if (!blob) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}
