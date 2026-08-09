import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { LegalTranslationNote } from "@/components/palace/LegalTranslationNote";
import { useLegalText } from "@/lib/legalText";

export default function Datenschutz() {
  const L = useLegalText();
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">{L("Rechtliches", "Legal")}</p>
          <LegalTranslationNote />
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            {L("Datenschutz.", "Privacy Policy.")}
          </h1>
          <p className="mt-8 font-serif italic text-[#000000]/70">
            {L(
              "Diese Seite ist ein solides deutsches Gerüst. Vor Launch bitte durch eine Kanzlei prüfen und ergänzen. Alle Punkte markiert mit",
              "This page is a solid German draft. Please have it reviewed and completed by a law firm before launch. All items marked with",
            )}
            <strong> TODO</strong>
            {L(" brauchen finale rechtliche Formulierung.", " need final legal wording.")}
          </p>
        </Reveal>

        <div className="palace-serif mt-16 space-y-10 text-[#000000]/85">
          <Section title={L("1. Verantwortlicher", "1. Data Controller")}>
            <p>
              {L(
                "PAWN [TODO: Firmenname, Anschrift, Kontakt]. E-Mail: ",
                "PAWN [TODO: company name, address, contact]. Email: ",
              )}
              <a href="mailto:pawnstudio.co@gmail.com" className="underline">pawnstudio.co@gmail.com</a>.
            </p>
          </Section>

          <Section title={L("2. Welche Daten wir verarbeiten", "2. What Data We Process")}>
            <ul className="list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li>
                <strong>{L("Konto:", "Account:")}</strong>{" "}
                {L(
                  "E-Mail, angezeigter Name, Rollen (Kunde, Designer:in, Admin), Zeitpunkte.",
                  "Email, display name, roles (customer, designer, admin), timestamps.",
                )}
              </li>
              <li>
                <strong>{L('Chat mit PAWN ("Frag PAWN"):', 'Chat with PAWN ("Ask PAWN"):')}</strong>{" "}
                {L(
                  "Deine Nachrichten und eine anonyme Session-ID (in deinem Browser gespeichert), damit wir dir passende Stücke zeigen können. Angemeldete werden zusätzlich mit ihrer Nutzer-ID verknüpft.",
                  "Your messages and an anonymous session ID (stored in your browser) so we can show you matching pieces. Signed-in users are additionally linked to their user ID.",
                )}
              </li>
              <li>
                <strong>{L("Geschmackssignale:", "Taste Signals:")}</strong>{" "}
                {L(
                  "Aus dem Chat extrahieren wir Welt (Mode/Interior/Kunst), Stimmung und Anlass — nicht deinen Rohtext für Werbezwecke, sondern für die Empfehlung im Katalog.",
                  "From the chat we extract world (fashion/interior/art), mood, and occasion — not your raw text for advertising purposes, but for recommendations in the catalogue.",
                )}
              </li>
              <li>
                <strong>{L("Bewerbung als Designer:in:", "Application as a Designer:")}</strong>{" "}
                {L(
                  "Brand-Name, Portfolio-Uploads, Verträge/Consents.",
                  "Brand name, portfolio uploads, contracts/consents.",
                )}
              </li>
              <li>
                <strong>{L("Bestellungen:", "Orders:")}</strong>{" "}
                {L("Rechnungs-/Versanddaten, wenn du kaufst.", "Billing/shipping data, when you make a purchase.")}
              </li>
            </ul>
          </Section>

          <Section title={L("3. Zwecke und Rechtsgrundlagen", "3. Purposes and Legal Bases")}>
            <ul className="list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li>
                {L(
                  "Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) — Konto, Bestellungen, Designer-Portal.",
                  "Performance of contract (Art. 6(1)(b) GDPR) — account, orders, designer portal.",
                )}
              </li>
              <li>
                {L(
                  "Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) — Personalisierung deiner Empfehlungen ohne Tracking-Cookies.",
                  "Legitimate interest (Art. 6(1)(f) GDPR) — personalising your recommendations without tracking cookies.",
                )}
              </li>
              <li>
                {L(
                  "Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) — freiwillige Angaben im Chat.",
                  "Consent (Art. 6(1)(a) GDPR) — voluntary information provided in the chat.",
                )}
              </li>
            </ul>
          </Section>

          <Section title={L("4. Abgeleitete Verhaltensprofile", "4. Derived Behavioural Profiles")}>
            <p>
              {L(
                'Aus deinem Kaufverhalten und deinen Aufrufen leiten wir automatisiert ein grobes Verhaltensprofil ab (z. B. „hat sich umgesehen, aber noch nichts gekauft" oder „kauft gezielt bei einem Haus"). Grundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer sinnvollen Reihenfolge und Empfehlung). ',
                'From your purchasing behaviour and page views we automatically derive a rough behavioural profile (e.g. "has browsed but not yet bought" or "buys specifically from one house"). Legal basis: Art. 6(1)(f) GDPR (legitimate interest in meaningful ordering and recommendations). ',
              )}
              <strong>
                {L(
                  "Diese Profile beeinflussen ausschließlich Reihenfolge und Empfehlung — niemals Preis, Verfügbarkeit, Versand oder Angebot.",
                  "These profiles influence only ordering and recommendations — never price, availability, shipping, or offers.",
                )}
              </strong>{" "}
              {L(
                "Sie werden nur aggregiert für Admin-Auswertungen verwendet, nie mit deinem Namen oder deiner E-Mail an Designer:innen weitergegeben. Du kannst der Bildung eines solchen Profils jederzeit widersprechen (Art. 21 DSGVO) — schreib an die Kontaktadresse in Abschnitt 10, wir schalten die Personalisierung für dein Konto dann ab. [TODO: exakte Frist zur Umsetzung final durch Kanzlei prüfen]",
                "They are used only in aggregated form for admin analytics and are never passed on to designers along with your name or email. You can object to the creation of such a profile at any time (Art. 21 GDPR) — write to the contact address in section 10 and we will disable personalisation for your account. [TODO: exact implementation deadline to be confirmed by a law firm]",
              )}
            </p>
          </Section>

          <Section title={L("5. Cookies und persistente Speicherung", "5. Cookies and Persistent Storage")}>
            <p>
              {L(
                "Nach deiner ausdrücklichen Zustimmung nutzen wir einen technischen Cookie ",
                "With your explicit consent we use a technical cookie ",
              )}
              <code>pawn_consent</code>
              {L(" sowie lokalen Speicher (", " as well as local storage (")}
              <em>localStorage</em>
              {L(") unter Schlüsseln wie ", ") under keys such as ")}
              <code>palace.chat.session_id</code> {L("und", "and")} <code>pawn.personalization.cache.v1</code>.{" "}
              {L(
                "Zweck: dass PAWN dich bei erneuten Besuchen wiedererkennt und deine Geschmackssignale — deinem Konto zugeordnet — weiterführt. Wenn du nur „notwendige“ wählst, behalten wir keine Signale zwischen Sitzungen. ",
                "Purpose: so PAWN recognises you on repeat visits and continues your taste signals — linked to your account. If you choose only \"necessary\", we retain no signals between sessions. ",
              )}
              <strong>{L("Widerruf jederzeit", "Withdrawal at any time")}</strong>{" "}
              {L(
                'über den Link „Cookie-Einstellungen" im Footer oder in deinem Konto unter „Meine Daten". Speicherdauer für den Consent-Cookie: 12 Monate. Deine Signale löschen wir mit deinem Konto vollständig.',
                'via the "Cookie Settings" link in the footer or in your account under "My Data". Retention period for the consent cookie: 12 months. Your signals are fully deleted along with your account.',
              )}
            </p>
          </Section>

          <Section title={L("6. Speicherdauer", "6. Retention Period")}>
            <p>
              {L(
                "Konto- und Bestelldaten so lange, wie gesetzlich vorgeschrieben. Chat-Sessions und Geschmackssignale bis zu 24 Monate ab letzter Aktivität, danach automatische Löschung oder Anonymisierung. [TODO: exakte Fristen final durch Kanzlei prüfen]",
                "Account and order data for as long as legally required. Chat sessions and taste signals for up to 24 months from last activity, after which they are automatically deleted or anonymised. [TODO: exact retention periods to be confirmed by a law firm]",
              )}
            </p>
          </Section>

          <Section title={L("7. Deine Rechte", "7. Your Rights")}>
            <p>
              {L(
                'Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerruf erteilter Einwilligungen. In deinem Konto findest du unter „Meine Daten" die Buttons ',
                'Access, rectification, erasure, restriction, data portability, withdrawal of consent given. In your account under "My Data" you will find the buttons ',
              )}
              <em>{L("Daten exportieren", "Export data")}</em> {L("und", "and")}{" "}
              <em>{L("Konto löschen", "Delete account")}</em>.{" "}
              {L(
                "Die Konto-Löschung entfernt nachweislich auch alle Signale und Sessions. Beschwerde bei einer Datenschutz-Aufsichtsbehörde ist möglich.",
                "Account deletion demonstrably removes all signals and sessions as well. You may lodge a complaint with a data protection supervisory authority.",
              )}
            </p>
          </Section>

          <Section title={L("8. Empfänger", "8. Recipients")}>
            <p>
              {L(
                "Hosting und Datenbank: [TODO: Anbieter benennen]. Zahlungsdienstleister: [TODO]. Keine Weitergabe an Werbenetzwerke.",
                "Hosting and database: [TODO: name provider]. Payment service provider: [TODO]. No disclosure to advertising networks.",
              )}
            </p>
          </Section>

          <Section title={L("9. Keine Tracking-Cookies Dritter", "9. No Third-Party Tracking Cookies")}>
            <p>
              {L(
                "Wir setzen keine Werbe- oder Analytics-Cookies Dritter. Nur die oben beschriebene erst-Party-Speicherung.",
                "We do not use third-party advertising or analytics cookies. Only the first-party storage described above.",
              )}
            </p>
          </Section>

          <Section title={L("10. Kontakt", "10. Contact")}>
            <p>
              {L("Fragen zum Datenschutz: ", "Questions about privacy: ")}
              <a href="mailto:pawnstudio.co@gmail.com" className="underline">pawnstudio.co@gmail.com</a>.
            </p>
          </Section>
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
