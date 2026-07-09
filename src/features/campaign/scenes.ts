/**
 * Szenen-Bibliothek für den PAWN-Renderer.
 * Jede Szene ist eine reine Zeichnungsfunktion (deterministisch aus Progress + Assets).
 * Bewegungen mit ease-Kurven — nie linear.
 */

export type SceneType =
  | "parallax-duo"
  | "split-frame"
  | "kinetic-typo"
  | "mask-reveal"
  | "detail-punch"
  | "ken-burns"; // legacy fallback

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
  /** Optional pre-loaded still image. Used unless `video` is present. */
  img?: HTMLImageElement;
  /** Optional video element for kinematischer Modus. Currently paused; we drive currentTime. */
  video?: HTMLVideoElement;
}

export interface SceneCtx {
  layout: Layout;
  layers: SourceLayer[]; // pool of source assets
  hookLine?: string | null;
  brandName: string;
  productName?: string | null;
  productLabel?: string | null;
  houseNumber?: number | null;
}

export interface Scene {
  type: SceneType;
  durationMs: number;
  layerIndexes: number[]; // which layers this scene uses
  render: (ctx: CanvasRenderingContext2D, t: number, sc: SceneCtx) => void;
}

/* ---------------- helpers ---------------- */
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;

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
  const src: CanvasImageSource | null =
    layer.video ?? layer.img ?? null;
  if (!src) return;
  ctx.save();
  ctx.filter = filter;
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  // cover-fit source into (dx,dy,dw,dh)
  const sw =
    (layer.video ? layer.video.videoWidth : (layer.img?.naturalWidth ?? 0)) || 1;
  const sh =
    (layer.video ? layer.video.videoHeight : (layer.img?.naturalHeight ?? 0)) || 1;
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

/* ---------------- Szenen ---------------- */

export function parallaxDuo(index: number, layerIdx: number): Scene {
  return {
    type: "parallax-duo",
    durationMs: 3200,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H, pad, serif, sans } = sc.layout;
      fill(ctx, "#fff", W, H);
      // Photo fills ~70% area, drifting slowly one direction
      const shift = (easeInOutCubic(t) - 0.5) * 40;
      const photoH = Math.round(H * 0.72);
      drawSource(ctx, sc.layers[layerIdx], pad, pad + shift, W - pad * 2, photoH);
      // Overlay typography card, drifting counter direction
      const cardW = Math.min(W * 0.7, 720);
      const cardH = 220;
      const cardX = W / 2 - cardW / 2 - shift * 1.4;
      const cardY = H - pad - cardH - 40;
      // hard shadow
      ctx.fillStyle = "#000";
      ctx.fillRect(cardX + 10, cardY + 10, cardW, cardH);
      ctx.fillStyle = "#fff";
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cardX, cardY, cardW, cardH);
      const name = sc.productName ?? sc.brandName;
      const label = sc.productLabel ?? sc.brandName;
      drawText(ctx, name, cardX + 32, cardY + 90, { size: 54, family: serif, weight: 500, color: "#000" });
      drawText(ctx, label.toUpperCase(), cardX + 32, cardY + 140, { size: 18, family: sans, weight: 400, color: "#000" });
      drawText(ctx, `Haus №\u2009${sc.houseNumber ?? "—"} · pawn`, cardX + 32, cardY + 190, { size: 16, family: sans, weight: 400, color: "#000" });
      void index;
    },
  };
}

export function splitFrame(aIdx: number, bIdx: number): Scene {
  return {
    type: "split-frame",
    durationMs: 2000,
    layerIndexes: [aIdx, bIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      fill(ctx, "#000", W, H);
      const mid = W / 2;
      const dxA = -20 * easeInOutCubic(t);
      const dxB = 20 * easeInOutCubic(t);
      drawSource(ctx, sc.layers[aIdx], dxA, 0, mid, H);
      drawSource(ctx, sc.layers[bIdx], mid + dxB, 0, mid, H);
      // hairline
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mid, 0); ctx.lineTo(mid, H);
      ctx.stroke();
    },
  };
}

export function kineticTypo(hookLine: string): Scene {
  const words = hookLine.split(/\s+/).filter(Boolean);
  const groups: string[][] = [];
  for (let i = 0; i < words.length; i += 2) groups.push(words.slice(i, i + 2));
  const perGroup = 1 / Math.max(1, groups.length);
  return {
    type: "kinetic-typo",
    durationMs: Math.max(2400, groups.length * 700),
    layerIndexes: [],
    render(ctx, t, sc) {
      const { W, H, serif } = sc.layout;
      const gi = Math.min(groups.length - 1, Math.floor(t / perGroup));
      const localT = (t - gi * perGroup) / perGroup;
      const dark = gi % 2 === 0;
      fill(ctx, dark ? "#000" : "#fff", W, H);
      const text = (groups[gi] || []).join(" ");
      const alpha = Math.min(1, easeOutCubic(localT * 2));
      drawText(ctx, text, W / 2, H / 2 + 20, {
        size: 128, family: serif, weight: 600, align: "center",
        color: dark ? "#fff" : "#000", alpha,
      });
      // hairline frame
      ctx.strokeStyle = dark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 60, W - 120, H - 120);
    },
  };
}

