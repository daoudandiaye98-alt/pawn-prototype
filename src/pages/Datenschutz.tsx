import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";

export default function Datenschutz() {
  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[820px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Rechtliches</p>
          <h1
            className="palace-serif mt-6 font-light text-[#0C0C0E]"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Datenschutz.
          </h1>
          <p className="mt-8 font-serif italic text-[#0C0C0E]/70">
            Diese Seite ist ein solides deutsches Gerüst. Vor Launch bitte durch eine Kanzlei prüfen und ergänzen. Alle Punkte markiert mit
            <strong> TODO</strong> brauchen finale rechtliche Formulierung.
          </p>
        </Reveal>

        <div className="palace-serif mt-16 space-y-10 text-[#0C0C0E]/85">
          <Section title="1. Verantwortlicher">
            <p>PAWN [TODO: Firmenname, Anschrift, Kontakt]. E-Mail: kontakt@pawn.example.</p>
          </Section>

          <Section title="2. Welche Daten wir verarbeiten">
            <ul className="list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li><strong>Konto:</strong> E-Mail, angezeigter Name, Rollen (Kunde, Designer:in, Admin), Zeitpunkte.</li>
              <li><strong>Chat mit PAWN ("Frag PAWN"):</strong> Deine Nachrichten und eine anonyme Session-ID (in deinem Browser gespeichert), damit wir dir passende Stücke zeigen können. Angemeldete werden zusätzlich mit ihrer Nutzer-ID verknüpft.</li>
              <li><strong>Geschmackssignale:</strong> Aus dem Chat extrahieren wir Welt (Mode/Interior/Kunst), Stimmung und Anlass — nicht deinen Rohtext für Werbezwecke, sondern für die Empfehlung im Katalog.</li>
              <li><strong>Bewerbung als Designer:in:</strong> Brand-Name, Portfolio-Uploads, Verträge/Consents.</li>
              <li><strong>Bestellungen:</strong> Rechnungs-/Versanddaten, wenn du kaufst.</li>
            </ul>
          </Section>

          <Section title="3. Zwecke und Rechtsgrundlagen">
            <ul className="list-disc space-y-2 pl-6 font-sans text-[0.95rem]">
              <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) — Konto, Bestellungen, Designer-Portal.</li>
              <li>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) — Personalisierung deiner Empfehlungen ohne Tracking-Cookies.</li>
              <li>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) — freiwillige Angaben im Chat.</li>
            </ul>
          </Section>

          <Section title="4. Cookies und persistente Speicherung">
            <p>
              Nach deiner ausdrücklichen Zustimmung nutzen wir einen technischen Cookie <code>pawn_consent</code> sowie
              lokalen Speicher (<em>localStorage</em>) unter Schlüsseln wie <code>palace.chat.session_id</code> und
              <code>pawn.personalization.cache.v1</code>. Zweck: dass PAWN dich bei erneuten Besuchen wiedererkennt und
              deine Geschmackssignale — deinem Konto zugeordnet — weiterführt. Wenn du nur „notwendige" wählst,
              behalten wir keine Signale zwischen Sitzungen. <strong>Widerruf jederzeit</strong> über den Link
              „Cookie-Einstellungen" im Footer oder in deinem Konto unter „Meine Daten". Speicherdauer für den
              Consent-Cookie: 12 Monate. Deine Signale löschen wir mit deinem Konto vollständig.
            </p>
          </Section>

          <Section title="5. Speicherdauer">
            <p>Konto- und Bestelldaten so lange, wie gesetzlich vorgeschrieben. Chat-Sessions und Geschmackssignale
              bis zu 24 Monate ab letzter Aktivität, danach automatische Löschung oder Anonymisierung.
              [TODO: exakte Fristen final durch Kanzlei prüfen]</p>
          </Section>

          <Section title="6. Deine Rechte">
            <p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerruf erteilter Einwilligungen.
              In deinem Konto findest du unter „Meine Daten" die Buttons <em>Daten exportieren</em> und <em>Konto löschen</em>.
              Die Konto-Löschung entfernt nachweislich auch alle Signale und Sessions. Beschwerde bei einer
              Datenschutz-Aufsichtsbehörde ist möglich.</p>
          </Section>

          <Section title="7. Empfänger">
            <p>Hosting und Datenbank: [TODO: Anbieter benennen]. Zahlungsdienstleister: [TODO]. Keine Weitergabe an Werbenetzwerke.</p>
          </Section>

          <Section title="8. Keine Tracking-Cookies Dritter">
            <p>Wir setzen keine Werbe- oder Analytics-Cookies Dritter. Nur die oben beschriebene erst-Party-Speicherung.</p>
          </Section>


          <Section title="9. Kontakt">
            <p>Fragen zum Datenschutz: <a href="mailto:datenschutz@pawn.example" className="underline">datenschutz@pawn.example</a>.</p>
          </Section>
        </div>
      </section>
    </PalaceLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-[1.4rem] italic text-[#0C0C0E]">{title}</h2>
      <div className="mt-3 font-sans text-[0.95rem] leading-relaxed">{children}</div>
    </section>
  );
}
