import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { LegalTranslationNote } from "@/components/palace/LegalTranslationNote";
import { useLegalText } from "@/lib/legalText";

export default function Widerruf() {
  const L = useLegalText();
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">{L("Rechtliches", "Legal")}</p>
          <LegalTranslationNote />
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {L("Widerrufsrecht.", "Right of Withdrawal.")}
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            {L("Vorläufige Fassung — anwaltliche Prüfung ausstehend.", "Draft version — legal review pending.")}
          </p>
        </Reveal>

        <div className="mt-14 space-y-10 text-[#000000]/85">
          <S title={L("Widerrufsbelehrung", "Withdrawal Instructions")}>
            <p>
              {L(
                "Verbraucher:innen haben das Recht, binnen ",
                "Consumers have the right to withdraw from the purchase contract within ",
              )}
              <strong>{L("14 Tagen", "14 days")}</strong>
              {L(
                " ohne Angabe von Gründen den Kaufvertrag zu widerrufen. Die Frist beginnt an dem Tag, an dem die Ware in Empfang genommen wurde. Um das Widerrufsrecht auszuüben, genügt eine eindeutige Erklärung (z.B. per E-Mail an die verkaufende Designer:in oder an PAWN unter ",
                " without giving reasons. The period begins on the day the goods were received. To exercise the right of withdrawal, a clear statement is sufficient (e.g. by email to the selling designer or to PAWN at ",
              )}
              <a href="mailto:pawnstudio.co@gmail.com" className="underline">pawnstudio.co@gmail.com</a>
              {L(") über den Entschluss, den Vertrag zu widerrufen.", ") of the decision to withdraw from the contract.")}
            </p>
          </S>
          <S title={L("Folgen des Widerrufs", "Consequences of Withdrawal")}>
            <p>
              {L(
                "Bei wirksamem Widerruf wird der gezahlte Kaufpreis (inkl. Standardversandkosten) binnen 14 Tagen zurückerstattet — auf dem Weg der ursprünglichen Zahlung. Die Rücksendung erfolgt an die auf der Produktseite genannte Adresse der verkaufenden Designer:in. Die Kosten der Rücksendung trägt die Käufer:in, sofern nicht anders vereinbart.",
                "Upon effective withdrawal, the purchase price paid (including standard shipping costs) will be refunded within 14 days, using the original payment method. Returns are sent to the selling designer's address stated on the product page. The buyer bears the cost of returning the goods, unless otherwise agreed.",
              )}
            </p>
          </S>
          <S title={L("Ausschluss", "Exclusion")}>
            <p>
              {L("Das Widerrufsrecht besteht ", "The right of withdrawal does ")}
              <strong>{L("nicht", "not")}</strong>
              {L(
                " bei Waren, die nach Kundenspezifikation angefertigt oder eindeutig auf persönliche Bedürfnisse zugeschnitten sind (individuelle Anfertigungen, made-to-order-Unikate mit Kundenwunsch — z.B. Maß, Farbe, Monogramm). Diese Ausnahme ist auf der jeweiligen Produktseite gekennzeichnet.",
                " apply to goods made to customer specifications or clearly tailored to personal needs (custom pieces, made-to-order one-offs with customer input — e.g. size, colour, monogram). This exception is marked on the respective product page.",
              )}
            </p>
          </S>
          <S title={L("Muster-Widerrufsformular", "Model Withdrawal Form")}>
            <pre className="whitespace-pre-wrap border border-[rgba(0,0,0,.18)] bg-white p-4 font-sans text-xs leading-relaxed">
              {L(
                `An [Name und Adresse der Designer:in / PAWN]:
Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag
über den Kauf der folgenden Waren:
— Bestellt am / erhalten am:
— Name Verbraucher:in:
— Anschrift:
— Datum, Unterschrift (nur bei Mitteilung auf Papier):`,
                `To [name and address of the designer / PAWN]:
I/we hereby give notice that I/we withdraw from my/our contract
for the purchase of the following goods:
— Ordered on / received on:
— Name of consumer(s):
— Address:
— Date, signature (only if notified on paper):`,
              )}
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
