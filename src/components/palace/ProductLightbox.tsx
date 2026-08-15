import { useEffect, useRef, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MediaImg } from "@/components/palace/MediaImg";
import { useAnkunft } from "@/hooks/useFlug";

/**
 * Teil J1 — Vollbild-Lightbox für Werkbilder: Pinch-Zoom, Doppeltipp-Zoom, Swipe zwischen
 * allen Bildern, Bildzähler, Thumbnail-Reihe. Eigener embla-Carousel (nicht die geteilte
 * ui/carousel.tsx-Hülle), weil jede Kachel ihre eigene Touch-Gesten-Schicht (Pinch/Pan)
 * braucht, die embla per `watchDrag`-Callback abschaltet, solange gezoomt wird — sonst
 * würde ein Pan-Zug beim Zoomen gleichzeitig die Seite wechseln.
 */

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.4;
const DOUBLE_TAP_MS = 300;

interface ProductLightboxProps {
  images: string[];
  alt: string;
  open: boolean;
  initialIndex: number;
  onClose: () => void;
  /** Teil S: unter diesem Namen fliegt das Werkbild auf den Lichttisch. */
  flugSchluessel?: string | null;
}

export function ProductLightbox({ images, alt, open, initialIndex, onClose, flugSchluessel }: ProductLightboxProps) {
  const { t } = useI18n();
  /* Teil S — das Bild wächst aus der Werkseite hierher. Ziel ist das BILD,
     nicht sein Kasten: bei `object-contain` sind das zwei Rechtecke. */
  const ersteFlaeche = useRef<HTMLImageElement>(null);
  useAnkunft(open ? flugSchluessel : null, ersteFlaeche);
  const zoomedRef = useRef(false);
  // Teil L2 — Barrierefreiheit: beim Öffnen wandert der Fokus auf den Schließen-Knopf,
  // damit Tastatur-Nutzer direkt im Dialog sind (Esc/Pfeile wirken sofort).
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    startIndex: initialIndex,
    watchDrag: () => !zoomedRef.current,
  });
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (open && emblaApi) emblaApi.scrollTo(initialIndex, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, emblaApi]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = prevOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") emblaApi?.scrollPrev();
      if (e.key === "ArrowRight") emblaApi?.scrollNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, emblaApi]);

  if (!open || images.length === 0) return null;

  // Teil Q — die Lightbox ist die eine Stelle, an der das Werk VOLLSTÄNDIG zu sehen
  // ist: eingepasst statt beschnitten. Damit dabei keine schwarzen Ränder entstehen,
  // liegt sie auf hellem Grund.
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="flex items-center justify-between px-4 py-4 text-black md:px-8">
        <span className="text-[0.7rem] uppercase tracking-[0.24em] tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={onClose}
          aria-label={t("product.lightbox.close")}
          className="flex h-11 w-11 items-center justify-center text-black hover:opacity-70"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={src + i} className="relative h-full w-full shrink-0 grow-0 basis-full">
              <ZoomableImage
                src={src}
                alt={alt}
                bildRef={i === initialIndex ? ersteFlaeche : undefined}
                active={i === index}
                onZoomChange={(zoomed) => { if (i === index) zoomedRef.current = zoomed; }}
                onSwipeDownClose={onClose}
              />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4 md:px-8">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={t("product.lightbox.thumbAria", { n: i + 1 })}
              className={`h-14 w-14 shrink-0 overflow-hidden border-[1.5px] ${i === index ? "border-black" : "border-black/25"}`}
            >
              <MediaImg src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ZoomableImageProps {
  src: string;
  alt: string;
  bildRef?: React.Ref<HTMLImageElement>;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onSwipeDownClose: () => void;
}

function ZoomableImage({ src, alt, bildRef, active, onZoomChange, onSwipeDownClose }: ZoomableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const gesture = useRef({
    startDist: 0,
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    startTouch: { x: 0, y: 0 },
    panning: false,
    lastTap: 0,
    swipeStartY: null as number | null,
  });

  useEffect(() => {
    if (!active) { setScale(1); setTranslate({ x: 0, y: 0 }); }
  }, [active]);

  useEffect(() => { onZoomChange(scale > 1.01); }, [scale, onZoomChange]);

  const clampTranslate = useCallback((nextScale: number, x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const maxX = (rect.width * (nextScale - 1)) / 2;
    const maxY = (rect.height * (nextScale - 1)) / 2;
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  }, []);

  function distance(touches: React.TouchList) {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      gesture.current.startDist = distance(e.touches);
      gesture.current.startScale = scale;
      gesture.current.panning = false;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      gesture.current.startTouch = { x: touch.clientX, y: touch.clientY };
      gesture.current.startTranslate = translate;
      gesture.current.swipeStartY = scale <= 1.01 ? touch.clientY : null;
      if (now - gesture.current.lastTap < DOUBLE_TAP_MS) {
        if (scale > 1.01) { setScale(1); setTranslate({ x: 0, y: 0 }); }
        else setScale(DOUBLE_TAP_ZOOM);
        gesture.current.lastTap = 0;
      } else {
        gesture.current.lastTap = now;
      }
      gesture.current.panning = scale > 1.01;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = distance(e.touches);
      const ratio = dist / (gesture.current.startDist || dist);
      setScale(Math.min(MAX_ZOOM, Math.max(1, gesture.current.startScale * ratio)));
    } else if (e.touches.length === 1 && gesture.current.panning) {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - gesture.current.startTouch.x;
      const dy = touch.clientY - gesture.current.startTouch.y;
      setTranslate(clampTranslate(scale, gesture.current.startTranslate.x + dx, gesture.current.startTranslate.y + dy));
    } else if (e.touches.length === 1 && gesture.current.swipeStartY !== null) {
      const dy = e.touches[0].clientY - gesture.current.swipeStartY;
      if (dy > 80) onSwipeDownClose();
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length === 0) {
      gesture.current.panning = false;
      gesture.current.swipeStartY = null;
      if (scale < 1.05) { setScale(1); setTranslate({ x: 0, y: 0 }); }
      else setTranslate((prev) => clampTranslate(scale, prev.x, prev.y));
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full touch-none items-center justify-center overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={() => {
        if (scale > 1.01) { setScale(1); setTranslate({ x: 0, y: 0 }); }
        else setScale(DOUBLE_TAP_ZOOM);
      }}
    >
      <MediaImg
        ref={bildRef}
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: gesture.current.panning ? "none" : "transform 200ms ease",
        }}
      />
    </div>
  );
}
