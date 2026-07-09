import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";

export default function Widerruf() {
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Rechtliches</p>
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            Widerrufsrecht.
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            Vorläufige Fassung — anwaltliche Prüfung ausstehend.
          </p>
        </Reveal>

        <div className="mt-14 space-y-10 text-[#000000]/85">
          <S title="Widerrufsbelehrung">
            <p>Verbraucher:innen haben das Recht, binnen <strong>14 Tagen</strong> ohne Angabe von Gründen den Kaufvertrag zu widerrufen. Die Frist beginnt an dem Tag, an dem die Ware in Empfang genommen wurde. Um das Widerrufsrecht auszuüben, genügt eine eindeutige Erklärung (z.B. per E-Mail an die verkaufende Designer:in oder an PAWN unter <a href="mailto:pawnstudio.co@gmail.com" className="underline">pawnstudio.co@gmail.com</a>) über den Entschluss, den Vertrag zu widerrufen.</p>
          </S>
          <S title="Folgen des Widerrufs">
            <p>Bei wirksamem Widerruf wird der gezahlte Kaufpreis (inkl. Standardversandkosten) binnen 14 Tagen zurückerstattet — auf dem Weg der ursprünglichen Zahlung. Die Rücksendung erfolgt an die auf der Produktseite genannte Adresse der verkaufenden Designer:in. Die Kosten der Rücksendung trägt die Käufer:in, sofern nicht anders vereinbart.</p>
          </S>
          <S title="Ausschluss">
            <p>Das Widerrufsrecht besteht <strong>nicht</strong> bei Waren, die nach Kundenspezifikation angefertigt oder eindeutig auf persönliche Bedürfnisse zugeschnitten sind (individuelle Anfertigungen, made-to-order-Unikate mit Kundenwunsch — z.B. Maß, Farbe, Monogramm). Diese Ausnahme ist auf der jeweiligen Produktseite gekennzeichnet.</p>
          </S>
          <S title="Muster-Widerrufsformular">
            <pre className="whitespace-pre-wrap border border-[rgba(0,0,0,.18)] bg-white p-4 font-sans text-xs leading-relaxed">
An [Name und Adresse der Designer:in / PAWN]:
Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag
über den Kauf der folgenden Waren:
— Bestellt am / erhalten am:
— Name Verbraucher:in:
— Anschrift:
— Datum, Unterschrift (nur bei Mitteilung auf Papier):
            </pre>
          </S>
        </div>
      </section>
    </PalaceLayout>
  );
}

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-[1.35rem] italic text-[#000000]">{title}</h2>
      <div className="mt-3 font-sans text-[0.95rem] leading-relaxed">{children}</div>
    </section>
  );
}
