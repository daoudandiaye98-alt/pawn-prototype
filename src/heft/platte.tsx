/**
 * Teil X10 — die Platten.
 *
 * Zwei Formate, weil eine Doppelseite bei 1.44/1 steht und eine Seite damit bei
 * rund 0,72/1:
 *
 *   `<Platte>`       3:4, ganzseitig — füllt eine Seite randabfallend
 *   `<PlatteBund>`   3:2, über den Bund — läuft über beide Seiten
 *
 * **Heruntergeladen, nicht verlinkt.** Die Dateien liegen im Projekt unter
 * `public/heft/` und werden mit dem Frontend ausgeliefert. Die Quelladressen des
 * Bildgenerators laufen ab; ein Verweis dorthin wäre ein Bild mit Verfallsdatum.
 *
 * **Warum `public/heft/` und nicht der Speicher-Eimer `site-assets`.** X10 nennt
 * `site-assets/heft/` als Ziel. Das ist kein Ordner im Projekt, sondern ein
 * Supabase-Storage-Eimer — und der hängt an derselben Datenbank, die gerade nicht
 * antwortet. Seitenmöbel, die aus der Datenbank kommen, fehlen genau dann, wenn
 * die Datenbank fehlt; das Heft wäre dann leeres Papier. Deshalb liegen die
 * Platten im Auslieferungsordner: sie sind Teil der Hülle, nicht Teil der Daten.
 *
 * **Auflösung.** Der Generator hat 896×1200 bzw. 1264×848 geliefert. Mehr ist
 * nicht da, und Hochskalieren erfindet Schärfe — deshalb ist die größte Breite
 * 894 bzw. 1260 und nicht mehr. Auf einem Telefon mit dreifacher Pixeldichte
 * reicht das nicht ganz an die Gerätebreite; wer scharfere Platten will, muss sie
 * größer erzeugen lassen, nicht größer rechnen.
 */

/** Die drei Breiten je Format. Sie stehen hier, weil sie auf der Platte stehen. */
const BREITEN_SEITE = [447, 672, 894];
const BREITEN_BUND = [630, 945, 1260];

function satz(name: string, breiten: number[]): string {
  return breiten.map((b) => `/heft/${name}-${b}.webp ${b}w`).join(", ");
}

export interface PlatteProps {
  /** Dateiname ohne Breite und Endung, z. B. `mode-stange`. */
  name: string;
  /**
   * Was auf der Platte zu sehen ist — für die Vorlesehilfe.
   *
   * Kein leeres `alt`: diese Platten tragen die Sektion, sie sind keine
   * Verzierung. Wer nicht sieht, soll erfahren, was da steht.
   */
  alt: string;
  /**
   * `true` nur für die Platte, die beim Aufschlagen schon sichtbar ist.
   *
   * Alle anderen werden nachgeladen. Das ist die Umsetzung von X11 — mit einer
   * Einschränkung, die hier benannt sein soll: `loading="lazy"` misst am
   * Sichtfeld, und im Wendel liegen alle Blätter im Sichtfeld. Was ferne Blätter
   * wirklich vom Zeichnen abhält, ist `content-visibility: auto` auf
   * `.hx-blatt.fern` (siehe `heft.css`) und das Aufteilen des Bündels je
   * Sektion. Das Attribut steht trotzdem, weil es im zweiten Weg — der
   * senkrechten Folge — genau das tut, was es soll.
   */
  zuerst?: boolean;
}

/** 3:4, eine ganze Seite. Randabfallend, der Ausschnitt ist mittig. */
export function Platte({ name, alt, zuerst }: PlatteProps) {
  return (
    <div className="hx-platte">
      <img
        src={`/heft/${name}-${BREITEN_SEITE[1]}.webp`}
        srcSet={satz(name, BREITEN_SEITE)}
        /* Eine Seite ist die halbe Doppelseite — auf dem Telefon die ganze. */
        sizes="(max-width: 820px) 100vw, 50vw"
        alt={alt}
        width={894}
        height={1192}
        loading={zuerst ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
}

/**
 * 3:2, über den Bund.
 *
 * Ein Bild kann nicht wirklich über zwei Blattflächen laufen — die linke Seite
 * einer Doppelseite ist die Rückseite des einen Blatts, die rechte die
 * Vorderseite des nächsten. Deshalb steht die Platte zweimal im DOM, jede Seite
 * doppelt so breit wie ihre Seite und an ihre Bundkante geschoben: links zeigt
 * die linke Hälfte, rechts die rechte. Zusammen ergibt das die ganze Platte,
 * mit der Rille des Bundes genau in ihrer Mitte — wie im gedruckten Heft.
 *
 * Die zweite Kopie kostet keinen zweiten Download: es ist dieselbe Adresse.
 */
export function PlatteBund({ name, alt, zuerst }: PlatteProps) {
  return (
    <div className="hx-platte hx-platte-bund">
      <img
        src={`/heft/${name}-${BREITEN_BUND[1]}.webp`}
        srcSet={satz(name, BREITEN_BUND)}
        /* Das Bild ist doppelt so breit wie die Seite, auf der es steht. */
        sizes="(max-width: 820px) 200vw, 100vw"
        alt={alt}
        width={1260}
        height={840}
        loading={zuerst ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
}

/**
 * Die Platte als Band am Kopf der Seite — nur auf dem Telefon.
 *
 * **Warum das nötig ist.** Gemessen bei 390 px: von der Sektion Mode war nur die
 * dunkle Textseite zu sehen, die Platte lag links außerhalb des Bildschirms. Das
 * ist keine Nachlässigkeit, sondern Geometrie: bei ≤ 820 px zeigt das Heft eine
 * Einzelseite, und ein Blatt, das um seine linke Kante wendet, verlässt dabei den
 * Rahmen. Die linke Seite einer Doppelseite kann auf dem Telefon also gar nicht
 * erscheinen — und X10 stellt die ganzseitigen Platten genau dorthin.
 *
 * Deshalb steht die Platte auf schmalen Geräten ein zweites Mal, als Band über
 * dem Satz der rechten Seite. Dieselbe Adresse, also kein zweiter Download; die
 * jeweils nicht gebrauchte Fassung steht auf `display: none` und wird damit weder
 * geladen noch vorgelesen.
 *
 * Das ist eine Antwort auf einen Widerspruch im Auftrag, keine Auslegung davon:
 * X3 verlangt die Einzelseite, X5 und X10 legen Inhalt auf die Seite, die eine
 * Einzelseite nicht zeigen kann. Die Entscheidung gehört gemeldet.
 */
export function PlatteBand({ name, alt }: PlatteProps) {
  return (
    <div className="hx-platte-band">
      <img
        src={`/heft/${name}-${BREITEN_SEITE[1]}.webp`}
        srcSet={satz(name, BREITEN_SEITE)}
        sizes="100vw"
        alt={alt}
        width={894}
        height={1192}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/**
 * Der Textblock über einer Platte.
 *
 * **Warum massives Schwarz und kein Verlauf.** Gemessen wurde das schon einmal,
 * auf der alten Landing: weiße Schrift über einem Foto mit Verlauf war an jeder
 * Stelle unterschiedlich stark im Kontrast, also nirgends messbar. Weiß auf
 * `--nacht` sind 21:1, unabhängig davon, wie hell die Platte dahinter ist. Die
 * Lösung war dort richtig und wird hier nicht neu erfunden (Kontrolle 3.3).
 */
export function AufPlatte({ children }: { children: React.ReactNode }) {
  return <div className="hx-auf-platte">{children}</div>;
}
