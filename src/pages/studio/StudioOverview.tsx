import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { Package, Megaphone, UserCircle2, ArrowUpRight } from "lucide-react";

export default function StudioOverview() {
  const { designer, loading } = useMyDesigner();
  const [counts, setCounts] = useState({ products: 0, campaigns: 0 });

  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [p, c] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("designer_id", designer.id),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("designer_id", designer.id),
      ]);
      setCounts({ products: p.count ?? 0, campaigns: c.count ?? 0 });
    })();
  }, [designer]);

  if (loading) return <StudioShell title="Studio"><Skeleton /></StudioShell>;

  if (!designer) return (
    <StudioShell title="Studio" eyebrow="Willkommen">
      <div className="mx-auto max-w-xl border border-border bg-card p-10 text-center">
        <p className="editorial-eyebrow">Kein Studio-Zugang</p>
        <h2 className="mt-3 font-serif text-3xl">Dein Studio steht noch nicht.</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Sobald deine Bewerbung angenommen ist, findest du hier deine Brand-Page, Produkte, Kampagnen und Einblicke.
        </p>
        <Link to="/apply" className="mt-6 inline-flex border border-foreground px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
          Zur Bewerbung
        </Link>
      </div>
    </StudioShell>
  );

  return (
    <StudioShell title={designer.brand_name} eyebrow="Studio">
      <div className="grid gap-6 md:grid-cols-3">
        <StatCard label="Produkte" value={counts.products} link="/studio/produkte" icon={Package} />
        <StatCard label="Kampagnen" value={counts.campaigns} link="/studio/kampagnen" icon={Megaphone} />
        <StatCard label="Brand-Page" value={designer.status} link="/studio/brand" icon={UserCircle2} isText />
      </div>

      <section className="mt-8 border border-border bg-card p-8">
        <p className="editorial-eyebrow">Nächste Schritte</p>
        <h2 className="mt-2 font-serif text-2xl">Alles bereit für deinen Auftritt</h2>
        <ol className="mt-6 space-y-4 text-sm">
          <Step n={1} label="Brand-Page fertigstellen" link="/studio/brand" done={!!designer.story} />
          <Step n={2} label="Erstes Produkt anlegen" link="/studio/produkte" done={counts.products > 0} />
          <Step n={3} label="Kampagnenvorschläge prüfen" link="/studio/kampagnen" done={false} />
        </ol>
      </section>
    </StudioShell>
  );
}

function StatCard({ label, value, link, icon: Icon, isText }: { label: string; value: number | string; link: string; icon: React.ElementType; isText?: boolean }) {
  return (
    <Link to={link} className="group block border border-border bg-card p-6 transition-colors hover:border-foreground">
      <div className="flex items-start justify-between">
        <div>
          <p className="editorial-eyebrow">{label}</p>
          <p className={`mt-3 font-serif ${isText ? "text-xl capitalize" : "text-4xl"}`}>{value}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-4 flex items-center gap-1 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground group-hover:text-foreground">
        Öffnen <ArrowUpRight className="h-3 w-3" />
      </p>
    </Link>
  );
}

function Step({ n, label, link, done }: { n: number; label: string; link: string; done: boolean }) {
  return (
    <li className="flex items-center justify-between border-b border-border pb-3">
      <div className="flex items-center gap-4">
        <span className={`flex h-8 w-8 items-center justify-center border ${done ? "border-accent bg-accent text-accent-foreground" : "border-border"} text-[0.7rem]`}>{done ? "✓" : n}</span>
        <span className={done ? "text-muted-foreground line-through" : ""}>{label}</span>
      </div>
      <Link to={link} className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Öffnen →</Link>
    </li>
  );
}

function Skeleton() {
  return <div className="animate-pulse space-y-6"><div className="h-24 bg-muted"></div><div className="h-64 bg-muted"></div></div>;
}
