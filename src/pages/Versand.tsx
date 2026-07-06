import { PalaceLayout } from "@/components/palace/PalaceLayout";

export default function Versand() {
  return (
    <PalaceLayout>
      <section className="mx-auto max-w-3xl px-6 pt-32 pb-24 md:px-14">
        <p className="palace-eyebrow">Versand · Retoure</p>
        <h1 className="palace-serif mt-6 text-[clamp(2rem,4vw,3.4rem)] font-light leading-[1.02] text-[#0C0C0E]">
          Direkt aus dem Atelier zu dir.
        </h1>
        <div className="mt-10 space-y-8 text-[1rem] leading-relaxed text-[#0C0C0E]/80">
          <p>
            Jedes Stück wird von der Designer:in verpackt und versichert versendet. Lagerware verlässt das Atelier
            in der Regel innerhalb von 3&nbsp;Werktagen. Anfertigungen benötigen die auf der Produktseite angegebene
            Fertigungszeit — wir halten dich per E-Mail auf dem Laufenden.
          </p>
          <div>
            <p className="palace-eyebrow">Rückgabe</p>
            <p className="mt-3">
              Innerhalb von 14&nbsp;Tagen nach Erhalt kannst du Lagerware zurücksenden. Anfertigungen sind vom
              Widerruf ausgenommen. Schreib uns an <span className="underline">retoure@pawn.example</span> — wir
              begleiten den Rückversand persönlich.
            </p>
          </div>
          <div>
            <p className="palace-eyebrow">Hinweis</p>
            <p className="mt-3 text-[0.9rem] text-[#7C7972]">
              Diese Seite wird finalisiert, sobald Versanddienstleister und Retourenprozess mit den Ateliers
              abgestimmt sind.
            </p>
          </div>
        </div>
      </section>
    </PalaceLayout>
  );
}
