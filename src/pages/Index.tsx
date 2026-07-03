import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { ProductImage } from "@/components/pawn/ProductImage";
import { DNAVisual } from "@/components/pawn/DNAVisual";
import {
  useStore,
  marketplaceSelectors,
  selectors,
  useCommand,
  commands,
  defaultIdentityId,
} from "@/core";
import { readFirstChoice, writeFirstChoice, readLastSeen, writeLastSeen, isReturningVisit } from "@/features/os/lastSeen";
import { useRoomShift } from "@/features/os/roomShift";
import { useRank, usePieceShadow } from "@/features/narrative/hooks";

/**
 * PAWN — The Obsidian Archive Palace.
 * One monumental scroll: Portal → Shadow room → Houses → Curation → DNA finale.
 * No dead ends. Every section pulls the eye down into the next room.
 */
const Index = () => {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
  const identity = useStore((s) => selectors.getIdentity(s, defaultIdentityId));
  const rank = useRank();
  const shadow = usePieceShadow();
  const dispatch = useCommand();
  const { push } = useRoomShift();

  const [choice, setChoice] = useState<"light" | "shadow" | null>(() => readFirstChoice());

  useEffect(() => {
    const prev = readLastSeen();
    if (isReturningVisit(prev)) push("Die Partie ruht. Es liegt an dir.");
    writeLastSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSaved = useMemo(() => {
    const savedIds = identity?.wardrobe.saved ?? [];
    if (savedIds.length === 0) return null;
    const id = savedIds[savedIds.length - 1] as string;
    return products.find((p) => p.id === id) ?? null;
  }, [identity, products]);

  function makeChoice(pick: "light" | "shadow") {
    writeFirstChoice(pick);
    setChoice(pick);
    if (identity) {
      const to = pick === "shadow"
        ? { darkness: Math.min(1, identity.dna.genome.darkness + 0.15), edge: Math.min(1, identity.dna.genome.edge + 0.1) }
        : { structure: Math.min(1, identity.dna.genome.structure + 0.15), elegance: Math.min(1, identity.dna.genome.elegance + 0.1) };
      const r = dispatch(commands.proposeMutation, {
        identityId: defaultIdentityId,
        to,
        rationale: pick === "shadow" ? "Erster Zug: Schatten." : "Erster Zug: Licht.",
      });
      if (r.ok) {
        const proposed = r.events.find((e) => e.type === "mutation.proposed");
        const proposedId = proposed && "payload" in proposed && proposed.payload && "mutation" in proposed.payload
          ? (proposed.payload as { mutation: { id: string } }).mutation.id
          : null;
        if (proposedId) dispatch(commands.ratifyMutation, { identityId: defaultIdentityId, mutationId: proposedId as never });
      }
    }
    push(pick === "shadow" ? "1. Schatten. Der Bauer zieht nach vorn." : "1. Licht. Der Bauer zieht nach vorn.");
  }

  const ordered = choice === "shadow"
    ? [...products].sort((a, b) => (b.genomeAffinity?.darkness ?? 0) - (a.genomeAffinity?.darkness ?? 0))
    : [...products].sort((a, b) => (b.genomeAffinity?.structure ?? 0) - (a.genomeAffinity?.structure ?? 0));

  return (
    <PublicLayout>
      {/* ───── 01 · PORTAL ─────────────────────────────────────────
          Marble hall. Fixed nav floats above. Serif bleeds off the left,
          graphite slab drifts in from the right. */}
      <section id="portal" className="relative min-h-screen overflow-hidden bg-background px-6 pt-40 md:px-14 md:pt-48">
        <div className="grid grid-cols-12 items-center">
          <div className="col-span-12 z-10 md:col-span-8">
            <div className="mb-10 flex items-center gap-4 text-[10px] uppercase tracking-[0.5em] text-foreground/50 motion-reveal">
              <span className="h-px w-10 bg-foreground/50" />
              Chapter 001 · The Archive
            </div>
            <h1 className="-ml-1 font-serif font-light leading-[0.82] tracking-[-0.03em] motion-reveal"
                style={{ fontSize: "clamp(4rem, 13vw, 15rem)" }}>
              Modern
              <br />
              <span className="ml-[8%] italic text-accent">Antiqua.</span>
            </h1>

            <div className="mt-12 flex max-w-md items-start gap-8 motion-reveal">
              <div className="mt-3 h-px w-24 shrink-0 bg-foreground" />
              <p className="text-sm leading-relaxed tracking-wide text-foreground/70">
                A curation of objects that bridge the threshold between light and shadow —
                the definitive collection for the modern aesthetician.
              </p>
            </div>

            {/* Der erste Zug — subtle, never blocks the room */}
            <div className="mt-14 flex flex-wrap items-center gap-4 motion-reveal">
              <span className="text-[10px] uppercase tracking-[0.4em] text-foreground/45">
                {choice ? `1. ${choice === "shadow" ? "…e5" : "e4"} · Rang ${rank.rank} / 8` : "Weiß beginnt. Wähle deinen Zug."}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => makeChoice("light")}
                  className={`group px-6 py-3 text-[10px] uppercase tracking-[0.4em] transition-all duration-700 ${
                    choice === "light"
                      ? "bg-foreground text-background"
                      : "border border-foreground/40 text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  Licht
                </button>
                <button
                  onClick={() => makeChoice("shadow")}
                  className={`group px-6 py-3 text-[10px] uppercase tracking-[0.4em] transition-all duration-700 ${
                    choice === "shadow"
                      ? "bg-foreground text-background"
                      : "border border-foreground/40 text-foreground hover:border-foreground hover:bg-foreground hover:text-background"
                  }`}
                >
                  Schatten
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Asymmetric graphite slab drifting from the right */}
        <div className="absolute right-0 top-[12%] hidden h-[75vh] w-[42vw] overflow-hidden bg-accent md:block">
          <div className="absolute inset-0 chess-grid-light opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-background/20" />
          <div className="absolute -left-6 bottom-10 origin-bottom-left rotate-90">
            <span className="text-[10px] font-light uppercase italic tracking-[0.5em] text-background/40">
              Fragment Series 003 / 12
            </span>
          </div>
          <div className="absolute bottom-10 right-10 max-w-[220px] text-right">
            <p className="font-serif text-4xl italic leading-none text-background">Marmor</p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-background/60">Volume 01</p>
          </div>
        </div>

        {/* Descend cue */}
        <a href="#shadow" className="absolute bottom-10 left-6 flex flex-col items-center gap-4 md:left-14">
          <div className="h-24 w-px bg-gradient-to-b from-foreground/50 to-transparent" />
          <span className="mt-2 rotate-90 text-[9px] uppercase tracking-[0.5em] text-foreground/45">
            Descend
          </span>
        </a>
      </section>

      {/* ───── 02 · THE SHADOW ROOM ─────────────────────────────
          Obsidian void. Sticky left column of narrative,
          asymmetric right column of floating objects. */}
      <section id="shadow" className="relative min-h-[120vh] overflow-hidden bg-foreground px-6 py-40 text-background md:px-14 md:py-48">
        <div className="grid grid-cols-12 items-start gap-8">
          <div className="col-span-12 md:col-span-4 md:col-start-2 md:sticky md:top-40">
            <div className="mb-8 flex items-center gap-4 text-[10px] uppercase tracking-[0.5em] text-background/40">
              <span className="h-px w-10 bg-background/40" />
              Chapter 002
            </div>
            <h2 className="font-serif text-6xl font-light italic leading-[0.95] tracking-tight md:text-8xl">
              The<br />Shadow<br />Palace
            </h2>
            <p className="mt-10 max-w-sm text-sm leading-loose tracking-widest text-background/60">
              In the absence of illumination, the object reveals its true form —
              a study in texture, weight, and the permanence of graphite.
            </p>
            <Link
              to="/designers"
              className="group mt-10 inline-flex items-center gap-4 border-b border-background/30 pb-2 text-[10px] font-semibold uppercase tracking-[0.4em] transition-all duration-700 hover:border-background"
            >
              Explore the Archiv
              <ArrowRight className="h-3 w-3 transition-transform duration-500 group-hover:translate-x-2" strokeWidth={1.4} />
            </Link>
          </div>

          <div className="col-span-12 md:col-span-6 md:col-start-7 space-y-[20vh]">
            {ordered[0] && (
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-accent shadow-2xl">
                <Link to={`/product/${ordered[0].slug}`} className="block h-full w-full">
                  <ProductImage seed={ordered[0].slug} className="h-full w-full grayscale contrast-125 transition-transform duration-[2000ms] hover:scale-105" />
                  <div className="pointer-events-none absolute right-6 top-6">
                    <span className="bg-background px-3 py-1 text-[10px] uppercase tracking-widest text-foreground">
                      Shadow No. 1
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-8 left-8 text-background">
                    <p className="font-serif text-3xl italic">{ordered[0].name}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.4em] opacity-70">{ordered[0].designer}</p>
                  </div>
                </Link>
              </div>
            )}


            {/* Monumental type bleed */}
            <div className="relative select-none">
              <span className="pointer-events-none absolute -left-[30%] -top-[10vh] whitespace-nowrap font-serif italic leading-none text-background/10"
                    style={{ fontSize: "22vw" }}>
                MONUMENTAL
              </span>
            </div>

            {ordered[1] && (
              <div className="relative ml-auto aspect-square w-4/5 overflow-hidden bg-secondary">
                <Link to={`/product/${ordered[1].slug}`} className="block h-full w-full">
                  <ProductImage seed={ordered[1].slug} className="h-full w-full grayscale mix-blend-multiply transition-transform duration-[2000ms] hover:scale-105" />
                  <div className="pointer-events-none absolute bottom-8 left-8 max-w-[220px] text-foreground">
                    <p className="font-serif text-2xl italic leading-tight">{ordered[1].name}</p>
                    <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.3em]">
                      {ordered[1].designer}
                    </p>
                  </div>
                </Link>
              </div>
            )}

          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-[10vw] -right-[10vw] h-[30vw] w-[30vw] rotate-45 border-l border-t border-background/10" />
      </section>

      {/* ───── 03 · THE HOUSES ─────────────────────────────
          Marble again. Wide grid of designers, plenty of air. */}
      <section id="houses" className="relative bg-background px-6 py-40 md:px-14 md:py-56">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid grid-cols-12 items-end gap-8">
            <div className="col-span-12 md:col-span-7 md:col-start-2">
              <p className="mb-8 text-[10px] uppercase tracking-[0.5em] text-foreground/50">Chapter 003 · The Houses</p>
              <h2 className="font-serif font-light leading-[0.9] tracking-[-0.02em]" style={{ fontSize: "clamp(3rem, 8vw, 8rem)" }}>
                The studios<br />we <span className="italic text-accent">collect.</span>
              </h2>
            </div>
            <div className="col-span-12 md:col-span-3 md:col-start-9">
              <Link to="/designers" className="group inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.4em]">
                View all houses
                <span className="inline-block h-px w-10 bg-foreground transition-all duration-700 group-hover:w-20" />
              </Link>
            </div>
          </div>

          <div className="mt-24 grid grid-cols-1 gap-x-8 gap-y-20 sm:grid-cols-2 lg:grid-cols-4">
            {designers.slice(0, 4).map((d) => (
              <DesignerCard key={d.slug} designer={d} />
            ))}
          </div>
        </div>
      </section>

      {/* ───── 04 · CURATION — the pull-forward gallery ─────── */}
      <section id="curation" className="relative bg-secondary/40 px-6 py-40 md:px-14 md:py-56">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-5">
              <p className="mb-8 text-[10px] uppercase tracking-[0.5em] text-foreground/50">
                Chapter 004 · {choice === "shadow" ? "Ordered by Shadow" : "Ordered by Light"}
              </p>
              <h2 className="font-serif italic font-light leading-[0.95] tracking-[-0.02em]" style={{ fontSize: "clamp(2.5rem, 6vw, 6rem)" }}>
                Worn by the<br />undecided<br />minority.
              </h2>
              {lastSaved && (
                <p className="mt-8 font-serif text-lg italic text-foreground/70">
                  Letzter Zug: <Link to={`/product/${lastSaved.slug}`} className="text-foreground underline-offset-4 hover:underline">{lastSaved.name}</Link>.
                </p>
              )}
            </div>
            <div className="col-span-12 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 md:col-span-7 md:col-start-6 lg:grid-cols-2">
              {ordered.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───── 05 · DNA FINALE — the pawn transforms ───────── */}
      <section id="dna" className="relative overflow-hidden bg-foreground px-6 py-40 text-background md:px-14 md:py-56">
        <div className="absolute inset-0 chess-grid-light opacity-20" aria-hidden />
        <div className="relative mx-auto grid max-w-[1600px] grid-cols-12 items-center gap-12">
          <div className="col-span-12 md:col-span-7 md:col-start-1">
            <p className="mb-8 text-[10px] uppercase tracking-[0.5em] text-background/40">Chapter 005 · Intelligence</p>
            <h2 className="font-serif font-light leading-[0.9] tracking-[-0.02em]" style={{ fontSize: "clamp(3rem, 8vw, 8rem)" }}>
              Der Bauer wird<br />zur <span className="italic">{shadow.label.toLowerCase()}</span>.
            </h2>
            <p className="mt-8 max-w-md font-serif text-xl italic text-background/70">
              Wenn du weiterziehst. Deine dominante Achse trägt {shadow.quality.toLowerCase()} —
              das ist die Figur, die aus dir wird.
            </p>
            <Link
              to="/dna"
              className="mt-12 inline-flex items-center gap-4 border border-background/40 px-8 py-4 text-[10px] uppercase tracking-[0.4em] transition-all duration-700 hover:bg-background hover:text-foreground"
            >
              Das Brett des Selbst
              <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
            </Link>
          </div>
          <div className="col-span-12 flex justify-center text-background/80 md:col-span-4 md:col-start-9">
            <DNAVisual className="h-[420px] w-auto" />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default Index;
