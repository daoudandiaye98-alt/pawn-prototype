/**
 * Teil X7 — das Werk.
 *
 * Ein Werk ist eine Doppelseite: links das Werk, rechts die Angaben. Es ist
 * keine Seite neben dem Heft, sondern eine Seite *im* Heft — mit derselben
 * Hülle, demselben Satzspiegel, demselben Wendel.
 *
 * **Das Werk wird nie beschnitten.** Der Rahmen hat sein eigenes
 * Seitenverhältnis, das Bild sitzt mittig darin, `object-fit: contain`. Das ist
 * die ausdrückliche Ausnahme von der Regel aus Teil Q2 („Werkkarten füllen
 * formatfüllend"): eine Karte ist eine Fläche im Raster und darf beschnitten
 * werden, ein Werk auf seiner eigenen Seite nicht. Ein Bild, das zu 4:5 passend
 * gemacht wird, zeigt nicht mehr, was das Haus gemacht hat.
 *
 * **Voriges und nächstes Werk sind ein Wendel.** Es gibt keine Knöpfe dafür,
 * weil es sie nicht braucht: die Werke liegen als Doppelseiten hintereinander im
 * Heft, in der Reihenfolge des Verzeichnisses. Wer weiterblättert, ist beim
 * nächsten Werk. Das ist der Grund, warum sie überhaupt alle im Heft stehen und
 * nicht nur das gerade aufgerufene.
 *
 * **Ein Weg.** In den Korb — und wo das nicht geht (Auftragsarbeit,
 * Live-Porträt, Maßanfertigung, oder ein Haus ohne freigeschaltete Kasse), ist
 * „Anfragen" der Weg. Nie beides nebeneinander.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { angebotstyp, gefuellteFelder, type Welt } from "@/lib/weltFelder";
import { createCustomRequestThread } from "@/features/messages/customRequest";
import { useInDenKorb } from "@/features/commerce/korb";
import { fliege, ruhigeBewegung } from "@/hooks/useFlug";
import { bildVariante } from "@/lib/media";
import { Auflage } from "./auflage";
import { Bildunterschrift, Fliesstext, Heftseite, Kicker, Schlagzeile, Vorspann } from "./satzspiegel";
import type { Werk } from "./verzeichnis";

/** Der Kolumnentitel eines Werks: das Haus, wenn es eines gibt. */
export const werkKolumne = (w: Werk) => w.haus?.name ?? "Das Werk";

/**
 * Kann dieses Stück in den Korb?
 *
 * Zwei Gründe sprechen dagegen, und beide stehen schon anderswo im Produkt:
 * die Werkart (Auftragsarbeit, Live-Porträt, Maßanfertigung tragen `ohneKauf`
 * in `weltFelder.ts`) und ein Haus ohne freigeschaltete Kasse (`kannVerkaufen`,
 * dieselbe Wahrheit wie auf der alten Werkseite). Gelesen, nicht neu erfunden.
 */
export function kannInDenKorb(w: Werk): boolean {
  const art = (w.dna as { kind?: string } | null)?.kind;
  const typ = angebotstyp((w.welt ?? "Mode") as Welt, art);
  return (w.haus?.kannVerkaufen ?? true) && !typ?.ohneKauf;
}

/* ————————————————— Links: das Werk ————————————————— */

export function WerkSeiteLinks({ werk, folio }: { werk: Werk; folio: number | null }) {
  return (
    <Heftseite lage="links" kolumne={werkKolumne(werk)} folio={folio}>
      <WerkBild werk={werk} />
    </Heftseite>
  );
}

/**
 * Das Bild im Rahmen — antippbar, öffnet den Lichttisch.
 *
 * `useFlug` trägt den Übergang: dasselbe Bild wächst aus dem Rahmen auf den
 * Lichttisch und fällt beim Schließen dorthin zurück. Bei „Bewegung reduzieren"
 * blendet `fliege` nur um; die Auflage funktioniert davon unberührt.
 */
