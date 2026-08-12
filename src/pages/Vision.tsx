/**
 * PAWNs Vision — die Seite, die erklärt, was für ein Ort PAWN ist.
 * PART 51 Teil A2: Erzählung statt Feature-Katalog, in fünf Teilen — Öffnung (der Bauer),
 * die Kette (Talent → ... → Transformation), was PAWN tut, die Haltung, der Schlusssatz
 * "PLAY YOUR OWN GAME." (erscheint bewusst nur hier, nirgends sonst als CTA oder im Produkt-UI).
 * Alle Texte hängen an site_content (Editable), damit sie ohne Code änderbar sind — mit
 * Ausnahme der beiden englischen Marken-Zeilen (Positionierungssatz, Schlusssatz), die wie
 * der Master-Slogan auf der Landing fest vorgegeben sind.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Editable } from "@/components/palace/Editable";
import { Reveal } from "@/components/palace/Reveal";
import { supabase } from "@/integrations/supabase/client";

interface Zaehler {
  haeuser: number;
  laender: number;
}

const KETTE = ["Talent", "Ausdruck", "Sichtbarkeit", "Bewegung", "Identität", "Transformation"];

function Zahl({ wert, label, geladen }: { wert: number; label: string; geladen: boolean }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-serif text-[clamp(3rem,9vw,6rem)] leading-none text-black">
        {geladen ? wert : "—"}
      </p>
      <p className="mt-4 text-[0.6rem] uppercase tracking-[0.42em] text-black">{label}</p>
    </div>
  );
}

export default function Vision() {
  const [zaehler, setZaehler] = useState<Zaehler>({ haeuser: 0, laender: 0 });
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const { data } = await supabase
        .from("designers")
        .select("country")
        .eq("published", true);
      if (abgebrochen) return;
      const rows = (data ?? []) as Array<{ country: string | null }>;
      const laender = new Set(
        rows.map((r) => (r.country ?? "").trim()).filter((c) => c.length > 0),
      );
      setZaehler({ haeuser: rows.length, laender: laender.size });
      setGeladen(true);
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  return (
    <PalaceLayout
      title="PAWNs Vision — der Bauer, der sich verwandeln kann"
      description="Wofür PAWN steht: ein kuratiertes Haus, in dem sich unabhängige Gestalter aus Mode, Interior und Kunst versammeln — und Menschen sie finden."
    >
      {/* 01 ÖFFNUNG — der Bauer */}
      <section className="border-b-[1.5px] border-black px-6 pb-20 pt-24 md:px-14 md:pb-28 md:pt-32">
        <Reveal>
          <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
            <Editable contentKey="vision_kicker">PAWNs Vision</Editable>
          </p>
          <h1 className="mt-8 max-w-[22ch] font-serif text-[clamp(2.4rem,7vw,6.4rem)] font-semibold leading-[1.02] text-black">
            <Editable contentKey="vision_headline" multiline>
              Der Bauer ist die kleinste Figur auf dem Brett — und die einzige, die sich verwandeln kann.
            </Editable>
          </h1>
        </Reveal>
      </section>

      {/* 02 DIE KETTE */}
      <section className="border-b-[1.5px] border-black px-6 py-14 md:px-14 md:py-20">
        <Reveal>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            {KETTE.map((glied, i) => (
              <span key={glied} className="flex items-baseline gap-4">
                <span className="font-serif text-[clamp(1.3rem,3.2vw,2.2rem)] italic leading-tight text-black">
                  {glied}
                </span>
                {i < KETTE.length - 1 && (
                  <span aria-hidden className="text-[1.1rem] text-black/40">→</span>
                )}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 03 WAS PAWN TUT */}
      <section className="grid border-b-[1.5px] border-black md:grid-cols-[minmax(0,22ch)_1fr]">
        <div className="border-b-[1.5px] border-black px-6 py-8 md:border-b-0 md:border-r-[1.5px] md:px-14 md:py-16">
          <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
            <Editable contentKey="vision_tut_label">Was PAWN tut</Editable>
          </p>
        </div>
        <div className="px-6 py-10 md:px-14 md:py-16">
          <Reveal>
            <p className="max-w-[52ch] font-serif text-[clamp(1.15rem,2.2vw,1.5rem)] italic leading-[1.4] text-black">
              PAWN turns creative potential into real-world opportunity.
            </p>
            <p className="mt-6 max-w-[62ch] text-[1rem] leading-relaxed text-black md:text-[1.1rem]">
              <Editable contentKey="vision_tut_text" multiline>
                PAWN erkennt, was in einer Arbeit steckt, kuratiert die stärksten Stimmen aus Mode,
                Interior und Kunst und entwickelt ihre Sichtbarkeit über Zeit — statt sie für einen
                Moment im Feed verschwinden zu lassen. Am Ende verbindet PAWN sie mit den Menschen,
                die genau danach gesucht haben.
              </Editable>
            </p>
          </Reveal>
        </div>
      </section>

      {/* 04 HALTUNG */}
      <section className="border-b-[1.5px] border-black px-6 py-16 text-center md:px-14 md:py-24">
        <Reveal>
          <p className="mx-auto max-w-[36ch] font-serif text-[clamp(1.5rem,3.6vw,2.6rem)] italic leading-[1.4] text-black">
            PAWN sagt nie: Wir machen dich zum Künstler.
            <br />
            PAWN sagt: Du bist dran.
          </p>
        </Reveal>
      </section>

      {/* Zwei Wege weiter */}
      <section className="grid border-b-[1.5px] border-black md:grid-cols-2">
        <div className="border-b-[1.5px] border-black px-6 py-14 md:border-b-0 md:border-r-[1.5px] md:px-14 md:py-20">
          <Reveal>
            <Link
              to="/apply"
              className="inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
            >
              <Editable contentKey="vision_cta_designer">Werde Teil davon</Editable>
            </Link>
          </Reveal>
        </div>
        <div className="px-6 py-14 md:px-14 md:py-20">
          <Reveal>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
              >
                <Editable contentKey="vision_cta_shop">Ausstellung ansehen</Editable>
              </Link>
              <Link
                to="/dna"
                className="inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
              >
                <Editable contentKey="vision_cta_dna">Deine DNA</Editable>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Welten */}
      <section className="grid border-b-[1.5px] border-black md:grid-cols-3">
        {[
          { label: "Mode", to: "/mode" },
          { label: "Interior", to: "/interior" },
          { label: "Kunst", to: "/kunst" },
        ].map((w, i) => (
          <Link
            key={w.to}
            to={w.to}
            className={`group border-black px-6 py-14 text-center transition-colors hover:bg-black md:px-14 ${
              i > 0 ? "border-t-[1.5px] md:border-l-[1.5px] md:border-t-0" : ""
            }`}
          >
            <span className="font-serif text-[clamp(1.8rem,4vw,3rem)] text-black transition-colors group-hover:text-white">
              {w.label}
            </span>
          </Link>
        ))}
      </section>

      {/* Zähler */}
      <section className="border-b-[1.5px] border-black px-0 py-4">
        <div className="px-6 pt-10 text-center md:px-14">
          <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
            <Editable contentKey="vision_zaehler_label">Das Haus heute</Editable>
          </p>
        </div>
        <div className="mx-auto mt-8 grid max-w-[1200px] grid-cols-1 border-y-[1.5px] border-black sm:grid-cols-3">
          <Zahl wert={zaehler.haeuser} label="Häuser" geladen={geladen} />
          <div className="border-y-[1.5px] border-black sm:border-x-[1.5px] sm:border-y-0">
            <Zahl wert={zaehler.laender} label="Länder" geladen={geladen} />
          </div>
          <Zahl wert={3} label="Welten" geladen />
        </div>
        <p className="px-6 py-10 text-center text-[0.85rem] text-black md:px-14">
          {geladen && zaehler.haeuser < 5 ? (
            <Editable contentKey="vision_zaehler_anfang">Die ersten Häuser ziehen ein.</Editable>
          ) : (
            <Editable contentKey="vision_zaehler_wachstum">Und es werden mehr.</Editable>
          )}
        </p>
      </section>

      {/* 05 SCHLUSSSATZ — steht allein, nie als CTA */}
      <section className="px-6 py-24 text-center md:px-14 md:py-36">
        <p className="font-serif text-[clamp(1.8rem,5.5vw,4rem)] font-semibold italic tracking-[-0.02em] text-black">
          PLAY YOUR OWN GAME.
        </p>
      </section>
    </PalaceLayout>
  );
}
