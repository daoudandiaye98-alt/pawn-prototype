import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

/**
 * Teil 29 — "Belege mit Bildbeweis": drei Beobachtungen aus echten Engagement-Daten,
 * jede mit dem Bild des betroffenen Stücks und der Kennzahl rechts. Rein deterministisch
 * aus page_visits/orders — kein KI-Aufruf, keine erfundenen Belege. Nur zeigen, was
 * belegbar ist: lieber zwei echte Zeilen als drei erfundene.
 */
interface Candidate { kind: "returner" | "dweller" | "purchase"; slug: string; name: string; image_url: string; n: number }

export function DnaBelege() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  useEffect(() => {
    if (!user) { setCandidates([]); return; }
    (async () => {
      const [{ data: visits }, { data: orders }] = await Promise.all([
        supabase.from("page_visits" as never).select("target_id, visit_count, dwell_seconds")
          .eq("user_id", user.id).eq("target_type", "product").order("visit_count", { ascending: false }).limit(10),
        supabase.from("orders").select("id, items").eq("user_id", user.id).eq("status", "paid"),
      ]);
      const visitRows = ((visits ?? []) as unknown as { target_id: string; visit_count: number; dwell_seconds: number }[]);
      const ids = Array.from(new Set(visitRows.map((v) => v.target_id)));
      const purchasedSlugs = new Set<string>();
      for (const o of (orders ?? []) as { items: unknown }[]) {
        const items = Array.isArray(o.items) ? (o.items as { slug?: string }[]) : [];
        for (const it of items) if (it.slug) purchasedSlugs.add(it.slug);
      }
      if (ids.length === 0 && purchasedSlugs.size === 0) { setCandidates([]); return; }

      const { data: prods } = ids.length > 0
        ? await supabase.from("products").select("id, slug, name, image_url").in("id", ids)
        : { data: [] as { id: string; slug: string; name: string; image_url: string | null }[] };
      const bySlugProd = new Map((prods ?? []).map((p) => [p.slug, p]));
      const byIdProd = new Map((prods ?? []).map((p) => [p.id, p]));

      const built: Candidate[] = [];

      const returner = visitRows.filter((v) => v.visit_count >= 2).sort((a, b) => b.visit_count - a.visit_count)[0];
      if (returner) {
        const p = byIdProd.get(returner.target_id);
        if (p?.image_url) built.push({ kind: "returner", slug: p.slug, name: p.name, image_url: p.image_url, n: returner.visit_count });
      }

      const dweller = visitRows.filter((v) => v.dwell_seconds >= 20 && v.target_id !== returner?.target_id).sort((a, b) => b.dwell_seconds - a.dwell_seconds)[0];
      if (dweller) {
        const p = byIdProd.get(dweller.target_id);
        if (p?.image_url) built.push({ kind: "dweller", slug: p.slug, name: p.name, image_url: p.image_url, n: dweller.dwell_seconds });
      }

      const purchasedSlug = Array.from(purchasedSlugs).find((s) => bySlugProd.get(s)?.image_url) ?? Array.from(purchasedSlugs)[0];
      if (purchasedSlug) {
        const p = bySlugProd.get(purchasedSlug) ?? (await supabase.from("products").select("slug, name, image_url").eq("slug", purchasedSlug).maybeSingle()).data;
        if (p?.image_url) built.push({ kind: "purchase", slug: p.slug, name: p.name, image_url: p.image_url, n: 0 });
      }

      setCandidates(built.slice(0, 3));
    })();
  }, [user]);

  const rows = useMemo(() => (candidates ?? []).map((c) => {
    if (c.kind === "returner") return { ...c, sentence: t("dna.belege.returner", { name: c.name }), metric: t("dna.belege.returner.metric", { n: c.n }) };
    if (c.kind === "dweller") return { ...c, sentence: t("dna.belege.dweller", { name: c.name }), metric: t("dna.belege.dweller.metric", { n: c.n }) };
    return { ...c, sentence: t("dna.belege.purchase", { name: c.name }), metric: t("dna.belege.purchase.metric") };
  }), [candidates, t]);

  if (!user || rows.length === 0) return null;

  return (
    <section id="belege" className="scroll-mt-24 border-t border-[rgba(0,0,0,.18)] px-6 py-24 md:px-14 md:py-32">
      <div className="mx-auto max-w-[900px]">
        <p className="palace-eyebrow">{t("dna.belege.eyebrow")}</p>
        <h2 className="palace-serif mt-6 font-light text-[clamp(1.8rem,3.5vw,3rem)] leading-[1.05] text-black">
          {t("dna.belege.heading.a")} <span className="italic">{t("dna.belege.heading.b")}</span>
        </h2>
        <div className="mt-10 divide-y divide-[rgba(0,0,0,.12)]">
          {rows.map((r) => (
            <Link key={r.kind} to={`/product/${r.slug}`} className="group flex items-center gap-5 py-5 no-underline">
              <div className="h-16 w-[52px] shrink-0 overflow-hidden border border-[rgba(0,0,0,.15)] sm:h-20 sm:w-16">
                <img src={r.image_url} alt={r.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              </div>
              <p className="flex-1 palace-serif text-[1.05rem] leading-snug text-black">{r.sentence}</p>
              <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.22em] tabular-nums text-black/60">{r.metric}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
