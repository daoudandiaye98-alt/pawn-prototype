/**
 * Editionen: häuserübergreifende Kampagnen. Admin wählt Thema + Häuser →
 * Start erzeugt je Haus eine eigene Video-Version in dessen Signatur.
 * Jedes Haus muss im Studio zustimmen, bevor irgendetwas veröffentlicht wird.
 */
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Play } from "lucide-react";

type Status = "pending" | "ready" | "approved" | "declined" | "failed";

interface Participant { id: string; designer_id: string; status: Status; error: string | null; designers?: { brand_name: string } | null }
interface EditionRow { id: string; theme: string; world: string | null; status: string; created_at: string; edition_participants?: Participant[] }
interface DesignerLite { id: string; brand_name: string; house_number: number | null }

const STATUS_LABEL: Record<Status, string> = { pending: "Wartet", ready: "Bereit", approved: "Freigegeben", declined: "Abgelehnt", failed: "Fehlgeschlagen" };

export default function AdminEditionen() {
  const { user, roles, loading } = useAuth();
  const [editions, setEditions] = useState<EditionRow[]>([]);
  const [designers, setDesigners] = useState<DesignerLite[]>([]);
  const [theme, setTheme] = useState("");
  const [world, setWorld] = useState("Mode");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const refresh = async () => {
    const [{ data: eds }, { data: ds }] = await Promise.all([
      supabase.from("editions" as never)
        .select("id, theme, world, status, created_at, edition_participants(id, designer_id, status, error, designers:designer_id(brand_name))")
        .order("created_at", { ascending: false }),
      supabase.from("designers").select("id, brand_name, house_number").eq("published", true).order("brand_name"),
    ]);
    setEditions((eds ?? []) as unknown as EditionRow[]);
    setDesigners((ds ?? []) as DesignerLite[]);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refresh();
  }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const toggle = (id: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const createEdition = async () => {
    if (!theme.trim()) return toast.error("Thema fehlt.");
    if (chosen.size < 2) return toast.error("Mindestens 2 Häuser wählen.");
    setCreating(true);
    try {
      const { data: ed, error } = await supabase.from("editions" as never).insert({
        theme: theme.trim(), world, status: "draft",
      } as never).select("id").single();
      if (error) throw error;
      const editionId = (ed as { id: string }).id;
      const rows = Array.from(chosen).map((designer_id) => ({ edition_id: editionId, designer_id, status: "pending" }));
      await supabase.from("edition_participants" as never).insert(rows as never);
      toast.success("Edition als Entwurf angelegt.");
      setTheme(""); setChosen(new Set());
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startEdition = async (id: string) => {
    setStarting(id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-edition-video", { body: { edition_id: id } });
      if (error) throw error;
      const r = data as { ok?: boolean; error?: string; message?: string; started?: number };
      if (!r?.ok) throw new Error(r?.message ?? r?.error ?? "Konnte nicht gestartet werden.");
      toast.success(`${r.started ?? 0} Häuser werden produziert — das dauert ein paar Minuten.`);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(null);
    }
  };

  return (
    <AdminShell title="Editionen" eyebrow="Häuserübergreifend">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Ein Thema, mehrere Häuser — jedes bekommt eine eigene Video-Version in seiner Signatur. Nichts geht raus, ohne dass das jeweilige Haus im Studio zustimmt.
      </p>

      <div className="mt-8 border border-border bg-white p-5">
        <p className="editorial-eyebrow">Neue Edition</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Thema, z.B. „Herbst-Editorial”"
            className="flex-1 border border-border bg-background p-2 text-sm" />
          <select value={world} onChange={(e) => setWorld(e.target.value)} className="border border-border bg-background p-2 text-sm">
            <option value="Mode">Mode</option>
            <option value="Interior">Interior</option>
            <option value="Kunst">Kunst</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {designers.map((d) => (
            <button key={d.id} onClick={() => toggle(d.id)}
              className={`border px-3 py-1.5 text-[0.68rem] ${chosen.has(d.id) ? "border-foreground bg-foreground text-background" : "border-border bg-white hover:border-foreground"}`}>
              {d.brand_name}{d.house_number != null ? ` · №${d.house_number}` : ""}
            </button>
          ))}
        </div>
        <button onClick={createEdition} disabled={creating}
          className="mt-4 border border-foreground bg-foreground px-4 py-2 text-[0.68rem] uppercase tracking-[0.22em] text-background disabled:opacity-50">
          {creating ? "Lege an…" : "Als Entwurf anlegen"}
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {editions.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Edition.</p>}
        {editions.map((e) => (
          <div key={e.id} className="border border-border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-serif text-xl">{e.theme}</p>
                <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{e.world ?? "—"} · {e.status}</p>
              </div>
              {e.status === "draft" && (
                <button onClick={() => startEdition(e.id)} disabled={starting === e.id}
                  className="flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background disabled:opacity-50">
                  <Play className="h-3.5 w-3.5" /> {starting === e.id ? "Startet…" : "Produzieren starten"}
                </button>
              )}
            </div>
            <ul className="mt-4 divide-y divide-border">
              {(e.edition_participants ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{p.designers?.brand_name ?? p.designer_id}</span>
                  <span className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                    {STATUS_LABEL[p.status]}
                    {p.status === "failed" && p.error && <span className="text-amber-700 normal-case">({p.error})</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