function WerkBild({ werk }: { werk: Werk }) {
  const [offen, setOffen] = useState(false);
  const imRahmen = useRef<HTMLImageElement>(null);
  /*
   * EINE Fassung des Fotos für Rahmen, Lichttisch und Flug.
   *
   * 1600 px, weil der Lichttisch bildschirmfüllend zeigt; dieselbe Adresse für
   * alle drei, damit der Flug nicht auf ein zweites, noch nicht geladenes Bild
   * umschaltet — und damit der Browser genau einmal lädt.
   *
   * Warum überhaupt: das Original ist das, was das Haus hochgeladen hat.
   * Gemessen am 17.08.2026 waren das für ein veröffentlichtes Stück 742 004
   * Byte PNG. Über `bildVariante` sind es 37 028 Byte webp — dieselbe Datei,
   * andere Adresse (siehe `src/lib/media.ts`).
   */
  const bildUrl = bildVariante(werk.bild, { breite: 1600, guete: 82 });
  /** Das Feld, aus dem geflogen wird — beim Öffnen gemessen, beim Schließen das Ziel. */
  const abflug = useRef<{ left: number; top: number; breite: number; hoehe: number } | null>(null);

  const messe = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, breite: r.width, hoehe: r.height };
  };

  const oeffne = useCallback(() => {
    const el = imRahmen.current;
    abflug.current = el ? messe(el) : null;
    setOffen(true);
  }, []);

  const schliesse = useCallback((vonLichttisch: HTMLImageElement | null) => {
    const ziel = imRahmen.current;
    const von = vonLichttisch ? messe(vonLichttisch) : null;
    setOffen(false);
    if (!von || !ziel || !bildUrl || ruhigeBewegung()) return;
    /*
     * Erst im nächsten Bild: die Auflage muss weg sein, bevor der Geist fliegt —
     * sonst läge er dahinter. `fliege` versteckt das Ziel für die Dauer des
     * Flugs selbst und stellt es danach wieder her.
     */
    requestAnimationFrame(() => { void fliege(von, ziel, bildUrl); });
  }, [bildUrl]);

  if (!werk.bild) {
    /* Ohne Bild kein Rahmen und keine Entschuldigung — nur der ehrliche Satz.
       `istZeigbar` lässt eigentlich kein Stück ohne Bild ins Heft; das hier ist
       die Antwort für den Fall, dass es doch einmal passiert. */
    return <Fliesstext>Von diesem Stück liegt noch kein Bild vor.</Fliesstext>;
  }

  return (
    <>
      {/* eslint-disable-next-line no-restricted-syntax */}
      <button type="button" className="hx-werkrahmen" onClick={oeffne} aria-label={`${werk.name} größer ansehen`}>
        <img ref={imRahmen} src={bildUrl} alt={werk.name} decoding="async" />
        <span className="hx-werkrahmen-hinweis" aria-hidden>Größer</span>
      </button>
      {offen && <Lichttisch werk={werk} bildUrl={bildUrl} abflug={abflug.current} aufZu={schliesse} />}
    </>
  );
}

/** Der Lichttisch: das Werk groß, auf schwarzem Grund, ohne Beschnitt. */
function Lichttisch({ werk, bildUrl, abflug, aufZu }: {
  werk: Werk;
  /** Dieselbe Fassung wie im Rahmen — sonst flöge der Übergang auf ein anderes Bild. */
  bildUrl: string | undefined;
  abflug: { left: number; top: number; breite: number; hoehe: number } | null;
  aufZu: (bild: HTMLImageElement | null) => void;
}) {
  const bild = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!abflug || !bildUrl || !bild.current) return;
    void fliege(abflug, bild.current, bildUrl);
    // Nur beim Aufschlagen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Auflage titel={werk.name} ton="nacht" aufZu={() => aufZu(bild.current)}>
      <figure className="hx-lichttisch">
        <img ref={bild} src={bildUrl ?? ""} alt={werk.name} />
        <figcaption>
          {werk.name}
          {werk.haus ? ` · ${werk.haus.name}` : ""}
        </figcaption>
      </figure>
    </Auflage>
  );
}

/* ————————————————— Rechts: die Angaben und der eine Weg ————————————————— */

export function WerkSeiteRechts({ werk, folio }: { werk: Werk; folio: number | null }) {
  const { locale } = useI18n();
  const inDenKorb = useInDenKorb();
  const [groesse, setGroesse] = useState<string | null>(null);
  const [bogen, setBogen] = useState(false);

  const kaufbar = kannInDenKorb(werk);
  const angaben = useMemo(
    () => gefuellteFelder((werk.welt ?? "Mode") as Welt, werk.dna),
    [werk.welt, werk.dna],
  );

  const legen = useCallback(() => {
    inDenKorb(
      {
        id: werk.id,
        slug: werk.slug,
        name: werk.name,
        preis: werk.preis,
        welt: werk.welt,
        bild: werk.bild,
        beschreibung: werk.beschreibung,
        groessen: werk.groessen,
        haus: werk.haus ? { id: werk.haus.id, slug: werk.haus.slug, name: werk.haus.name } : null,
      },
      groesse ?? werk.groessen[0] ?? "",
    );
    toast.success("Im Korb.");
  }, [inDenKorb, werk, groesse]);

  const weg = kaufbar
    ? { text: "In den Korb", tu: legen }
    : { text: "Anfragen", tu: () => setBogen(true) };

  return (
    <Heftseite lage="rechts" kolumne={werkKolumne(werk)} folio={folio} weg={weg}>
      <Kicker>{[werk.welt, werk.haus?.name].filter(Boolean).join(" · ")}</Kicker>
      <Schlagzeile>{werk.name}</Schlagzeile>
      <Vorspann>{formatPrice(werk.preis, locale)}</Vorspann>
      {werk.beschreibung ? <Fliesstext>{werk.beschreibung}</Fliesstext> : null}

      {/* Die Angaben der Welt. Was leer ist, steht hier nicht — kein Strich,
          kein „k. A.", keine erfundene Zeile. Dieselbe Regel wie auf der alten
          Werkseite, dieselbe Quelle (`gefuellteFelder`). */}
      {angaben.length > 0 && (
        <dl className="hx-werk-angaben">
          {angaben.map(({ feld, wert }) => (
            <div key={feld.schluessel}>
              <dt>{feld.label}</dt>
              <dd>{wert}</dd>
            </div>
          ))}
        </dl>
      )}

      {kaufbar && werk.groessen.length > 0 && (
        <GroessenWahl
          groessen={werk.groessen}
          gewaehlt={groesse ?? werk.groessen[0]}
          aufWahl={setGroesse}
        />
      )}

      {!kaufbar && (
        <Bildunterschrift>
          Dieses Stück entsteht nach Absprache. Der Weg dorthin ist die Anfrage.
        </Bildunterschrift>
      )}

      {bogen && <Anfragebogen werk={werk} aufZu={() => setBogen(false)} />}
    </Heftseite>
  );
}

