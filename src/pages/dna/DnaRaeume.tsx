import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  BildArt, KundenBild, signiere, useAvatarEinwilligung, useKundenBilder,
} from "@/features/dna/bilder";
import { DnaShell, EinwilligungKarte, Knopf } from "./DnaShell";

/**
 * D2 — /deine-dna/raeume.
 *
 * Der Punkt, an dem es steht oder fällt: EINE Referenzmaße je Bild. Die Person
 * markiert eine Kante im Foto und sagt, wie breit sie in cm ist. Daraus wird
 * `masse = { wert_cm, referenz_anteil }`. Ohne sie hängt jedes Bild „irgendwie
 * groß" — `anprobe` rechnet dann mit `groesse_geschaetzt = true`.
 */
function Referenz({
  bild, onSpeichern,
}: { bild: KundenBild; onSpeichern: (masse: Record<string, unknown>) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [cm, setCm] = useState("");
  const masse = (bild.masse ?? {}) as { wert_cm?: number; referenz_anteil?: number };

  useEffect(() => { void signiere(bild.quelle_path).then(setUrl); }, [bild.quelle_path]);

  function klick(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    if (a === null || b !== null) { setA(x); setB(null); } else { setB(x); }
  }

  const anteil = a !== null && b !== null ? Math.abs(b - a) : null;
  const wert = Number(cm);
  const bereit = anteil !== null && anteil > 0.01 && Number.isFinite(wert) && wert > 0;

  return (
    <div className="space-y-3">
      <div
        onClick={klick}
        className="relative aspect-[4/3] w-full cursor-crosshair overflow-hidden border-[1.5px] border-black bg-white"
      >
        {url ? <img src={url} alt={bild.name ?? "Raum"} className="h-full w-full object-cover" /> : null}
        {a !== null && <span className="absolute inset-y-0 w-[1.5px] bg-black" style={{ left: `${a * 100}%` }} />}
        {b !== null && <span className="absolute inset-y-0 w-[1.5px] bg-black" style={{ left: `${b * 100}%` }} />}
      </div>
      <p className="font-sans text-[0.8rem] text-black">
        {masse.wert_cm && masse.referenz_anteil
          ? `Referenz gesetzt: ${masse.wert_cm} cm über ${(masse.referenz_anteil * 100).toFixed(0)} % der Bildbreite.`
          : "Klick auf die linke und die rechte Kante von etwas, dessen Breite du kennst — eine Tür, eine Tischkante."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          inputMode="numeric"
          value={cm}
          onChange={(e) => setCm(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          placeholder="Breite in cm"
          className="w-36 border-[1.5px] border-black bg-white px-3 py-2 font-sans text-sm text-black"
        />
        <Knopf
          disabled={!bereit}
          onClick={() => bereit && onSpeichern({ wert_cm: wert, referenz_anteil: anteil })}
        >
          Referenz speichern
        </Knopf>
        {anteil !== null && (
          <span className="text-[0.62rem] uppercase tracking-[0.22em] text-black">
            markiert: {(anteil * 100).toFixed(0)} % der Breite
          </span>
        )}
      </div>
    </div>
  );
}

export default function DnaRaeume() {
  const { user } = useAuth();
  const einwilligung = useAvatarEinwilligung(user?.id);
  const sammlung = useKundenBilder(user?.id, ["raum", "wand"]);
  const dateiRef = useRef<HTMLInputElement>(null);
  const [art, setArt] = useState<BildArt>("raum");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function sicher(fn: () => Promise<void>) {
    setFehler(null);
    try { await fn(); } catch (e) { setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt."); }
  }

  return (
    <DnaShell
      eyebrow="Deine DNA"
      titel="Deine Räume und Wände."
      satz="Ein Foto vom Raum für Interior, eins von der Wand für Kunst. Eine gemessene Kante je Bild — dann steht das Stück in der richtigen Größe darin."
      title="Deine Räume — PAWN"
      description="Lade Fotos von Raum und Wand hoch und sieh Stücke darin, maßstabsgetreu."
    >
      {einwilligung.laden ? null : !einwilligung.erteilt ? (
        <EinwilligungKarte laufend={laeuft} onJa={() => void sicher(async () => { setLaeuft(true); await einwilligung.setzen(true); setLaeuft(false); })} />
      ) : (
        <div className="space-y-10">
          <div className="border-[1.5px] border-black p-6">
            <div className="flex flex-wrap gap-2">
              {(["raum", "wand"] as BildArt[]).map((k) => (
                <Knopf key={k} invers={art === k} onClick={() => setArt(k)}>
                  {k === "raum" ? "Raum (Interior)" : "Wand (Kunst)"}
                </Knopf>
              ))}
            </div>
            <input
              ref={dateiRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void sicher(async () => {
                  setLaeuft(true);
                  await sammlung.hochladen(f, art);
                  setLaeuft(false);
                  if (dateiRef.current) dateiRef.current.value = "";
                });
              }}
            />
            <div className="mt-6">
              <Knopf invers disabled={laeuft} onClick={() => dateiRef.current?.click()}>
                {laeuft ? "Lädt …" : "Foto hochladen"}
              </Knopf>
            </div>
          </div>

          {fehler && <p className="border-[1.5px] border-black p-4 font-sans text-[0.85rem] text-black">{fehler}</p>}

          {sammlung.laden ? null : sammlung.bilder.length === 0 ? (
            <p className="font-sans text-[0.95rem] text-black">Noch kein Raum, keine Wand.</p>
          ) : (
            <div className="grid gap-10 md:grid-cols-2">
              {sammlung.bilder.map((bild) => (
                <div key={bild.id} className={`border-[1.5px] p-4 ${bild.aktiv ? "border-black shadow-[6px_6px_0_#000]" : "border-black/40"}`}>
                  <p className="mb-3 text-[0.62rem] uppercase tracking-[0.22em] text-black">
                    {bild.art === "wand" ? "Wand" : "Raum"} · {bild.aktiv ? "Aktiv" : "Abgelegt"}
                  </p>
                  <Referenz bild={bild} onSpeichern={(m) => void sicher(() => sammlung.masseSetzen(bild, m))} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!bild.aktiv && <Knopf onClick={() => void sicher(() => sammlung.aktivSetzen(bild))}>Aktiv setzen</Knopf>}
                    <Knopf onClick={() => void sicher(() => sammlung.entfernen(bild))}>Löschen</Knopf>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DnaShell>
  );
}
