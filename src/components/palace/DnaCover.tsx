import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PawnFigur } from "@/components/pawn/PawnFigur";
import { usePawnMood, type PawnMoodSignals } from "@/features/studio/usePawnMood";
import { useStilberater } from "@/features/personalization/useStilberater";
import { useI18n } from "@/lib/i18n";
import { MediaImg } from "@/components/palace/MediaImg";

/**
 * Teil 29 — die DNA-Seite als Cover. Reicht die Datenlage nicht, ersetzt ein schwarzer
 * Block mit weißer Figur das Urteil ("Wächter-Moment") — kein leeres Theater, keine
 * erfundenen Urteile. Reicht sie, öffnet die Seite bildschirmfüllend mit dem stärksten
 * belegenden Werk, dem Urteil als Schlagzeile und dem Kunden-PAWN, der sich unten rechts
 * materialisiert. Die Stimmungs-Maschine gilt auch hier — Datenbasis: Kundenaktivität,
 * nirgends beschriftet. id="dna-cover" ist der Hero-Anker für das Kunden-Deck (PawnDeck).
 */

interface Evidence { slug: string; name: string; image_url: string }

export function DnaCover() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { result, loading, busy, anfordern } = useStilberater();
  const [counts, setCounts] = useState<{ blicke: number; kaeufe: number } | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [lastSaleHoursAgo, setLastSaleHoursAgo] = useState<number | null>(null);
  const [bubble, setBubble] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ count: visitCount }, { data: paidOrders }, { data: visits }] = await Promise.all([
        supabase.from("page_visits" as never).select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("orders").select("id, created_at").eq("user_id", user.id).eq("status", "paid").order("created_at", { ascending: false }),
        supabase.from("page_visits" as never).select("target_id, visit_count").eq("user_id", user.id).eq("target_type", "product").order("visit_count", { ascending: false }).limit(3),
      ]);
      setCounts({ blicke: visitCount ?? 0, kaeufe: (paidOrders ?? []).length });
      const latest = (paidOrders ?? [])[0] as { created_at: string } | undefined;
      setLastSaleHoursAgo(latest ? (Date.now() - new Date(latest.created_at).getTime()) / 3600000 : null);

      const ids = ((visits ?? []) as unknown as { target_id: string }[]).map((v) => v.target_id);
      if (ids.length > 0) {
        const { data: prods } = await supabase.from("products").select("slug, name, image_url").in("id", ids);
        setEvidence(((prods ?? []) as { slug: string; name: string; image_url: string | null }[]).filter((p): p is Evidence => !!p.image_url));
      }
    })();
  }, [user]);

  // Teil 31: die Stimmungs-Maschine gilt auch für den Kunden-PAWN — realistisch nutzbare
  // Datenbasis hier ist "kürzlicher Kauf" (strahlend); Wartezeit/letzter Besuch haben für
  // einen Kunden kein sauberes Analogon und bleiben bewusst leer statt geraten zu werden.
  const moodSignals: PawnMoodSignals = useMemo(() => ({
    saleOrMilestoneHoursAgo: lastSaleHoursAgo,
    hasPendingMove: false,
    activityRising: false,
    oldestWaitingDays: null,
    lastVisitDays: null,
  }), [lastSaleHoursAgo]);
  const { mood, variant } = usePawnMood(moodSignals);

  const fz = result?.fruehzustand;
  const hasContent = fz?.erreicht && (result?.urteil || result?.einordnung);

  useEffect(() => {
    if (!hasContent) return;
    const show = setTimeout(() => setBubble(true), 900);
    const hide = setTimeout(() => setBubble(false), 900 + 4500);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [hasContent]);

  if (!user) return null;

  if (loading || counts === null) {
    return <div id="dna-cover" className="flex min-h-[60vh] items-center justify-center border-b border-[rgba(0,0,0,.18)] bg-white"><div className="h-16 w-16 animate-pulse bg-black/10" /></div>;
  }

  if (!hasContent) {
    return (
      <section id="dna-cover" className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-black px-6 py-24 text-center text-white md:px-14">
        <PawnFigur size={110} interactive={false} showShadow={false} tone="dark" ariaLabel="PAWN" />
        <p className="font-serif text-2xl italic leading-relaxed sm:text-3xl">{t("dna.cover.guard.quote")}</p>
        <p className="max-w-md text-sm text-white/70">
          {fz && !fz.erreicht ? t("dna.cover.guard.progress", { n: Math.max(0, fz.ziel - fz.aktuell) }) : t("dna.cover.guard.ready")}
        </p>
        <button type="button" onClick={() => void anfordern(false)} disabled={busy || (fz ? !fz.erreicht : false)}
          className="border-[1.5px] border-white px-5 py-2.5 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-white hover:text-black disabled:opacity-40">
          {busy ? "…" : t("dna.cover.guard.cta")}
        </button>
      </section>
    );
  }

  const coverImage = evidence[0]?.image_url ?? null;

  return (
    <section id="dna-cover" className="relative flex min-h-[92svh] items-end overflow-hidden bg-black text-white">
      {coverImage && <MediaImg src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

      <div className="relative z-[2] mx-auto w-full max-w-[1100px] px-6 pb-16 pt-32 md:px-14">
        <span className="inline-block bg-black px-[0.8rem] py-[0.45rem] text-[0.62rem] uppercase tracking-[0.36em]">
          {t("dna.cover.kicker", { blicke: counts.blicke, kaeufe: counts.kaeufe })}
        </span>
        <h1 className="mt-6 max-w-3xl font-serif text-[clamp(2.2rem,6.5vw,5.2rem)] font-medium italic leading-[0.98] tracking-[-0.02em]">
          {result?.urteil ?? result?.einordnung}
        </h1>

        {evidence.length > 0 && (
          <p className="mt-8 text-[0.6rem] uppercase tracking-[0.24em] text-white/60">
            {t("dna.cover.credit", { names: evidence.map((e) => e.name).join(", ") })}
          </p>
        )}
      </div>

      <div className="absolute bottom-5 right-5 z-[3] flex flex-col items-end gap-2">
        {bubble && (
          <div className="max-w-[220px] border-[1.5px] border-white bg-black px-3 py-2 text-right font-serif text-sm italic leading-snug text-white shadow-[5px_5px_0_0_rgba(255,255,255,0.25)]">
            {t("dna.cover.bubble")}
          </div>
        )}
        <PawnFigur size={64} interactive={false} showShadow={false} tone="dark" mood={mood} moodVariant={variant} ariaLabel="PAWN" />
      </div>
    </section>
  );
}
