/**
 * Teil O/K4 — `/admin/begleiter`: der Bauer spricht nur, was in der Datenbank steht.
 *
 * Zwei Tabellen, eine Fläche: `begleiter_saetze` (was gesagt wird, mehrere Varianten je
 * Sprache) und `begleiter_regeln` (wann es gesagt wird). Dazu eine Vorschau, die denselben
 * Vergleich fährt wie das Heft: Ereignis wählen, Zustand einstellen, sehen welche Regel
 * gewinnt und welchen Satz sie zieht. Das ist die Text-Bearbeiten-Funktion für den Begleiter.
 */
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SatzRow {
  id: string; key: string; flaeche: string | null; kontext: string | null; welt: string | null;
  register: string | null; varianten: { de?: string[]; en?: string[] } | null;
  platzhalter: string[] | null; aktiv: boolean; notiz: string | null;
}
interface RegelRow {
  id: string; key: string; flaeche: string | null; ereignis: string; bedingung: Record<string, unknown> | null;
  satz_key: string; aktion: Record<string, unknown> | null; prioritaet: number;
  abklingzeit_s: number | null; einmal: string | null; aktiv: boolean; notiz: string | null;
}

interface Zustand {
  besuch: "erster" | "wieder";
  welt: "" | "mode" | "interior" | "kunst";
  merkliste: number;
  konto: boolean;
  avatar: boolean;
}

/** Derselbe Vergleich wie im Heft: eine Bedingung gilt, wenn jeder ihrer Schlüssel passt. */
function bedingungPasst(bedingung: Record<string, unknown> | null, z: Zustand): boolean {
  const b = bedingung ?? {};
  for (const [schluessel, wert] of Object.entries(b)) {
    switch (schluessel) {
      case "besuch": if (wert !== z.besuch) return false; break;
      case "welt": if (z.welt && String(wert).toLowerCase() !== z.welt) return false; break;
      case "merkliste_min": if (z.merkliste < Number(wert)) return false; break;
      case "merkliste_max": if (z.merkliste > Number(wert)) return false; break;
      case "merk_sichtbar": if (Boolean(wert) !== z.merkliste > 0) return false; break;
      case "konto": if (Boolean(wert) !== z.konto) return false; break;
      case "avatar": if (Boolean(wert) !== z.avatar) return false; break;
      default: break; // unbekannte Schlüssel gelten als erfüllt — sonst verstummt der Bauer stumm
    }
  }
  return true;
}

const FELD = "w-full border border-border bg-white px-2 py-1 text-sm";

