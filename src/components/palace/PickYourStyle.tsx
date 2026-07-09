import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStore, marketplaceSelectors } from "@/core";
import type { ProductView } from "@/core/views/product";
import type { World } from "@/core/types/entities";
import { usePersonalization, sortByPersonalization } from "@/features/personalization";
import { EditorialImage } from "@/components/palace/EditorialImage";

const QUEUE_KEY = "pawn.taste.queue.v1";
type Verdict = "like" | "skip";
interface QueuedSignal { product_slug: string; world: string; verdict: Verdict; tags: string[]; at: string }

function loadQueue(): QueuedSignal[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedSignal[]; } catch { return []; }
}
function saveQueue(q: QueuedSignal[]) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* noop */ } }

/**
 * PickYourStyle — swipe-to-taste discovery.
 * - Anonymous → queues signals in localStorage; flushed on login.
 * - Signed in → writes ai.taste_signal domain_events immediately.
 * The deck starts random per selected world; once signals exist it becomes
 * 80% personalization-sorted + 20% random for discovery.
 */
export function PickYourStyle({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const personalization = usePersonalization();
  const [world, setWorld] = useState<World>("Mode");
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState<number>(() => loadQueue().length);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  // Flush anonymous queue on login.
  useEffect(() => {
    if (!user) return;
    const q = loadQueue();
    if (q.length === 0) return;
    (async () => {
      const rows = q.map((s) => ({
        id: crypto.randomUUID(),
        at: s.at,
        type: "ai.taste_signal",
        actor: user.id,
        payload: { ...s, user_id: user.id, source: "style_swipe" },
      }));
      const { error } = await supabase.from("domain_events").insert(rows as never);
      if (!error) { saveQueue([]); }
    })();
  }, [user]);

  const deck = useMemo(() => {
    const pool = products.filter((p) => p.world === world);
    if (!personalization.hasSignals) {
      return [...pool].sort(() => Math.random() - 0.5);
    }
    const sorted = sortByPersonalization(pool, personalization, personalization.designerDna);
    // 20% random for discovery — swap random pairs
    const shuffled = [...sorted];
    for (let i = 0; i < shuffled.length; i++) {
      if (Math.random() < 0.2) {
        const j = Math.floor(Math.random() * shuffled.length);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }
    return shuffled;
  }, [products, world, personalization]);

  // Reset index when world changes
  useEffect(() => { setIndex(0); }, [world]);

  const current = deck[index];
  const next = deck[index + 1];

  const react = async (verdict: Verdict, p: ProductView) => {
    const signal: QueuedSignal = {
      product_slug: p.slug,
      world: p.world,
      verdict,
      tags: [p.category, ...(p.colors ?? [])].filter(Boolean),
      at: new Date().toISOString(),
    };
    if (user) {
      await supabase.from("domain_events").insert({
        id: crypto.randomUUID(),
        at: signal.at,
        type: "ai.taste_signal",
        actor: user.id,
        payload: { ...signal, user_id: user.id, source: "style_swipe" },
      } as never);
    } else {
      const q = loadQueue();
      q.push(signal);
      saveQueue(q);
    }
    setCount((c) => c + 1);
    setIndex((i) => i + 1);
    setDragX(0);
  };

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === "ArrowRight") void react("like", current);
      if (e.key === "ArrowLeft") void react("skip", current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Touch / pointer drag
  const onPointerDown = (e: React.PointerEvent) => { startX.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onPointerMove = (e: React.PointerEvent) => { if (startX.current !== null) setDragX(e.clientX - startX.current); };
  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    if (Math.abs(dragX) > 120 && current) {
      void react(dragX > 0 ? "like" : "skip", current);
    } else {
      setDragX(0);
    }
  };

  const WORLDS: { key: World; label: string }[] = [
    { key: "Mode", label: "Mode" },
    { key: "Interior", label: "Interior" },
    { key: "Kunst", label: "Kunst" },
  ];

  return (
    <div className={`mx-auto w-full ${compact ? "max-w-[820px]" : "max-w-[1100px]"} px-6`}>
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="palace-eyebrow">Pick your Style</p>
          <h2 className="palace-serif mt-4 font-light text-[#000000]" style={{ fontSize: "clamp(1.8rem,3.5vw,3rem)", lineHeight: 1.05 }}>
            Swipe dich in deine <span className="italic">Handschrift.</span>
          </h2>
          <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-[#55534E]">
            Herz für Ja, Kreuz für weiter. Jede Reaktion schärft, was PAWN dir zeigt.
          </p>
        </div>
        <div className="flex items-center gap-2 border border-[rgba(0,0,0,.28)] p-1">
          {WORLDS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWorld(w.key)}
              className={`whitespace-nowrap px-4 py-2 text-[0.62rem] uppercase tracking-[0.32em] transition-colors duration-300 ${
                world === w.key ? "bg-[#000000] text-[#FFFFFF]" : "text-[#55534E] hover:text-[#000000]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto mt-12 h-[62vh] w-full max-w-[520px] select-none md:h-[68vh]">
        {!current ? (
          <div className="flex h-full flex-col items-center justify-center border border-[rgba(0,0,0,.18)] bg-white p-10 text-center">
            <p className="palace-eyebrow">Danke</p>
            <p className="palace-serif mt-6 text-[1.5rem] italic text-[#000000]">Du hast diese Welt durchgesehen.</p>
            <p className="mt-3 text-[0.95rem] text-[#55534E]">Wähle eine andere Welt oder komm gleich wieder — der Katalog wächst.</p>
          </div>
        ) : (
          <>
            {next && (
              <div className="absolute inset-0 translate-y-2 scale-[.96] border-[1.5px] border-black bg-white">
                <EditorialImage seed={`style-${next.slug}`} ratio="3/4" className="h-full w-full" />
              </div>
            )}
            <div
              className="absolute inset-0 border-[1.5px] border-black bg-white transition-transform duration-200"
              style={{
                transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`,
                cursor: dragX ? "grabbing" : "grab",
                boxShadow: "8px 8px 0 #000",
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="relative h-full">
                <EditorialImage seed={`style-${current.slug}`} ratio="3/4" className="h-full w-full" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <p className="palace-serif italic text-[1.4rem] text-white">{current.name}</p>
                  <p className="mt-1 text-[0.7rem] uppercase tracking-[0.32em] text-white/80">{current.designer} · {current.world}</p>
                </div>
                {dragX > 40 && (
                  <div className="pointer-events-none absolute left-6 top-6 border-[1.5px] border-black bg-white px-3 py-1 text-[0.65rem] uppercase tracking-[0.32em] text-black">Gefällt</div>
                )}
                {dragX < -40 && (
                  <div className="pointer-events-none absolute right-6 top-6 border-[1.5px] border-white bg-black px-3 py-1 text-[0.65rem] uppercase tracking-[0.32em] text-white">Weiter</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-10 flex items-center justify-center gap-8">
        <button
          type="button"
          aria-label="Weiter"
          disabled={!current}
          onClick={() => current && react("skip", current)}
          className="grid h-[54px] w-[54px] place-items-center border-[1.5px] border-black bg-white text-black transition-colors duration-200 hover:bg-black hover:text-white disabled:opacity-40"
        >
          <X className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <p className="min-w-[220px] text-center palace-eyebrow text-[#55534E]">
          {count > 0 ? `${count} Reaktionen · deine Auswahl wird persönlicher` : "Deine ersten Reaktionen formen die Handschrift"}
        </p>
        <button
          type="button"
          aria-label="Gefällt"
          disabled={!current}
          onClick={() => current && react("like", current)}
          className="grid h-[54px] w-[54px] place-items-center border-[1.5px] border-black bg-black text-white transition-colors duration-200 hover:bg-white hover:text-black disabled:opacity-40"
        >
          <Heart className="h-6 w-6" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