/** Die Größen als Reihe — Auswahl, kein Aufklappmenü. */
function GroessenWahl({ groessen, gewaehlt, aufWahl }: {
  groessen: string[];
  gewaehlt: string;
  aufWahl: (g: string) => void;
}) {
  return (
    <div className="hx-groessen" role="group" aria-label="Größe">
      {groessen.map((g) => (
        /* Ausnahme wie im Griffregister: das Heft hat seine eigene Form, und
           `<Button>` brächte die des Palasts mit. */
        /* eslint-disable-next-line no-restricted-syntax */
        <button
          key={g}
          type="button"
          className="hx-groesse"
          data-hier={g === gewaehlt || undefined}
          aria-pressed={g === gewaehlt}
          onClick={() => aufWahl(g)}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

/* ————————————————— Der Anfragebogen ————————————————— */

const BUDGETS = ["bis 200 €", "200–500 €", "500–1000 €", "ab 1000 €"];

/**
 * Die Anfrage — eine Auflage, kein Sprung aus dem Heft.
 *
 * Sie schreibt in denselben Kanal wie die alte Werkseite
 * (`createCustomRequestThread`): ein Gesprächsfaden beim Haus, mit dem Stück
 * daran. Kein zweiter Weg, kein zweites Postfach.
 */
function Anfragebogen({ werk, aufZu }: { werk: Werk; aufZu: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const senden = async () => {
    if (!user || !werk.haus) return;
    if (text.trim().length < 10) {
      toast.error("Schreib zwei Sätze mehr — das Haus soll wissen, worum es geht.");
      return;
    }
    setLaeuft(true);
    try {
      await createCustomRequestThread({
        userId: user.id,
        designerId: werk.haus.id,
        productId: werk.id,
        productName: werk.name,
        body: text.trim(),
        budget: budget ?? undefined,
        name: name.trim() || undefined,
      });
      toast.success("Die Anfrage liegt beim Haus.");
      aufZu();
    } catch {
      toast.error("Die Anfrage ist nicht angekommen. Versuch es gleich noch einmal.");
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <Auflage titel={`Anfrage · ${werk.name}`} ton="papier" aufZu={aufZu}>
      <div className="hx-bogen">
        <Kicker>Anfrage</Kicker>
        <Schlagzeile>{werk.name}</Schlagzeile>

        {!user ? (
          <>
            <Fliesstext>
              Eine Anfrage geht an das Haus und bekommt eine Antwort — dafür braucht es
              einen Zugang.
            </Fliesstext>
            <Link className="hx-pfad" to="/auth">Zugang anlegen</Link>
          </>
        ) : !werk.haus ? (
          <Fliesstext>Zu diesem Stück ist gerade kein Haus hinterlegt.</Fliesstext>
        ) : (
          <>
            <label className="hx-feld">
              <span>Worum geht es?</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Maße, Anlass, Zeitpunkt — was das Haus wissen sollte."
              />
            </label>

            <label className="hx-feld">
              <span>Dein Name (freiwillig)</span>
              {/* eslint-disable-next-line no-restricted-syntax */}
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <div className="hx-groessen" role="group" aria-label="Budget-Vorstellung">
              {BUDGETS.map((b) => (
                /* eslint-disable-next-line no-restricted-syntax */
                <button
                  key={b}
                  type="button"
                  className="hx-groesse"
                  data-hier={b === budget || undefined}
                  aria-pressed={b === budget}
                  onClick={() => setBudget(b === budget ? null : b)}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* eslint-disable-next-line no-restricted-syntax */}
            <button type="button" className="hx-pfad hx-pfad-tat" onClick={() => void senden()} disabled={laeuft}>
              {laeuft ? "Wird gesendet" : "Anfrage senden"}
            </button>
          </>
        )}
      </div>
    </Auflage>
  );
}
