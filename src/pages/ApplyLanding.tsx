import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";

const SERVICES = [
  {
    number: "01",
    key: "s1",
    title: "Eigene Brand-Page",
    body: "Deine Handschrift, deine Bilder, deine Story. Ein Auftritt, der zu dir gehört — nicht zu einer Suchmaske. Eigener Shop-Bereich, kuratiertes Layout, editorial statt Katalog.",
  },
  {
    number: "02",
    key: "s2",
    title: "Kuratiertes Publikum",
    body: "Wir empfehlen dich nach Geschmack, nicht nach Ranking. Cover Story, Banner, Aufnahme in redaktionelle Kollektionen — dort, wo dein Publikum liest, nicht wo es sucht.",
  },
  {
    number: "03",
    key: "s3",
    title: "Kampagnen-Studio",
    body: "Aus deinen Produkten entstehen Kampagnenvorschläge — Video, Post, Text. Du gibst jede Veröffentlichung frei. Nichts geht ohne dich raus. Jede Änderung, die du wünschst, fließt in die nächste Runde.",
  },
  {
    number: "04",
    key: "s4",
    title: "Faire Beteiligung",
    body: "Die Plattform kostet dich nichts. Wir beteiligen uns prozentual am Verkauf, transparent abgerechnet. Keine Aufnahmegebühr, keine Sichtbarkeitspakete.",
  },
  {
    number: "05",
    key: "s5",
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
      {/* ── Monumental hero: „Werde ein Haus." ─────────────── */}
      <section className="relative overflow-hidden px-6 pt-40 pb-24 md:px-14 md:pt-56 md:pb-32">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <Editable as="p" contentKey="apply_hero_eyebrow" className="palace-eyebrow">
              PAWN · Bewerbung
            </Editable>
          </Reveal>
          <Reveal delay={80}>
            <h1
              className="palace-serif mt-10 font-light text-[#0C0C0E]"
              style={{
                fontSize: "clamp(3.4rem, 12vw, 12rem)",
                lineHeight: 0.86,
                letterSpacing: "-0.045em",
              }}
            >
              <Editable as="span" contentKey="apply_hero_word_a" className="block">
                Werde ein
              </Editable>
              <Editable as="span" contentKey="apply_hero_word_b" className="block italic">
                Haus.
              </Editable>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <Editable
              as="p"
              contentKey="apply_hero_subline"
              className="mt-14 block max-w-2xl font-serif italic text-[1.15rem] leading-relaxed text-[#0C0C0E]/70"
              multiline
            >
              Ein Ort, an dem deine Arbeit gelesen wird, nicht gefiltert. Ein Publikum, das dich sucht,
              bevor es weiß, dass es dich sucht. Und ein Team, das jeden Auftritt mit dir kuratiert.
            </Editable>
          </Reveal>
        </div>
      </section>

      {/* ── 5 Akte mit Outline-Nummern ───────────────────── */}
      <section className="border-t border-[rgba(12,12,14,.13)] px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1400px] space-y-28 md:space-y-40">
          {SERVICES.map((s, i) => (
            <Reveal key={s.number} delay={i * 40}>
              <article className="grid gap-8 md:grid-cols-12 md:gap-12">
                {/* Outline number — big, hairline stroke */}
                <div className="md:col-span-4">
                  <p
                    aria-hidden
                    className="palace-serif font-light leading-none"
                    style={{
                      fontSize: "clamp(5rem, 12vw, 11rem)",
                      color: "transparent",
                      WebkitTextStroke: "1px #0C0C0E",
                      letterSpacing: "-0.04em",
                    }}
                  >
                    {s.number}
                  </p>
                  <p className="palace-eyebrow mt-6">Akt {s.number}</p>
                </div>
                <div className="md:col-span-5">
                  <h2
                    className="palace-serif font-light text-[#0C0C0E]"
                    style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)", lineHeight: 1.02, letterSpacing: "-0.015em" }}
                  >
                    <Editable as="span" contentKey={`apply_${s.key}_title`}>{s.title}</Editable>
                  </h2>
                  <Editable
                    as="p"
                    contentKey={`apply_${s.key}_body`}
                    className="mt-6 block text-[1rem] leading-[1.75] text-[#0C0C0E]/80"
                    multiline
                  >
                    {s.body}
                  </Editable>
                </div>
                <div className="md:col-span-3">
                  <div className="border-l border-[rgba(12,12,14,.22)] pl-6">
                    <p className="palace-eyebrow text-[#7C7972]">Für dich</p>
                    <p className="palace-serif mt-3 text-[1.15rem] italic text-[#0C0C0E]/85">
                      {i === 0 && "Editorial statt Katalog."}
                      {i === 1 && "Publikum statt Traffic."}
                      {i === 2 && "Auftritt statt Post."}
                      {i === 3 && "Beteiligung statt Gebühr."}
                      {i === 4 && "Einsicht statt Bauchgefühl."}
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Ablauf: vertikale Fortschrittslinie ──────────── */}
      <section className="border-t border-[rgba(12,12,14,.13)] bg-[#EEE9E0] px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <Editable as="p" contentKey="apply_flow_eyebrow" className="palace-eyebrow">Ablauf</Editable>
            <h2
              className="palace-serif mt-6 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              <Editable as="span" contentKey="apply_flow_headline_a">So läuft es </Editable>
              <Editable as="span" contentKey="apply_flow_headline_b" className="italic">ab.</Editable>
            </h2>
          </Reveal>

          <ol className="relative mt-16 space-y-14 md:space-y-20">
            {/* Vertical progress line */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-[10px] top-3 bottom-3 w-px bg-[rgba(12,12,14,.28)] md:left-4"
            />
            {FLOW.map((step, i) => (
              <Reveal key={step.label} delay={i * 60}>
                <li className="relative flex gap-8 pl-10 md:pl-16">
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 grid h-5 w-5 place-items-center rounded-full border border-[#0C0C0E] bg-[#EEE9E0] md:h-9 md:w-9"
                  >
                    <span className="palace-eyebrow hidden md:block">{String(i + 1).padStart(2, "0")}</span>
                    <span className="block h-1.5 w-1.5 rounded-full bg-[#0C0C0E] md:hidden" />
                  </span>
                  <div className="flex-1">
                    <p className="palace-eyebrow text-[#7C7972]">Schritt {i + 1}</p>
                    <p
                      className="palace-serif mt-3 font-light text-[#0C0C0E]"
                      style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", lineHeight: 1, letterSpacing: "-0.015em" }}
                    >
                      <Editable as="span" contentKey={`apply_flow_${i}_label`} className="italic">{step.label}</Editable>
                    </p>
                    <Editable
                      as="p"
                      contentKey={`apply_flow_${i}_body`}
                      className="mt-4 block max-w-xl text-[0.98rem] leading-relaxed text-[#0C0C0E]/75"
                      multiline
                    >
                      {step.body}
                    </Editable>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA-Karten ───────────────────────────────────── */}
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <Editable as="p" contentKey="apply_cta_eyebrow" className="palace-eyebrow text-center">Bereit?</Editable>
            <h2
              className="palace-serif mt-6 text-center font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              <Editable as="span" contentKey="apply_cta_headline_a">Zeig uns </Editable>
              <Editable as="span" contentKey="apply_cta_headline_b" className="italic">deine Handschrift.</Editable>
            </h2>
          </Reveal>

          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal>
              <Link
                to="/apply/form"
                className="group flex h-full flex-col justify-between border border-[#0C0C0E] bg-[#0C0C0E] p-10 text-left text-[#F1EEE7] transition-colors duration-500 hover:bg-[#F1EEE7] hover:text-[#0C0C0E]"
              >
                <p className="palace-eyebrow" style={{ color: "inherit", opacity: 0.75 }}>Bewerbung</p>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  <Editable as="span" contentKey="apply_cta_card_a">Jetzt<br/>bewerben.</Editable>
                </p>
              </Link>
            </Reveal>
            <Reveal delay={120}>
              <Link
                to="/designers"
                className="group flex h-full flex-col justify-between border border-[rgba(12,12,14,.28)] p-10 text-left text-[#0C0C0E] transition-colors duration-500 hover:bg-[#0C0C0E] hover:text-[#F1EEE7]"
              >
                <p className="palace-eyebrow group-hover:text-[#A8A49B]">Vorher sehen</p>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  <Editable as="span" contentKey="apply_cta_card_b">Häuser, die<br/>schon eingezogen sind.</Editable>
                </p>
              </Link>
            </Reveal>
          </div>

          <p className="mt-14 text-center font-serif italic text-[1rem] text-[#0C0C0E]/70">
            <Editable as="span" contentKey="apply_cta_footnote" multiline>
              Wir lesen jede Bewerbung persönlich und antworten innerhalb von sieben Tagen.
            </Editable>
          </p>
        </div>
      </section>
    </PalaceLayout>
  );
}
