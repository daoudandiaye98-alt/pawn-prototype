import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Teil 21b — Das Ziel und der Weg. Das Ziel steht in eigenen Worten, jederzeit
 * änderbar. Der Weg (drei nächste Schritte) wird aus Ist-Zustand + Ziel
 * berechnet, jeder Schritt führt zu einem echten Stück bei PAWN.
 */

interface Schritt { text: string; produkt_slug: string | null; begruendung: string }
interface WegResult { schritte?: Schritt[]; fortschritt?: string | null; generated_at?: string }

export function DnaKompass() {
  const { user } = useAuth();
  const [ziel, setZiel] = useState<string | null>(null);
  const [weg, setWeg] = useState<WegResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = (data as { preferences?: { ziel?: string; weg?: WegResult } } | null)?.preferences ?? {};
    setZiel(typeof prefs.ziel === "string" ? prefs.ziel : null);
    setWeg(prefs.weg ?? null);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const saveZiel = async () => {
    if (!user) return;
    const next = draft.trim();
    if (!next) return;
    setBusy(true);
    const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = (data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
    const { error } = await supabase.from("user_memory" as never).update({ preferences: { ...prefs, ziel: next } } as never).eq("user_id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setZiel(next);
    setEditing(false);
    setDraft("");
    toast.success("Ziel gemerkt.");
  };

  const berechneWeg = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dna-voice", { body: { mode: "weg" } });
      if (error) throw error;
      const r = data as WegResult & { ok: boolean; fruehzustand?: { erreicht: boolean }; message?: string; error?: string };
      if (!r.ok) { toast.error(r.message ?? r.error ?? "Konnte den Weg noch nicht berechnen."); return; }
      if (!r.fruehzustand?.erreicht) { toast.message("Erst braucht es ein Ziel — erzähl mir im Gespräch, wohin du willst."); return; }
      setWeg(r);
      toast.success("Weg berechnet.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!user || loading) return null;

  return (
    <div className="border-[1.5px] border-black bg-white p-6 md:p-8">
      <p className="editorial-eyebrow text-black/60">Dein Ziel</p>

      {!ziel && !editing ? (
        <div className="mt-4">
          <p className="text-sm text-black/70">
            Noch kein Ziel — erzähl mir im Gespräch oben, wohin du willst, oder halte es hier gleich selbst in deinen Worten fest.
          </p>
          <button type="button" onClick={() => setEditing(true)}
            className="mt-4 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white">
            Ziel festhalten
          </button>
        </div>
      ) : editing ? (
        <div className="mt-4">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Ich will ruhiger wirken, ohne langweilig zu sein…"
            className="w-full min-h-20 border border-border bg-background p-3 text-sm" />
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => void saveZiel()} disabled={busy}
              className="border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-40">
              {busy ? "…" : "Speichern"}
            </button>
            <button type="button" onClick={() => { setEditing(false); setDraft(""); }}
              className="text-[0.65rem] uppercase tracking-[0.24em] text-black/60 hover:text-black">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <h2 className="font-serif text-2xl italic leading-tight text-black">„{ziel}"</h2>
          <button type="button" onClick={() => { setDraft(ziel ?? ""); setEditing(true); }}
            className="mt-3 editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
            Ziel ändern →
          </button>
        </div>
      )}

      {ziel && (
        <div className="mt-8 border-t border-black/15 pt-6">
          <p className="editorial-eyebrow text-black/60">Der Weg</p>
          <p className="mt-2 text-sm text-black/70">Ein Teil ersetzt, nicht der ganze Schrank.</p>

          {!weg?.schritte?.length ? (
            <button type="button" onClick={() => void berechneWeg()} disabled={busy}
              className="mt-4 border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-black hover:text-white disabled:opacity-40">
              {busy ? "…" : "Weg berechnen"}
            </button>
          ) : (
            <>
              <ol className="mt-6 space-y-5">
                {weg.schritte.map((s, i) => (
                  <li key={i} className="border-l-[1.5px] border-black/20 pl-4">
                    <p className="text-sm text-black">{s.text}</p>
                    <p className="mt-1 text-xs text-black/60">{s.begruendung}</p>
                    {s.produkt_slug && (
                      <Link to={`/product/${s.produkt_slug}`} className="mt-1 inline-block editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline">
                        Zum Stück →
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
              {weg.fortschritt && (
                <div className="mt-6 border-t border-black/15 pt-4">
                  <p className="editorial-eyebrow text-black/60">Seit dem letzten Mal</p>
                  <p className="mt-2 text-sm text-black/85">{weg.fortschritt}</p>
                </div>
              )}
              <button type="button" onClick={() => void berechneWeg()} disabled={busy}
                className="mt-6 editorial-eyebrow text-black underline decoration-1 underline-offset-4 hover:no-underline disabled:opacity-40">
                {busy ? "…" : "Weg neu berechnen →"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
