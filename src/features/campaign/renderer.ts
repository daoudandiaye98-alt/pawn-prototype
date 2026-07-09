/**
 * PAWN client-side Kampagnen-Renderer.
 *
 * Canvas 1080x1920 (Reel 9:16), 30fps, ohne Audio.
 * Szenen: Intro → 2..4 Produkt-Shots (Ken-Burns, Weißblitz-Cut) → Outro.
 * Aufnahme via canvas.captureStream(30) + MediaRecorder mit Format-Fallback.
 *
 * Entwurfsziel: null Serverkosten, funktioniert im Browser jedes Designers.
 */

export type Tempo = "ruhig" | "spannungsvoll";

export interface RendererInput {
  brandName: string;
  houseNumber: number | null;
  hookLine?: string | null;
  imageUrls: string[]; // 2..4
  tempo: Tempo;
  productLabel?: string | null; // "Welt · Brand"
  productName?: string | null;
}

export interface RenderResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface RenderProgress {
  scene: number;
  totalScenes: number;
  fraction: number; // 0..1
}

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FPS = 30;

function pickMimeType(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const t of candidates) {
    try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* noop */ }
  }
  return "video/webm";
}

function ease(t: number): number { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image_load_failed: ${url}`));
    img.src = url;
  });
}

/** Fill canvas with a black frame. */
function fillBlack(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}
function fillWhite(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size: number; family?: string; weight?: number | string; color?: string; align?: CanvasTextAlign; letterSpacing?: number },
) {
  ctx.save();
  ctx.fillStyle = opts.color ?? "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = opts.align ?? "left";
  const family = opts.family ?? "Playfair Display, Georgia, serif";
  ctx.font = `${opts.weight ?? 500} ${opts.size}px ${family}`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draws a photo with grayscale + higher contrast and ken-burns transform. */
function drawKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: number, // 0..1 within shot
  direction: 1 | -1,
  zoomDelta: number,
) {
  const scaleStart = 1;
  const scaleEnd = 1 + zoomDelta;
  const s = scaleStart + (scaleEnd - scaleStart) * ease(t);

  // Cover fit
  const ir = img.width / img.height;
  const cr = CANVAS_W / CANVAS_H;
  let w: number, h: number;
  if (ir > cr) { h = CANVAS_H; w = h * ir; } else { w = CANVAS_W; h = w / ir; }
  w *= s; h *= s;
  const dx = (CANVAS_W - w) / 2 + direction * 60 * ease(t);
  const dy = (CANVAS_H - h) / 2 - 30 * ease(t);

  ctx.save();
  ctx.filter = "grayscale(1) contrast(1.25) brightness(0.98)";
  ctx.drawImage(img, dx, dy, w, h);
  ctx.restore();
}

function drawIntro(
  ctx: CanvasRenderingContext2D,
  input: RendererInput,
  progress: number, // 0..1
) {
  fillBlack(ctx);
  // Subtle fade-in of typography
  const alpha = Math.min(1, progress * 3);
  ctx.globalAlpha = alpha;
  drawText(ctx, input.brandName, CANVAS_W / 2, CANVAS_H / 2 - 40, {
    size: 108, weight: 500, color: "#fff", align: "center",
  });
  if (input.hookLine) {
    drawText(ctx, input.hookLine, CANVAS_W / 2, CANVAS_H / 2 + 60, {
      size: 44, weight: 400, color: "#fff", align: "center",
      family: "Playfair Display, Georgia, serif",
    });
  }
  drawText(
    ctx,
    `Haus №\u2009${input.houseNumber ?? "—"}`,
    CANVAS_W / 2,
    CANVAS_H / 2 + (input.hookLine ? 140 : 60),
    { size: 26, weight: 300, color: "rgba(255,255,255,0.7)", align: "center",
      family: "Inter, system-ui, sans-serif" },
  );
  ctx.globalAlpha = 1;

  // Hairline frame
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, CANVAS_W - 120, CANVAS_H - 120);
}

function drawShot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  input: RendererInput,
  index: number,
  progress: number,
  zoomDelta: number,
) {
  fillBlack(ctx);
  const dir: 1 | -1 = index % 2 === 0 ? 1 : -1;
  drawKenBurns(ctx, img, progress, dir, zoomDelta);

  // Bottom-left typography overlay
  const padX = 72, padY = 140;
  const label = input.productLabel ?? input.brandName;
  const name = input.productName ?? input.brandName;

  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 4);
  // subtle scrim
  const grad = ctx.createLinearGradient(0, CANVAS_H - 380, 0, CANVAS_H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, CANVAS_H - 380, CANVAS_W, 380);
  ctx.restore();

  drawText(ctx, name, padX, CANVAS_H - padY, {
    size: 76, weight: 500, color: "#fff",
    family: "Playfair Display, Georgia, serif",
  });
  drawText(ctx, label.toUpperCase(), padX, CANVAS_H - padY + 46, {
    size: 22, weight: 400, color: "rgba(255,255,255,0.75)",
    family: "Inter, system-ui, sans-serif", letterSpacing: 4,
  });
}

function drawFlash(ctx: CanvasRenderingContext2D) {
  fillWhite(ctx);
}

function drawOutro(ctx: CanvasRenderingContext2D, input: RendererInput, progress: number) {
  fillWhite(ctx);
  const alpha = Math.min(1, progress * 3);
  ctx.globalAlpha = alpha;
  drawText(ctx, "P♟WN", CANVAS_W / 2, CANVAS_H / 2 - 10, {
    size: 160, weight: 600, color: "#000", align: "center",
    family: "Playfair Display, Georgia, serif",
  });
  drawText(
    ctx,
    `Haus №\u2009${input.houseNumber ?? "—"} · pawn`,
    CANVAS_W / 2,
    CANVAS_H / 2 + 80,
    { size: 30, weight: 400, color: "#000", align: "center",
      family: "Inter, system-ui, sans-serif" },
  );
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, CANVAS_W - 120, CANVAS_H - 120);
}

/** Build the storyboard as a list of frame-generator functions with durations (ms). */
interface Scene { durationMs: number; render: (ctx: CanvasRenderingContext2D, tProgress: number) => void }

function buildScenes(input: RendererInput, imgs: HTMLImageElement[]): Scene[] {
  const shotMs = input.tempo === "ruhig" ? 3000 : 2200;
  const zoomDelta = input.tempo === "ruhig" ? 0.06 : 0.12;
  const scenes: Scene[] = [];
  scenes.push({ durationMs: 2000, render: (ctx, t) => drawIntro(ctx, input, t) });
  imgs.forEach((img, i) => {
    scenes.push({ durationMs: shotMs, render: (ctx, t) => drawShot(ctx, img, input, i, t, zoomDelta) });
    if (i < imgs.length - 1) {
      // 2-frame hard white flash (~66ms)
      scenes.push({ durationMs: 66, render: (ctx) => drawFlash(ctx) });
    }
  });
  scenes.push({ durationMs: 2500, render: (ctx, t) => drawOutro(ctx, input, t) });
  return scenes;
}

export interface RenderCallbacks {
  onProgress?: (p: RenderProgress) => void;
  /** Called once with the working canvas so the UI can mount it for live preview. */
  onCanvas?: (canvas: HTMLCanvasElement) => void;
}

export async function renderCampaign(input: RendererInput, cb: RenderCallbacks = {}): Promise<RenderResult> {
  if (input.imageUrls.length < 2) throw new Error("min_2_images");
  if (input.imageUrls.length > 4) throw new Error("max_4_images");

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no_canvas_context");
  cb.onCanvas?.(canvas);

  const imgs = await Promise.all(input.imageUrls.map(loadImage));
  const scenes = buildScenes(input, imgs);
  const totalMs = scenes.reduce((s, sc) => s + sc.durationMs, 0);

  const mimeType = pickMimeType();
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const start = performance.now();

  // Render loop driven by rAF, dispatch to the right scene based on elapsed.
  await new Promise<void>((resolve) => {
    const step = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= totalMs) { resolve(); return; }
      let acc = 0, sceneIdx = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (elapsed < acc + scenes[i].durationMs) { sceneIdx = i; break; }
        acc += scenes[i].durationMs;
      }
      const sc = scenes[sceneIdx];
      const local = (elapsed - acc) / sc.durationMs;
      sc.render(ctx, Math.max(0, Math.min(1, local)));
      cb.onProgress?.({ scene: sceneIdx + 1, totalScenes: scenes.length, fraction: elapsed / totalMs });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // Small tail so the last frame is captured.
  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  const blob = await done;
  return { blob, mimeType, durationMs: totalMs };
}

/** Turn a Blob into an object URL for previewing in <video>. */
export function blobPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
