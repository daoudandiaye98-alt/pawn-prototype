import type { Json } from "@/integrations/supabase/types";

export function hatSilhouette(rgba: ArrayLike<number>): boolean {
  const pixel = Math.floor(rgba.length / 4);
  if (!pixel) return false;
  let durchsichtig = 0, sichtbar = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] < 16) durchsichtig++;
    if (rgba[i] > 128) sichtbar++;
  }
  // Ein JPEG mit weisser Flaeche und eine leere PNG-Datei sind keine Aufsteller.
  return durchsichtig / pixel >= 0.01 && sichtbar / pixel >= 0.01;
}

export function aufstellerDNA(dna: Json, url: string): Json {
  const objekt = (value: Json) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const basis = objekt(dna);
  return { ...basis, heft: { ...objekt(basis.heft), cutout_url: url } };
}

/** Prueft echte Transparenz. Es wird nichts generiert und kein Farbton entfernt. */
export async function pruefeAufsteller(blob: Blob): Promise<boolean> {
  if (!["image/png", "image/webp"].includes(blob.type) || blob.size > 20 * 1024 * 1024) return false;
  const image = await createImageBitmap(blob);
  try {
    if (!image.width || !image.height || image.width * image.height > 24_000_000) return false;
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return hatSilhouette(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  } finally { image.close(); }
}