export function maskReveal(layerIdx: number): Scene {
  return {
    type: "mask-reveal",
    durationMs: 3000,
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
      drawSource(ctx, sc.layers[layerIdx], 0, 0, W, H);
      ctx.restore();
      // trailing bar
      ctx.fillStyle = "#000";
      ctx.fillRect(revealW, 0, 8, H);
    },
  };
}

export function detailPunch(layerIdx: number): Scene {
  return {
    type: "detail-punch",
    durationMs: 1400,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      fill(ctx, "#000", W, H);
      const flash = t > 0.92 ? 1 : 0;
      const zoom = 1.1 + easeInCubic(t) * 0.35;
      const dw = W * zoom;
      const dh = H * zoom;
      const dx = -(dw - W) * 0.6;
      const dy = -(dh - H) * 0.5;
      drawSource(ctx, sc.layers[layerIdx], dx, dy, dw, dh, "grayscale(1) contrast(1.4) brightness(1)");
      if (flash) { fill(ctx, "#fff", W, H); }
    },
  };
}

export function kenBurns(layerIdx: number, direction: 1 | -1, zoomDelta = 0.08): Scene {
  return {
    type: "ken-burns",
    durationMs: 3000,
    layerIndexes: [layerIdx],
    render(ctx, t, sc) {
      const { W, H, pad, serif, sans } = sc.layout;
      fill(ctx, "#000", W, H);
      const s = 1 + zoomDelta * easeInOutCubic(t);
      const dw = W * s, dh = H * s;
      const dx = (W - dw) / 2 + direction * 40 * easeInOutCubic(t);
      const dy = (H - dh) / 2 - 20 * easeInOutCubic(t);
      drawSource(ctx, sc.layers[layerIdx], dx, dy, dw, dh);
      // bottom scrim + label
      const grad = ctx.createLinearGradient(0, H - 380, 0, H);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, H - 380, W, 380);
      const name = sc.productName ?? sc.brandName;
      const label = sc.productLabel ?? sc.brandName;
      drawText(ctx, name, pad + 12, H - 150, { size: 72, family: serif, weight: 500, color: "#fff", alpha: Math.min(1, t * 4) });
      drawText(ctx, label.toUpperCase(), pad + 12, H - 104, { size: 20, family: sans, weight: 400, color: "rgba(255,255,255,0.75)", alpha: Math.min(1, t * 4) });
    },
  };
}

/* ---------------- Intro / Outro / Transitions ---------------- */

export function intro(sc: SceneCtx): Scene {
  return {
    type: "kinetic-typo",
    durationMs: 1800,
    layerIndexes: [],
    render(ctx, t) {
      const { W, H, serif, sans } = sc.layout;
      fill(ctx, "#000", W, H);
      const alpha = Math.min(1, t * 3);
      drawText(ctx, sc.brandName, W / 2, H / 2 - 20, { size: 108, family: serif, weight: 500, color: "#fff", align: "center", alpha });
      if (sc.hookLine) drawText(ctx, sc.hookLine, W / 2, H / 2 + 60, { size: 40, family: serif, weight: 400, color: "#fff", align: "center", alpha });
      drawText(ctx, `Haus №\u2009${sc.houseNumber ?? "—"}`, W / 2, H / 2 + (sc.hookLine ? 130 : 60), { size: 24, family: sans, weight: 300, color: "rgba(255,255,255,0.7)", align: "center", alpha });
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 60, W - 120, H - 120);
    },
  };
}

export function outro(sc: SceneCtx): Scene {
  return {
    type: "kinetic-typo",
    durationMs: 2200,
    layerIndexes: [],
    render(ctx, t) {
      const { W, H, serif, sans } = sc.layout;
      fill(ctx, "#fff", W, H);
      const alpha = Math.min(1, t * 3);
      drawText(ctx, "P♟WN", W / 2, H / 2, { size: 160, family: serif, weight: 600, color: "#000", align: "center", alpha });
      drawText(ctx, `Haus №\u2009${sc.houseNumber ?? "—"} · pawn`, W / 2, H / 2 + 80, { size: 28, family: sans, weight: 400, color: "#000", align: "center", alpha });
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(60, 60, W - 120, H - 120);
    },
  };
}

export function whiteFlash(): Scene {
  return {
    type: "kinetic-typo",
    durationMs: 66,
    layerIndexes: [],
    render(ctx, _t, sc) { fill(ctx, "#fff", sc.layout.W, sc.layout.H); },
  };
}

export function wipeLeft(fromIdx: number, toIdx: number): Scene {
  return {
    type: "mask-reveal",
    durationMs: 350,
    layerIndexes: [fromIdx, toIdx],
    render(ctx, t, sc) {
      const { W, H } = sc.layout;
      drawSource(ctx, sc.layers[fromIdx], 0, 0, W, H);
      const p = easeInOutCubic(t);
      ctx.save();
      ctx.beginPath();
      ctx.rect(W - W * p, 0, W * p, H);
      ctx.clip();
      drawSource(ctx, sc.layers[toIdx], 0, 0, W, H);
      ctx.restore();
    },
  };
}
