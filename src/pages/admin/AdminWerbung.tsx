import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Megaphone, ArrowRight } from "lucide-react";

interface QueueRow { id: string; scheduled_at: string; status: string; channel: string; campaign_id: string }
interface CampRow { id: string; title: string; status: string; kind: string; created_at: string }

export default function AdminWerbung() {
  const { user, roles, loading } = useAuth();
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampRow[]>([]);

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    (async () => {
      const [q, c] = await Promise.all([
        supabase.from("posting_queue").select("id, scheduled_at, status, channel, campaign_id").order("scheduled_at", { ascending: true }).limit(20),
        supabase.from("campaigns").select("id, title, status, kind, created_at").order("created_at", { ascending: false }).limit(10),
      ]);
      setQueue((q.data ?? []) as QueueRow[]);
      setCampaigns((c.data ?? []) as CampRow[]);
    })();
  }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const counts = queue.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});

  return (
    <AdminShell title="Werbung" eyebrow="Posting-Queue · Kampagnen">
      <div className="grid gap-4 md:grid-cols-3">
        {["queued", "posted", "failed"].map((s) => (
          <div key={s} className="border border-border bg-card p-5">
            <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{s}</p>
            <p className="mt-2 font-serif text-3xl">{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-serif text-lg">Nächste Slots</h3>
          <Link to="/admin/posting" className="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
            Alle Slots <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        <ul className="divide-y divide-border">
          {queue.slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="font-mono text-[0.7rem] text-muted-foreground">{new Date(r.scheduled_at).toLocaleString("de-DE")}</span>
              <span className="text-[0.65rem] uppercase tracking-[0.22em]">{r.channel}</span>
              <span className={`border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em] ${r.status === "posted" ? "border-emerald-500/40 text-emerald-600" : r.status === "failed" ? "border-red-500/40 text-red-600" : "border-amber-500/40 text-amber-600"}`}>{r.status}</span>
            </li>
          ))}
          {queue.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine geplanten Posts.</li>}
        </ul>
      </section>

      <section className="mt-8 border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-serif text-lg">Letzte Kampagnen</h3>
          <Link to="/admin/kampagnen" className="inline-flex items-center gap-1 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground">
            Alle Kampagnen <ArrowRight className="h-3 w-3" />
          </Link>
        </header>
        <ul className="divide-y divide-border">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="flex items-center gap-3"><Megaphone className="h-3.5 w-3.5 text-muted-foreground" />{c.title}</span>
              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{c.kind} · {c.status}</span>
            </li>
          ))}
          {campaigns.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Noch keine Kampagnen.</li>}
        </ul>
      </section>
    </AdminShell>
  );
}
