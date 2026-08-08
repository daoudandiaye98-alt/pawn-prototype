import { useEffect, useState } from "react";
import { PawnFigurSvg } from "./PawnFigur";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 28a: "Während du weg warst" — Vollbild-Moment beim ersten Studio-Öffnen des Tages.
 * Zeigt nur echte Ereignisse seit dem letzten Besuch (designers.studio_last_seen_at).
 * Gibt es nichts zu berichten, erscheint der Moment nicht — kein Theater. Höchstens einmal
 * täglich (Datum in localStorage), unabhängig davon, dass studio_last_seen_at bei jedem
 * Besuch aktualisiert wird.
 */
export function WhileYouWereAway({ designerId, previousLastSeenAt }: { designerId: string; previousLastSeenAt: string | null }) {
  const { t } = useI18n();
  const [lines, setLines] = useState<string[]>([]);
  const [visible, setVisible] = useState(false);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    void supabase.from("designers").update({ studio_last_seen_at: new Date().toISOString() }).eq("id", designerId);
  }, [designerId]);

  useEffect(() => {
    if (!previousLastSeenAt) return;
    const todayKey = `pawn_away_${designerId}_${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(todayKey)) return;

    (async () => {
      const since = previousLastSeenAt;
      const { data: prods } = await supabase.from("products").select("id, slug").eq("designer_id", designerId);
      const slugs = new Set((prods ?? []).map((p) => p.slug));

      const [{ count: viewCount }, { count: taskCount }, { data: threads }, { data: orders }] = await Promise.all([
        supabase.from("domain_events").select("id", { count: "exact", head: true }).eq("type", "designer.view").eq("payload->>designer_id", designerId).gt("created_at", since),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designerId).eq("status", "published").gt("updated_at", since),
        supabase.from("message_threads").select("id, created_at").eq("designer_id", designerId).gt("created_at", since),
        supabase.from("orders").select("id, created_at, items").eq("status", "paid").gt("created_at", since),
      ]);

      let orderCount = 0;
      for (const o of (orders ?? []) as { items: unknown }[]) {
        const items = Array.isArray(o.items) ? (o.items as { slug?: string }[]) : [];
        if (items.some((it) => it.slug && slugs.has(it.slug))) orderCount++;
      }
      const requestCount = (threads?.length ?? 0) + orderCount;

      const next: string[] = [];
      if ((taskCount ?? 0) > 0) next.push(taskCount === 1 ? t("studio.away.tasks.one") : t("studio.away.tasks.many", { n: taskCount }));
      if ((viewCount ?? 0) > 0) next.push(viewCount === 1 ? t("studio.away.views.one") : t("studio.away.views.many", { n: viewCount }));
      if (requestCount > 0) next.push(requestCount === 1 ? t("studio.away.requests.one") : t("studio.away.requests.many", { n: requestCount }));

      if (next.length === 0) return;
      setLines(next.slice(0, 3));
      setVisible(true);
      localStorage.setItem(todayKey, "1");
      requestAnimationFrame(() => setArrived(true));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designerId, previousLastSeenAt]);

  if (!visible) return null;

  const close = () => setVisible(false);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-foreground px-6 text-center text-background"
      role="dialog"
      aria-label={t("studio.away.title")}
      onClick={close}
    >
      <PawnFigurSvg invert className={`w-32 transition-all duration-700 ${arrived ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"}`} />
      <div>
        <p className="text-[0.6rem] uppercase tracking-[0.28em] text-background/60">{t("studio.away.title")}</p>
        <div className="mt-4 space-y-2">
          {lines.map((line, i) => (
            <p key={i} className="font-serif text-xl leading-relaxed sm:text-2xl">{line}</p>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        className="mt-4 border-[1.5px] border-background px-5 py-2 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-background hover:text-foreground"
      >
        {t("studio.away.dismiss")}
      </button>
    </div>
  );
}
