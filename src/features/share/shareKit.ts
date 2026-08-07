/**
 * Teil 17b: Share Kits — vorlagenbasiert und deterministisch. Keine KI, keine Credits,
 * keine Wartezeit: alles läuft im Browser auf einem Canvas, sofort fertig.
 * Bildkomposition folgt dem Haus-Design (nur #000/#FFF, harte Kanten, Playfair/Inter) und
 * ist bewusst fest im Code — nur die Texte (Bildunterschrift, Hashtags) kommen aus
 * ai_config.share_kit_texts und sind dort editierbar.
 */
import { supabase } from "@/integrations/supabase/client";

export type ShareFormat = "story_9x16" | "post_1x1" | "pin_2x3" | "banner";

export const SHARE_FORMAT_LABEL: Record<ShareFormat, string> = {
  story_9x16: "Story",
  post_1x1: "Post",
  pin_2x3: "Pin",
  banner: "Banner",
};

const SHARE_FORMAT_SIZE: Record<ShareFormat, { w: number; h: number }> = {
  story_9x16: { w: 1080, h: 1920 },
  post_1x1: { w: 1080, h: 1080 },
  pin_2x3: { w: 1000, h: 1500 },
  banner: { w: 1200, h: 628 },
};

export interface ShareKitInput {
  imageUrl: string;
  brandName: string;
  productName: string;
  price: number;
}

interface ShareKitTexts {
  caption_template: string;
  hashtag_sets: Record<string, string[]>;
}

const FALLBACK_TEXTS: ShareKitTexts = {
  caption_template: "{brand} — {name}\n{price} · {link}",
  hashtag_sets: {},
};

export async function fetchShareKitTexts(): Promise<ShareKitTexts> {
  const { data } = await supabase.from("ai_config").select("value").eq("key", "share_kit_texts").maybeSingle();
  const v = (data as { value?: Partial<ShareKitTexts> } | null)?.value;
  return { ...FALLBACK_TEXTS, ...v };
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(price);
}

export function buildCaption(template: string, vars: { brand: string; name: string; price: string; link: string }): string {
  return template
    .replaceAll("{brand}", vars.brand)
    .replaceAll("{name}", vars.name)
    .replaceAll("{price}", vars.price)
    .replaceAll("{link}", vars.link);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`image_load_failed: ${url}`));
    img.src = url;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Erzeugt eine Share-Kit-Grafik als PNG-Blob — komplett im Browser, ohne Server-Aufruf. */
