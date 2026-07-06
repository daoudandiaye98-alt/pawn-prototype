import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { EditorialImage } from "@/components/palace/EditorialImage";

const SERVICES = [
  {
    number: "01",
    title: "Eigene Brand-Page",
    body: "Deine Handschrift, deine Bilder, deine Story. Ein Auftritt, der zu dir gehört — nicht zu einer Suchmaske. Eigener Shop-Bereich, kuratiertes Layout, editorial statt Katalog.",
  },
  {
    number: "02",
    title: "Kuratiertes Publikum",
    body: "Wir empfehlen dich nach Geschmack, nicht nach Ranking. Cover Story, Banner, Aufnahme in redaktionelle Kollektionen — dort, wo dein Publikum liest, nicht wo es sucht.",
  },
  {
    number: "03",
    title: "Kampagnen-Studio",
    body: "Aus deinen Produkten entstehen Kampagnenvorschläge — Video, Post, Text. Du gibst jede Veröffentlichung frei. Nichts geht ohne dich raus. Jede Änderung, die du wünschst, fließt in die nächste Runde.",
  },
  {
    number: "04",
    title: "Faire Beteiligung",
    body: "Die Plattform kostet dich nichts. Wir beteiligen uns prozentual am Verkauf, transparent abgerechnet. Keine Aufnahmegebühr, keine Sichtbarkeitspakete.",
  },
  {
    number: "05",
    title: "Einblicke",
    body: "Was bewegt dein Publikum? Welche Stücke ziehen an, welche werden gerettet? Aggregierte, anonymisierte Signale als Entscheidungshilfe für deine nächste Kollektion.",
  },
];

const FLOW = [
  { label: "Bewerben", body: "Ein kurzer Antrag mit deiner Handschrift und Portfolio." },
  { label: "Kurator-Prüfung", body: "Wir antworten innerhalb von 7 Tagen. Persönlich, nicht automatisch." },
  { label: "Onboarding", body: "Wir richten deine Brand-Page ein und übergeben dir dein Studio." },
  { label: "Auftritt", body: "Deine erste Story geht live. Ab hier gestaltest du." },
];

export default function ApplyLanding() {
  return (
    <PalaceLayout transparentHeader={false}>
      {/* Hero */}
      <section className="px-6 pt-32 md:px-14 md:pt-40">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <p className="palace-eyebrow">Für Designer</p>
            <h1
              className="palace-serif mt-8 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 7vw, 6.4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              Was PAWN <span className="italic">dir gibt.</span>
            </h1>
            <p className="mt-10 max-w-2xl font-serif italic text-[1.1rem] leading-relaxed text-[#0C0C0E]/70">
              Ein Ort, an dem deine Arbeit gelesen wird, nicht gefiltert. Ein Publikum, das dich sucht,
              bevor es weiß, dass es dich sucht. Und ein Team, das jeden Auftritt mit dir kuratiert.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Services */}
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1400px] space-y-24">
          {SERVICES.map((s, i) => (
            <Reveal key={s.number} delay={i * 40}>
              <article className="grid gap-10 md:grid-cols-12">
                <div className="md:col-span-4">
                  <p className="palace-eyebrow">{s.number}</p>
                  <h2
                    className="palace-serif mt-4 font-light text-[#0C0C0E]"
                    style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", lineHeight: 1.05 }}
                  >
                    {s.title}
                  </h2>
                </div>
                <div className="md:col-span-6">
                  <p className="text-[1rem] leading-relaxed text-[#0C0C0E]/80">{s.body}</p>
                </div>
                <div className="md:col-span-2">
                  <EditorialImage seed={`apply-${s.number}`} ratio="1/1" />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Flow */}
      <section className="border-t border-[rgba(12,12,14,.13)] bg-[#EEE9E0] px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <p className="palace-eyebrow">Ablauf</p>
            <h2
              className="palace-serif mt-6 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)", lineHeight: 1, letterSpacing: "-0.01em" }}
            >
              So läuft es ab.
            </h2>
          </Reveal>
          <ol className="mt-14 grid gap-8 md:grid-cols-4">
            {FLOW.map((step, i) => (
              <Reveal key={step.label} delay={i * 40}>
                <li className="border-t border-[#0C0C0E] pt-6">
                  <p className="palace-eyebrow">Schritt {i + 1}</p>
                  <p className="palace-serif mt-3 text-[1.4rem] italic text-[#0C0C0E]">{step.label}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#0C0C0E]/70">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 md:px-14 md:py-40">
        <Reveal>
          <div className="mx-auto flex max-w-[1000px] flex-col items-center text-center">
            <p className="palace-eyebrow">Bereit?</p>
            <h2
              className="palace-serif mt-6 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.4rem, 5vw, 4.4rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              Zeig uns <span className="italic">deine Handschrift.</span>
            </h2>
            <p className="mt-8 max-w-md font-serif italic text-[1.05rem] text-[#0C0C0E]/70">
              Wir lesen jede Bewerbung persönlich und antworten innerhalb von sieben Tagen.
            </p>
            <Link
              to="/apply/form"
              className="mt-12 inline-flex border border-[#0C0C0E] bg-[#0C0C0E] px-10 py-4 text-[0.7rem] uppercase tracking-[0.42em] text-[#F1EEE7] transition-colors hover:bg-transparent hover:text-[#0C0C0E]"
            >
              Jetzt bewerben
            </Link>
          </div>
        </Reveal>
      </section>
    </PalaceLayout>
  );
}
