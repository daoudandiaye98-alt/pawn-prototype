import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  KundenBild, signiere, useAvatarEinwilligung, useKundenBilder, useAnprobeKontingent,
} from "@/features/dna/bilder";
import { DnaShell, EinwilligungKarte, Knopf } from "./DnaShell";

/**
 * D1 — /deine-dna/avatar.
 *
 * Einwilligung zuerst, dann das Foto, dann die Körpergröße. Mit der Größe rechnet
 * `anprobe` die echte Größe; ohne sie schätzt sie, und das sieht man.
 */
function BildKachel({
  bild, onLoeschen, onAktiv,
}: { bild: KundenBild; onLoeschen: () => void; onAktiv: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { void signiere(bild.basis_path ?? bild.quelle_path).then(setUrl); }, [bild.basis_path, bild.quelle_path]);
  const groesse = (bild.masse as { koerpergroesse_cm?: number } | null)?.koerpergroesse_cm;

  return (
    <figure className={`border-[1.5px] p-3 ${bild.aktiv ? "border-black shadow-[6px_6px_0_#000]" : "border-black/40"}`}>
      <div className="aspect-[3/4] w-full overflow-hidden bg-white">
        {url ? <img src={url} alt={bild.name ?? "Avatar"} className="h-full w-full object-cover" /> : null}
      </div>
      <figcaption className="mt-3 space-y-2">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-black">
          {bild.aktiv ? "Aktiv" : "Abgelegt"}
          {groesse ? ` · ${groesse} cm` : " · ohne Größe"}
        </p>
        <div className="flex flex-wrap gap-2">
          {!bild.aktiv && <Knopf onClick={onAktiv}>Aktiv setzen</Knopf>}
          <Knopf onClick={onLoeschen}>Löschen</Knopf>
        </div>
      </figcaption>
    </figure>
  );
}

export default function DnaAvatar() {
  const { user } = useAuth();
  const einwilligung = useAvatarEinwilligung(user?.id);
  const sammlung = useKundenBilder(user?.id, ["avatar"]);
  const kontingent = useAnprobeKontingent(user?.id);
  const dateiRef = useRef<HTMLInputElement>(null);
  const [groesse, setGroesse] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void supabase.from("customer_measurements").select("height_cm").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const h = (data as { height_cm?: number } | null)?.height_cm;
        if (h) setGroesse(String(h));
      });
  }, [user?.id]);

  async function hochladen(datei: File) {
    setLaeuft(true); setFehler(null);
    try {
      const cm = Number(groesse);
      await sammlung.hochladen(datei, "avatar", Number.isFinite(cm) && cm > 0 ? { koerpergroesse_cm: cm } : {});
      if (Number.isFinite(cm) && cm > 0 && user?.id) {
        await supabase.from("customer_measurements").upsert({ user_id: user.id, height_cm: cm } as never);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setLaeuft(false);
      if (dateiRef.current) dateiRef.current.value = "";
    }
  }

  async function sicher(fn: () => Promise<void>) {
    setFehler(null);
    try { await fn(); } catch (e) { setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt."); }
  }

  return (
    <DnaShell
      eyebrow="Deine DNA"
      titel="Dein Avatar."
      satz="Ein Ganzkörperfoto genügt. Daraus entsteht die Anprobe — dein Bild bleibt privat, und du löschst es, wann du willst."
      title="Dein Avatar — PAWN"
      description="Lade ein Foto hoch und sieh Stücke an dir. Privat, löschbar, jederzeit."
    >
      {einwilligung.laden ? null : !einwilligung.erteilt ? (
        <EinwilligungKarte laufend={laeuft} onJa={() => void sicher(async () => { setLaeuft(true); await einwilligung.setzen(true); setLaeuft(false); })} />
      ) : (
        <div className="space-y-10">
          <div className="border-[1.5px] border-black p-6">
            <label className="block text-[0.62rem] uppercase tracking-[0.22em] text-black" htmlFor="groesse">
              Deine Körpergröße in cm
            </label>
            <input
              id="groesse"
              inputMode="numeric"
              value={groesse}
              onChange={(e) => setGroesse(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              placeholder="z. B. 174"
              className="mt-2 w-40 border-[1.5px] border-black bg-white px-3 py-2 font-sans text-sm text-black outline-none"
            />
            <p className="mt-2 max-w-[60ch] font-sans text-[0.8rem] text-black/70">
              Mit ihr rechnet die Anprobe die echte Größe. Ohne sie schätzt sie — und das sieht man.
            </p>

            <div className="mt-6">
              <input
                ref={dateiRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void hochladen(f); }}
              />
              <Knopf invers disabled={laeuft} onClick={() => dateiRef.current?.click()}>
                {laeuft ? "Lädt …" : "Foto hochladen"}
              </Knopf>
            </div>
          </div>

          {kontingent && (
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-black">
              Anproben heute: {kontingent.heute} · frei: {kontingent.frei}
            </p>
          )}

          {fehler && <p className="border-[1.5px] border-black p-4 font-sans text-[0.85rem] text-black">{fehler}</p>}

          {sammlung.laden ? null : sammlung.bilder.length === 0 ? (
            <p className="font-sans text-[0.95rem] text-black">Noch kein Bild. Das erste entscheidet, wie gut die Anprobe wird.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {sammlung.bilder.map((b) => (
                <BildKachel
                  key={b.id}
                  bild={b}
                  onAktiv={() => void sicher(() => sammlung.aktivSetzen(b))}
                  onLoeschen={() => void sicher(() => sammlung.entfernen(b))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </DnaShell>
  );
}
