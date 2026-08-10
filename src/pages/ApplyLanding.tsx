import { Link, useSearchParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DISCIPLINE_LIST,
  DISCIPLINES,
  NEUTRAL_ACTS,
  parseDiscipline,
  type Discipline,
} from "@/features/apply/disciplines";

const ACT_META = [
  { number: "01", key: "hausseite", title: "Deine eigene Hausseite", tagline: "Editorial statt Katalog." },
  { number: "02", key: "publikum", title: "Ein kuratiertes Publikum", tagline: "Publikum statt Reichweite." },
  { number: "03", key: "studio", title: "Dein Studio mit KI-Hilfe", tagline: "Auftritt statt Post." },
  { number: "04", key: "auszahlung", title: "Geld kommt direkt zu dir", tagline: "93 % gehören dir." },
  { number: "05", key: "einblicke", title: "Ehrliche Einblicke", tagline: "Einsicht statt Bauchgefühl." },
] as const;

const LOOKING_FOR = [
  "Eine erkennbare Handschrift — man sieht nach drei Bildern, dass es deine Arbeit ist.",
  "Du machst die Arbeit selbst oder lässt sie in kleiner Auflage fertigen.",
  "Mindestens drei Stücke, die heute verkäuflich sind — kein reines Konzept.",
  "Du kannst deine Arbeit zeigen: Bilder, die etwas hergeben, auch mit dem Handy.",
];

const NOT_LOOKING_FOR = [
  "Weiterverkauf fremder Ware oder Dropshipping.",
  "Reine Print-on-Demand-Ware ohne eigene Fertigung.",
  "Kopien geschützter Marken oder Entwürfe.",
];

const FLOW = [
  { label: "Bewerben", body: "Ein geführtes Formular, etwa zehn Minuten. Du kannst zwischendurch aufhören — dein Stand bleibt gespeichert." },
  { label: "Prüfung", body: "Wir sehen uns deine Arbeit persönlich an und antworten innerhalb von 48 Stunden. Auch bei Absage, mit Begründung." },
  { label: "Einrichtung", body: "Wir bauen deine Hausseite mit dir auf, verbinden dein Auszahlungskonto und übergeben dir dein Studio." },
  { label: "Auftritt", body: "Dein erstes Stück geht live, deine erste Kampagne entsteht. Ab hier gestaltest du." },
];

const FAQ = [
  {
    q: "Was kostet PAWN?",
    a: "Der Einstieg kostet nichts: keine Aufnahmegebühr, keine Grundgebühr. Bei jedem Verkauf behalten wir 7 % vom Warenwert — Versandkosten bleiben unangetastet. Wer mehr Videos, Signaturen und Produktfotos möchte, kann später auf Atelier oder Maison wechseln.",
  },
  {
    q: "Wann bekomme ich mein Geld?",
    a: "Sofort und direkt. Dein Auszahlungskonto wird beim Einrichten mit PAWN verbunden. Zahlt ein Kunde, gehen 93 % unmittelbar auf dein Konto — das Geld liegt nie bei uns.",
  },
  {
    q: "Wie viele Stücke brauche ich?",
    a: "Drei verkäufliche Arbeiten reichen für den Anfang. Wichtiger als Menge ist, dass die Stücke zusammen eine Handschrift ergeben.",
  },
  {
    q: "Wer kümmert sich um Versand und Verpackung?",
    a: "Du versendest selbst — du kennst deine Arbeit am besten. Im Studio gibt es eine Sendungsübersicht mit Adressen, Status und Nachweisen, damit nichts untergeht.",
  },
  {
    q: "Wie ist das mit der Umsatzsteuer?",
    a: "Du trägst deinen Steuersatz einmal im Studio ein, PAWN zeigt Kunden dann automatisch Preise inklusive Steuer. Deine Rechnungen bleiben deine Rechnungen.",
  },
  {
    q: "Was passiert mit meinen Bildern und Videos?",
    a: "Sie gehören dir. Wir dürfen ausgewählte Arbeiten mit Namensnennung und Verlinkung auf PAWN und den PAWN-Kanälen zeigen — dafür stimmst du einmalig zu und kannst es jederzeit widerrufen.",
  },
  {
    q: "Kann ich wieder gehen?",
    a: "Jederzeit, ohne Frist. Deine Daten und Bilder werden auf Wunsch gelöscht, offene Bestellungen wickelst du noch ab.",
  },
  {
    q: "Ich arbeite in mehreren Welten — geht das?",
    a: "Ja. Wähle die Welt, in der dein Schwerpunkt liegt. Im Studio kannst du jedes Stück einzeln Mode, Interior oder Kunst zuordnen.",
  },
];

