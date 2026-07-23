import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { Link } from "react-router-dom";

interface BrandDna {
  worlds?: Record<string, number>;
  signals?: string[];
  price_band?: { min?: number; max?: number; avg?: number };
  inventory_mix?: { stock?: number; made_to_order?: number };
  product_count?: number;
}

export default function StudioSettings() {
  const { designer, loading } = useMyDesigner();
  if (loading) return <StudioShell title="Einstellungen"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Einstellungen"><p className="text-sm text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  const dna = (designer.brand_dna ?? {}) as BrandDna;
  const worlds = dna.worlds ?? {};
  const hasDna = (dna.product_count ?? 0) > 0;

  return (
    <StudioShell title="Einstellungen" eyebrow="Einstellungen">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brand-DNA */}
        <section className="border border-border bg-white p-8">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Deine Brand-DNA</p>
          <h2 className="mt-2 font-serif text-2xl font-medium">So sieht PAWN deine Handschrift.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sie entsteht aus deinen Stücken — Welt, Preisband und wiederkehrende Signale.</p>

          {!hasDna ? (
            <div className="mt-6 border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Noch keine veröffentlichten Stücke.</p>
              <Link to="/studio/produkte" className="mt-3 inline-flex border border-foreground px-4 py-2 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">Erstes Stück anlegen</Link>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-3">
                {(["Mode", "Interior", "Kunst"] as const).map((w) => {
                  const ratio = worlds[w] ?? 0;
                  return (
                    <div key={w}>
                      <div className="flex items-baseline justify-between text-[0.68rem] uppercase tracking-[0.22em]">
                        <span>{w}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(ratio * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1 w-full bg-muted">
                        <div className="h-full bg-[#0B0B0D] transition-all" style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {dna.signals && dna.signals.length > 0 && (
                <div className="mt-6">
                  <p className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Signale</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dna.signals.slice(0, 8).map((s) => (
                      <span key={s} className="border border-border bg-white px-2 py-1 text-[0.68rem]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {dna.price_band && (
                <div className="mt-6 grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
                  <Stat label="Ø Preis" value={`€ ${Math.round(dna.price_band.avg ?? 0)}`} />
                  <Stat label="Preisband" value={`€ ${Math.round(dna.price_band.min ?? 0)}–${Math.round(dna.price_band.max ?? 0)}`} />
                  <Stat label="Stücke" value={String(dna.product_count ?? 0)} />
                </div>
              )}
            </>
          )}
        </section>

        {/* Meta */}
        <section className="border border-border bg-white p-8">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Studio-Meta</p>
          <h2 className="mt-2 font-serif text-2xl font-medium">Haus {designer.house_number ? `№ ${designer.house_number}` : ""}</h2>
          <dl className="mt-6 space-y-3 text-sm">
            <Row k="Marke" v={designer.brand_name} />
            <Row k="Slug" v={designer.slug} />
            <Row k="Ort" v={designer.location ?? "—"} />
            <Row k="Land" v={designer.country ?? "—"} />
            <Row k="Status" v={designer.status} />
            <Row k="Im Haus seit" v={designer.created_at ? new Date(designer.created_at).toLocaleDateString("de-DE", { month: "long", year: "numeric" }) : "—"} />
          </dl>
          <Link to="/studio/brand" className="mt-6 inline-flex border border-foreground px-4 py-2 text-[0.68rem] tracking-wide hover:bg-foreground hover:text-background">Retrospektive bearbeiten</Link>
        </section>
      </div>
    </StudioShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border pb-2">
      <dt className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{k}</dt>
      <dd className="font-serif">{v}</dd>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-3">
      <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-lg">{value}</p>
    </div>
  );
}
