import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/pawn/PublicLayout";
import { ProductCard } from "@/components/pawn/ProductCard";
import { DesignerCard } from "@/components/pawn/DesignerCard";
import { SectionHeading } from "@/components/pawn/SectionHeading";
import { PawnMark } from "@/components/pawn/PawnMark";
import { ChessDivider, ChapterLabel } from "@/components/pawn/ChessDivider";
import { DNAVisual } from "@/components/pawn/DNAVisual";
import { useStore, marketplaceSelectors, selectors, useCommand, commands, defaultIdentityId } from "@/core";
import { Button } from "@/components/ui/button";
import { readFirstChoice, writeFirstChoice, readLastSeen, writeLastSeen, isReturningVisit } from "@/features/os/lastSeen";
import { useRoomShift } from "@/features/os/roomShift";
import { useRank, useMoves, usePieceShadow } from "@/features/narrative/hooks";
import { moveNotation } from "@/features/narrative";

/**
 * Home — die Eröffnung.
 * Ein Bauer steht auf dem Brett. Der Nutzer macht den ersten Zug.
 * Jede Section darunter ist ein Rang, den der Bauer bereits erreicht hat.
 */
const Index = () => {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const designers = useStore(marketplaceSelectors.getAllDesignerViews);
  const identity = useStore((s) => selectors.getIdentity(s, defaultIdentityId));
  const rank = useRank();
  const moves = useMoves();
  const shadow = usePieceShadow();
  const dispatch = useCommand();
  const { push } = useRoomShift();

  const [choice, setChoice] = useState<"light" | "shadow" | null>(() => readFirstChoice());
  const [justChose, setJustChose] = useState(false);

  useEffect(() => {
    const prev = readLastSeen();
    if (isReturningVisit(prev)) {
      push("Die Partie ruht. Es liegt an dir.");
    }
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
    setJustChose(true);
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
        const proposedEvent = r.events.find((e) => e.type === "mutation.proposed");
        const proposedId = proposedEvent && "payload" in proposedEvent && proposedEvent.payload && "mutation" in proposedEvent.payload
          ? (proposedEvent.payload as { mutation: { id: string } }).mutation.id
          : null;
        if (proposedId) {
          dispatch(commands.ratifyMutation, { identityId: defaultIdentityId, mutationId: proposedId as never });
        }
      }
    }
    push(pick === "shadow" ? "1. Schatten. Der Bauer zieht nach vorn." : "1. Licht. Der Bauer zieht nach vorn.");
  }

  // Erste Begegnung: nur das Tor.
  if (!choice) {
    return (
      <PublicLayout>
        <FirstVisitDoor onChoose={makeChoice} />
      </PublicLayout>
    );
  }

  const ordered = choice === "shadow"
    ? [...products].sort((a, b) => (b.genomeAffinity?.darkness ?? 0) - (a.genomeAffinity?.darkness ?? 0))
    : [...products].sort((a, b) => (b.genomeAffinity?.structure ?? 0) - (a.genomeAffinity?.structure ?? 0));

  // Der nicht gespielte Zug bleibt sichtbar — als schmaler Streifen.
  const chosenIsLight = choice === "light";

  return (
    <PublicLayout>
      {/* HERO — der gewählte Zug dominiert, der andere bleibt Rand */}
      <section className="relative">
        <div
          className="relative grid min-h-[680px] grid-cols-[64px_1fr] md:grid-cols-[80px_1fr]"
          style={{ direction: chosenIsLight ? "ltr" : "rtl" }}
        >
          {/* Der nicht-gespielte Zug — schmaler Streifen, klickbar */}
          <button
            type="button"
            onClick={() => makeChoice(chosenIsLight ? "shadow" : "light")}
            className={`${chosenIsLight ? "ink-panel" : "paper-panel"} group relative flex flex-col items-center justify-between py-8 text-center transition-opacity hover:opacity-90`}
            style={{ direction: "ltr" }}
            aria-label={chosenIsLight ? "Zurück zum Schatten" : "Zurück zum Licht"}
          >
            <span className={`text-[0.55rem] uppercase tracking-[0.3em] ${chosenIsLight ? "text-primary-foreground/50" : "text-foreground/50"}`}>
              {chosenIsLight ? "II" : "I"}
            </span>
            <span
              className={`writing-vertical font-cormorant text-sm italic ${chosenIsLight ? "text-primary-foreground/60" : "text-foreground/60"}`}
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {chosenIsLight ? "Der Schatten wartet." : "Das Licht wartet."}
            </span>
            <span className={`text-[0.55rem] uppercase tracking-[0.3em] ${chosenIsLight ? "text-primary-foreground/40" : "text-foreground/40"}`}>
              ↻
            </span>
          </button>

          {/* Der gewählte Zug — der Raum, der jetzt zählt */}
          <article
            className={`${chosenIsLight ? "paper-panel" : "ink-panel"} relative flex flex-col justify-between p-10 md:p-16`}
            style={{ direction: "ltr" }}
          >
            <div className={`flex items-center gap-3 text-[0.6rem] uppercase tracking-[0.32em] ${chosenIsLight ? "text-foreground/55" : "text-primary-foreground/55"}`}>
              <span className="pawn-numeral text-[0.85rem]">{chosenIsLight ? "1. e4" : "1. …e5"}</span>
              <span className={`h-px w-6 ${chosenIsLight ? "bg-foreground/30" : "bg-primary-foreground/30"}`} />
              <span>{chosenIsLight ? "Licht" : "Schatten"}</span>
            </div>
            <div>
              <h1 className={`font-serif text-[3rem] leading-[0.92] md:text-[5.8rem] ${chosenIsLight ? "" : "text-primary-foreground"}`}>
                {chosenIsLight ? <>INNOCENCE<br /> IS A CHOICE.</> : <>AMBITION<br /> IS POWER.</>}
              </h1>
              <Link
                to="/shop"
                className={`mt-10 inline-flex items-center gap-3 border-b pb-1 text-[0.7rem] uppercase tracking-[0.28em] ${chosenIsLight ? "border-foreground" : "border-primary-foreground text-primary-foreground"}`}
              >
                Enter <ArrowRight className="h-3 w-3" strokeWidth={1.4} />
              </Link>
            </div>
            <span className={`text-[0.6rem] uppercase tracking-[0.32em] ${chosenIsLight ? "text-foreground/55" : "text-primary-foreground/45"}`}>
              PAWN · Rang {rank.rank} / 8
            </span>
          </article>

          {/* Die Figur — bewegt sich nach der Wahl sichtbar in Richtung des gewählten Zugs */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div
              className={`relative flex h-28 w-28 items-center justify-center rounded-full border border-foreground/20 bg-background transition-transform duration-700 ease-out ${justChose ? (chosenIsLight ? "-translate-x-12" : "translate-x-12") : ""}`}
            >
              <PawnMark className="h-12 w-12 text-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* M3 — die Notiz des letzten Zugs */}
      {lastSaved && (
        <section className="ivory-surface border-y border-foreground/10">
          <div className="editorial-container flex items-center justify-between gap-6 py-4">
            <p className="font-cormorant text-[0.95rem] italic tracking-wide text-foreground/70">
              Letzter Zug: <span className="text-foreground">{lastSaved.name}</span>. {moves.total} von 16 gespielt.
            </p>
            <Link to={`/product/${lastSaved.slug}`} className="text-[0.65rem] uppercase tracking-[0.28em] underline-offset-4 hover:underline">
              Ansehen →
            </Link>
          </div>
        </section>
      )}

      <ChessDivider rank={Math.max(1, rank.rank)} />

      <section className="bone-surface pb-24">
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading eyebrow="The Houses" title={<>The studios<br />we collect.</>} />
            <Link to="/designers" className="hidden whitespace-nowrap text-[0.7rem] uppercase tracking-[0.26em] underline-offset-4 hover:underline md:inline">
              View all →
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
            {designers.slice(0, 4).map((d) => <DesignerCard key={d.slug} designer={d} />)}
          </div>
        </div>
      </section>

      <ChessDivider rank={Math.max(2, rank.rank)} />

      <section className={`${justChose ? "animate-fade-up" : ""} paper-surface py-24`}>
        <div className="editorial-container">
          <div className="flex items-end justify-between gap-6">
            <SectionHeading
              eyebrow={choice === "shadow" ? "Ordered by Shadow" : "Ordered by Light"}
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
              Der Bauer wird zur {shadow.label}.
              <br />Wenn du weiterziehst.
            </h2>
            <p className="mt-6 max-w-md font-cormorant text-lg italic text-primary-foreground/70">
              Deine dominante Achse trägt {shadow.quality.toLowerCase()}. Das ist die Figur, die aus dir wird.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="rounded-none bg-primary-foreground px-8 text-primary hover:bg-primary-foreground/90">
                <Link to="/dna">Das Brett des Selbst</Link>
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
 * Die Eröffnung. Kein Titel. Zwei Felder. Ein Bauer in der Mitte, der wartet.
 * Der erste Klick ist der erste Zug.
 */
function FirstVisitDoor({ onChoose }: { onChoose: (pick: "light" | "shadow") => void }) {
  const [visible, setVisible] = useState(false);
  const [moving, setMoving] = useState<"light" | "shadow" | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 800);
    return () => window.clearTimeout(t);
  }, []);

  function handle(pick: "light" | "shadow") {
    setMoving(pick);
    window.setTimeout(() => onChoose(pick), 350);
  }

  return (
    <section className="relative min-h-[calc(100vh-72px)]">
      <div className="grid min-h-[calc(100vh-72px)] grid-cols-2">
        <button
          type="button"
          onClick={() => handle("light")}
          disabled={moving !== null}
          className="paper-panel group relative flex items-end justify-start p-10 text-left transition-colors hover:bg-[hsl(var(--paper))]/95 md:p-20"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.34em] text-foreground/50">I</p>
            <p className="mt-6 font-serif text-5xl leading-[0.95] md:text-7xl">Licht.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => handle("shadow")}
          disabled={moving !== null}
          className="ink-panel group relative flex items-end justify-start p-10 text-left transition-colors hover:bg-[hsl(var(--ink))]/95 md:p-20"
        >
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.34em] text-primary-foreground/50">II</p>
            <p className="mt-6 font-serif text-5xl leading-[0.95] md:text-7xl text-primary-foreground">Schatten.</p>
          </div>
        </button>
      </div>

      {/* Der Bauer — steht in der Mitte, zieht bei der Wahl */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-500 ease-out ${visible ? "opacity-100" : "opacity-0"} ${moving === "light" ? "-translate-x-[calc(50%+120px)]" : ""} ${moving === "shadow" ? "translate-x-[calc(-50%+120px)]" : ""}`}
      >
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-foreground/20 bg-background">
          <PawnMark className="h-10 w-10 text-foreground" />
        </div>
        <p className="mt-6 font-cormorant text-xl italic text-foreground/70">
          Weiß beginnt. Dein erster Zug.
        </p>
      </div>
    </section>
  );
}

export default Index;
