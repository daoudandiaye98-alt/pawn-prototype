import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Check, MessageSquare, X } from "lucide-react";

type Status = "draft" | "proposed" | "in_review" | "changes_requested" | "approved" | "published" | "declined";

interface FeedbackEntry { by?: string; role?: string; comment: string; at: string }

interface CampaignRow {
  id: string;
  title: string;
  kind: "video" | "post" | "text";
  status: Status;
  content: { script?: string; caption?: string; hashtags?: string[]; asset_url?: string };
  feedback: FeedbackEntry[];
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  draft: "Entwurf", proposed: "Vorgeschlagen", in_review: "In Prüfung",
  changes_requested: "Änderung gewünscht", approved: "Freigegeben",
  published: "Veröffentlicht", declined: "Abgelehnt",
};

const STATUS_TONE: Record<Status, string> = {
  draft: "bg-muted text-foreground",
  proposed: "bg-accent/20 text-foreground border border-accent",
  in_review: "bg-muted text-foreground",
  changes_requested: "bg-destructive/20 text-destructive border border-destructive",
  approved: "bg-emerald-500/15 text-emerald-800 border border-emerald-500/50",
  published: "bg-emerald-600 text-white",
  declined: "bg-muted text-muted-foreground line-through",
};

export default function StudioCampaigns() {
  const { designer, loading } = useMyDesigner();
  const { user } = useAuth();
  const [items, setItems] = useState<CampaignRow[]>([]);
  const [active, setActive] = useState<CampaignRow | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!designer) return;
    const { data } = await supabase.from("campaigns")
      .select("id, title, kind, status, content, feedback, created_at")
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as CampaignRow[]);
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [designer?.id]);

  const decide = async (status: "approved" | "changes_requested", comment?: string) => {
    if (!active || !user) return;
    if (status === "changes_requested" && !comment?.trim()) {
      return toast.error("Bitte beschreibe kurz, was du geändert haben möchtest.");
    }
    setBusy(true);
    const newFeedback: FeedbackEntry[] = [
      ...(active.feedback ?? []),
      ...(comment ? [{ by: user.email ?? user.id, role: "designer", comment: comment.trim(), at: new Date().toISOString() }] : []),
    ];
    const { error } = await supabase.from("campaigns")
      .update({ status, feedback: newFeedback as unknown as Json[] })
      .eq("id", active.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Freigegeben." : "Änderungswunsch gesendet.");
    setActive(null); setFeedbackText("");
    void refresh();
  };

  if (loading) return <StudioShell title="Kampagnen"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Kampagnen"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Kampagnen" eyebrow="Nichts geht ohne deine Freigabe raus">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Aus deinen Produkten entstehen Kampagnenvorschläge — als Video, Post oder Text. Du entscheidest,
          was veröffentlicht wird. Jeder Änderungswunsch fließt in die nächste Runde.
        </p>
        <a href="/studio/kampagnen/neu" className="flex items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background hover:opacity-90">
          + Neue Kampagne
        </a>
      </div>

      {items.length === 0 ? (
        <div className="mt-8 border border-dashed border-border p-12 text-center">
          <p className="editorial-eyebrow">Ruhig</p>
          <p className="mt-3 font-serif text-2xl">Noch keine Kampagnenvorschläge.</p>
          <p className="mt-2 text-sm text-muted-foreground">Starte deine erste Kampagne — dein Reel entsteht in wenigen Minuten.</p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border border border-border bg-card">
          {items.map((c) => (
            <li key={c.id} className="flex cursor-pointer items-center gap-4 px-5 py-4 hover:bg-muted/40" onClick={() => setActive(c)}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <p className="font-serif text-lg">{c.title}</p>
                  <span className={`px-2 py-0.5 text-[0.55rem] uppercase tracking-[0.28em] ${STATUS_TONE[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.kind} · {new Date(c.created_at).toLocaleDateString("de-DE")}</p>
              </div>
              {c.status === "proposed" && <span className="text-[0.62rem] uppercase tracking-[0.28em] text-accent">Prüfung offen →</span>}
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setActive(null)}>
          <div className="w-full max-w-2xl border border-border bg-card p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="editorial-eyebrow">{active.kind} · {STATUS_LABEL[active.status]}</p>
                <h2 className="mt-1 font-serif text-2xl">{active.title}</h2>
              </div>
              <button onClick={() => setActive(null)}><X className="h-4 w-4" /></button>
            </div>

            <section className="mt-6 space-y-4 border-t border-border pt-6">
              {active.content.asset_url && (
                active.kind === "video" ? (
                  <video src={active.content.asset_url} controls playsInline className="mx-auto max-h-[70vh] w-full max-w-md bg-black" />
                ) : (
                  <img src={active.content.asset_url} alt="" className="w-full grayscale" />
                )
              )}
              {active.content.script && (
                <div>
                  <p className="editorial-eyebrow">Skript</p>
                  <p className="mt-2 whitespace-pre-wrap font-serif italic">{active.content.script}</p>
                </div>
              )}
              {active.content.caption && (
                <div>
                  <p className="editorial-eyebrow">Caption</p>
                  <p className="mt-2 text-sm">{active.content.caption}</p>
                </div>
              )}
              {active.content.hashtags && active.content.hashtags.length > 0 && (
                <p className="text-xs text-muted-foreground">{active.content.hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" ")}</p>
              )}
              {active.status === "approved" && active.content.asset_url && (
                <div className="border border-border bg-muted/40 p-4">
                  <a href={active.content.asset_url} download className="border border-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                    Für deinen eigenen Kanal herunterladen
                  </a>
                  <p className="mt-3 text-xs text-muted-foreground">Musik fügst du direkt in Reels oder TikTok hinzu — dort ist sie lizenzsicher.</p>
                </div>
              )}
            </section>

            {active.feedback && active.feedback.length > 0 && (
              <section className="mt-6 border-t border-border pt-6">
                <p className="editorial-eyebrow">Verlauf</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {active.feedback.map((f, i) => (
                    <li key={i} className="border-l-2 border-border pl-3">
                      <p>{f.comment}</p>
                      <p className="mt-1 text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                        {f.role} · {new Date(f.at).toLocaleString("de-DE")}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(active.status === "proposed" || active.status === "in_review") && (
              <section className="mt-6 border-t border-border pt-6">
                <label className="block">
                  <span className="editorial-eyebrow flex items-center gap-2"><MessageSquare className="h-3 w-3" /> Deine Notiz (Pflicht bei Änderungswunsch)</span>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="mt-2 w-full border border-border bg-background p-3 text-sm min-h-24"
                    placeholder="Was soll sich ändern? Was passt schon?"
                  />
                </label>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => decide("approved", feedbackText || undefined)} disabled={busy}
                    className="flex items-center gap-2 border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
                    <Check className="h-3 w-3" /> Freigeben
                  </button>
                  <button onClick={() => decide("changes_requested", feedbackText)} disabled={busy}
                    className="border border-destructive px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-destructive disabled:opacity-50">
                    Änderung wünschen
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </StudioShell>
  );
}
