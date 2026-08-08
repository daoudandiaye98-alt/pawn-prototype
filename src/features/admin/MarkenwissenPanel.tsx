/**
 * Markenaufbau-Wissen — Jarvis sammelt Bausteine, hier werden sie freigegeben.
 * Nur freigegebene Bausteine erreichen den Begleiter im Studio.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Baustein {
  id: string;
  topic: string;
  world: string | null;
  headline: string;
  body: string;
  example: string | null;
  source_url: string | null;
  source_title: string | null;
  approved: boolean;
  created_at: string;
}

export function MarkenwissenPanel() {
  const [rows, setRows] = useState<Baustein[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("brand_knowledge" as never)
      .select("id, topic, world, headline, body, example, source_url, source_title, approved, created_at")
      .order("approved", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(60);
    setRows((data ?? []) as unknown as Baustein[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runNow = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode: "wissen_markenaufbau" } });
      if (error) { toast.error(error.message); return; }
      const r = data as { ok?: boolean; angelegt?: number; error?: string };
      if (!r.ok) { toast.error(r.error ?? "Lauf konnte nicht starten."); return; }
      toast.success(`${r.angelegt ?? 0} neue Bausteine als Entwurf.`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    const { error } = await supabase.from("brand_knowledge" as never).update({ approved: true } as never).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, approved: true } : r)));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("brand_knowledge" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const entwuerfe = rows.filter((r) => !r.approved);
  const frei = rows.filter((r) => r.approved);

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-black px-5 py-3">
        <div>
          <p className="editorial-eyebrow">Markenaufbau-Wissen</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {frei.length} freigegeben · {entwuerfe.length} warten auf dich
          </p>
        </div>
        <Button onClick={runNow} disabled={busy} variant="outline" className="rounded-none border-black hover:bg-black hover:text-white">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {busy ? "PAWN liest…" : "Jetzt lernen"}
        </Button>
      </header>

      {loading ? (
        <div className="h-24 animate-pulse bg-muted" />
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Noch keine Bausteine. Starte den ersten Lauf.</p>
      ) : (
        <ul className="divide-y divide-black/10">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.headline}</p>
                <p className="mt-1 text-sm text-foreground/75">{r.body}</p>
                {r.example && <p className="mt-1 text-xs text-muted-foreground">Beispiel: {r.example}</p>}
                <p className="mt-2 text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {r.topic}{r.world ? ` · ${r.world}` : ""}{r.approved ? " · freigegeben" : " · Entwurf"}
                  {r.source_url && (
                    <>
                      {" · "}
                      <a href={r.source_url} target="_blank" rel="noreferrer" className="underline">
                        {r.source_title ?? "Quelle"}
                      </a>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {!r.approved && (
                  <button type="button" onClick={() => void approve(r.id)} aria-label="Freigeben"
                    className="flex h-8 w-8 items-center justify-center border-[1.5px] border-black hover:bg-black hover:text-white">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => void remove(r.id)} aria-label="Löschen"
                  className="flex h-8 w-8 items-center justify-center border border-black/30 text-muted-foreground hover:border-black hover:text-black">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