export async function renderShareKit(format: ShareFormat, input: ShareKitInput): Promise<Blob> {
  const { w, h } = SHARE_FORMAT_SIZE[format];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  await document.fonts.ready;
  const img = await loadImage(input.imageUrl);

  const barH = Math.round(h * (format === "banner" ? 0.32 : 0.2));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  drawCover(ctx, img, 0, 0, w, h - barH);

  // Textleiste — solides Schwarz, weiße Schrift, harte Kante (1.5px weiße Linie als Trenner).
  ctx.fillStyle = "#000";
  ctx.fillRect(0, h - barH, w, barH);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, h - barH, w, Math.max(2, Math.round(w * 0.0014)));

  const pad = Math.round(w * 0.06);
  const brandSize = Math.round(w * 0.024);
  const nameSize = Math.round(w * 0.042);
  const priceSize = Math.round(w * 0.028);
  let ty = h - barH + pad + brandSize;

  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${brandSize}px Inter, sans-serif`;
  ctx.fillText(input.brandName.toUpperCase(), pad, ty);

  ty += nameSize + Math.round(pad * 0.3);
  ctx.font = `600 ${nameSize}px "Playfair Display", Georgia, serif`;
  const maxNameWidth = w - pad * 2;
  let name = input.productName;
  while (ctx.measureText(name).width > maxNameWidth && name.length > 3) {
    name = name.slice(0, -1);
  }
  if (name !== input.productName) name = name.trimEnd() + "…";
  ctx.fillText(name, pad, ty);

  ty += priceSize + Math.round(pad * 0.35);
  ctx.font = `${priceSize}px Inter, sans-serif`;
  ctx.fillText(formatPrice(input.price), pad, ty);

  // Kleine Herkunftsmarke oben links — Text statt SVG, damit kein zweiter Asset-Ladeschritt nötig ist.
  const markSize = Math.round(w * 0.022);
  ctx.font = `600 ${markSize}px Inter, sans-serif`;
  const markPad = Math.round(w * 0.03);
  const markText = "PAWN";
  const markW = ctx.measureText(markText).width + markPad * 1.6;
  const markH = markSize + markPad * 1.4;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1.5, w * 0.0012);
  ctx.strokeRect(markPad, markPad, markW, markH);
  ctx.fillStyle = "#fff";
  ctx.fillText(markText, markPad + markPad * 0.8, markPad + markH / 2 + markSize / 3);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas_export_failed"))), "image/png", 0.95);
  });
}

export interface CoverShareKitInput {
  imageUrl: string;
  brandName: string;
  houseNumber: number | null;
}

/**
 * Teil 27b — der Cover-Moment als Bild: das Werk läuft randlos über die ganze Fläche
 * (kein Textbalken, der es beschneidet), der Hausname liegt groß direkt auf dem Bild wie
 * auf einem Magazin-Cover, darunter klein die Ausgabennummer. Bewusst kein Preis, kein
 * Produktname — dieser Moment gehört dem Haus, nicht dem einzelnen Stück.
 */
export async function renderCoverShareKit(input: CoverShareKitInput): Promise<Blob> {
  const w = 1080, h = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  await document.fonts.ready;
  const img = await loadImage(input.imageUrl);

  drawCover(ctx, img, 0, 0, w, h);

  // Weicher Verlauf nur hinter dem Text — das Bild bleibt der Held, der Verlauf sorgt nur
  // dafür, dass weiße Schrift auf jedem Motiv lesbar bleibt.
  const scrimH = Math.round(h * 0.45);
  const gradient = ctx.createLinearGradient(0, h - scrimH, 0, h);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h - scrimH, w, scrimH);

  const pad = Math.round(w * 0.08);
  const nameSize = Math.round(w * 0.11);
  const numberSize = Math.round(w * 0.026);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  let fittedNameSize = nameSize;
  const maxNameWidth = w - pad * 2;
  ctx.font = `600 ${fittedNameSize}px "Playfair Display", Georgia, serif`;
  while (ctx.measureText(input.brandName).width > maxNameWidth && fittedNameSize > numberSize * 2) {
    fittedNameSize -= 2;
    ctx.font = `600 ${fittedNameSize}px "Playfair Display", Georgia, serif`;
  }
  const nameY = h - pad - numberSize - Math.round(pad * 0.4);
  ctx.fillText(input.brandName, pad, nameY);

  ctx.font = `${numberSize}px Inter, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  const numberLabel = `№ ${String(input.houseNumber ?? 0).padStart(3, "0")}`;
  ctx.fillText(numberLabel, pad, h - pad);

  // Kleine Herkunftsmarke oben links, wie bei den übrigen Share-Kits.
  const markSize = Math.round(w * 0.022);
  ctx.font = `600 ${markSize}px Inter, sans-serif`;
  const markPad = Math.round(w * 0.03);
  const markText = "PAWN";
  const markW = ctx.measureText(markText).width + markPad * 1.6;
  const markH = markSize + markPad * 1.4;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(1.5, w * 0.0012);
  ctx.strokeRect(markPad, markPad, markW, markH);
  ctx.fillStyle = "#fff";
  ctx.fillText(markText, markPad + markPad * 0.8, markPad + markH / 2 + markSize / 3);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas_export_failed"))), "image/png", 0.95);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
