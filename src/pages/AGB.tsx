import { useEffect, useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { supabase } from "@/integrations/supabase/client";

interface Business { legal_name?: string; contact_email?: string; city?: string; country?: string }

export default function AGB() {
  const [b, setB] = useState<Business>({});
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
          <p className="palace-eyebrow">Rechtliches</p>
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            AGB.
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            Vorläufige Fassung — anwaltliche Prüfung ausstehend. Bis zur finalen Freigabe gelten zusätzlich die gesetzlichen Regelungen.
          </p>
        </Reveal>

        <div className="mt-14 space-y-10 text-[#000000]/85">
          <S title="1. Betreiber & Rolle von PAWN">
            <p>PAWN (Anbieter: {name}, Kontakt: <a href={`mailto:${email}`} className="underline">{email}</a>) betreibt einen kuratierten Online-Marktplatz für unabhängige Designer:innen (Mode, Interior, Kunst). PAWN vermittelt zwischen Kunden und Designern und stellt die Zahlungsabwicklung bereit — PAWN ist nicht selbst Verkäufer der auf der Plattform angebotenen Stücke.</p>
          </S>
          <S title="2. Vertragsschluss">
            <p>Kaufverträge kommen ausschließlich <strong>direkt zwischen Kunde und der jeweiligen Designer:in</strong> zustande. Die Produktseite nennt die verkaufende Marke; deren Angaben (Impressum, Lieferzeiten, Rückgabe) sind maßgeblich. Der Vertrag entsteht mit Bestätigung der Bestellung im Checkout.</p>
          </S>
          <S title="3. Zahlungsabwicklung via Stripe">
            <p>Zahlungen werden über Stripe abgewickelt. PAWN erhält die Zahlung im Namen der Designer:in als Zahlungsvermittler und leitet den Nettobetrag (abzüglich der Plattform-Provision) monatlich an die Designer:in weiter. Verfügbar sind Karte, Apple Pay, Google Pay, PayPal, Klarna (je nach Land).</p>
          </S>
          <S title="4. Plattform-Provision">
            <p><strong>PAWN behält 7% des Bruttoverkaufspreises</strong> je Bestellung als Vermittlungsprovision. Der Provisions-Satz ist auf jeder Produktseite implizit — <em>7% bleiben immer 7%</em>, unabhängig vom gewählten Designer-Plan.</p>
          </S>
          <S title="5. Optionale Pläne für Designer:innen">
            <p>Designer:innen können Zusatzpakete buchen: Haus (0 €/Monat, Basis), Atelier (19 €/Monat), Maison (79 €/Monat). Die Pakete enthalten unterschiedliche Kontingente an Kampagnen-Videos und Zugang zu erweiterten KI-Werkzeugen. <strong>Monatliche Kündigung</strong> jederzeit im Studio möglich; keine Mindestlaufzeit. Kein Einfluss auf die 7%-Provision.</p>
          </S>
          <S title="6. Lieferzeiten, Anfertigungen">
            <p>Lagerware wird nach Bestellung versendet; die Lieferzeit steht auf der Produktseite. <strong>Anfertigungs-Artikel</strong> (made-to-order, Unikate nach Kundenspezifikation) werden erst nach Bestellung produziert. Die auf der Produktseite genannte Lieferzeit ist verbindlich; Verzögerungen kommuniziert die Designer:in direkt.</p>
          </S>
          <S title="7. Gewährleistung">
            <p>Es gelten die gesetzlichen Gewährleistungsregeln (§§ 434 ff. BGB). Ansprüche richten sich <strong>gegen die Designer:in als Verkäufer:in</strong>. PAWN vermittelt bei Bedarf und leitet Reklamationen an die jeweilige Marke weiter.</p>
          </S>
          <S title="8. Widerrufsrecht">
            <p>Verbraucher:innen steht ein 14-tägiges Widerrufsrecht zu. Details und Formular unter <a href="/widerruf" className="underline">/widerruf</a>. <strong>Ausnahme:</strong> Waren, die nach Kundenspezifikation angefertigt wurden (Anfertigungs-Artikel).</p>
          </S>
          <S title="9. Haftung">
            <p>PAWN haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach dem Produkthaftungsgesetz. Für einfache Fahrlässigkeit haftet PAWN nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>
          </S>
          <S title="10. Nutzerpflichten & Bildrechte">
            <p>Designer:innen versichern, an allen hochgeladenen Inhalten die Rechte zu halten. PAWN nutzt Bild-/Videomaterial zur Präsentation im Katalog und in Kampagnen. Diese Nutzung ist <strong>widerruflich</strong> — Anfrage per Nachricht im Studio, Löschung binnen 14 Tagen.</p>
          </S>
          <S title="11. Datenschutz">
            <p>Details unter <a href="/datenschutz" className="underline">/datenschutz</a>. Kundendaten werden Designer:innen nur pseudonymisiert übermittelt (z.B. "User 3"); Klarnamen nur zur Fulfillment-Notwendigkeit (Versandadresse).</p>
          </S>
          <S title="12. Schlussbestimmungen">
            <p>Gerichtsstand Deutschland, deutsches Recht. Sollte eine Klausel unwirksam sein, bleibt der Rest wirksam. EU-Streitbeilegungs-Plattform: <a href="https://ec.europa.eu/consumers/odr/" className="underline">https://ec.europa.eu/consumers/odr/</a>. PAWN ist zur Teilnahme an Streitschlichtungsverfahren nicht verpflichtet.</p>
          </S>
        </div>
        <p className="mt-16 text-xs text-[#7C7972]">Stand: {new Date().toLocaleDateString("de-DE")} · Fassung v1 (vorläufig)</p>
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