export default function AdminBegleiter() {
  const [saetze, setSaetze] = useState<SatzRow[]>([]);
  const [regeln, setRegeln] = useState<RegelRow[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [ereignis, setEreignis] = useState("betreten");
  const [zustand, setZustand] = useState<Zustand>({ besuch: "erster", welt: "", merkliste: 0, konto: false, avatar: false });

  const laden = async () => {
    setLaedt(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from("begleiter_saetze" as never).select("*").order("key"),
      supabase.from("begleiter_regeln" as never).select("*").order("prioritaet", { ascending: false }),
    ]);
    setSaetze((s ?? []) as unknown as SatzRow[]);
    setRegeln((r ?? []) as unknown as RegelRow[]);
    setLaedt(false);
  };
  useEffect(() => { void laden(); }, []);

  const ereignisse = useMemo(
    () => Array.from(new Set(regeln.map((r) => r.ereignis))).sort(),
    [regeln],
  );

  const gewinner = useMemo(() => {
    const passend = regeln
      .filter((r) => r.aktiv && r.ereignis === ereignis && bedingungPasst(r.bedingung, zustand))
      .sort((a, b) => b.prioritaet - a.prioritaet);
    const regel = passend[0] ?? null;
    const satz = regel ? saetze.find((s) => s.key === regel.satz_key) ?? null : null;
    return { regel, satz, weitere: passend.slice(1) };
  }, [regeln, saetze, ereignis, zustand]);

  const satzSpeichern = async (row: SatzRow, feld: Partial<SatzRow>) => {
    const { error } = await supabase.from("begleiter_saetze" as never).update(feld as never).eq("id", row.id);
    if (error) return toast.error(error.message);
    setSaetze((prev) => prev.map((s) => (s.id === row.id ? { ...s, ...feld } : s)));
  };
  const regelSpeichern = async (row: RegelRow, feld: Partial<RegelRow>) => {
    const { error } = await supabase.from("begleiter_regeln" as never).update(feld as never).eq("id", row.id);
    if (error) return toast.error(error.message);
    setRegeln((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...feld } : r)));
  };

  const variantenText = (s: SatzRow, sprache: "de" | "en") => (s.varianten?.[sprache] ?? []).join("\n");
  const variantenSpeichern = (s: SatzRow, sprache: "de" | "en", text: string) => {
    const zeilen = text.split("\n").map((z) => z.trim()).filter(Boolean);
    void satzSpeichern(s, { varianten: { ...(s.varianten ?? {}), [sprache]: zeilen } });
  };

  return (
    <AdminShell title="Begleiter">
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Der Bauer sagt nichts, was hier nicht steht. Oben die Sätze (mehrere Varianten je Sprache — eine
        wird zufällig gewählt), darunter die Regeln, und ganz unten die Probe: Ereignis und Zustand
        einstellen, sehen welche Regel gewinnt.
      </p>

      {laedt ? <p className="text-sm text-muted-foreground">Lädt…</p> : (
        <>
          {/* ——— Die Probe ——— */}
          <section className="mb-10 border border-border bg-white p-5">
            <p className="editorial-eyebrow">Probe · {regeln.length} Regeln, {saetze.length} Sätze</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <label className="text-xs">Ereignis
                <select className={FELD} value={ereignis} onChange={(e) => setEreignis(e.target.value)}>
                  {ereignisse.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </label>
              <label className="text-xs">Besuch
                <select className={FELD} value={zustand.besuch} onChange={(e) => setZustand({ ...zustand, besuch: e.target.value as Zustand["besuch"] })}>
                  <option value="erster">erster</option><option value="wieder">wieder</option>
                </select>
              </label>
              <label className="text-xs">Welt
                <select className={FELD} value={zustand.welt} onChange={(e) => setZustand({ ...zustand, welt: e.target.value as Zustand["welt"] })}>
                  <option value="">egal</option><option value="mode">mode</option><option value="interior">interior</option><option value="kunst">kunst</option>
                </select>
              </label>
              <label className="text-xs">Merkliste
                <input type="number" min={0} className={FELD} value={zustand.merkliste}
                  onChange={(e) => setZustand({ ...zustand, merkliste: Number(e.target.value) })} />
              </label>
              <label className="flex items-end gap-2 text-xs">
                <input type="checkbox" checked={zustand.konto} onChange={(e) => setZustand({ ...zustand, konto: e.target.checked })} /> Konto
              </label>
              <label className="flex items-end gap-2 text-xs">
                <input type="checkbox" checked={zustand.avatar} onChange={(e) => setZustand({ ...zustand, avatar: e.target.checked })} /> Avatar
              </label>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              {gewinner.regel ? (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Es gewinnt <strong className="text-foreground">{gewinner.regel.key}</strong> (Priorität {gewinner.regel.prioritaet}) → Satz {gewinner.regel.satz_key}
                  </p>
                  <p className="mt-3 font-serif text-lg">
                    {(gewinner.satz?.varianten?.de ?? []).join("  ·  ") || "— dieser Satz hat keine deutsche Variante —"}
                  </p>
                  {gewinner.weitere.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">Unterlegen: {gewinner.weitere.map((r) => r.key).join(", ")}</p>
                  )}
                </>
              ) : <p className="text-sm text-muted-foreground">Für diesen Zustand sagt der Bauer nichts.</p>}
            </div>
          </section>

          {/* ——— Sätze ——— */}
          <section className="mb-10">
            <p className="editorial-eyebrow mb-3">Sätze · {saetze.length}</p>
            <div className="space-y-3">
              {saetze.map((s) => (
                <div key={s.id} className="border border-border bg-white p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <strong className="font-mono text-xs">{s.key}</strong>
                    <span className="text-xs text-muted-foreground">{s.flaeche} · {s.kontext} · {s.register}{s.welt ? ` · ${s.welt}` : ""}</span>
                    {!!s.platzhalter?.length && <span className="text-xs text-muted-foreground">Platzhalter: {s.platzhalter.map((p) => `{${p}}`).join(" ")}</span>}
                    <label className="ml-auto flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={s.aktiv} onChange={(e) => void satzSpeichern(s, { aktiv: e.target.checked })} /> aktiv
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs">Deutsch — eine Variante je Zeile
                      <textarea className={`${FELD} min-h-[72px]`} defaultValue={variantenText(s, "de")}
                        onBlur={(e) => variantenSpeichern(s, "de", e.target.value)} />
                    </label>
                    <label className="text-xs">Englisch — eine Variante je Zeile
                      <textarea className={`${FELD} min-h-[72px]`} defaultValue={variantenText(s, "en")}
                        onBlur={(e) => variantenSpeichern(s, "en", e.target.value)} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ——— Regeln ——— */}
          <section>
            <p className="editorial-eyebrow mb-3">Regeln · {regeln.length}</p>
            <div className="space-y-3">
              {regeln.map((r) => (
                <div key={r.id} className="border border-border bg-white p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <strong className="font-mono text-xs">{r.key}</strong>
                    <span className="text-xs text-muted-foreground">Ereignis: {r.ereignis}</span>
                    <label className="ml-auto flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={r.aktiv} onChange={(e) => void regelSpeichern(r, { aktiv: e.target.checked })} /> aktiv
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs">Satz
                      <select className={FELD} value={r.satz_key} onChange={(e) => void regelSpeichern(r, { satz_key: e.target.value })}>
                        {saetze.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
                      </select>
                    </label>
                    <label className="text-xs">Priorität
                      <input type="number" className={FELD} defaultValue={r.prioritaet}
                        onBlur={(e) => void regelSpeichern(r, { prioritaet: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs">Abklingzeit (s)
                      <input type="number" className={FELD} defaultValue={r.abklingzeit_s ?? 0}
                        onBlur={(e) => void regelSpeichern(r, { abklingzeit_s: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs">Einmal
                      <select className={FELD} value={r.einmal ?? ""} onChange={(e) => void regelSpeichern(r, { einmal: e.target.value || null })}>
                        <option value="">— (jedes Mal)</option><option value="sitzung">sitzung</option><option value="immer">immer</option>
                      </select>
                    </label>
                    <label className="text-xs sm:col-span-2">Bedingung (JSON)
                      <input className={`${FELD} font-mono`} defaultValue={JSON.stringify(r.bedingung ?? {})}
                        onBlur={(e) => {
                          try { void regelSpeichern(r, { bedingung: JSON.parse(e.target.value) as Record<string, unknown> }); }
                          catch { toast.error("Das ist kein gültiges JSON."); }
                        }} />
                    </label>
                    <label className="text-xs sm:col-span-2">Aktion (JSON)
                      <input className={`${FELD} font-mono`} defaultValue={JSON.stringify(r.aktion ?? {})}
                        onBlur={(e) => {
                          try { void regelSpeichern(r, { aktion: JSON.parse(e.target.value) as Record<string, unknown> }); }
                          catch { toast.error("Das ist kein gültiges JSON."); }
                        }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}
