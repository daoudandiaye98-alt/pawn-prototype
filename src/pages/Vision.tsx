/**
 * PAWNs Vision — die Seite, die erklärt, was für ein Ort PAWN ist.
 * Kein Wort über Geld oder Konditionen: Haltung, Einladung, Versammlung.
 * Alle Texte hängen an site_content (Editable), damit sie ohne Code änderbar sind.
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

const BELIEFS: ReadonlyArray<{ key: string; titel: string; text: string }> = [
  {
    key: "haus_kein_feed",
    titel: "Ein Haus für jede Arbeit",
    text: "Jede Arbeit bekommt Raum, Licht und Zeit — so viel, wie sie braucht, um wirken zu können.",
  },
  {
    key: "herkunft",
    titel: "Jedes Stück hat eine Herkunft",
    text: "Wer es gemacht hat, woraus und warum: bei uns steht das direkt daneben.",
  },
  {
    key: "wenige",
    titel: "Ausgewählt, um zu bleiben",
    text: "Wir kuratieren. Was hier einzieht, soll bleiben und über Jahre getragen, bewohnt, angesehen werden.",
  },
  {
    key: "handschrift",
    titel: "Die Handschrift gehört den Häusern",
    text: "PAWN stellt Werkzeuge bereit. Die Sprache, die Bilder, die Richtung kommen von den Gestaltern selbst.",
  },
];

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
      title="PAWNs Vision — ein Ort für die, die noch selbst machen"
      description="Wofür PAWN steht: ein kuratiertes Haus, in dem sich unabhängige Gestalter aus Mode, Interior und Kunst versammeln — und Menschen sie finden."
    >
      {/* Manifest */}
      <section className="border-b-[1.5px] border-black px-6 pb-20 pt-24 md:px-14 md:pb-28 md:pt-32">
        <Reveal>
          <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
            <Editable contentKey="vision_kicker">PAWNs Vision</Editable>
          </p>
          <h1 className="mt-8 max-w-[18ch] font-serif text-[clamp(2.6rem,8vw,7rem)] font-semibold leading-[0.95] text-black">
            <Editable contentKey="vision_headline">Ein Ort für die, die noch selbst machen.</Editable>
          </h1>
          <p className="mt-8 max-w-[52ch] text-[1rem] leading-relaxed text-black md:text-[1.15rem]">
            <Editable contentKey="vision_sub" multiline>
              PAWN ist ein Haus für unabhängige Gestalter aus Mode, Interior und Kunst — und für
              Menschen, die wissen wollen, wessen Hände hinter einem Stück stehen.
            </Editable>
          </p>
        </Reveal>
      </section>

      {/* Warum es uns gibt */}
      <section className="grid border-b-[1.5px] border-black md:grid-cols-[minmax(0,22ch)_1fr]">
        <div className="border-b-[1.5px] border-black px-6 py-8 md:border-b-0 md:border-r-[1.5px] md:px-14 md:py-16">
          <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
            <Editable contentKey="vision_warum_label">Warum es uns gibt</Editable>
          </p>
        </div>
        <div className="px-6 py-10 md:px-14 md:py-16">
          <Reveal>
            <p className="max-w-[62ch] font-serif text-[clamp(1.25rem,2.6vw,2rem)] leading-[1.35] text-black">
              <Editable contentKey="vision_warum" multiline>
                Mode entsteht heute im Wochentakt und verschwindet im Scrollen. Die Menschen, die
                sie entwerfen, nähen, glasieren, malen, bleiben dabei unsichtbar. Wir bauen den
                Gegenort: langsam, kuratiert, mit Namen. Ein Haus, in dem eine Arbeit stehen bleiben
                darf, bis jemand sie wirklich sieht.
              </Editable>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Überzeugungen */}
      <section className="grid border-b-[1.5px] border-black md:grid-cols-2">
        {BELIEFS.map((b, i) => (
          <div
            key={b.key}
            className={`border-black px-6 py-12 md:px-14 md:py-16 ${
              i % 2 === 1 ? "md:border-l-[1.5px]" : ""
            } ${i < BELIEFS.length - 1 ? "border-b-[1.5px]" : ""} ${
              i === BELIEFS.length - 2 ? "md:border-b-0" : ""
            }`}
          >
            <Reveal>
              <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-6 font-serif text-[clamp(1.5rem,3.4vw,2.4rem)] leading-tight text-black">
                <Editable contentKey={`vision_glaube_${b.key}_titel`}>{b.titel}</Editable>
              </h2>
              <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-black">
                <Editable contentKey={`vision_glaube_${b.key}_text`} multiline>
                  {b.text}
                </Editable>
              </p>
            </Reveal>
          </div>
        ))}
      </section>

      {/* Versammlung + Besucher */}
      <section className="grid border-b-[1.5px] border-black md:grid-cols-2">
        <div className="border-b-[1.5px] border-black px-6 py-14 md:border-b-0 md:border-r-[1.5px] md:px-14 md:py-20">
          <Reveal>
            <h2 className="font-serif text-[clamp(1.8rem,4vw,3rem)] leading-tight text-black">
              <Editable contentKey="vision_versammlung_titel">Eine Versammlung</Editable>
            </h2>
            <p className="mt-6 max-w-[46ch] text-[0.98rem] leading-relaxed text-black">
              <Editable contentKey="vision_versammlung_text" multiline>
                Mode, Interior, Kunst — hier stehen sie nebeneinander, weil sie dieselbe Haltung
                teilen. Jedes Haus behält seinen eigenen Auftritt und findet gleichzeitig andere,
                die ähnlich arbeiten. Zusammen sind wir sichtbarer, als wir es einzeln wären.
              </Editable>
            </p>
            <Link
              to="/apply"
              className="mt-10 inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
            >
              <Editable contentKey="vision_cta_designer">Werde Teil davon</Editable>
            </Link>
          </Reveal>
        </div>
        <div className="px-6 py-14 md:px-14 md:py-20">
          <Reveal>
            <h2 className="font-serif text-[clamp(1.8rem,4vw,3rem)] leading-tight text-black">
              <Editable contentKey="vision_besucher_titel">Für die, die suchen</Editable>
            </h2>
            <p className="mt-6 max-w-[46ch] text-[0.98rem] leading-relaxed text-black">
              <Editable contentKey="vision_besucher_text" multiline>
                Betrachte PAWN als Ausstellung, nicht als Katalog. Du gehst durch Häuser, liest
                Geschichten, erkennst Handschriften — und nimmst am Ende ein Stück mit, von dem du
                weißt, wer es gemacht hat.
              </Editable>
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
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
      <section className="px-0 py-4">
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
    </PalaceLayout>
  );
}
