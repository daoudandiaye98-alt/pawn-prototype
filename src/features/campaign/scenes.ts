/**
 * Szenen-Bibliothek für den PAWN-Renderer.
 * V2 — Reel-safe Typografie, adaptive Regie, Hook-First, CTA-Outro.
 */

export type SceneType =
  | "hook-typo"
  | "parallax-duo"
  | "split-frame"
  | "kinetic-typo"
  | "mask-reveal"
  | "detail-punch"
  | "ken-burns"
  | "outro"
  | "white-flash";

export interface Layout {
  W: number;
  H: number;
  pad: number;
  serif: string;
  sans: string;
}

export const REEL: Layout = { W: 1080, H: 1920, pad: 60, serif: "Playfair Display, Georgia, serif", sans: "Inter, system-ui, sans-serif" };
export const FEED: Layout = { W: 1080, H: 1080, pad: 60, serif: "Playfair Display, Georgia, serif", sans: "Inter, system-ui, sans-serif" };

export interface SourceLayer {
  img?: HTMLImageElement;
  video?: HTMLVideoElement;
}

export interface SceneCtx {
  layout: Layout;
  layers: SourceLayer[];
  hookLine?: string | null;
  brandName: string;
  productName?: string | null;
  productLabel?: string | null;
  houseNumber?: number | null;
  instagramHandle?: string | null;
  /** Haus-Plan zeigt das PAWN-Emblem im Abspann; Atelier/Maison nicht. Default true. */
  showEmblem?: boolean;
  /** Signatur-Rezept: Canvas-Filter (Licht/Palette), bevorzugte Schnitttypen (Kamerafahrt). */
  filter?: string;
  preferredShots?: string[];
}

export interface Scene {
  type: SceneType;
  durationMs: number;
  layerIndexes: number[];
  render: (ctx: CanvasRenderingContext2D, t: number, sc: SceneCtx) => void;
}

/* ---------------- helpers ---------------- */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;

/** Safe-zones: top 14 %, bottom 20 % bleiben textfrei. */
export function safeTop(H: number) { return Math.round(H * 0.14); }
export function safeBottom(H: number) { return Math.round(H * 0.80); }
export function indentX(W: number) { return Math.round(W * 0.08); }

function fill(ctx: CanvasRenderingContext2D, color: string, W: number, H: number) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
}

