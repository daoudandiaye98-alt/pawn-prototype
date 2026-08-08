import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { Reveal } from "@/components/palace/Reveal";
import { Editable, useContentValue } from "@/components/palace/Editable";
import { Button } from "@/components/ui/button";
import { usePublicDesigners, usePublishedProducts, useActiveCollection, type PublicProduct } from "@/lib/publicData";
import { useSiteContent } from "@/lib/siteContent";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";

/**
 * Teil 27a — Die Bühne: Landing 1:1 nach docs/design-referenz/landing.html.
 * Sieben Abschnitte: Cover, Fakten, Drei Welten, Ausgabe, Concierge, Designer-Finale, Footer
 * (Footer kommt fertig aus PalaceLayout). Die drei Gesetze gelten überall in dieser Datei:
 * Bild ist Held, Schwarz-Weiß nur für die Halle, kein Systemschmuck.
 */

const WORLDS: { key: "Mode" | "Interior" | "Kunst"; labelKey: string; label: string; textKey: string; text: string }[] = [
  { key: "Mode", labelKey: "landing.world_mode_label", label: "Mode", textKey: "landing.world_mode_text", text: "Stücke, die eine Handschrift tragen." },
  { key: "Interior", labelKey: "landing.world_interior_label", label: "Interior", textKey: "landing.world_interior_text", text: "Objekte, an denen man die Verbindung sieht." },
  { key: "Kunst", labelKey: "landing.world_kunst_label", label: "Kunst", textKey: "landing.world_kunst_text", text: "Arbeiten, die einen Raum verändern." },
];

/** Zellen 1/6, 6/10, 10/13 im 12er-Raster, versetzte Höhen — exakt wie die Referenz. */
const WORLD_TILE_STYLE = [
  { gridColumn: "1 / 6" as const, minHeight: "76vh", marginTop: "0" },
  { gridColumn: "6 / 10" as const, minHeight: "58vh", marginTop: "5rem" },
  { gridColumn: "10 / 13" as const, minHeight: "66vh", marginTop: "1.5rem" },
];

