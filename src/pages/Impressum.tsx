import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";

export default function Impressum() {
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Rechtliches</p>
          <h1
            className="palace-serif mt-6 font-light text-[#0C0C0E]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Impressum.
          </h1>
          <p className="mt-8 font-serif italic text-[#0C0C0E]/70">
            Angaben gemäß § 5 TMG. [TODO: Vor Launch durch Kanzlei prüfen und vollständige Angaben ergänzen.]
          </p>
        </Reveal>

        <div className="mt-14 space-y-8 font-sans text-[0.95rem] leading-relaxed text-[#0C0C0E]/85">
          <Row title="Anbieter">
            PAWN [TODO Rechtsform]<br />
            [TODO Straße Hausnummer]<br />
            [TODO PLZ Ort]<br />
            Deutschland
          </Row>
          <Row title="Vertretungsberechtigt">[TODO Namen der Geschäftsführung]</Row>
          <Row title="Kontakt">
            E-Mail: <a href="mailto:kontakt@pawn.example" className="underline">kontakt@pawn.example</a>
          </Row>
          <Row title="Registereintrag">[TODO Registergericht und Nummer]</Row>
          <Row title="Umsatzsteuer-ID">[TODO USt-IdNr.]</Row>
          <Row title="Verantwortlich für Inhalte">[TODO Name, Anschrift]</Row>
          <Row title="EU-Streitbeilegung">
            Plattform der EU-Kommission: <a href="https://ec.europa.eu/consumers/odr/" className="underline">https://ec.europa.eu/consumers/odr/</a>.
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </Row>
        </div>
      </section>
    </PalaceLayout>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[rgba(12,12,14,.13)] pt-6">
      <p className="palace-eyebrow">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
