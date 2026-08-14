/**
 * PAWNs Vision — die Seite, die erklärt, was für ein Ort PAWN ist.
 * PART 51 Teil A2: Erzählung statt Feature-Katalog. Teil I: eine Erzählung in einer Bewegung —
 * kein zweites Landing, keine Navigation, kein Dashboard. Die Kette ist eine stille
 * Hairline-Zeile, es gibt genau einen CTA ("Mach deinen Zug" → /start), keine Kacheln,
 * keine Zähler. Die Seite endet allein stehend mit "PLAY YOUR OWN GAME."
 *
 * Teil P — V2: drei neue Passagen tragen die Erzählung (Was wir sehen · Was wir glauben ·
 * Die Halle wächst), die Haltung ist positiv gedreht. Diese Texte sind wörtlich vorgegeben
 * und hängen deshalb an i18n (DE/EN exakt), nicht an site_content — sie sollen nicht
 * versehentlich überschrieben werden. Kicker, Öffnung, Kette und "Was PAWN tut" bleiben
 * wie gehabt an site_content (Editable).
 */
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Editable } from "@/components/palace/Editable";
import { Reveal } from "@/components/palace/Reveal";
import { useI18n } from "@/lib/i18n";

const KETTE = [
  { key: "talent", de: "Talent" },
  { key: "ausdruck", de: "Ausdruck" },
  { key: "sichtbarkeit", de: "Sichtbarkeit" },
  { key: "bewegung", de: "Bewegung" },
  { key: "identitaet", de: "Identität" },
  { key: "transformation", de: "Transformation" },
];

/** Eine ruhige Passage im Kapitel-Rhythmus: kleine Marke links, Lesetext rechts. */
function Passage({ label, text }: { label: string; text: string }) {
  return (
    <section className="grid border-b-[1.5px] border-black md:grid-cols-[minmax(0,22ch)_1fr]">
      <div className="border-b-[1.5px] border-black px-6 py-8 md:border-b-0 md:border-r-[1.5px] md:px-14 md:py-16">
        <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">{label}</p>
      </div>
      <div className="px-6 py-10 md:px-14 md:py-16">
        <Reveal>
          <p className="max-w-[62ch] text-[1rem] leading-relaxed text-black md:text-[1.1rem]">{text}</p>
        </Reveal>
      </div>
    </section>
  );
}

export default function Vision() {
  const { t } = useI18n();
  return (
    <PalaceLayout
      title="PAWNs Vision — der Bauer, der sich verwandeln kann"
      description="Wofür PAWN steht: ein kuratiertes Haus, in dem sich unabhängige Gestalter aus Mode, Interior und Kunst versammeln — und Menschen sie finden."
    >
      {/* 01 ÖFFNUNG — der Bauer */}
      <section className="border-b-[1.5px] border-black px-6 pb-20 pt-24 md:px-14 md:pb-28 md:pt-32">
        <Reveal>
          <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">
            <Editable contentKey="vision_kicker">Die Vision</Editable>
          </p>
          <h1 className="mt-8 max-w-[22ch] font-serif text-[clamp(2.4rem,7vw,6.4rem)] font-semibold leading-[1.02] text-black">
            <Editable contentKey="vision_headline" multiline>
              Der Bauer ist die kleinste Figur auf dem Brett — und die einzige, die sich verwandeln kann.
            </Editable>
          </h1>
        </Reveal>
      </section>

      {/* 02 DIE KETTE — ein Flüstern zwischen den Kapiteln, kein zweiter Hero */}
      <section className="border-b-[1.5px] border-black px-6 py-6 md:px-14 md:py-8">
        <Reveal>
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y-[1.5px] border-black/15 py-4 text-center">
            {KETTE.map((glied, i) => (
              <span key={glied.key} className="flex items-center gap-3">
                <span className="font-serif text-[0.8rem] italic leading-tight text-black/55 md:text-[0.85rem]">
                  <Editable as="span" contentKey={`vision_kette_${glied.key}`}>{glied.de}</Editable>
                </span>
                {i < KETTE.length - 1 && (
                  <span aria-hidden className="text-[0.7rem] text-black/25">→</span>
                )}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 03 WAS WIR SEHEN (Teil P) */}
      <Passage label={t("vision.sehen.label")} text={t("vision.sehen.text")} />

      {/* 04 WAS WIR GLAUBEN (Teil P) */}
      <Passage label={t("vision.glauben.label")} text={t("vision.glauben.text")} />

      {/* 05 WAS PAWN TUT */}
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

      {/* 06 DIE HALLE WÄCHST (Teil P) */}
      <Passage label={t("vision.halle.label")} text={t("vision.halle.text")} />

      {/* 07 HALTUNG (positiv gedreht, Teil P) + der eine CTA */}
      <section className="border-b-[1.5px] border-black px-6 py-16 text-center md:px-14 md:py-24">
        <Reveal>
          <p className="mx-auto max-w-[36ch] font-serif text-[clamp(1.5rem,3.6vw,2.6rem)] italic leading-[1.4] text-black">
            {t("vision.haltung.text")}
          </p>
          <Link
            to="/start"
            className="mt-10 inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
          >
            {t("vision.cta")}
          </Link>
        </Reveal>
      </section>

      {/* 08 SCHLUSSSATZ — steht allein, nie als CTA */}
      <section className="px-6 py-24 text-center md:px-14 md:py-36">
        <p className="font-serif text-[clamp(1.8rem,5.5vw,4rem)] font-semibold italic tracking-[-0.02em] text-black">
          PLAY YOUR OWN GAME.
        </p>
      </section>
    </PalaceLayout>
  );
}
