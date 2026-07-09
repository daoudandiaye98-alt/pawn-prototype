import { useEffect, useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { supabase } from "@/integrations/supabase/client";

interface Business {
  legal_name?: string; contact_email?: string;
  address_line1?: string; address_line2?: string;
  postal_code?: string; city?: string; country?: string;
  vat_id?: string; register?: string;
}

export default function Impressum() {
  const [b, setB] = useState<Business>({});
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
          <p className="palace-eyebrow">Rechtliches</p>
          <h1 className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem,5vw,3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}>
            Impressum.
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            Angaben gemäß § 5 TMG. Vorläufige Fassung — anwaltliche Prüfung ausstehend.
          </p>
        </Reveal>

        <div className="mt-14 space-y-8 font-sans text-[0.95rem] leading-relaxed text-[#000000]/85">
          <Row title="Anbieter">
            {name}<br />
            {b.address_line1 || <em className="text-[#7C7972]">[Adresse wird ergänzt]</em>}<br />
            {b.address_line2 && <>{b.address_line2}<br /></>}
            {[b.postal_code, b.city].filter(Boolean).join(" ") || <em className="text-[#7C7972]">[PLZ Ort]</em>}<br />
            {b.country ?? "Deutschland"}
          </Row>
          <Row title="Vertretungsberechtigt">Daouda Ndiaye</Row>
          <Row title="Kontakt">
            E-Mail: <a href={`mailto:${email}`} className="underline">{email}</a>
          </Row>
          {b.register && <Row title="Registereintrag">{b.register}</Row>}
          {b.vat_id && <Row title="Umsatzsteuer-ID">{b.vat_id}</Row>}
          <Row title="Verantwortlich für Inhalte (§ 55 Abs. 2 RStV)">Daouda Ndiaye · Anschrift wie oben</Row>
          <Row title="EU-Streitbeilegung">
            Plattform der EU-Kommission: <a href="https://ec.europa.eu/consumers/odr/" className="underline">https://ec.europa.eu/consumers/odr/</a>.
            Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucher-schlichtungsstelle teilzunehmen.
          </Row>
          {addrMissing && (
            <p className="border border-dashed border-[rgba(0,0,0,.28)] p-3 text-xs text-[#7C7972]">
              Adressfelder sind noch leer. Admins können sie in <code>ai_config.business_profile</code> ergänzen.
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
