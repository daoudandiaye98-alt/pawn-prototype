import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { PageLabel } from "@/components/pawn/PageLabel";
import { PawnMark } from "@/components/pawn/PawnMark";
import { ChessDivider, ChapterLabel } from "@/components/pawn/ChessDivider";
import { DNAVisual } from "@/components/pawn/DNAVisual";
import { useStore, marketplaceSelectors, selectors, useCommand, commands, defaultIdentityId } from "@/core";
import { Button } from "@/components/ui/button";
import { readFirstChoice, writeFirstChoice, readLastSeen, writeLastSeen, isReturningVisit } from "@/features/os/lastSeen";
import { useRoomShift } from "@/features/os/roomShift";

/**
 * Home is not a landing page. It is the door.
 * A first-time visitor is asked, not sold to. A returning visitor is acknowledged.
 * Every subsequent visit is a re-projection of the same identity.
 */
const Index = () => {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
  const identity = useStore((s) => selectors.getIdentity(s, defaultIdentityId));
  const dispatch = useCommand();
  const { push } = useRoomShift();

  const [choice, setChoice] = useState<"light" | "shadow" | null>(() => readFirstChoice());
  const [justChose, setJustChose] = useState(false);

  // M4 — return acknowledgement (runs once per mount)
  useEffect(() => {
    const prev = readLastSeen();
    if (isReturningVisit(prev)) {
      push("Willkommen zurück. Es hat sich etwas verschoben.");
    }
    writeLastSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // M3 — the room remembers what was last saved
  const lastSaved = useMemo(() => {
    const savedIds = identity?.wardrobe.saved ?? [];
    if (savedIds.length === 0) return null;
    const id = savedIds[savedIds.length - 1] as string;
    return products.find((p) => p.id === id) ?? null;
  }, [identity, products]);

  // M1/M2 — first choice recomposes the room without a reload
  function makeChoice(pick: "light" | "shadow") {
    writeFirstChoice(pick);
    setChoice(pick);
    setJustChose(true);
    // Shift the genome so recommendations actually change.
    if (identity) {
      const to = pick === "shadow"
        ? { darkness: Math.min(1, identity.dna.genome.darkness + 0.15), edge: Math.min(1, identity.dna.genome.edge + 0.1) }
        : { structure: Math.min(1, identity.dna.genome.structure + 0.15), elegance: Math.min(1, identity.dna.genome.elegance + 0.1) };
      const r = dispatch(commands.proposeMutation, {
        identityId: defaultIdentityId,
        to,
        rationale: pick === "shadow" ? "Chose shadow at entry." : "Chose light at entry.",
      });
      if (r.ok) {
        const proposedEvent = r.events.find((e) => e.type === "mutation.proposed");
        const proposedId = proposedEvent && "payload" in proposedEvent && proposedEvent.payload && "mutation" in proposedEvent.payload
          ? (proposedEvent.payload as { mutation: { id: string } }).mutation.id
          : null;
        if (proposedId) {
          dispatch(commands.ratifyMutation, { identityId: defaultIdentityId, mutationId: proposedId as never });
        }
      }
    }
    push(pick === "shadow" ? "Weil du Schatten gewählt hast." : "Weil du Licht gewählt hast.");
  }

  // The pre-choice door — replaces the hero on first visit only
  if (!choice) {
    return (
      <PublicLayout>
        <FirstVisitDoor onChoose={makeChoice} />
      </PublicLayout>
    );
  }

  // Order recommendations by chosen polarity so the room *is* the difference.
  const ordered = choice === "shadow"
    ? [...products].sort((a, b) => (b.genomeAffinity?.darkness ?? 0) - (a.genomeAffinity?.darkness ?? 0))
    : [...products].sort((a, b) => (b.genomeAffinity?.structure ?? 0) - (a.genomeAffinity?.structure ?? 0));

  return (
    <PublicLayout>
      {/* HERO — chess polarity, but the chosen side leads */}
      <section className="relative">
        <div className="relative grid min-h-[680px] grid-cols-1 md:grid-cols-2">
          <article className={`${choice === "light" ? "paper-panel" : "ivory-surface"} relative flex flex-col justify-between p-10 md:p-16`}>
            <PageLabel index="01">Light</PageLabel>
            <div>
              <h1 className="font-serif text-[3rem] leading-[0.92] md:text-[5.8rem]">
                INNOCENCE
                <br /> IS A CHOICE.
              </h1>
              <Link to="/shop" className="mt-10 inline-flex items-center gap-3 border-b border-foreground pb-1 text-[0.7rem] uppercase tracking-[0.28em]">
                Enter <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
              </Link>
            </div>
            <span className="text-[0.6rem] uppercase tracking-[0.32em] text-foreground/55">PAWN · White</span>
          </article>

          <article className="ink-panel relative flex flex-col justify-between p-10 md:p-16">
            <PageLabel index="02" className="text-primary-foreground/70">Shadow</PageLabel>
            <div>
              <h1 className="font-serif text-[3rem] leading-[0.92] md:text-[5.8rem] text-primary-foreground">
                AMBITION
                <br /> IS POWER.
              </h1>
              <Link to="/shop" className="mt-10 inline-flex items-center gap-3 border-b border-primary-foreground pb-1 text-[0.7rem] uppercase tracking-[0.28em] text-primary-foreground">
                Enter <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
              </Link>
            </div>
            <span className="text-[0.6rem] uppercase tracking-[0.32em] text-primary-foreground/45">PAWN · Black</span>
          </article>

          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-foreground/20 bg-background">
              <PawnMark className="h-12 w-12 text-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* M3 — the room remembers */}
      {lastSaved && (
        <section className="ivory-surface border-y border-foreground/10">
          <div className="editorial-container flex items-center justify-between gap-6 py-4">
            <p className="font-cormorant text-[0.95rem] italic tracking-wide text-foreground/70">
              Zuletzt gespeichert: <span className="text-foreground">{lastSaved.name}</span>. Der Raum hat sich leicht verschoben.
            </p>
            <Link to={`/product/${lastSaved.slug}`} className="text-[0.65rem] uppercase tracking-[0.28em] underline-offset-4 hover:underline">
              Ansehen →
            </Link>
          </div>
        </section>
      )}

      <ChessDivider label="The Houses" />

      <section className="bone-surface pb-24">
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading eyebrow="01 — Featured Houses" title={<>The studios<br />we collect.</>} />
            <Link to="/designers" className="hidden whitespace-nowrap text-[0.7rem] uppercase tracking-[0.26em] underline-offset-4 hover:underline md:inline">
              View all →
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {designers.slice(0, 4).map((d) => <DesignerCard key={d.slug} designer={d} />)}
          </div>
        </div>
      </section>

      <ChessDivider label="The Pieces" />

      {/* Ordered by the chosen polarity — the visible proof of M2 */}
      <section className={`${justChose ? "animate-fade-up" : ""} paper-surface py-24`}>
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading
              eyebrow={choice === "shadow" ? "02 — Ordered by Shadow" : "02 — Ordered by Light"}
              title={<>Worn by the<br />undecided minority.</>}
            />
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.slice(0, 6).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>

      <section className="relative ink-panel overflow-hidden">
        <div className="absolute inset-0 chess-grid-light opacity-40" aria-hidden />
        <div className="editorial-container relative grid items-center gap-12 py-24 md:grid-cols-[1.2fr_0.9fr]">
          <div>
            <ChapterLabel index="03" invert>Intelligence</ChapterLabel>
            <h2 className="mt-7 font-serif text-5xl leading-[0.95] md:text-7xl text-primary-foreground">
              PAWN is not a shop.
              <br />It is a system.
            </h2>
            <div className="mt-10">
              <Button asChild size="lg" className="rounded-none bg-primary-foreground px-8 text-primary hover:bg-primary-foreground/90">
                <Link to="/dna">Open your DNA dossier</Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center text-primary-foreground/80">
            <DNAVisual className="h-[360px] w-auto" />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

/**
 * The door. No headline that describes PAWN. One question. Two rooms.
 * The choice IS the entry.
 */
function FirstVisitDoor({ onChoose }: { onChoose: (pick: "light" | "shadow") => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 1000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="relative min-h-[calc(100vh-72px)]">
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-1 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onChoose("light")}
          className="paper-panel group relative flex items-end justify-start p-10 text-left transition-colors hover:bg-[hsl(var(--paper))]/95 md:p-20"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.34em] text-foreground/50">I</p>
            <p className="mt-6 font-serif text-5xl leading-[0.95] md:text-7xl">Light.</p>
            <p className="mt-6 max-w-xs font-cormorant text-lg italic text-foreground/60 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
              Structure. Restraint. A room drawn in white.
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChoose("shadow")}
          className="ink-panel group relative flex items-end justify-start p-10 text-left transition-colors hover:bg-[hsl(var(--ink))]/95 md:p-20"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.34em] text-primary-foreground/50">II</p>
            <p className="mt-6 font-serif text-5xl leading-[0.95] md:text-7xl text-primary-foreground">Shadow.</p>
            <p className="mt-6 max-w-xs font-cormorant text-lg italic text-primary-foreground/60 opacity-0 transition-opacity duration-700 group-hover:opacity-100">
              Instinct. Edge. A room drawn in black.
            </p>
          </div>
        </button>
      </div>
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center transition-opacity duration-1000 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-foreground/20 bg-background">
          <PawnMark className="h-10 w-10 text-foreground" />
        </div>
        <p className="mt-6 font-cormorant text-xl italic text-foreground/70">Wähle einen Raum.</p>
      </div>
    </section>
  );
}

export default Index;