const Index = () => {
  const { locale } = useI18n();
  const { designers } = usePublicDesigners();
  const { products } = usePublishedProducts();
  const collection = useActiveCollection();
  const ausgabeNummer = useSiteContent("ausgabe_nummer");

  const designerById = useMemo(() => new Map(designers.map((d) => [d.id, d])), [designers]);

  // Cover: das stärkste verfügbare Werk — zuerst ein featured Haus mit Bild, sonst irgendein
  // Haus mit Bild, sonst ehrlich leer (nie die farbigen Platzhalterflächen der Referenz).
  const coverDesigner = useMemo(() => {
    const withImage = designers.filter((d) => d.hero_image_url || d.banner_url);
    return withImage.find((d) => d.is_featured) ?? withImage[0] ?? null;
  }, [designers]);
  const coverImage = coverDesigner?.hero_image_url ?? coverDesigner?.banner_url ?? null;

  // Drei Welten: das jüngste veröffentlichte Stück je Welt (products ist bereits nach
  // created_at absteigend sortiert) — ein echtes Werk statt eines Farbverlaufs.
  const worldImage = (world: "Mode" | "Interior" | "Kunst") => products.find((p) => p.world === world)?.image_url ?? null;

  // Ausgabe: die aktive Kollektion, sonst die fünf jüngsten veröffentlichten Stücke.
  const productBySlug = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const issuePieces: PublicProduct[] = useMemo(() => {
    if (collection.items.length > 0) {
      const resolved = collection.items.map((i) => productBySlug.get(i.product_slug)).filter((p): p is PublicProduct => !!p);
      if (resolved.length > 0) return resolved.slice(0, 5);
    }
    return products.slice(0, 5);
  }, [collection.items, productBySlug, products]);

  return (
    <PalaceLayout showBreadcrumbs={false}>
      {/* 01 COVER */}
      <div className="relative flex min-h-[100svh] items-end overflow-hidden bg-black text-white">
        {coverImage ? (
          <img src={coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <span className="font-serif text-[15vw] font-semibold leading-none text-white/90 md:text-[10vw]">
              Ausgabe {ausgabeNummer}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="relative z-[2] mx-auto w-full max-w-[1440px] px-6 pb-12 pt-32 md:px-10">
          <span className="inline-block bg-black px-[0.8rem] py-[0.45rem] text-[0.62rem] uppercase tracking-[0.36em]">
            <Editable contentKey="landing.cover_kicker">Der kuratierte Marktplatz</Editable>
          </span>
          <h1 className="mt-[1.3rem] max-w-[14ch] font-serif text-[clamp(2.7rem,9vw,7.6rem)] font-semibold leading-[0.92] tracking-[-0.028em]">
            <Editable contentKey="landing.cover_headline_a">Kunst von Händen,</Editable>
            <br />
            <span className="font-serif font-medium italic">
              <Editable contentKey="landing.cover_headline_b">nicht von Fabriken.</Editable>
            </span>
          </h1>
          <p className="mt-[1.6rem] max-w-[44ch] text-[1rem] text-white/92">
            <Editable contentKey="landing.cover_sub">
              Unabhängige Designer und Künstler aus Mode, Interior und Kunst — geprüft, kuratiert, direkt von der Werkstatt zu dir.
            </Editable>
          </p>
          <div className="mt-[2.2rem] flex flex-wrap gap-[0.9rem]">
            <Button asChild variant="editorial" size="chip" className="border-white bg-white text-black hover:bg-transparent hover:text-white">
              <Link to="/neu">Ausstellung betreten</Link>
            </Button>
            <Button asChild variant="editorial" size="chip" className="border-white bg-transparent text-white hover:bg-white hover:text-black">
              <Link to="/apply">Als Designer bewerben</Link>
            </Button>
          </div>
        </div>
        {coverDesigner && (
          <div className="absolute bottom-[1.2rem] left-6 z-[3] text-[0.58rem] uppercase tracking-[0.28em] text-white/85 md:left-10">
            {coverDesigner.house_number != null && <>№ {String(coverDesigner.house_number).padStart(3, "0")} · </>}
            {coverDesigner.brand_name}
            {coverDesigner.location && <> · {coverDesigner.location}</>}
          </div>
        )}
      </div>

      {/* 02 FAKTEN */}
      <div className="border-b-[1.5px] border-black">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3">
            {[
              { titleKey: "landing.fact_1_title", title: "Kuratiert", bodyKey: "landing.fact_1_body", body: "Jede Bewerbung wird geprüft. Was hier hängt, hat jemand gemacht." },
              { titleKey: "landing.fact_2_title", title: "93 % an die Hände", bodyKey: "landing.fact_2_body", body: "Vom Verkaufspreis geht fast alles an das Haus — PAWN nimmt 7 %." },
              { titleKey: "landing.fact_3_title", title: "Drei Welten", bodyKey: "landing.fact_3_body", body: "Mode, Interior und Kunst — eine Halle, viele Räume." },
            ].map((f, i) => (
              <div
                key={f.titleKey}
                className={`border-b border-[#e6e6e6] py-[1.4rem] px-6 text-[0.8rem] text-[#404040] md:border-b-0 md:border-r md:py-[1.6rem] md:px-8 ${i === 2 ? "md:border-r-0" : ""}`}
              >
                <b className="mb-[0.35rem] block text-[0.62rem] font-medium uppercase tracking-[0.3em] text-black">
                  <Editable contentKey={f.titleKey}>{f.title}</Editable>
                </b>
                <Editable contentKey={f.bodyKey}>{f.body}</Editable>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 03 DREI WELTEN */}
      <section className="py-[5.5rem] md:py-32">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10">
          <Reveal className="mb-[2.8rem] flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-[#404040]">
                <Editable contentKey="landing.worlds_eyebrow">Die Halle</Editable>
              </p>
              <h2 className="mt-[0.6rem] font-serif text-[clamp(2rem,4.8vw,3.6rem)] font-semibold leading-none tracking-[-0.024em]">
                Drei <span className="font-serif font-medium italic">Welten.</span>
              </h2>
            </div>
            <Link to="/designers" className="whitespace-nowrap border-b-[1.5px] border-black pb-[0.25rem] text-[0.62rem] uppercase tracking-[0.3em] text-black">
              Alle Häuser
            </Link>
          </Reveal>
          <div className="grid gap-6 md:grid-cols-12">
            {WORLDS.map((w, i) => {
              const img = worldImage(w.key);
              return (
                <Reveal
                  key={w.key}
                  className="md:min-h-0"
                  style={{ gridColumn: WORLD_TILE_STYLE[i].gridColumn, minHeight: WORLD_TILE_STYLE[i].minHeight, marginTop: WORLD_TILE_STYLE[i].marginTop }}
                >
                  <Link
                    to={`/${w.key.toLowerCase()}`}
                    className="group relative flex h-full min-h-[52vh] items-end overflow-hidden text-white no-underline md:min-h-0"
                  >
                    {img ? (
                      <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-[cubic-bezier(.76,0,.18,1)] group-hover:scale-[1.03]" />
                    ) : (
                      <div className="absolute inset-0 bg-black" />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
                    <div className="relative z-[2] p-[1.6rem]">
                      <div className="font-serif text-[clamp(1.8rem,3.4vw,2.7rem)] font-medium italic tracking-[-0.02em]">
                        <Editable contentKey={w.labelKey}>{w.label}</Editable>
                      </div>
                      <div className="mt-[0.4rem] max-w-[30ch] text-[0.85rem] text-white/90">
                        <Editable contentKey={w.textKey}>{w.text}</Editable>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* 04 AUSGABE */}
      <section className="border-t-[1.5px] border-black py-[5.5rem] md:py-32">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10">
          <Reveal className="mb-[2.8rem] flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-[#404040]">Ausgabe {ausgabeNummer}</p>
              <h2 className="mt-[0.6rem] font-serif text-[clamp(2rem,4.8vw,3.6rem)] font-semibold leading-none tracking-[-0.024em]">
                Diese Woche <span className="font-serif font-medium italic">hängt hier.</span>
              </h2>
            </div>
            <Link to="/ausgabe" className="whitespace-nowrap border-b-[1.5px] border-black pb-[0.25rem] text-[0.62rem] uppercase tracking-[0.3em] text-black">
              Zur Ausgabe
            </Link>
          </Reveal>
          {issuePieces.length === 0 ? (
            <Reveal className="border border-dashed border-border py-24 text-center">
              <p className="font-serif text-lg italic">Die ersten Stücke ziehen ein.</p>
            </Reveal>
          ) : (
            <div className="grid grid-cols-1 gap-[2.2rem] sm:grid-cols-2 lg:grid-cols-3">
              {issuePieces.map((p, i) => {
                const d = designerById.get(p.designer_id);
                const offset = issuePieces.length >= 4 ? (i === 1 ? "lg:mt-16" : i === 3 ? "lg:-mt-[2.2rem]" : "") : "";
                return (
                  <Reveal key={p.id} className={offset}>
                    <Link to={`/product/${p.slug}`} className="block text-black no-underline">
                      <EditorialImage src={p.image_url} seed={p.slug} ratio="4/5" alt={p.name} color className="group [&_.palace-image-inner]:transition-transform [&_.palace-image-inner]:duration-[900ms] [&:hover_.palace-image-inner]:scale-[1.035]" />
                      <p className="mt-[0.9rem] font-serif text-[1.3rem] font-semibold tracking-[-0.02em]">{p.name}</p>
                      <div className="mt-[0.3rem] flex items-center justify-between gap-4 text-[0.58rem] uppercase tracking-[0.26em] text-[#404040]">
                        <span>{d?.brand_name ?? "PAWN"} · {p.world}</span>
                        <span>{formatPrice(p.price, locale)}</span>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 05 CONCIERGE */}
      <ConciergeSection />

      {/* 06 DESIGNER-FINALE */}
      <section className="flex min-h-[62vh] items-center border-t-[1.5px] border-black py-[5.5rem] md:py-32">
        <Reveal className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-[#404040]">Für Designer</p>
          <h2 className="mt-4 max-w-[15ch] font-serif text-[clamp(2.4rem,7.4vw,6rem)] font-semibold leading-[0.92] tracking-[-0.026em]">
            Jeder beginnt als Bauer.<br />
            <span className="font-serif font-medium italic">Keiner bleibt einer.</span>
          </h2>
          <ChessProgression className="mt-8" />
          <Button asChild variant="editorial" size="chip" className="mt-9 bg-black text-white hover:bg-white hover:text-black">
            <Link to="/apply">Haus eröffnen</Link>
          </Button>
        </Reveal>
      </section>
    </PalaceLayout>
  );
};

function ConciergeSection() {
  const [value, setValue] = useState("");
  const send = () => {
    const text = value.trim();
    if (!text) return;
    window.dispatchEvent(new CustomEvent("palace:open-chat"));
    setTimeout(() => window.dispatchEvent(new CustomEvent("palace:chat-send", { detail: { message: text } })), 220);
    setValue("");
  };
  const placeholder = useContentValue("landing.concierge_placeholder", "„Etwas Ruhiges für meinen Esstisch…“");

  return (
    <section className="bg-black py-[5.5rem] text-white md:py-32">
      <div className="mx-auto max-w-[1440px] px-6 md:px-10">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr] md:gap-20">
          <Reveal>
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-white/60">Dein Concierge</p>
            <h2 className="mt-[0.7rem] font-serif text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.024em]">
              Sag PAWN, <span className="font-serif font-medium italic">wonach du suchst.</span>
            </h2>
            <p className="mt-[1.2rem] max-w-[44ch] text-[0.95rem] text-white/85">
              Beschreib es in deinen Worten — ein Gefühl, ein Anlass, ein Raum. PAWN kennt jedes Stück der Halle und
              merkt sich, was dir gefällt. Alles Gespeicherte kannst du lesen und löschen.
            </p>
          </Reveal>
          <Reveal>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-[1.5px] border-white p-[1.3rem] pb-[1.1rem]">
              <div className="flex items-center gap-2">
                <PawnFigurSvg invert className="h-6 w-[18px] shrink-0" />
                <p className="text-[0.58rem] uppercase tracking-[0.3em] text-white/70">Frag die Halle</p>
              </div>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                aria-label="Frag die Halle"
                className="mt-[0.7rem] w-full border-0 border-b-[1.5px] border-white bg-transparent py-[0.7rem] font-serif text-[1.25rem] font-medium italic text-white placeholder:text-white/55 focus:outline-none"
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <span className="text-[0.68rem] text-white/60">Oder lade ein Bild hoch — PAWN liest es.</span>
                <Button type="submit" variant="editorial" size="chip" className="border-white bg-white text-black hover:bg-transparent hover:text-white">
                  Fragen
                </Button>
              </div>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Bauer → Läufer → Turm → Dame, blass werdend — das einzige Systemzeichen, klein gesetzt. */
function ChessProgression({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-end gap-[1.1rem] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 40 52" className="h-[34px] w-auto"><g fill="#000">
        <circle cx="20" cy="10" r="7.5" /><path d="M13 18h14l-2.5 6h-9z" /><path d="M15.5 24h9l2.5 15H13z" /><rect x="8" y="39" width="24" height="6" />
      </g></svg>
      <svg viewBox="0 0 40 52" className="h-[34px] w-auto opacity-35"><g fill="#000">
        <path d="M20 2c4 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2-6 6-10z" /><path d="M13 18h14l-2.5 6h-9z" /><path d="M15 24h10l2.5 15H12.5z" /><rect x="8" y="39" width="24" height="6" />
      </g></svg>
      <svg viewBox="0 0 40 52" className="h-[34px] w-auto opacity-35"><g fill="#000">
        <path d="M9 3h5v4h4V3h4v4h4V3h5v10H9z" /><path d="M12.5 13h15l2 26H10.5z" /><rect x="7" y="39" width="26" height="6" />
      </g></svg>
      <svg viewBox="0 0 40 52" className="h-[34px] w-auto opacity-35"><g fill="#000">
        <circle cx="20" cy="3.6" r="2.6" /><circle cx="9.5" cy="7.5" r="2.4" /><circle cx="30.5" cy="7.5" r="2.4" />
        <path d="M9 10l3 9h16l3-9-6.5 5L20 8l-5.5 7z" /><path d="M13 21h14l2.5 18H10.5z" /><rect x="7" y="39" width="26" height="6" />
      </g></svg>
    </div>
  );
}

export default Index;
