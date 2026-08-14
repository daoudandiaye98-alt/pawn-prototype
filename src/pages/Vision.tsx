/**
 * PAWNs Vision — TEIL R: vollständig neuer Text.
 *
 * Der Wortlaut ist verbindlich und ersetzt alles, was vorher auf dieser Seite
 * stand (auch die Passagen aus Teil P). Deshalb hängt der gesamte Fließtext an
 * i18n und nicht mehr an `site_content`: was wörtlich vorgegeben ist, soll nicht
 * versehentlich im Admin überschrieben werden. Die alten `vision_*`-Schlüssel
 * werden von dieser Seite nicht mehr gelesen.
 *
 * Rhythmus: die Absätze sind kurz, das ist Absicht. Im i18n-Text bedeutet eine
 * Leerzeile einen neuen Absatz, ein einfacher Zeilenumbruch eine eigene Zeile
 * innerhalb desselben Blocks. `Fliesstext` rendert genau das — nichts wird zu
 * Blöcken zusammengezogen.
 *
 * Englische Zeilen (Epigraphe, PLAY YOUR OWN GAME, MAKE YOUR MOVE) stehen als
 * Konstanten im Code und NICHT im Wörterbuch. Sie sollen in beiden Sprach-
 * fassungen englisch bleiben; läge je Sprache ein eigener Eintrag vor, könnte
 * die englische Fassung eines Tages übersetzt werden. Eine Konstante kann das
 * nicht.
 *
 * Genau ein CTA auf der ganzen Seite, ganz am Ende.
 */
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { useI18n } from "@/lib/i18n";

/** Nie übersetzt — in beiden Sprachfassungen englisch. */
const EPIGRAPH = {
  vision_1: "Culture moves fast.",
  vision_2: "PAWN gives what matters a place to grow.",
  tut: "PAWN turns creative potential into cultural presence.",
  spielfeld: "PAWN is where independent creativity meets opportunity.",
  halle: "Every number tells a story.",
} as const;
const SCHLUSSZEILE = "PLAY YOUR OWN GAME.";
const CTA = "MAKE YOUR MOVE";

/**
 * Der Fließtext. Leerzeile = neuer Absatz (großer Abstand),
 * einfacher Umbruch = eigene Zeile im selben Absatz (kleiner Abstand).
 * Zeilenlänge höchstens ~62 Zeichen.
 */
function Fliesstext({ text }: { text: string }) {
  const absaetze = text.split("\n\n");
  return (
    <div className="max-w-[62ch] space-y-6">
      {absaetze.map((absatz, i) => (
        <p key={i} className="text-[1rem] leading-[1.75] text-black md:text-[1.1rem]">
          {absatz.split("\n").map((zeile, j, alle) => (
            <span key={j}>
              {zeile}
              {j < alle.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

/** Ein Epigraph: groß, Playfair kursiv, allein stehend, viel Luft darum. */
function Epigraph({ children }: { children: string }) {
  return (
    <p className="my-10 max-w-[24ch] font-serif text-[clamp(1.5rem,3.4vw,2.4rem)] italic leading-[1.3] text-black md:my-14">
      {children}
    </p>
  );
}

/** Eine Sektion im Kapitel-Rhythmus: kleines Label links, Text rechts. */
function Sektion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid border-b-[1.5px] border-black md:grid-cols-[minmax(0,22ch)_1fr]">
      <div className="border-b-[1.5px] border-black px-6 py-8 md:border-b-0 md:border-r-[1.5px] md:px-14 md:py-16">
        <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">{label}</p>
      </div>
      <div className="px-6 py-10 md:px-14 md:py-16">
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}

export default function Vision() {
  const { t } = useI18n();

  return (
    <PalaceLayout
      title="PAWNs Vision — der Bauer, der sich verwandeln kann"
      description="Wofür PAWN steht: ein kuratierter Ort für unabhängige Kreative aus Fashion, Art und Interior — und für die Menschen, die sie suchen."
    >
      {/* 01 DIE VISION */}
      <Sektion label={t("vision.vision.label")}>
        <Epigraph>{EPIGRAPH.vision_1}</Epigraph>
        <Epigraph>{EPIGRAPH.vision_2}</Epigraph>
        <Fliesstext text={t("vision.vision.body")} />
      </Sektion>

      {/* 02 WAS WIR SEHEN — mit Pfeilzeile und Zitat */}
      <Sektion label={t("vision.sehen.label")}>
        <Fliesstext text={t("vision.sehen.body1")} />

        {/* Die Pfeilzeile: stille Hairline-Zeile, kein zweiter Hero. */}
        <div className="my-10 max-w-[62ch] border-y-[1.5px] border-black/15 py-4">
          <p className="font-serif text-[0.85rem] italic leading-relaxed text-black/55 md:text-[0.9rem]">
            {t("vision.sehen.kette")}
          </p>
        </div>

        <Fliesstext text={t("vision.sehen.body2")} />

        <blockquote className="my-12 border-y-[1.5px] border-black px-2 py-10 text-center md:my-16 md:py-14">
          <p className="mx-auto max-w-[40ch] font-serif text-[clamp(1.25rem,2.8vw,1.9rem)] italic leading-[1.4] text-black">
            {t("vision.sehen.zitat")}
          </p>
        </blockquote>

        <Fliesstext text={t("vision.sehen.body3")} />
      </Sektion>

      {/* 03 WAS WIR GLAUBEN */}
      <Sektion label={t("vision.glauben.label")}>
        <Fliesstext text={t("vision.glauben.body")} />
      </Sektion>

      {/* 04 WAS PAWN TUT */}
      <Sektion label={t("vision.tut.label")}>
        <Epigraph>{EPIGRAPH.tut}</Epigraph>
        <Fliesstext text={t("vision.tut.body")} />
      </Sektion>

      {/* 05 DAS NEUE SPIELFELD */}
      <Sektion label={t("vision.spielfeld.label")}>
        <Epigraph>{EPIGRAPH.spielfeld}</Epigraph>
        <Fliesstext text={t("vision.spielfeld.body")} />
      </Sektion>

      {/* 06 DIE HALLE WÄCHST */}
      <Sektion label={t("vision.halle.label")}>
        <Epigraph>{EPIGRAPH.halle}</Epigraph>
        <Fliesstext text={t("vision.halle.body")} />
      </Sektion>

      {/* 07 SCHLUSS — zwei allein stehende Zeilen, drei kurze Sätze, ein CTA */}
      <section className="px-6 py-24 text-center md:px-14 md:py-36">
        <Reveal>
          <p className="mx-auto max-w-[26ch] font-serif text-[clamp(1.6rem,4.4vw,3.2rem)] font-semibold leading-[1.15] text-black">
            {t("vision.schluss.bauer")}
          </p>

          <p className="mx-auto mt-20 font-serif text-[clamp(1.8rem,5.5vw,4rem)] font-semibold italic tracking-[-0.02em] text-black md:mt-28">
            {SCHLUSSZEILE}
          </p>

          <div className="mx-auto mt-20 flex max-w-[62ch] flex-col items-center gap-6 md:mt-28">
            {t("vision.schluss.body").split("\n\n").map((zeile, i) => (
              <p key={i} className="text-[1rem] leading-[1.75] text-black md:text-[1.1rem]">{zeile}</p>
            ))}
          </div>

          <Link
            to="/start"
            className="mt-16 inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white md:mt-20"
          >
            {CTA}
          </Link>
        </Reveal>
      </section>
    </PalaceLayout>
  );
}