export default function ApplyLanding() {
  const [params, setParams] = useSearchParams();
  const active = parseDiscipline(params.get("welt"));
  const discipline: Discipline | null = active ? DISCIPLINES[active] : null;
  const acts = discipline ? discipline.acts : NEUTRAL_ACTS;

  const choose = (id: string) => {
    const next = new URLSearchParams(params);
    if (active === id) next.delete("welt");
    else next.set("welt", id);
    setParams(next, { replace: true });
  };

  const formLink = active ? `/apply/form?welt=${active}` : "/apply/form";

  return (
    <PalaceLayout transparentHeader={false}>
      {/* ── Kopf ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-32 pb-16 md:px-14 md:pt-56 md:pb-24">
        <div className="mx-auto max-w-[1600px]">
          <Reveal>
            <Editable as="p" contentKey="apply_hero_eyebrow" className="palace-eyebrow">
              PAWN · Bewerbung
            </Editable>
          </Reveal>
          <Reveal delay={80}>
            <h1
              className="palace-serif mt-8 font-light text-[#000000] md:mt-10"
              style={{ fontSize: "clamp(3.4rem, 12vw, 12rem)", lineHeight: 0.86, letterSpacing: "-0.045em" }}
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
              contentKey="apply_hero_subline_v2"
              className="mt-10 block max-w-2xl font-serif italic text-[1.15rem] leading-relaxed text-[#000000]/70 md:mt-14"
              multiline
            >
              Für alle, die Kleidung schneiden, Räume möblieren oder Werke schaffen. PAWN gibt deiner
              Arbeit eine eigene Seite, ein Publikum, das liest statt sucht, und ein Studio, das dir
              Kampagnen abnimmt. Das Geld kommt direkt zu dir.
            </Editable>
          </Reveal>
        </div>
      </section>

      {/* ── Weiche: Mode · Interior · Kunst ──────────────── */}
      <section className="border-t border-[rgba(0,0,0,.18)] px-6 py-16 md:px-14 md:py-24">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <Editable as="p" contentKey="apply_welt_eyebrow" className="palace-eyebrow">
              Zuerst: Was machst du?
            </Editable>
            <Editable
              as="p"
              contentKey="apply_welt_hint"
              className="mt-4 block max-w-xl text-[0.98rem] leading-relaxed text-[#000000]/70"
              multiline
            >
              Wähle deine Welt — die Seite spricht ab hier in deiner Sprache. Du kannst später jederzeit wechseln.
            </Editable>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-3 md:gap-6">
            {DISCIPLINE_LIST.map((d, i) => {
              const isActive = active === d.id;
              return (
                <Reveal key={d.id} delay={i * 60}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => choose(d.id)}
                    className={`group flex h-full w-full flex-col justify-between border p-8 text-left transition-colors duration-300 md:p-10 ${
                      isActive
                        ? "border-[#000000] bg-[#000000] text-[#FFFFFF]"
                        : "border-[rgba(0,0,0,.28)] bg-white text-[#000000] hover:bg-[#000000] hover:text-[#FFFFFF]"
                    }`}
                  >
                    <span className="palace-eyebrow" style={{ color: "inherit", opacity: 0.6 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="palace-serif mt-10 block text-[2rem] font-light leading-none md:mt-16 md:text-[2.6rem]">
                      {d.label}
                    </span>
                    <span className="mt-4 block font-serif text-[0.98rem] italic leading-snug opacity-80">
                      {d.tagline}
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Was du bekommst ──────────────────────────────── */}
      <section className="border-t border-[rgba(0,0,0,.18)] px-6 py-20 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <Editable as="p" contentKey="apply_acts_eyebrow" className="palace-eyebrow">
              Was du bekommst
            </Editable>
          </Reveal>
          <div className="mt-16 space-y-24 md:mt-24 md:space-y-40">
            {ACT_META.map((s, i) => (
              <Reveal key={s.number} delay={i * 40}>
                <article className="grid gap-8 md:grid-cols-12 md:gap-12">
                  <div className="md:col-span-4">
                    <p
                      aria-hidden
                      className="palace-serif font-light leading-none"
                      style={{
                        fontSize: "clamp(5rem, 12vw, 11rem)",
                        color: "transparent",
                        WebkitTextStroke: "1px #000000",
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {s.number}
                    </p>
                  </div>
                  <div className="md:col-span-5">
                    <h2
                      className="palace-serif font-light text-[#000000]"
                      style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)", lineHeight: 1.02, letterSpacing: "-0.015em" }}
                    >
                      <Editable as="span" contentKey={`apply_act_${s.key}_title`}>{s.title}</Editable>
                    </h2>
                    <p className="mt-6 block text-[1rem] leading-[1.75] text-[#000000]/80">
                      {acts[s.key]}
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <div className="border-l border-[rgba(0,0,0,.22)] pl-6">
                      <p className="palace-eyebrow text-black/60">Für dich</p>
                      <Editable
                        as="p"
                        contentKey={`apply_act_${s.key}_tagline`}
                        className="palace-serif mt-3 text-[1.15rem] italic text-[#000000]/85"
                      >
                        {s.tagline}
                      </Editable>
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Wen wir suchen ───────────────────────────────── */}
      <section className="border-t border-[rgba(0,0,0,.18)] px-6 py-20 md:px-14 md:py-32">
        <div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-2 md:gap-20">
          <Reveal>
            <div>
              <Editable as="p" contentKey="apply_fit_yes_eyebrow" className="palace-eyebrow">
                Wen wir suchen
              </Editable>
              <ul className="mt-8 space-y-5">
                {LOOKING_FOR.map((line, i) => (
                  <li key={i} className="flex gap-4 border-t border-[rgba(0,0,0,.18)] pt-5 text-[1rem] leading-relaxed text-[#000000]/85">
                    <span aria-hidden className="palace-serif italic text-black/40">{String(i + 1).padStart(2, "0")}</span>
                    <Editable as="span" contentKey={`apply_fit_yes_${i}`} multiline>{line}</Editable>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <Editable as="p" contentKey="apply_fit_no_eyebrow" className="palace-eyebrow">
                Wen wir nicht suchen
              </Editable>
              <ul className="mt-8 space-y-5">
                {NOT_LOOKING_FOR.map((line, i) => (
                  <li key={i} className="flex gap-4 border-t border-[rgba(0,0,0,.18)] pt-5 text-[1rem] leading-relaxed text-[#000000]/60">
                    <span aria-hidden className="palace-serif italic text-black/30">—</span>
                    <Editable as="span" contentKey={`apply_fit_no_${i}`} multiline>{line}</Editable>
                  </li>
                ))}
              </ul>
              <p className="mt-8 font-serif text-[0.98rem] italic leading-relaxed text-[#000000]/60">
                <Editable as="span" contentKey="apply_fit_note" multiline>
                  Wir sagen lieber vorher ehrlich, was nicht passt, als hinterher abzusagen.
                </Editable>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Ablauf ───────────────────────────────────────── */}
      <section className="border-t border-[rgba(0,0,0,.18)] bg-white px-6 py-20 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <Editable as="p" contentKey="apply_flow_eyebrow" className="palace-eyebrow">Ablauf</Editable>
            <h2
              className="palace-serif mt-6 font-light text-[#000000]"
              style={{ fontSize: "clamp(2rem, 5vw, 4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              <Editable as="span" contentKey="apply_flow_headline_a">So läuft es </Editable>
              <Editable as="span" contentKey="apply_flow_headline_b" className="italic">ab.</Editable>
            </h2>
          </Reveal>

          <ol className="relative mt-14 space-y-12 md:mt-16 md:space-y-20">
            <span
              aria-hidden
              className="pointer-events-none absolute left-[10px] top-3 bottom-3 w-px bg-[rgba(0,0,0,.28)] md:left-4"
            />
            {FLOW.map((step, i) => (
              <Reveal key={step.label} delay={i * 60}>
                <li className="relative flex gap-8 pl-10 md:pl-16">
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 grid h-5 w-5 place-items-center rounded-full border border-[#000000] bg-white md:h-9 md:w-9"
                  >
                    <span className="palace-eyebrow hidden md:block">{String(i + 1).padStart(2, "0")}</span>
                    <span className="block h-1.5 w-1.5 rounded-full bg-[#000000] md:hidden" />
                  </span>
                  <div className="flex-1">
                    <p className="palace-eyebrow text-black/60">Schritt {i + 1}</p>
                    <p
                      className="palace-serif mt-3 font-light text-[#000000]"
                      style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", lineHeight: 1, letterSpacing: "-0.015em" }}
                    >
                      <Editable as="span" contentKey={`apply_flow_${i}_label`} className="italic">{step.label}</Editable>
                    </p>
                    <Editable
                      as="p"
                      contentKey={`apply_flow_${i}_body_v2`}
                      className="mt-4 block max-w-xl text-[0.98rem] leading-relaxed text-[#000000]/75"
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

      {/* ── Häufige Fragen ───────────────────────────────── */}
      <section className="border-t border-[rgba(0,0,0,.18)] px-6 py-20 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1000px]">
          <Reveal>
            <Editable as="p" contentKey="apply_faq_eyebrow" className="palace-eyebrow">Häufige Fragen</Editable>
          </Reveal>
          <Accordion type="single" collapsible className="mt-10 border-t border-[rgba(0,0,0,.18)]">
            {FAQ.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b border-[rgba(0,0,0,.18)]">
                <AccordionTrigger className="palace-serif py-6 text-left text-[1.15rem] font-light text-[#000000] hover:no-underline md:text-[1.4rem]">
                  <Editable as="span" contentKey={`apply_faq_${i}_q`}>{item.q}</Editable>
                </AccordionTrigger>
                <AccordionContent className="pb-8 text-[0.98rem] leading-relaxed text-[#000000]/75">
                  <Editable as="span" contentKey={`apply_faq_${i}_a`} multiline>{item.a}</Editable>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Abschluss ────────────────────────────────────── */}
      <section className="border-t border-[rgba(0,0,0,.18)] px-6 py-20 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <Editable as="p" contentKey="apply_cta_eyebrow" className="palace-eyebrow text-center">Bereit?</Editable>
            <h2
              className="palace-serif mt-6 text-center font-light text-[#000000]"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4.4rem)", lineHeight: 0.96, letterSpacing: "-0.02em" }}
            >
              <Editable as="span" contentKey="apply_cta_headline_a">Zeig uns </Editable>
              <Editable as="span" contentKey="apply_cta_headline_b" className="italic">deine Handschrift.</Editable>
            </h2>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2">
            <Reveal>
              <Link
                to={formLink}
                className="group flex h-full flex-col justify-between border border-[#000000] bg-[#000000] p-10 text-left text-[#FFFFFF] transition-colors duration-500 hover:bg-[#FFFFFF] hover:text-[#000000]"
              >
                <p className="palace-eyebrow" style={{ color: "inherit", opacity: 0.75 }}>
                  {discipline ? discipline.label : "Bewerbung"} · ca. 10 Minuten
                </p>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  <Editable as="span" contentKey="apply_cta_card_a_v2">Bewerbung<br/>starten.</Editable>
                </p>
              </Link>
            </Reveal>
            <Reveal delay={120}>
              <Link
                to="/designers"
                className="group flex h-full flex-col justify-between border border-[rgba(0,0,0,.28)] p-10 text-left text-[#000000] transition-colors duration-500 hover:bg-[#000000] hover:text-[#FFFFFF]"
              >
                <p className="palace-eyebrow group-hover:text-white/60">Vorher sehen</p>
                <p className="palace-serif mt-16 font-light text-[1.8rem] italic leading-tight">
                  <Editable as="span" contentKey="apply_cta_card_b">Häuser, die<br/>schon eingezogen sind.</Editable>
                </p>
              </Link>
            </Reveal>
          </div>

          <p className="mt-14 text-center font-serif italic text-[1rem] text-[#000000]/70">
            <Editable as="span" contentKey="apply_cta_footnote_v2" multiline>
              Wir lesen jede Bewerbung persönlich und antworten innerhalb von 48 Stunden — auch bei einer Absage.
            </Editable>
          </p>
        </div>
      </section>
    </PalaceLayout>
  );
}
