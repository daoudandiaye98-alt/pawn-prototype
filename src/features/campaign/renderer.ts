/**
 * PAWN client-side Kampagnen-Renderer — mit echter Szenen-Regie.
 * Format 9:16 (Reel) oder 1:1 (Feed). Storyboard aus deterministischem Seed.
 * Optional Kinematischer Modus: Video-Clips als Layer statt Stills.
 */

import {
  REEL, FEED, hookTypo, outro, whiteFlash,
  parallaxDuo, splitFrame, maskReveal, detailPunch, kenBurns,
  type Scene, type SceneCtx, type SourceLayer, type Layout,
} from "./scenes";
import { mulberry32, randomSeed } from "./prng";

export type Tempo = "ruhig" | "spannungsvoll";
export type Format = "9:16" | "1:1";

export interface RendererInput {
  brandName: string;
  houseNumber: number | null;
  hookLine?: string | null;
  /** Stills (Stufe 1). Ignoriert, wenn `clips` gesetzt. */
  imageUrls?: string[];
  /** Kinematischer Modus (Stufe 2): erwartet vorbereitete Clip-URLs. */
  clipUrls?: string[];
  tempo: Tempo;
  productLabel?: string | null;
  productName?: string | null;
  format?: Format;
  seed?: number;
}

export interface RenderResult { blob: Blob; mimeType: string; durationMs: number; seed: number }
export interface RenderProgress { scene: number; totalScenes: number; fraction: number }
export interface RenderCallbacks {
  onProgress?: (p: RenderProgress) => void;
  onCanvas?: (canvas: HTMLCanvasElement) => void;
}

const FPS = 30;

function pickMimeType(): string {
  // Safari bevorzugt mp4/avc1, Chromium bevorzugt webm/vp9. Bewusst mp4 zuerst.
  const c = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const t of c) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* noop */ } }
  return "video/webm";
}

export function mimeToExt(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  return "webm";
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    // Muss VOR src gesetzt sein — sonst kein CORS-Request, Canvas wird tainted.
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`image_load_failed: ${url}`));
    img.src = url;
  });
}


function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    v.onloadeddata = () => res(v);
    v.onerror = () => rej(new Error(`video_load_failed: ${url}`));
  });
}

function buildStoryboard(input: RendererInput, layers: SourceLayer[], seed: number): { scenes: Scene[]; ctx: SceneCtx } {
  const layout: Layout = input.format === "1:1" ? FEED : REEL;
  const ctx: SceneCtx = {
    layout,
    layers,
    hookLine: input.hookLine ?? null,
    brandName: input.brandName,
    productName: input.productName ?? null,
    productLabel: input.productLabel ?? input.brandName,
    houseNumber: input.houseNumber ?? null,
  };
  const rnd = mulberry32(seed);
  const n = layers.length;
  const scenes: Scene[] = [intro(ctx)];

  const shotTypes = input.tempo === "ruhig"
    ? ["parallax-duo", "mask-reveal", "ken-burns"] as const
    : ["split-frame", "detail-punch", "kinetic-typo", "ken-burns"] as const;

  const shotCount = Math.max(3, Math.min(5, n + 1));
  let iLayer = 0;
  for (let i = 0; i < shotCount; i++) {
    const type = shotTypes[Math.floor(rnd() * shotTypes.length)];
    const a = iLayer % Math.max(1, n);
    const b = (iLayer + 1) % Math.max(1, n);
    let scene: Scene;
    switch (type) {
      case "parallax-duo": scene = parallaxDuo(i, a); break;
      case "split-frame": scene = n >= 2 ? splitFrame(a, b) : kenBurns(a, i % 2 === 0 ? 1 : -1); break;
      case "kinetic-typo": scene = kineticTypo(input.hookLine || input.brandName); break;
      case "mask-reveal": scene = maskReveal(a); break;
      case "detail-punch": scene = detailPunch(a); break;
      default: scene = kenBurns(a, i % 2 === 0 ? 1 : -1);
    }
    // Tempo shortens shots slightly
    if (input.tempo === "spannungsvoll") scene.durationMs = Math.round(scene.durationMs * 0.75);
    scenes.push(scene);
    iLayer = (iLayer + 1) % Math.max(1, n);
    // transition
    if (i < shotCount - 1) {
      const r = rnd();
      if (r < 0.5) scenes.push(whiteFlash());
      else if (r < 0.8 && n >= 2) scenes.push(wipeLeft(a, b));
      // else: hard cut (no filler scene)
    }
  }
  scenes.push(outro(ctx));
  return { scenes, ctx };
}

export async function renderCampaign(input: RendererInput, cb: RenderCallbacks = {}): Promise<RenderResult> {
  const stills = input.imageUrls ?? [];
  const clips = input.clipUrls ?? [];
  const sourceCount = clips.length > 0 ? clips.length : stills.length;
  if (sourceCount < 1) throw new Error("min_1_source");
  if (sourceCount > 6) throw new Error("max_6_sources");

  const layout: Layout = input.format === "1:1" ? FEED : REEL;
  const canvas = document.createElement("canvas");
  canvas.width = layout.W;
  canvas.height = layout.H;
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("no_canvas_context");
  cb.onCanvas?.(canvas);

  // Bild-Ladefehler einzeln abfangen (Skip statt Abbruch).
  const layers: SourceLayer[] = [];
  const skipped: string[] = [];
  if (clips.length > 0) {
    for (const c of clips) {
      try { layers.push({ video: await loadVideo(c) }); }
      catch { skipped.push(c); }
    }
  } else {
    for (const s of stills) {
      try { layers.push({ img: await loadImage(s) }); }
      catch { skipped.push(s); }
    }
  }
  if (layers.length === 0) {
    throw new Error(
      "no_usable_source: Alle Bilder blockieren Cross-Origin. Prüfe die Bild-URLs (Signed URLs müssen frisch sein).",
    );
  }
  if (skipped.length > 0) console.warn("[renderCampaign] übersprungene Quellen:", skipped);


  const seed = input.seed ?? randomSeed();
  const { scenes } = buildStoryboard(input, layers, seed);
  const totalMs = scenes.reduce((s, sc) => s + sc.durationMs, 0);

  const mimeType = pickMimeType();
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const done = new Promise<Blob>((res) => { recorder.onstop = () => res(new Blob(chunks, { type: mimeType })); });

  // Start any videos muted-looping so drawImage(video) always has fresh frames.
  for (const l of layers) if (l.video) { try { await l.video.play(); l.video.loop = true; } catch { /* noop */ } }

  recorder.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const step = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= totalMs) { resolve(); return; }
      let acc = 0, idx = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (elapsed < acc + scenes[i].durationMs) { idx = i; break; }
        acc += scenes[i].durationMs;
      }
      const sc = scenes[idx];
      const local = (elapsed - acc) / sc.durationMs;
      sc.render(ctx2d, Math.max(0, Math.min(1, local)), {
        layout, layers,
        hookLine: input.hookLine ?? null,
        brandName: input.brandName,
        productName: input.productName ?? null,
        productLabel: input.productLabel ?? input.brandName,
        houseNumber: input.houseNumber ?? null,
      });
      cb.onProgress?.({ scene: idx + 1, totalScenes: scenes.length, fraction: elapsed / totalMs });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  const blob = await done;
  for (const l of layers) if (l.video) { try { l.video.pause(); } catch { /* noop */ } }
  return { blob, mimeType, durationMs: totalMs, seed };
}

export function blobPreviewUrl(blob: Blob): string { return URL.createObjectURL(blob); }