function drawSource(
  ctx: CanvasRenderingContext2D,
  layer: SourceLayer,
  dx: number, dy: number, dw: number, dh: number,
  filter = "grayscale(1) contrast(1.25) brightness(0.98)",
) {
  const src: CanvasImageSource | null = layer.video ?? layer.img ?? null;
  if (!src) return;
  ctx.save();
  ctx.filter = filter;
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  const sw = (layer.video ? layer.video.videoWidth : (layer.img?.naturalWidth ?? 0)) || 1;
  const sh = (layer.video ? layer.video.videoHeight : (layer.img?.naturalHeight ?? 0)) || 1;
  const sr = sw / sh;
  const dr = dw / dh;
  let rw: number, rh: number;
  if (sr > dr) { rh = dh; rw = rh * sr; }
  else { rw = dw; rh = rw / sr; }
  const rx = dx + (dw - rw) / 2;
  const ry = dy + (dh - rh) / 2;
  ctx.drawImage(src as CanvasImageSource, rx, ry, rw, rh);
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  opts: { size: number; family: string; weight?: number | string; color?: string; align?: CanvasTextAlign; alpha?: number },
) {
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.fillStyle = opts.color ?? "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = opts.align ?? "left";
  ctx.font = `${opts.weight ?? 500} ${opts.size}px ${opts.family}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Wrap text at word boundaries into up to `maxLines` lines that fit `maxWidth`. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  weight: number | string,
  family: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(cand).width <= maxWidth || !cur) {
      cur = cand;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // If truncated, push rest into last line with ellipsis
  ctx.restore();
  return lines;
}

/* ---------------- Szenen ---------------- */

/** HOOK-Szene: Wort für Wort, Playfair 600, groß, safe-zone-respektierend. */
export function hookTypo(hookLine: string): Scene {
  const words = hookLine.split(/\s+/).filter(Boolean);
  // 1-2 Wörter pro Beat
  const groups: string[][] = [];
  for (let i = 0; i < words.length; i += 2) groups.push(words.slice(i, i + 2));
  if (groups.length === 0) groups.push([hookLine]);
  const perGroup = 1 / groups.length;
  return {
    type: "hook-typo",
    durationMs: Math.max(2400, groups.length * 900),
    layerIndexes: [],
    render(ctx, t, sc) {
      const { W, H, serif } = sc.layout;
      const gi = Math.min(groups.length - 1, Math.floor(t / perGroup));
      const localT = (t - gi * perGroup) / perGroup;
      const dark = gi % 2 === 0;
      fill(ctx, dark ? "#0a0a0a" : "#fff", W, H);
      const text = (groups[gi] || []).join(" ");
      const alpha = Math.min(1, easeOutCubic(localT * 2.2));
      const x = indentX(W);
      const size = 200;
      const maxW = W - 2 * x;
      const lines = wrapLines(ctx, text, size, 600, serif, maxW, 2);
      // Center block vertically in the safe area
      const top = safeTop(H);
      const bot = safeBottom(H);
      const lineH = size * 1.02;
      const blockH = lines.length * lineH;
      const y0 = top + ((bot - top) - blockH) / 2 + size * 0.82;
      lines.forEach((line, i) => {
        drawText(ctx, line, x, y0 + i * lineH, {
          size, family: serif, weight: 600, align: "left",
          color: dark ? "#fff" : "#0a0a0a", alpha,
        });
      });
      // Hairline frame (respects safe zones aesthetically)
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 60, W - 120, H - 120);
    },
  };
}

export function parallaxDuo(index: number, layerIdx: number): Scene {
  return {
    type: "parallax-duo",
    durationMs: 3200,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H, pad, serif, sans } = sc.layout;
      fill(ctx, "#fff", W, H);
      const shift = (easeInOutCubic(t) - 0.5) * 40;
      // Foto in Safe-Area (respektiert oben 14 %, unten 20 %)
      const top = safeTop(H);
      const bot = safeBottom(H);
      drawSource(ctx, sc.layers[layerIdx], pad, top + shift, W - pad * 2, bot - top - 260, sc.filter);
      // Overlay-Karte am unteren Ende der Safe-Area, linksbündig 8 %
      const cardX = indentX(W);
      const cardW = W - cardX * 2;
      const cardH = 240;
      const cardY = bot - cardH - 24;
      ctx.fillStyle = "#000";
      ctx.fillRect(cardX + 10, cardY + 10, cardW, cardH);
      ctx.fillStyle = "#fff";
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cardX, cardY, cardW, cardH);
      const name = sc.productName ?? sc.brandName;
      const label = sc.productLabel ?? sc.brandName;
      drawText(ctx, name, cardX + 40, cardY + 110, { size: 88, family: serif, weight: 500, color: "#000" });
      drawText(ctx, label.toUpperCase(), cardX + 40, cardY + 160, { size: 26, family: sans, weight: 400, color: "#000" });
      drawText(ctx, `Haus №\u2009${sc.houseNumber ?? "—"} · pawn`, cardX + 40, cardY + 210, { size: 22, family: sans, weight: 400, color: "#000" });
      void index;
    },
  };
}

export function splitFrame(aIdx: number, bIdx: number): Scene {
  return {
    type: "split-frame",
    durationMs: 2400,
    layerIndexes: [aIdx, bIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      fill(ctx, "#000", W, H);
      const mid = W / 2;
      const dxA = -20 * easeInOutCubic(t);
      const dxB = 20 * easeInOutCubic(t);
      drawSource(ctx, sc.layers[aIdx], dxA, 0, mid, H, sc.filter);
      drawSource(ctx, sc.layers[bIdx], mid + dxB, 0, mid, H, sc.filter);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mid, 0); ctx.lineTo(mid, H);
      ctx.stroke();
    },
  };
}

/** Legacy kineticTypo — behalten, mit größerer Type und Safe-Zone. */
export function kineticTypo(hookLine: string): Scene {
  const words = hookLine.split(/\s+/).filter(Boolean);
  const groups: string[][] = [];
  for (let i = 0; i < words.length; i += 2) groups.push(words.slice(i, i + 2));
  const perGroup = 1 / Math.max(1, groups.length);
  return {
    type: "kinetic-typo",
    durationMs: Math.max(2400, groups.length * 800),
    layerIndexes: [],
    render(ctx, t, sc) {
      const { W, H, serif } = sc.layout;
      const gi = Math.min(groups.length - 1, Math.floor(t / perGroup));
      const localT = (t - gi * perGroup) / perGroup;
      const dark = gi % 2 === 0;
      fill(ctx, dark ? "#000" : "#fff", W, H);
      const text = (groups[gi] || []).join(" ");
      const alpha = Math.min(1, easeOutCubic(localT * 2));
      const x = indentX(W);
      const size = 180;
      const lines = wrapLines(ctx, text, size, 600, serif, W - 2 * x, 2);
      const top = safeTop(H);
      const bot = safeBottom(H);
      const lineH = size * 1.02;
      const y0 = top + ((bot - top) - lines.length * lineH) / 2 + size * 0.82;
      lines.forEach((line, i) => {
        drawText(ctx, line, x, y0 + i * lineH, {
          size, family: serif, weight: 600, align: "left",
          color: dark ? "#fff" : "#000", alpha,
        });
      });
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 60, W - 120, H - 120);
    },
  };
}

export function maskReveal(layerIdx: number): Scene {
  return {
    type: "mask-reveal",
    durationMs: 2400,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      fill(ctx, "#000", W, H);
      const reveal = easeInOutCubic(t);
      const revealW = W * reveal;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, revealW, H);
      ctx.clip();
      drawSource(ctx, sc.layers[layerIdx], 0, 0, W, H, sc.filter);
      ctx.restore();
      ctx.fillStyle = "#000";
      ctx.fillRect(revealW, 0, 8, H);
    },
  };
}

export function detailPunch(layerIdx: number): Scene {
  return {
    type: "detail-punch",
    durationMs: 1600,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      fill(ctx, "#000", W, H);
      const flash = t > 0.94 ? 1 : 0;
      const zoom = 1.1 + easeInCubic(t) * 0.35;
      const dw = W * zoom;
      const dh = H * zoom;
      const dx = -(dw - W) * 0.6;
      const dy = -(dh - H) * 0.5;
      drawSource(ctx, sc.layers[layerIdx], dx, dy, dw, dh, sc.filter ?? "grayscale(1) contrast(1.4) brightness(1)");
      if (flash) fill(ctx, "#fff", W, H);
    },
  };
}

export function kenBurns(layerIdx: number, direction: 1 | -1, zoomDelta = 0.08): Scene {
  return {
    type: "ken-burns",
    durationMs: 3200,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H, serif, sans } = sc.layout;
      fill(ctx, "#000", W, H);
      const s = 1 + zoomDelta * easeInOutCubic(t);
      const dw = W * s, dh = H * s;
      const dx = (W - dw) / 2 + direction * 40 * easeInOutCubic(t);
      const dy = (H - dh) / 2 - 20 * easeInOutCubic(t);
      drawSource(ctx, sc.layers[layerIdx], dx, dy, dw, dh, sc.filter);
      // Weiße Text-Plate, linksbündig, in Safe-Area
      const x = indentX(W);
      const bot = safeBottom(H);
      const plateH = 220;
      const plateY = bot - plateH - 20;
      const plateW = Math.min(W - x * 2, 820);
      const alpha = Math.min(1, t * 4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, plateY, plateW, plateH);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, plateY, plateW, plateH);
      ctx.restore();
      const name = sc.productName ?? sc.brandName;
      const label = sc.productLabel ?? sc.brandName;
      drawText(ctx, name, x + 32, plateY + 110, { size: 96, family: serif, weight: 500, color: "#000", alpha });
      drawText(ctx, label.toUpperCase(), x + 32, plateY + 170, { size: 28, family: sans, weight: 400, color: "#000", alpha });
    },
  };
}

/* ---------------- Intro / Outro / Transitions ---------------- */

/** Legacy intro — nicht mehr im Storyboard, aber Export bleibt für Kompatibilität. */
export function intro(sc: SceneCtx): Scene {
  return hookTypo(sc.hookLine || sc.productName || sc.brandName);
}

/** CTA-Outro: Designer-Brand groß, Produkt-Zeile, IG-Handle, PAWN als Rahmen. */
export function outro(sc: SceneCtx): Scene {
  return {
    type: "outro",
    durationMs: 2400,
    layerIndexes: [],
    render(ctx, t) {
      const { W, H, serif, sans } = sc.layout;
      fill(ctx, "#fff", W, H);
      const alpha = Math.min(1, t * 3);
      const top = safeTop(H);
      const bot = safeBottom(H);
      const cx = W / 2;
      const handle = (sc.instagramHandle && sc.instagramHandle.trim()) || "hausofpawn";
      const productName = sc.productName ?? sc.brandName;

      // Kleines P♟WN oben als Rahmen — nur auf dem Haus-Plan (Atelier/Maison ohne Emblem).
      if (sc.showEmblem !== false) {
        drawText(ctx, "P♟WN", cx, top + 60, {
          size: 44, family: serif, weight: 600, color: "#000", align: "center", alpha: alpha * 0.85,
        });
      }

      // Designer-Brand als Star, groß & mittig
      const brand = sc.brandName;
      const brandSize = 180;
      const brandLines = wrapLines(ctx, brand, brandSize, 500, serif, W - indentX(W) * 2, 2);
      const centerY = top + (bot - top) / 2;
      const lineH = brandSize * 1.02;
      const y0 = centerY - ((brandLines.length - 1) * lineH) / 2 + brandSize * 0.34;
      brandLines.forEach((ln, i) => {
        drawText(ctx, ln, cx, y0 + i * lineH, {
          size: brandSize, family: serif, weight: 500, color: "#000", align: "center", alpha,
        });
      });

      // Produkt-Zeile
      drawText(ctx, `${productName} · auf pawn`, cx, bot - 140, {
        size: 42, family: serif, weight: 400, color: "#000", align: "center", alpha,
      });
      // Handle
      drawText(ctx, `@${handle}`, cx, bot - 80, {
        size: 34, family: sans, weight: 400, color: "#000", align: "center", alpha,
      });

      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 60, W - 120, H - 120);
    },
  };
}

export function whiteFlash(): Scene {
  return {
    type: "white-flash",
    durationMs: 80,
    layerIndexes: [],
    render(ctx, _t, sc) { fill(ctx, "#fff", sc.layout.W, sc.layout.H); },
  };
}

export function wipeLeft(fromIdx: number, toIdx: number): Scene {
  return {
    type: "mask-reveal",
    durationMs: 360,
    layerIndexes: [fromIdx, toIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      drawSource(ctx, sc.layers[fromIdx], 0, 0, W, H, sc.filter);
      const p = easeInOutCubic(t);
      ctx.save();
      ctx.beginPath();
      ctx.rect(W - W * p, 0, W * p, H);
      ctx.clip();
      drawSource(ctx, sc.layers[toIdx], 0, 0, W, H, sc.filter);
      ctx.restore();
    },
  };
}
