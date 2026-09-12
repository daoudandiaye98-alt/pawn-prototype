/**
 * Teil O/K4 — `/admin/archetypen`: die 18 Stil-Archetypen, sechs je Welt.
 *
 * Was die Kundin im Bilderquiz zugeordnet bekommt, steht hier — Name, Kurzsatz, Wörter,
 * Farbregister, Bild. `haus_archetypen` ist die Brücke zur anderen Seite des Marktplatzes:
 * die Archetypen, die in `designers.brand_dna.archetyp` vorkommen. Deshalb stehen die
 * tatsächlich vergebenen Haus-Archetypen als anklickbare Liste daneben.
 */
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ArchetypRow {
  id: string; key: string; welt: string | null; name: string | null; name_en: string | null;
  figur: string | null; kurz: string | null; kurz_en: string | null; beschreibung: string | null;
  richtung: string[] | null; form: string[] | null; woerter: string[] | null;
  farbregister: string | null; nahe: string[] | null; haus_archetypen: string[] | null;
  bild_url: string | null; sort: number | null; aktiv: boolean;
}

const FELD = "w-full border border-border bg-white px-2 py-1 text-sm";
const liste = (v: string[] | null) => (v ?? []).join(", ");
const zurListe = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function AdminArchetypen() {
  const [rows, setRows] = useState<ArchetypRow[]>([]);
  const [hausArchetypen, setHausArchetypen] = useState<string[]>([]);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    void (async () => {
      const [{ data: a }, { data: d }] = await Promise.all([
        supabase.from("stil_archetypen" as never).select("*").order("welt").order("sort"),
        supabase.from("designers").select("brand_dna"),
      ]);
      setRows((a ?? []) as unknown as ArchetypRow[]);
      const gefunden = new Set<string>();
      for (const row of (d ?? []) as { brand_dna?: Record<string, unknown> | null }[]) {
        const wert = row.brand_dna?.archetyp;
        if (typeof wert === "string" && wert.trim()) gefunden.add(wert.trim());
        if (Array.isArray(wert)) wert.forEach((w) => typeof w === "string" && gefunden.add(w));
      }
      setHausArchetypen([...gefunden].sort());
      setLaedt(false);
    })();
  }, []);

  const speichern = async (row: ArchetypRow, feld: Partial<ArchetypRow>) => {
    const { error } = await supabase.from("stil_archetypen" as never).update(feld as never).eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...feld } : r)));
  };

  const nachWelt = useMemo(() => {
    const map = new Map<string, ArchetypRow[]>();
    for (const r of rows) {
      const w = r.welt ?? "ohne Welt";
      map.set(w, [...(map.get(w) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <AdminShell title="Archetypen">
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        {rows.length} Karten, sechs je Welt. Was hier steht, bekommt die Kundin nach dem Bilderquiz zu
        sehen. Über <strong>Haus-Archetypen</strong> hängt eine Karte an den Häusern, deren Marken-DNA
        denselben Archetyp trägt.
      </p>

      {hausArchetypen.length > 0 && (
        <p className="mb-6 border border-border bg-white p-4 text-xs">
          In den Häusern vergeben: {hausArchetypen.join(" · ")}
        </p>
      )}

      {laedt ? <p className="text-sm text-muted-foreground">Lädt…</p> : nachWelt.map(([welt, karten]) => (
        <section key={welt} className="mb-10">
          <p className="editorial-eyebrow mb-3">{welt} · {karten.length}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            {karten.map((r) => (
              <article key={r.id} className="border border-border bg-white p-4">
                <div className="flex gap-4">
                  {r.bild_url
                    ? <img src={r.bild_url} alt={r.name ?? r.key} className="h-24 w-24 shrink-0 object-cover" loading="lazy" />
                    : <span className="flex h-24 w-24 shrink-0 items-center justify-center border border-dashed border-border text-[0.6rem] uppercase tracking-widest text-muted-foreground">kein Bild</span>}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{r.key}{r.figur ? ` · ${r.figur}` : ""}</p>
                    <input className={`${FELD} mt-1 font-serif text-base`} defaultValue={r.name ?? ""}
                      onBlur={(e) => void speichern(r, { name: e.target.value })} />
                    <input className={`${FELD} mt-2`} defaultValue={r.kurz ?? ""} placeholder="Kurzsatz"
                      onBlur={(e) => void speichern(r, { kurz: e.target.value })} />
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">Name (EN)
                    <input className={FELD} defaultValue={r.name_en ?? ""} onBlur={(e) => void speichern(r, { name_en: e.target.value })} />
                  </label>
                  <label className="text-xs">Kurzsatz (EN)
                    <input className={FELD} defaultValue={r.kurz_en ?? ""} onBlur={(e) => void speichern(r, { kurz_en: e.target.value })} />
                  </label>
                  <label className="text-xs sm:col-span-2">Beschreibung
                    <textarea className={`${FELD} min-h-[64px]`} defaultValue={r.beschreibung ?? ""}
                      onBlur={(e) => void speichern(r, { beschreibung: e.target.value })} />
                  </label>
                  <label className="text-xs">Richtung
                    <input className={FELD} defaultValue={liste(r.richtung)} onBlur={(e) => void speichern(r, { richtung: zurListe(e.target.value) })} />
                  </label>
                  <label className="text-xs">Form
                    <input className={FELD} defaultValue={liste(r.form)} onBlur={(e) => void speichern(r, { form: zurListe(e.target.value) })} />
                  </label>
                  <label className="text-xs">Wörter
                    <input className={FELD} defaultValue={liste(r.woerter)} onBlur={(e) => void speichern(r, { woerter: zurListe(e.target.value) })} />
                  </label>
                  <label className="text-xs">Farbregister
                    <input className={FELD} defaultValue={r.farbregister ?? ""} onBlur={(e) => void speichern(r, { farbregister: e.target.value })} />
                  </label>
                  <label className="text-xs">Nahe
                    <input className={FELD} defaultValue={liste(r.nahe)} onBlur={(e) => void speichern(r, { nahe: zurListe(e.target.value) })} />
                  </label>
                  <label className="text-xs">Haus-Archetypen
                    <input className={FELD} defaultValue={liste(r.haus_archetypen)}
                      list="haus-archetypen"
                      onBlur={(e) => void speichern(r, { haus_archetypen: zurListe(e.target.value) })} />
                  </label>
                  <label className="text-xs sm:col-span-2">Bild (site-assets)
                    <input className={FELD} defaultValue={r.bild_url ?? ""} onBlur={(e) => void speichern(r, { bild_url: e.target.value })} />
                  </label>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={r.aktiv} onChange={(e) => void speichern(r, { aktiv: e.target.checked })} /> aktiv
                </label>
              </article>
            ))}
          </div>
        </section>
      ))}

      <datalist id="haus-archetypen">
        {hausArchetypen.map((h) => <option key={h} value={h} />)}
      </datalist>
    </AdminShell>
  );
}
