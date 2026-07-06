import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Plus, X } from "lucide-react";

interface DesignerLite { id: string; brand_name: string }
interface CampaignRow {
  id: string;
  designer_id: string;
  title: string;
  kind: string;
  status: string;
  content: { script?: string; caption?: string; asset_url?: string };
  feedback: Array<{ comment: string; role?: string; at: string }>;
  created_at: string;
}

export default function AdminCampaigns() {
  const { user, roles, loading } = useAuth();
  const [designers, setDesigners] = useState<DesignerLite[]>([]);
  const [items, setItems] = useState<CampaignRow[]>([]);
  const [newForm, setNewForm] = useState<{
    designer_id: string; title: string; kind: "video" | "post" | "text"; script: string; caption: string;
  } | null>(null);

  const refresh = async () => {
    const [d, c] = await Promise.all([
      supabase.from("designers").select("id, brand_name").eq("status", "active").order("brand_name"),
      supabase.from("campaigns").select("id, designer_id, title, kind, status, content, feedback, created_at")
        .order("created_at", { ascending: false }).limit(100),
    ]);
    setDesigners((d.data ?? []) as DesignerLite[]);
    setItems((c.data ?? []) as unknown as CampaignRow[]);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refresh();
  }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const create = async () => {
    if (!newForm) return;
    if (!newForm.designer_id || !newForm.title) return toast.error("Designer und Titel wählen.");
    const { error } = await supabase.from("campaigns").insert({
      designer_id: newForm.designer_id,
      title: newForm.title,
      kind: newForm.kind,
      status: "proposed",
      content: { script: newForm.script, caption: newForm.caption },
    });
    if (error) return toast.error(error.message);
    toast.success("Kampagne als Vorschlag an Designer gesendet.");
    setNewForm(null);
    void refresh();
  };

  const designerName = (id: string) => designers.find((d) => d.id === id)?.brand_name ?? "—";

  return (
    <AdminShell title="Kampagnen" eyebrow="Kuratorische Vorschläge">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} Kampagnen · Feedback fließt später in die KI-Runde.</p>
        <button onClick={() => setNewForm({ designer_id: "", title: "", kind: "post", script: "", caption: "" })}
          className="flex items-center gap-2 border border-accent bg-accent px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground">
          <Plus className="h-3 w-3" /> Neue Kampagne
        </button>
      </div>

      <ul className="mt-6 divide-y divide-border border border-border bg-card">
        {items.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Noch keine Kampagnen.</li>}
        {items.map((c) => (
          <li key={c.id} className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-serif text-lg">{c.title}</p>
                <p className="text-xs text-muted-foreground">{designerName(c.designer_id)} · {c.kind} · {c.status}</p>
              </div>
              <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">
                {new Date(c.created_at).toLocaleDateString("de-DE")}
              </span>
            </div>
            {c.feedback.length > 0 && (
              <div className="mt-3 border-l-2 border-border pl-3 text-sm">
                {c.feedback.slice(-2).map((f, i) => (
                  <p key={i} className="text-muted-foreground">"{f.comment}" — {f.role}</p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {newForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setNewForm(null)}>
          <div className="w-full max-w-xl border border-border bg-card p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl">Neue Kampagne</h2>
              <button onClick={() => setNewForm(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="editorial-eyebrow">Designer</span>
                <select value={newForm.designer_id} onChange={(e) => setNewForm({ ...newForm, designer_id: e.target.value })}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm">
                  <option value="">Wählen…</option>
                  {designers.map((d) => <option key={d.id} value={d.id}>{d.brand_name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Titel</span>
                <input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Art</span>
                <select value={newForm.kind} onChange={(e) => setNewForm({ ...newForm, kind: e.target.value as "video" | "post" | "text" })}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm">
                  <option value="post">Post</option><option value="video">Video</option><option value="text">Text</option>
                </select>
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Skript / Text</span>
                <textarea value={newForm.script} onChange={(e) => setNewForm({ ...newForm, script: e.target.value })}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm min-h-24" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Caption</span>
                <input value={newForm.caption} onChange={(e) => setNewForm({ ...newForm, caption: e.target.value })}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm" />
              </label>
              <div className="flex justify-end gap-3 pt-4">
                <button onClick={() => setNewForm(null)} className="border border-border px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em]">Abbrechen</button>
                <button onClick={create} className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground">
                  An Designer senden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
