import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { LegalTranslationNote } from "@/components/palace/LegalTranslationNote";

export default function WiePawnKiNutzt() {
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Transparenz</p>
          <LegalTranslationNote />
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Wie PAWN KI nutzt.
          </h1>
          <p className="mt-8 font-serif italic text-[#000000]/70">
            PAWN verkauft Sichtbarkeit für unabhängige Häuser — keine KI-Videos als Selbstzweck. Diese Seite legt offen,
            wo und wie künstliche Intelligenz mitwirkt.
          </p>
        </Reveal>

        <div className="palace-serif mt-16 space-y-10 text-[#000000]/85">
          <Section title="Das Gespräch">
            <p>
              „Frag PAWN" (auf der Startseite, im Studio, auf Produktseiten und in der Stilberatung) ist ein
              KI-Sprachmodell. Das steht direkt am Eingabefeld — kein Kleingedrucktes, keine Pop-ups. Es antwortet aus
              dem echten PAWN-Katalog und aus dem, was du ihm erzählst; es erfindet keine Produkte, Preise oder
              Verfügbarkeiten.
            </p>
          </Section>

          <Section title="Bilder und Videos">
            <p>
              Auf Wunsch eines Hauses erzeugt PAWN aus echten Produktfotos: freigestellte Studio-Aufnahmen (ohne
              Person), Anprobe-Darstellungen mit einem KI-Model, und kurze Kampagnen-Videos. Anprobe-Modelle sind
              immer synthetisch erzeugt oder aus einem lizenzierten Modell-Pool — nie eine reale, existierende Person.
              Reine Produktfotos ohne Person tragen keine Kennzeichnung; jede Darstellung mit einem KI-Model trägt ein
              sichtbares Zeichen „KI-generiert" — im Player, in der Produktgalerie und in geteilten Ausspielungen.
            </p>
          </Section>

          <Section title="Redaktionelle Prüfung">
            <p>
              Bevor ein automatisch vorgeschlagener Beitrag auf den PAWN-Kanälen erscheint, prüft ihn ein Mensch. Die
              Warteschlange hält fest, wer wann geprüft hat — kein Beitrag läuft ungesehen durch.
            </p>
          </Section>

          <Section title="Was KI nicht entscheidet">
            <p>
              Preis, Verfügbarkeit, Versand und Vertragsbedingungen legt nie eine KI fest. Empfehlungen und Reihenfolge
              im Katalog stützen sich auf abgeleitete Verhaltensprofile (siehe Datenschutzerklärung, Abschnitt 4) — sie
              beeinflussen nie, was ein Stück kostet oder ob es verfügbar ist.
            </p>
          </Section>

          <Section title="Deine Möglichkeiten">
            <p>
              Du kannst jederzeit lieber mit einem Menschen sprechen — jede Gesprächsfläche verlinkt eine
              E-Mail-Adresse dafür. Mehr zu Rechtsgrundlagen, Speicherdauer und Widerspruch: <a href="/datenschutz" className="underline">Datenschutzerklärung</a>.
            </p>
          </Section>
        </div>
      </section>
    </PalaceLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-[1.4rem] italic text-[#000000]">{title}</h2>
      <div className="mt-3 font-sans text-[0.95rem] leading-relaxed">{children}</div>
    </section>
  );
}
