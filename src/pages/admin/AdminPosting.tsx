/**
 * Admin-Posting-Warteschlange.
 * Zeigt anstehende Kampagnen-Slots + erlaubt "als gepostet markieren".
 * Bis Meta/TikTok-APIs verdrahtet sind: manueller Workflow.
 */
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Info } from "lucide-react";

type Status = "queued" | "posted" | "failed" | "cancelled";
type Channel = "pawn_instagram" | "pawn_tiktok" | "pawn_youtube";

interface QueueRow {
  id: string;
  campaign_id: string;
  channel: Channel;
  scheduled_at: string;
  status: Status;
  posted_url: string | null;
  posted_at: string | null;
  created_at: string;
  campaigns?: {
    title: string;
    content: { asset_url?: string; caption?: string; hashtags?: string[] } | null;
    designer_id: string;
  } | null;
}

const LABELS: Record<Status, string> = { queued: "Warteschlange", posted: "Veröffentlicht", failed: "Fehlgeschlagen", cancelled: "Zurückgezogen" };
const CH_LABEL: Record<Channel, string> = { pawn_instagram: "Instagram", pawn_tiktok: "TikTok", pawn_youtube: "YouTube" };

export default function AdminPosting() {
  const { user, roles, loading } = useAuth();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [urlEdit, setUrlEdit] = useState<Record<string, string>>({});

  const refresh = async () => {
    const { data } = await supabase.from("posting_queue" as never)
      .select("id, campaign_id, channel, scheduled_at, status, posted_url, posted_at, created_at, campaigns:campaign_id(title, content, designer_id)")
      .order("scheduled_at", { ascending: true })
      .limit(200);
    setRows((data ?? []) as unknown as QueueRow[]);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refresh();
  }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const markPosted = async (row: QueueRow) => {
    const url = (urlEdit[row.id] ?? "").trim();
    if (!url) return toast.error("Bitte den Link zum Post einfügen.");
    const { error } = await supabase.from("posting_queue" as never)
      .update({ status: "posted" as Status, posted_url: url, posted_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    if (row.campaign_id) {
      await supabase.from("campaigns").update({ status: "published" }).eq("id", row.campaign_id);
    }
    toast.success("Als veröffentlicht markiert.");
    void refresh();
  };

  const cancel = async (row: QueueRow) => {
    const { error } = await supabase.from("posting_queue" as never).update({ status: "cancelled" as Status } as never).eq("id", row.id);
    if (error) return toast.error(error.message);
    void refresh();
  };

  return (
    <AdminShell title="Posting" eyebrow="Warteschlange">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Automatik: bereit — wartet auf Meta- und TikTok-Zugang. Bis dahin veröffentlichen wir die Reels manuell und tragen den Link hier ein.
      </p>

      <details className="mt-4 max-w-3xl border border-border bg-white p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm"><Info className="h-4 w-4" /> Was wird für die Automatik gebraucht?</summary>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><code>META_ACCESS_TOKEN</code> — Long-lived Business-Token</li>
          <li><code>IG_BUSINESS_ID</code> — Instagram-Business-Account-ID</li>
          <li><code>TIKTOK_CLIENT_KEY</code> und <code>TIKTOK_CLIENT_SECRET</code> — für den Content-Posting-Endpoint</li>
        </ul>
      </details>

      <ul className="mt-8 divide-y divide-border border border-border bg-card">
        {rows.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Warteschlange ist leer.</li>}
        {rows.map((r) => (
          <li key={r.id} className="grid gap-4 px-5 py-5 md:grid-cols-[220px_1fr_260px]">
            <div className="border border-border bg-black">
              {r.campaigns?.content?.asset_url ? (
                <video src={r.campaigns.content.asset_url} controls playsInline className="aspect-[9/16] w-full bg-black object-contain" />
              ) : (
                <div className="flex aspect-[9/16] items-center justify-center text-xs text-white/50">Kein Asset</div>
              )}
            </div>
            <div>
              <p className="font-serif text-lg">{r.campaigns?.title ?? r.campaign_id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {CH_LABEL[r.channel]} · {new Date(r.scheduled_at).toLocaleString("de-DE")}
                {" "}· <span className="uppercase tracking-[0.22em]">{LABELS[r.status]}</span>
              </p>
              {r.campaigns?.content?.caption && (
                <p className="mt-3 text-sm">{r.campaigns.content.caption}</p>
              )}
              {r.campaigns?.content?.hashtags && r.campaigns.content.hashtags.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{r.campaigns.content.hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" ")}</p>
              )}
              {r.posted_url && <a href={r.posted_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs underline">Post öffnen ↗</a>}
            </div>
            <div>
              {r.status === "queued" && (
                <div className="space-y-2">
                  <input
                    value={urlEdit[r.id] ?? ""}
                    onChange={(e) => setUrlEdit((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder="Link zum veröffentlichten Post"
                    className="w-full border border-border bg-background p-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => markPosted(r)}
                      className="flex-1 border border-foreground bg-foreground px-3 py-2 text-[0.65rem] uppercase tracking-[0.22em] text-background">
                      Als gepostet markieren
                    </button>
                    <button onClick={() => cancel(r)}
                      className="border border-border px-3 py-2 text-[0.65rem] uppercase tracking-[0.22em] hover:bg-muted">
                      Zurückziehen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
