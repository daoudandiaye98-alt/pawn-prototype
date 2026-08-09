import { useEffect, useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { LegalTranslationNote } from "@/components/palace/LegalTranslationNote";
import { supabase } from "@/integrations/supabase/client";

interface Business {
  legal_name?: string; contact_email?: string;
  address_line1?: string; address_line2?: string;
  postal_code?: string; city?: string; country?: string;
}

export default function Datenschutz() {
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
          <LegalTranslationNote />
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Datenschutz.
          </h1>
          <p className="mt-8 border-l-2 border-[#000000] bg-[rgba(0,0,0,.04)] px-4 py-3 font-serif italic text-[#000000]/80">
            Vorläufige Fassung — anwaltliche Prüfung ausstehend. Wo Angaben noch fehlen, ist das offen markiert statt geraten.
          </p>
        </Reveal>

        <div className="palace-serif mt-16 space-y-10 text-[#000000]/85">
          <Section title="1. Verantwortlicher">
            <p>
              {name}<br />
              {b.address_line1 || <em className="text-black/60">[Adresse wird ergänzt]</em>}<br />
              {b.address_line2 && <>{b.address_line2}<br /></>}
              {[b.postal_code, b.city].filter(Boolean).join(" ") || <em className="text-black/60">[PLZ Ort]</em>}<br />
              {b.country ?? "Deutschland"}<br />
              E-Mail: <a href={`mailto:${email}`} className="underline">{email}</a>
            </p>
          </Section>

          <Section title="2. Welche Daten wir verarbeiten">
            <ul className="list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li><strong>Konto:</strong> E-Mail, angezeigter Name, Rollen (Kunde, Designer:in, Admin), Zeitpunkte. Anmeldung wahlweise per Passwort oder über Google (OAuth) — Google erhält dabei nur die zur Anmeldung nötigen Basisdaten, keine weiteren Berechtigungen.</li>
              <li><strong>Chat mit PAWN ("Frag PAWN"):</strong> Deine Nachrichten und eine anonyme Session-ID (in deinem Browser gespeichert), damit wir dir passende Stücke zeigen können. Angemeldete werden zusätzlich mit ihrer Nutzer-ID verknüpft. Die Antworten erzeugen KI-Sprachmodelle von Anthropic (Claude) bzw. OpenAI — deine Nachrichten werden zur Verarbeitung an diese Anbieter übermittelt (siehe Abschnitt 8).</li>
              <li><strong>Geschmackssignale:</strong> Aus dem Chat extrahieren wir Welt (Mode/Interior/Kunst), Stimmung und Anlass — nicht deinen Rohtext für Werbezwecke, sondern für die Empfehlung im Katalog.</li>
              <li><strong>Bewerbung als Designer:in:</strong> Brand-Name, Portfolio-Uploads, Verträge/Zustimmungen (revisionssicher protokolliert: welche Vertragsversion, wann, mit welchem Text-Prüfwert).</li>
              <li><strong>Bild-/Video-Erzeugung im Designer-Studio:</strong> Hochgeladene Produktfotos und daraus erzeugte Kampagnenbilder/-videos (Anprobe-Darstellungen, Produktfotos, Kurzvideos) — verarbeitet über die Dienste fal.ai (Anprobe-Bilder, Produktfotos) und WAN (Video), siehe Abschnitt 8. Ob PAWN erzeugte Aufnahmen zusätzlich zur Werbung für die Plattform nutzen darf, entscheidet jedes Haus selbst per einmaliger, jederzeit widerruflicher Zustimmung im Studio.</li>
              <li><strong>Bestellungen:</strong> Rechnungs-/Versanddaten, wenn du kaufst. Die Zahlung selbst wickelt der Zahlungsdienstleister Stripe ab (siehe Abschnitt 8) — Kartendaten laufen nie über unsere eigenen Server.</li>
              <li><strong>Aufrufe/Nutzung:</strong> welche Seiten wie oft aufgerufen werden (erste Partei, kein Tracking Dritter) — für Reihenfolge/Empfehlung, siehe Abschnitt 4.</li>
            </ul>
          </Section>

          <Section title="3. Zwecke und Rechtsgrundlagen">
            <ul className="list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) — Konto, Bestellungen, Designer-Portal, Zahlungsabwicklung.</li>
              <li>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) — Personalisierung deiner Empfehlungen, Betrieb und Absicherung der Plattform, Ansprache möglicher neuer Häuser (siehe Abschnitt 7).</li>
              <li>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) — freiwillige Angaben im Chat, Cookie-Einstellungen, Nutzung von Bild-/Videomaterial zu Werbezwecken über die eigene Präsentation hinaus.</li>
            </ul>
          </Section>

          <Section title="4. Abgeleitete Verhaltensprofile">
            <p>
              Aus deinem Kaufverhalten und deinen Aufrufen leiten wir automatisiert ein grobes Verhaltensprofil ab
              (z. B. „hat sich umgesehen, aber noch nichts gekauft" oder „kauft gezielt bei einem Haus"). Grundlage:
              Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer sinnvollen Reihenfolge und Empfehlung).{" "}
              <strong>Diese Profile beeinflussen ausschließlich Reihenfolge und Empfehlung — niemals Preis,
              Verfügbarkeit, Versand oder Angebot.</strong> Sie werden nur aggregiert für Admin-Auswertungen
              verwendet, nie mit deinem Namen oder deiner E-Mail an Designer:innen weitergegeben. Du kannst der
              Bildung eines solchen Profils jederzeit widersprechen (Art. 21 DSGVO) — schreib an die Kontaktadresse
              in Abschnitt 11, wir schalten die Personalisierung für dein Konto dann ab.
            </p>
          </Section>

          <Section title="5. Cookies und persistente Speicherung">
            <p>
              Nach deiner ausdrücklichen Zustimmung nutzen wir einen technischen Cookie <code>pawn_consent</code> sowie
              lokalen Speicher (<em>localStorage</em>) unter Schlüsseln wie <code>palace.chat.session_id</code> und
              <code>pawn.personalization.cache.v1</code>. Zweck: dass PAWN dich bei erneuten Besuchen wiedererkennt und
              deine Geschmackssignale — deinem Konto zugeordnet — weiterführt. Wenn du nur „notwendige" wählst,
              behalten wir keine Signale zwischen Sitzungen. <strong>Widerruf jederzeit</strong> über den Link
              „Cookie-Einstellungen" im Footer oder in deinem Konto unter „Meine Daten". Speicherdauer für den
              Consent-Cookie: 12 Monate. Deine Signale löschen wir mit deinem Konto vollständig. Wir setzen keine
              Werbe- oder Analytics-Cookies Dritter — nur die hier beschriebene erst-Party-Speicherung.
            </p>
          </Section>

          <Section title="6. Speicherdauer">
            <p>Konto- und Bestelldaten so lange, wie gesetzlich vorgeschrieben (insb. handels- und steuerrechtliche
              Aufbewahrungsfristen von bis zu 10 Jahren für Rechnungsdaten). Chat-Sessions und Geschmackssignale
              bis zu 24 Monate ab letzter Aktivität, danach automatische Löschung oder Anonymisierung. Für den Akquise-Bereich
              siehe Abschnitt 7. <em>[TODO: exakte Fristen final durch Kanzlei prüfen]</em></p>
          </Section>

          <Section title="7. Kontaktaufnahme mit möglichen neuen Häusern (Akquise)">
            <p>
              PAWN sucht aktiv nach Designer:innen, die zur Plattform passen könnten. Dafür werten wir öffentlich
              zugängliche Informationen aus (z. B. Angaben auf der eigenen Website oder einem öffentlichen
              Geschäftsprofil eines Labels) — <strong>niemals private oder eingeschränkt sichtbare Inhalte</strong>.
              Verarbeitet werden dabei: öffentlicher Name/Marke, öffentlich genannte Kontaktadresse, öffentlich
              sichtbare Bilder des Sortiments zur Einschätzung der stilistischen Passung.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li><strong>Rechtsgrundlage:</strong> berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der gezielten Gewinnung passender Häuser für einen kuratierten Marktplatz.</li>
              <li><strong>Informationspflicht (Art. 14 DSGVO):</strong> diese Erklärung erfüllt die Informationspflicht gegenüber Personen, deren Daten wir nicht direkt bei ihnen selbst erhoben haben. Jede Erstansprache per E-Mail benennt diese Datenquelle zusätzlich direkt in der Nachricht.</li>
              <li><strong>Speicherdauer:</strong> Kontaktdaten, die zu keiner Bewerbung führen, werden nach angemessener Frist auf ein Minimum reduziert (nur ein technischer Kennwert zur dauerhaften Unterdrückung erneuter Ansprache bleibt bestehen).</li>
              <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> jede Nachricht enthält einen direkten Abmeldelink — ein Klick genügt, keine Anmeldung nötig, die Unterdrückung ist dauerhaft und wird bei jedem erneuten Fund derselben Adresse respektiert.</li>
            </ul>
          </Section>

          <Section title="8. Empfänger und Auftragsverarbeiter">
            <p>Wir geben Daten nur an Dienstleister weiter, die sie in unserem Auftrag verarbeiten (Auftragsverarbeitung nach Art. 28 DSGVO) oder als eigenständig Verantwortliche einbinden, wenn das gesetzlich zulässig ist. Keine Weitergabe an Werbenetzwerke.</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li><strong>Hosting Frontend:</strong> Vercel Inc. (USA) — Auslieferung der Website. Datentransfer in die USA über die von Vercel bereitgestellten Standardvertragsklauseln.</li>
              <li><strong>Datenbank, Backend, Datei-Speicher:</strong> Supabase — Konten, Bestellungen, Nachrichten, hochgeladene Bilder.</li>
              <li><strong>Zahlungsabwicklung:</strong> Stripe — Kaufpreise, Abo-Zahlungen, Auszahlungen an Designer:innen (Stripe Connect). Stripe ist eigenständig Verantwortlicher für die von ihm verarbeiteten Zahlungsdaten.</li>
              <li><strong>KI-Chat:</strong> Anthropic (Claude) und/oder OpenAI — Verarbeitung deiner Chat-Nachrichten zur Erzeugung einer Antwort. Kein Training der Modelle mit deinen Daten laut Anbieter-Vereinbarung.</li>
              <li><strong>Bild-/Video-Erzeugung:</strong> fal.ai (Anprobe-Bilder, Produktfotos) und WAN (Kampagnen-Videos) — Verarbeitung hochgeladener Produktfotos zur Erzeugung neuer Aufnahmen.</li>
              <li><strong>E-Mail-Versand:</strong> Resend — Konto-Benachrichtigungen, Bestellbestätigungen, Akquise-Nachrichten an mögliche neue Häuser.</li>
            </ul>
            <p className="mt-3"><em>[TODO: vollständige AVV-Liste mit Vertragsdaten/Sitzland je Anbieter final durch Kanzlei ergänzen]</em></p>
          </Section>

          <Section title="9. Deine Rechte">
            <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch und Widerruf erteilter Einwilligungen.
              In deinem Konto findest du unter „Meine Daten" die Buttons <em>Daten exportieren</em> und <em>Konto löschen</em>.
              Die Konto-Löschung entfernt nachweislich auch alle Signale und Sessions.</p>
          </Section>

          <Section title="10. Aufsichtsbehörde">
            <p>Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist die
              Behörde deines gewöhnlichen Aufenthalts, deines Arbeitsplatzes oder unseres Sitzes.{" "}
              <em className="text-black/60">[TODO: zuständige Landesdatenschutzbehörde je nach endgültigem Firmensitz eintragen]</em></p>
          </Section>

          <Section title="11. Kontakt">
            <p>Fragen zum Datenschutz: <a href={`mailto:${email}`} className="underline">{email}</a>.</p>
          </Section>

          {addrMissing && (
            <p className="border border-dashed border-[rgba(0,0,0,.28)] p-3 font-sans text-xs text-black/60">
              Adressfelder sind noch leer. Admins können sie in <code>ai_config.business_profile</code> ergänzen.
            </p>
          )}
        </div>
      </section>
    </PalaceLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-[1.4rem] italic text-[#000000]">{title}</h2>
      <div className="mt-3 font-sans text-[0.95rem] leading-relaxed">{children}</div>
    </section>
  );
}
