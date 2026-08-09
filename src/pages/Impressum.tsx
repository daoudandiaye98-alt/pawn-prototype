import { useEffect, useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { LegalTranslationNote } from "@/components/palace/LegalTranslationNote";
import { supabase } from "@/integrations/supabase/client";
import { useLegalText } from "@/lib/legalText";

interface Business {
  legal_name?: string; contact_email?: string;
  address_line1?: string; address_line2?: string;
  postal_code?: string; city?: string; country?: string;
  vat_id?: string; register?: string;
}

export default function Impressum() {
  const [b, setB] = useState<Business>({});
  const L = useLegalText();
  useEffect(() => {
    supabase.from("ai_config").select("value").eq("key", "business_profile").maybeSingle()
      .then(({ data }) => data?.value && setB(data.value as Business));
  }, []);

  const name = b.legal_name ?? "Daouda Ndiaye · PAWN";
  const email = b.contact_email ?? "pawnstudio.co@gmail.com";
  const addrMissing = !b.address_line1 || !b.city || !b.postal_code;

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">{L("Rechtliches", "Legal")}</p>
          <LegalTranslationNote />
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {L("Impressum.", "Legal Notice.")}
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            {L("Angaben gemäß § 5 TMG. Vorläufige Fassung — anwaltliche Prüfung ausstehend.",
              "Information pursuant to § 5 TMG (German Telemedia Act). Draft version — legal review pending.")}
          </p>
        </Reveal>

        <div className="mt-14 space-y-8 font-sans text-[0.95rem] leading-relaxed text-[#000000]/85">
          <Row title={L("Anbieter", "Provider")}>
            {name}<br />
            {b.address_line1 || <em className="text-black/60">{L("[Adresse wird ergänzt]", "[address to be added]")}</em>}<br />
            {b.address_line2 && <>{b.address_line2}<br /></>}
            {[b.postal_code, b.city].filter(Boolean).join(" ") || <em className="text-black/60">{L("[PLZ Ort]", "[postal code, city]")}</em>}<br />
            {b.country ?? L("Deutschland", "Germany")}
          </Row>
          <Row title={L("Vertretungsberechtigt", "Represented by")}>Daouda Ndiaye</Row>
          <Row title={L("Kontakt", "Contact")}>
            {L("E-Mail", "Email")}: <a href={`mailto:${email}`} className="underline">{email}</a>
          </Row>
          {b.register && <Row title={L("Registereintrag", "Register entry")}>{b.register}</Row>}
          {b.vat_id && <Row title={L("Umsatzsteuer-ID", "VAT ID")}>{b.vat_id}</Row>}
          <Row title={L("Verantwortlich für Inhalte (§ 55 Abs. 2 RStV)", "Responsible for content (§ 55(2) RStV)")}>
            {L("Daouda Ndiaye · Anschrift wie oben", "Daouda Ndiaye · address as above")}
          </Row>
          <Row title={L("EU-Streitbeilegung", "EU dispute resolution")}>
            {L("Plattform der EU-Kommission", "European Commission platform")}: <a href="https://ec.europa.eu/consumers/odr/" className="underline">https://ec.europa.eu/consumers/odr/</a>.{" "}
            {L("Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucher-schlichtungsstelle teilzunehmen.",
              "We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board.")}
          </Row>
          {addrMissing && (
            <p className="border border-dashed border-[rgba(0,0,0,.28)] p-3 text-xs text-black/60">
              {L("Adressfelder sind noch leer. Admins können sie in ", "Address fields are still empty. Admins can fill them in via ")}
              <code>ai_config.business_profile</code>
              {L(" ergänzen.", ".")}
            </p>
          )}
        </div>
      </section>
    </PalaceLayout>
  );
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[rgba(0,0,0,.18)] pt-6">
      <p className="palace-eyebrow">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
