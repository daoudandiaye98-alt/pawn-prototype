import { useEffect, useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { LegalTranslationNote } from "@/components/palace/LegalTranslationNote";
import { supabase } from "@/integrations/supabase/client";
import { useLegalText } from "@/lib/legalText";

interface Business { legal_name?: string; contact_email?: string; city?: string; country?: string }

export default function AGB() {
  const [b, setB] = useState<Business>({});
  const L = useLegalText();
  useEffect(() => {
    supabase.from("ai_config").select("value").eq("key", "business_profile").maybeSingle()
      .then(({ data }) => data?.value && setB(data.value as Business));
  }, []);
  const name = b.legal_name ?? "Daouda Ndiaye · PAWN";
  const email = b.contact_email ?? "pawnstudio.co@gmail.com";
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">{L("Rechtliches", "Legal")}</p>
          <LegalTranslationNote />
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {L("AGB.", "Terms & Conditions.")}
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            {L(
              "Vorläufige Fassung — anwaltliche Prüfung ausstehend. Bis zur finalen Freigabe gelten zusätzlich die gesetzlichen Regelungen.",
              "Draft version — legal review pending. Statutory provisions apply in addition until final approval.",
            )}
          </p>
        </Reveal>

        <div className="mt-14 space-y-10 text-[#000000]/85">
          <S title={L("1. Betreiber & Rolle von PAWN", "1. Operator & Role of PAWN")}>
            <p>
              {L(
                `PAWN (Anbieter: ${name}, Kontakt: `,
                `PAWN (provider: ${name}, contact: `,
              )}
              <a href={`mailto:${email}`} className="underline">{email}</a>
              {L(
                ") betreibt einen kuratierten Online-Marktplatz für unabhängige Designer:innen (Mode, Interior, Kunst). PAWN vermittelt zwischen Kunden und Designern und stellt die Zahlungsabwicklung bereit — PAWN ist nicht selbst Verkäufer der auf der Plattform angebotenen Stücke.",
                ") operates a curated online marketplace for independent designers (fashion, interior, art). PAWN acts as an intermediary between customers and designers and provides payment processing — PAWN is not itself the seller of the pieces offered on the platform.",
              )}
            </p>
          </S>
          <S title="2. Vertragsschluss">
            <p>Kaufverträge kommen ausschließlich <strong>direkt zwischen Kunde und der jeweiligen Designer:in</strong> zustande. Die Produktseite nennt die verkaufende Marke; deren Angaben (Impressum, Lieferzeiten, Rückgabe) sind maßgeblich. Der Vertrag entsteht erst mit Klick auf die ausdrücklich mit dem Zahlungshinweis versehene Schaltfläche im letzten Bestellschritt — davor lässt sich die Bestellung jederzeit ändern oder abbrechen.</p>
          </S>
          <S title={L("3. Zahlungsabwicklung via Stripe", "3. Payment Processing via Stripe")}>
            <p>
              {L(
                "Zahlungen werden über Stripe abgewickelt. PAWN erhält die Zahlung im Namen der Designer:in als Zahlungsvermittler und leitet den Nettobetrag (abzüglich der Plattform-Provision) monatlich an die Designer:in weiter. Verfügbar sind Karte, Apple Pay, Google Pay, PayPal, Klarna (je nach Land).",
                "Payments are processed via Stripe. PAWN receives the payment on the designer's behalf as payment intermediary and forwards the net amount (less the platform commission) to the designer monthly. Available methods include card, Apple Pay, Google Pay, PayPal, and Klarna (depending on country).",
              )}
            </p>
            <p>
              {L(
                "Kaufpreiszahlungen fließen über den Zahlungsdienstleister Stripe unmittelbar an den jeweiligen Designer; PAWN erhält eine Vermittlungsprovision von 7%.",
                "Purchase price payments flow via the payment service provider Stripe directly to the respective designer; PAWN receives an intermediation commission of 7%.",
              )}
            </p>
          </S>
          <S title={L("4. Plattform-Provision", "4. Platform Commission")}>
            <p>
              <strong>{L("PAWN behält 7% des Bruttoverkaufspreises", "PAWN retains 7% of the gross sale price")}</strong>
              {L(
                " je Bestellung als Vermittlungsprovision. Der Provisions-Satz ist auf jeder Produktseite implizit — ",
                " per order as intermediation commission. The commission rate applies implicitly on every product page — ",
              )}
              <em>{L("7% bleiben immer 7%", "7% always stays 7%")}</em>
              {L(", unabhängig vom gewählten Designer-Plan.", ", regardless of the designer's chosen plan.")}
            </p>
          </S>
          <S title="5. Optionale Pläne für Designer:innen">
            <p>Designer:innen können zwischen zwei Plänen wählen: <strong>Frei</strong> (0 €/Monat, Basiszugang) und <strong>Paid</strong> (Preis und Kontingente einsehbar unter <a href="/studio/plan" className="underline">/studio/plan</a>). Ein älterer, nicht mehr neu abschließbarer Zwischenplan „Atelier" bleibt für bestehende Abos zu dessen ursprünglichem Preis bestehen. Die Pläne enthalten unterschiedliche Limits an Kampagnen-Videos und Zugang zu erweiterten KI-Werkzeugen. <strong>Monatliche Kündigung jederzeit</strong> über die eigene Kündigungsseite unter <a href="/vertrag-kuendigen" className="underline">/vertrag-kuendigen</a> möglich; keine Mindestlaufzeit, keine Kündigungsfrist außer dem Ende der laufenden Abrechnungsperiode. Kein Einfluss auf die 7%-Provision.</p>
          </S>
          <S title={L("6. Lieferzeiten, Anfertigungen", "6. Delivery Times, Made-to-Order")}>
            <p>
              {L(
                "Lagerware wird nach Bestellung versendet; die Lieferzeit steht auf der Produktseite. ",
                "In-stock items are shipped after ordering; the delivery time is shown on the product page. ",
              )}
              <strong>{L("Anfertigungs-Artikel", "Made-to-order items")}</strong>
              {L(
                " (made-to-order, Unikate nach Kundenspezifikation) werden erst nach Bestellung produziert. Die auf der Produktseite genannte Lieferzeit ist verbindlich; Verzögerungen kommuniziert die Designer:in direkt.",
                " (one-offs made to customer specification) are produced only after ordering. The delivery time stated on the product page is binding; delays are communicated directly by the designer.",
              )}
            </p>
          </S>
          <S title={L("7. Gewährleistung", "7. Warranty")}>
            <p>
              {L(
                "Es gelten die gesetzlichen Gewährleistungsregeln (§§ 434 ff. BGB). Ansprüche richten sich ",
                "The statutory warranty rules apply (§§ 434 et seq. BGB, German Civil Code). Claims are directed ",
              )}
              <strong>{L("gegen die Designer:in als Verkäufer:in", "against the designer as seller")}</strong>
              {L(". PAWN vermittelt bei Bedarf und leitet Reklamationen an die jeweilige Marke weiter.",
                ". PAWN mediates when needed and forwards complaints to the respective brand.")}
            </p>
          </S>
          <S title={L("8. Widerrufsrecht", "8. Right of Withdrawal")}>
            <p>
              {L(
                "Verbraucher:innen steht ein 14-tägiges Widerrufsrecht zu. Details und Formular unter ",
                "Consumers have a 14-day right of withdrawal. Details and the form are available at ",
              )}
              <a href="/widerruf" className="underline">/widerruf</a>
              {L(". ", ". ")}
              <strong>{L("Ausnahme:", "Exception:")}</strong>
              {L(
                " Waren, die nach Kundenspezifikation angefertigt wurden (Anfertigungs-Artikel).",
                " goods made to customer specification (made-to-order items).",
              )}
            </p>
          </S>
          <S title={L("9. Haftung", "9. Liability")}>
            <p>
              {L(
                "PAWN haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach dem Produkthaftungsgesetz. Für einfache Fahrlässigkeit haftet PAWN nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und begrenzt auf den vorhersehbaren, vertragstypischen Schaden.",
                "PAWN is liable without limitation for intent and gross negligence, as well as under the Product Liability Act. For simple negligence, PAWN is liable only for breach of material contractual obligations (cardinal duties) and limited to foreseeable damage typical for this type of contract.",
              )}
            </p>
          </S>
          <S title={L("10. Nutzerpflichten & Bildrechte", "10. User Obligations & Image Rights")}>
            <p>
              {L(
                "Designer:innen versichern, an allen hochgeladenen Inhalten die Rechte zu halten. PAWN nutzt Bild-/Videomaterial zur Präsentation im Katalog und in Kampagnen. Diese Nutzung ist ",
                "Designers warrant that they hold the rights to all uploaded content. PAWN uses image/video material for presentation in the catalogue and in campaigns. This use is ",
              )}
              <strong>{L("widerruflich", "revocable")}</strong>
              {L(" — Anfrage per Nachricht im Studio, Löschung binnen 14 Tagen.",
                " — request via message in the Studio, deletion within 14 days.")}
            </p>
          </S>
          <S title={L("11. Datenschutz", "11. Privacy")}>
            <p>
              {L("Details unter ", "Details at ")}
              <a href="/datenschutz" className="underline">/datenschutz</a>
              {L(
                ". Kundendaten werden Designer:innen nur pseudonymisiert übermittelt (z.B. \"User 3\"); Klarnamen nur zur Fulfillment-Notwendigkeit (Versandadresse).",
                ". Customer data is shared with designers only in pseudonymised form (e.g. \"User 3\"); real names only where necessary for fulfilment (shipping address).",
              )}
            </p>
          </S>
          <S title={L("12. Schlussbestimmungen", "12. Final Provisions")}>
            <p>
              {L(
                "Gerichtsstand Deutschland, deutsches Recht. Sollte eine Klausel unwirksam sein, bleibt der Rest wirksam. EU-Streitbeilegungs-Plattform: ",
                "Place of jurisdiction Germany, German law. Should any clause be invalid, the remainder stays valid. EU dispute resolution platform: ",
              )}
              <a href="https://ec.europa.eu/consumers/odr/" className="underline">https://ec.europa.eu/consumers/odr/</a>
              {L(". PAWN ist zur Teilnahme an Streitschlichtungsverfahren nicht verpflichtet.",
                ". PAWN is not obliged to participate in dispute resolution proceedings.")}
            </p>
          </S>
        </div>
        <p className="mt-16 text-xs text-black/60">
          {L("Stand", "Last updated")}: {new Date().toLocaleDateString(L("de-DE", "en-GB"))} · {L("Fassung v1 (vorläufig)", "Version 1 (draft)")}
        </p>
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
