import { PalaceLayout } from "@/components/palace/PalaceLayout";

export default function AGB() {
  return (
    <PalaceLayout>
      <section className="mx-auto max-w-3xl px-6 pt-32 pb-24 md:px-14">
        <p className="palace-eyebrow">AGB</p>
        <h1 className="palace-serif mt-6 text-[clamp(2rem,4vw,3.4rem)] font-light leading-[1.02] text-[#0C0C0E]">
          Allgemeine Geschäftsbedingungen.
        </h1>
        <div className="mt-10 space-y-6 text-[1rem] leading-relaxed text-[#0C0C0E]/80">
          <p>
            PAWN vermittelt zwischen unabhängigen Designer:innen und Sammler:innen. Kaufverträge kommen zwischen
            dir und der jeweiligen Designer:in zustande; PAWN fungiert als Marktplatz und Zahlungsvermittler.
          </p>
          <p className="text-[0.9rem] text-[#7C7972]">
            Der vollständige AGB-Text wird zurzeit finalisiert (Kanzlei-TODO). Bis zur Freigabe gelten die
            gesetzlichen Regelungen sowie die Angaben auf der jeweiligen Produktseite. Fragen? Schreib an
            <span className="underline"> kontakt@pawn.example</span>.
          </p>
        </div>
      </section>
    </PalaceLayout>
  );
}
