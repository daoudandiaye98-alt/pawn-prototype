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
import { formatPrice, formatCreditLine } from "@/lib/format";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";
import { BauerSpruch } from "@/components/pawn/BauerSpruch";
import heroImage1400 from "@/assets/landing-hero-1400.webp";
import heroImage2400 from "@/assets/landing-hero-2400.webp";
// Teil O — feste Bilder für die drei Welten (lokal, WebP).
import weltModeBild from "@/assets/teil-o/welt-mode.webp";
import weltInteriorBild from "@/assets/teil-o/welt-interior.webp";
import weltKunstBild from "@/assets/teil-o/welt-kunst.webp";
import { MediaImg } from "@/components/palace/MediaImg";
import { KiBildZeichen } from "@/components/pawn/KiBildZeichen";
import { AiDisclosureNote } from "@/components/pawn/AiDisclosureNote";
import { useKiBilder, istKiBild } from "@/lib/kiHerkunft";

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

const Index = () => {
  const { locale, t } = useI18n();
  /* Teil R8 — welche Bilder dieser Seite aus einer Maschine kommen. Eine Abfrage
     für die ganze Landing, kein Nachschlagen je Kachel. */
  const kiBilder = useKiBilder();
  const { designers } = usePublicDesigners();
  const { products } = usePublishedProducts();
  const collection = useActiveCollection();
  const ausgabeNummer = useSiteContent("ausgabe_nummer");

  const designerById = useMemo(() => new Map(designers.map((d) => [d.id, d])), [designers]);

  // Teil J2 — das Hero-Bild ist ein festes Marken-Asset (kein dynamisches Haus-Foto mehr);
  // coverDesigner bleibt für die Credit-Zeile unten links (echtes, aktuelles Feature-Haus).
  const coverDesigner = useMemo(() => {
    const withImage = designers.filter((d) => d.hero_image_url || d.banner_url);
    return withImage.find((d) => d.is_featured) ?? withImage[0] ?? null;
  }, [designers]);

  // Aus den Häusern (Teil H): maximal sechs kuratierte/neueste veröffentlichte Werke — der
  // Slogan behauptet, die Werke beweisen. products ist bereits nach created_at absteigend
  // sortiert; is_featured-Häuser zuerst, danach die übrigen, nie aufgefüllt mit Platzhaltern.
  const houseWorks: PublicProduct[] = useMemo(() => {
    const featuredIds = new Set(designers.filter((d) => d.is_featured).map((d) => d.id));
    const featured = products.filter((p) => featuredIds.has(p.designer_id));
    const rest = products.filter((p) => !featuredIds.has(p.designer_id));
    return [...featured, ...rest].slice(0, 6);
  }, [products, designers]);

  // Teil O — Drei Welten mit festen Bildern: jede Welt hat ihr eigenes, kuratiertes
  // Kopfbild (lokal, WebP) statt des zufällig jüngsten Werks. Die Kacheln verlinken
  // weiter in die jeweilige Kategorie; „Aus den Häusern" zeigt weiterhin echte Werke.
  const worldImage = (world: "Mode" | "Interior" | "Kunst") =>
    ({ Mode: weltModeBild, Interior: weltInteriorBild, Kunst: weltKunstBild })[world];

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
        <img
          src={heroImage2400}
          srcSet={`${heroImage1400} 1400w, ${heroImage2400} 2400w`}
          sizes="100vw"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        {/*
          Teil R1 — LESBARKEIT DURCH EINE KANTE, NICHT DURCH EINEN VERLAUF.

          Bis hierher lagen zwei Schleier über dem Foto: eine flächige
          Schwarz-Deckkraft und darüber ein Verlauf von unten nach oben. Weiß
          auf hellem Beton blieb trotzdem grenzwertig — der Verlauf ist an
          jeder Stelle unterschiedlich stark, also ist auch der Kontrast an
          jeder Stelle ein anderer. Gemessen werden kann so nichts.

          Jetzt steht der ganze Textblock auf einer massiven schwarzen Fläche
          mit harter Kante — dieselbe Lösung wie beim Label „Der kuratierte
          Raum", das schon immer funktioniert hat. Weiß auf #000 sind 21:1,
          unabhängig davon, wie hell das Foto dahinter gerade ist.
        */}
        {/* Teil K1 — der Held ist `100svh` hoch und unten ausgerichtet; eine
            Polsterung am `body` ändert daran nichts. Deshalb rechnet er die
            Höhe der Einwilligungsleiste selbst dazu, solange sie steht. */}
        <div className="relative z-[2] mx-auto w-full max-w-[1440px] px-6 pb-[calc(3rem+var(--pawn-einwilligung,0px))] pt-32 md:px-10">
          <div className="w-fit max-w-full bg-black px-6 py-8 md:px-10 md:py-10">
            <span className="inline-block border-[1.5px] border-white px-[0.8rem] py-[0.45rem] text-[0.68rem] uppercase tracking-[0.32em]">
              <Editable contentKey="landing.cover_kicker">Der kuratierte Raum</Editable>
            </span>
            {/* Eine Wortmarke pro Bildschirm: die im Kopf. Die zweite,
                dekorative stand direkt über „YOUR MOVE." und überlagerte sie
                auf schmalen Geräten. */}
            <h1 className="mt-[1.1rem] max-w-[16ch] font-serif text-[clamp(3.2rem,10vw,8.4rem)] font-semibold italic leading-[0.9] tracking-[-0.028em]">
              YOUR MOVE.
            </h1>
            <p className="mt-[1.6rem] max-w-[44ch] text-[1rem] text-white">
              {t("landing.cover_claim")}
            </p>
            <div className="mt-[2.2rem] flex flex-wrap gap-[0.9rem]">
              <Button asChild variant="editorial" size="chip" className="border-white bg-white text-black hover:bg-transparent hover:text-white">
                <Link to="/start">Mach deinen Zug</Link>
              </Button>
              {/* Teil Q — der zweite Weg führt in die Boutique: von der Landing ist
                  alles Kaufbare jetzt einen Tipp entfernt. */}
              <Button asChild variant="editorial" size="chip" className="border-white bg-transparent text-white hover:bg-white hover:text-black">
                <Link to="/shop">Häuser entdecken</Link>
              </Button>
            </div>
            {coverDesigner && (
              <p className="mt-8 text-[0.68rem] uppercase tracking-[0.28em] text-white">
                {formatCreditLine({ houseNumber: coverDesigner.house_number, brandName: coverDesigner.brand_name, third: coverDesigner.location })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 01B AUS DEN HÄUSERN — Teil H: der Slogan behauptet, die Werke beweisen. Kuratierte/
          neueste veröffentlichte Stücke direkt unter dem Hero, maximal sechs (Choice-Paralysis-
          Regel), nie Platzhalter. */}
      {houseWorks.length > 0 && (
        <section className="border-b-[1.5px] border-black bg-white text-black">
          <div className="mx-auto max-w-[1440px] px-6 py-[3.5rem] md:px-10 md:py-[4.5rem]">
            <Reveal>
              <h2 className="font-serif text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold italic tracking-[-0.02em]">
                <Editable contentKey="landing.from_houses_title">Aus den Häusern</Editable>
              </h2>
            </Reveal>
            <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 md:gap-8">
              {houseWorks.map((p, i) => {
                const designer = designerById.get(p.designer_id);
                return (
                  <Reveal key={p.id} delay={i * 60}>
                    <Link to={`/product/${p.slug}`} className="group block">
                      <div className="relative">
                        <EditorialImage seed={`house-${p.slug}`} src={p.image_url} ratio="4/5" className="w-full" />
                        {/* Teil R8 — Bilder mit KI-Herkunft tragen ihr Zeichen. */}
                        {istKiBild(p.image_url, kiBilder) && <KiBildZeichen className="absolute left-2 top-2 z-[2]" />}
                      </div>
                      <p className="mt-3 font-serif text-[1.05rem] italic leading-tight">{p.name}</p>
                      <p className="mt-1 text-[0.62rem] uppercase tracking-[0.24em] text-[#404040]">
                        {designer?.brand_name ?? "PAWN"}
                      </p>
                      {/* Teil R2 — eine einzige Preis-Schreibweise, aus formatPrice. */}
                      <p className="mt-1 text-[0.8rem] tabular-nums">{formatPrice(p.price, locale)}</p>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 02 FAKTEN */}
      <div className="border-b-[1.5px] border-black">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10">
          <div className="grid grid-cols-1 md:grid-cols-3">
            {[
              { titleKey: "landing.fact_1_title", title: "Kuratiert", bodyKey: "landing.fact_1_body", body: "Jede Bewerbung wird geprüft. Was hier hängt, hat jemand gemacht." },
              { titleKey: "landing.fact_2_title", title: "93 % ans Haus", bodyKey: "landing.fact_2_body", body: "93 % jedes Kaufs gehen direkt an das Haus — 7 % gehen an PAWN." },
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
            <Link to="/designers" className="trefferflaeche whitespace-nowrap text-[0.62rem] uppercase tracking-[0.3em] text-black">
              {/* Prüfstand 3.5 — der Kasten wird 44 px hoch, der Strich bleibt am Wort. */}
              <span className="border-b-[1.5px] border-black pb-[0.25rem]">Alle Häuser</span>
            </Link>
          </Reveal>
          {/*
            Teil R6 — unter 768px eine Reihe zum Wischen mit Schnappen an der
            Kante: alle drei Kacheln gleich breit, gleich hoch, gleicher
            Ausschnitt. Ab 768px der versetzte Zwölfer-Raster-Satz wie zuvor.
            Höhe, Spalte und Versatz stehen jetzt in `index.css` (`.welt-kachel`),
            nicht mehr als Inline-Stil — Inline-Stil kennt keinen Umbruchpunkt.
          */}
          <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-12 md:gap-6 md:overflow-visible md:px-0 md:pb-0">
            {WORLDS.map((w, i) => {
              const img = worldImage(w.key);
              return (
                <Reveal
                  key={w.key}
                  className={`welt-kachel welt-kachel--${i + 1} w-[78vw] shrink-0 snap-start sm:w-[62vw] md:w-auto md:shrink`}
                >
                  {/* Teil Q — die Welt-Kachel führt in die Boutique mit vorgewählter
                      Welt, statt auf eine eigene Weltseite. Ein Weg, ein Regal. */}
                  <Link
                    to={`/shop?welt=${w.key}`}
                    className="group relative flex h-full items-end overflow-hidden text-white no-underline"
                  >
                    <MediaImg src={img} alt="" width={896} height={1200} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-[cubic-bezier(.76,0,.18,1)] group-hover:scale-[1.03]" />
                    {/* Teil R6/R1 — eine Kante statt eines Verlaufs: der Kartentext
                        steht auf massivem Schwarz, nicht auf hellem Beton. */}
                    <div className="relative z-[2] w-full bg-black p-[1.4rem]">
                      <div className="font-serif text-[clamp(1.8rem,3.4vw,2.7rem)] font-medium italic tracking-[-0.02em]">
                        <Editable contentKey={w.labelKey}>{w.label}</Editable>
                      </div>
                      <div className="mt-[0.4rem] max-w-[30ch] text-[0.85rem] text-white">
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

      {/* 04 AUSGABE — Teil R7: findet dieser Aufmacher kein vorzeigbares Stück,
          fällt der ganze Abschnitt weg. Kein Platzhalter, keine leere Kachel.
          Ein leerer Aufmacher ist besser als ein falscher. */}
      {issuePieces.length > 0 && (
      <section className="border-t-[1.5px] border-black py-[5.5rem] md:py-32">
        <div className="mx-auto max-w-[1440px] px-6 md:px-10">
          <Reveal className="mb-[2.8rem] flex flex-wrap items-end justify-between gap-8">
            <div>
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-[#404040]">Ausgabe {ausgabeNummer}</p>
              <h2 className="mt-[0.6rem] font-serif text-[clamp(2rem,4.8vw,3.6rem)] font-semibold leading-none tracking-[-0.024em]">
                Diese Woche <span className="font-serif font-medium italic">hängt hier.</span>
              </h2>
            </div>
            <Link to="/ausgabe" className="trefferflaeche whitespace-nowrap text-[0.62rem] uppercase tracking-[0.3em] text-black">
              {/* Prüfstand 3.5 — der Kasten wird 44 px hoch, der Strich bleibt am Wort. */}
              <span className="border-b-[1.5px] border-black pb-[0.25rem]">Zur Ausgabe</span>
            </Link>
          </Reveal>
          <div className="grid grid-cols-1 gap-[2.2rem] sm:grid-cols-2 lg:grid-cols-3">
            {issuePieces.map((p, i) => {
              const d = designerById.get(p.designer_id);
              const offset = issuePieces.length >= 4 ? (i === 1 ? "lg:mt-16" : i === 3 ? "lg:-mt-[2.2rem]" : "") : "";
              return (
                <Reveal key={p.id} className={offset}>
                  <Link to={`/product/${p.slug}`} className="block text-black no-underline">
                    <div className="relative">
                      <EditorialImage src={p.image_url} seed={p.slug} ratio="4/5" alt={p.name} color className="group [&_.palace-image-inner]:transition-transform [&_.palace-image-inner]:duration-[900ms] [&:hover_.palace-image-inner]:scale-[1.035]" />
                      {/* Teil R8 — auch das Wochen-Feature kennzeichnet KI-Bilder. */}
                      {istKiBild(p.image_url, kiBilder) && <KiBildZeichen className="absolute left-2 top-2 z-[2]" />}
                    </div>
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
        </div>
      </section>
      )}

      {/* 05 CONCIERGE */}
      <ConciergeSection />

      {/* 06 DESIGNER-FINALE — Teil R5: die Sektion hatte `min-h-[62vh]` UND
          `items-center`. Der Inhalt saß damit in der Mitte einer viel zu hohen
          Fläche, und unter „Haus eröffnen" stand fast ein leerer Bildschirm bis
          zum Footer. Jetzt derselbe Abstand wie zwischen allen anderen
          Abschnitten: py-[5.5rem] / md:py-32. */}
      <section className="border-t-[1.5px] border-black py-[5.5rem] md:py-32">
        <Reveal className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.34em] text-[#404040]">Für Designer</p>
          <h2 className="mt-5 max-w-[15ch] font-serif text-[clamp(2.4rem,7.4vw,6rem)] font-semibold leading-[0.92] tracking-[-0.026em]">
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
  const { t } = useI18n();
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
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="relative border-[1.5px] border-white p-[1.3rem] pb-[1.1rem]">
              {/* Teil S6 — einmal pro Sitzung, 4,2 s, dann leise weg. */}
              <BauerSpruch schluessel="halle" text={t("spruch.halle")} verzoegerungMs={2000} hell
                className="absolute bottom-full left-0 mb-3" />
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
              {/* Teil R8 — dieses Feld ist der Eingang ins Gespräch mit PAWN.
                  Die Gesprächs-Offenlegung hing bisher nur im Chat-Fenster
                  dahinter, nicht an der Tür. Jetzt an beiden Stellen. */}
              <AiDisclosureNote className="mt-4 text-white/70 [&_a]:hover:text-white" />
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
