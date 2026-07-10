import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";

interface ActionRow {
  id: string; source: string; action: string; params: Record<string, unknown>;
  status: string; created_at: string; undone_at: string | null; error: string | null;
}

const UNDOABLE = new Set(["set_content", "set_image", "set_config", "upsert_ontology_term"]);

export default function AdminAktionen() {
  const { user, roles, loading } = useAuth();
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [filter, setFilter] = useState<"all" | "admin_chat" | "auto_ontology" | "system">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const base = supabase.from("ai_actions_log" as never).select("*").order("created_at", { ascending: false }).limit(100);
    const query = filter === "all" ? base : (base as unknown as { eq: (k: string, v: string) => typeof base }).eq("source", filter);
    const { data } = await query;
    setRows(((data ?? []) as unknown) as ActionRow[]);
  };
  useEffect(() => { if (user && roles.includes("admin")) void load(); }, [user, roles, filter]);

  const undo = async (id: string) => {
    setBusy(id);
    const { data, error } = await supabase.functions.invoke("pawn-actions", { body: { mode: "undo", action_id: id } });
    setBusy(null);
    if (error || (data as { ok?: boolean; error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Undo fehlgeschlagen");
      return;
    }
    toast.success("Rückgängig gemacht.");
    void load();
  };

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  return (
    <AdminShell title="Aktionen" eyebrow="PAWN Hände · Log · Rückgängig">
      <div className="mb-4 flex gap-2">
        {(["all","admin_chat","auto_ontology","system"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`border px-3 py-1.5 text-[0.65rem] uppercase tracking-[0.22em] ${filter === f ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "Alle" : f === "admin_chat" ? "Admin-Chat" : f === "auto_ontology" ? "Auto-Ontologie" : "System"}
          </button>
        ))}
      </div>

      <div className="border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 text-sm">
              <span className="font-mono text-[0.68rem] text-muted-foreground">{new Date(r.created_at).toLocaleString("de-DE")}</span>
              <div className="min-w-0">
                <p className="font-medium">{r.action} <span className="ml-2 text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{r.source}</span></p>
                <p className="mt-0.5 truncate font-mono text-[0.7rem] text-muted-foreground">{JSON.stringify(r.params)}</p>
                {r.error && <p className="mt-0.5 text-[0.7rem] text-red-600">{r.error}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em] ${r.status === "done" ? "border-emerald-500/40 text-emerald-600" : r.status === "undone" ? "border-muted text-muted-foreground" : "border-red-500/40 text-red-600"}`}>{r.status}</span>
                {r.status === "done" && UNDOABLE.has(r.action) && (
                  <button onClick={() => undo(r.id)} disabled={busy === r.id}
                    className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[0.6rem] uppercase tracking-[0.22em] hover:bg-muted disabled:opacity-40">
                    <Undo2 className="h-3 w-3" /> Rückgängig
                  </button>
                )}
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-12 text-center text-sm text-muted-foreground">Noch keine Aktionen.</li>}
        </ul>
      </div>
    </AdminShell>
  );
}
