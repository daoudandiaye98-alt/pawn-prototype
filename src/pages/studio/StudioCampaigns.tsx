import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
// Teil O — das Beispielbild des Produktbild-Versprechens, lokal als WebP.
import beispielProduktbild from "@/assets/teil-o/beispiel-produktbild.webp";
import { FlaechenTabs } from "@/components/pawn/FlaechenTabs";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { HowItWorks } from "@/components/pawn/HowItWorks";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { usePlanQuota, formatQuota, type Plan } from "@/features/campaign/quota";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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

const STATUS_LABEL_KEY: Record<Status, string> = {
  draft: "studio.campaigns.status.draft", proposed: "studio.campaigns.status.proposed", in_review: "studio.campaigns.status.inReview",
  changes_requested: "studio.campaigns.status.changesRequested", approved: "studio.campaigns.status.approved",
  published: "studio.campaigns.status.published", declined: "studio.campaigns.status.declined",
};

interface EditionCard {
  id: string; status: "pending" | "ready" | "approved" | "declined" | "failed";
  video_url: string | null; campaign_id: string | null;
  editions?: { theme: string; world: string | null } | null;
}

export default function StudioCampaigns() {
  const { t } = useI18n();
  const { designer, loading } = useMyDesigner();
  // Teil K1 — das Video-Kontingent wandert aus der Topbar hierher: es gehört zur Clips-Fläche.
  const quota = usePlanQuota(designer?.id, ((designer as unknown as { plan?: Plan })?.plan) ?? "haus");
  // Teil O — das ausklappbare Beispielbild des Produktbild-Versprechens.
  const [beispielOffen, setBeispielOffen] = useState(false);
  const { user } = useAuth();
  const [items, setItems] = useState<CampaignRow[]>([]);
  const [active, setActive] = useState<CampaignRow | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editionCards, setEditionCards] = useState<EditionCard[]>([]);
  const [editionBusy, setEditionBusy] = useState<string | null>(null);

  const refresh = async () => {
    if (!designer) return;
    const { data } = await supabase.from("campaigns")
      .select("id, title, kind, status, content, feedback, created_at")
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as unknown as CampaignRow[]);
  };

  const refreshEditions = async () => {
    if (!designer) return;
    const { data } = await supabase.from("edition_participants" as never)
      .select("id, status, video_url, campaign_id, editions:edition_id(theme, world)")
      .eq("designer_id", designer.id)
      .in("status", ["pending", "ready"]);
    setEditionCards((data ?? []) as unknown as EditionCard[]);
  };

  useEffect(() => { void refresh(); void refreshEditions(); /* eslint-disable-next-line */ }, [designer?.id]);

  const decideEdition = async (card: EditionCard, approve: boolean) => {
    if (!designer) return;
    setEditionBusy(card.id);
    try {
      if (approve) {
        const { data: d } = await supabase.from("designers").select("media_rights_granted_at").eq("id", designer.id).maybeSingle();
        const rightsGranted = !!(d as { media_rights_granted_at?: string | null } | null)?.media_rights_granted_at;
        const { data: videoAssetRow } = await supabase.from("video_assets").insert({
          designer_id: designer.id,
          campaign_id: card.campaign_id,
          url: card.video_url,
          source: "edition",
          video_dna: { signatur: null, hook_typ: null, schnittrhythmus: null, palette: null, laenge_s: 5, modelltyp: "edition-kinematisch" } as unknown as Record<string, unknown>,
          rights_granted: rightsGranted,
        } as never).select("id").single();
        // Mediathek (Teil 12b): auch umgesetzte gemeinsame Kampagnen landen dort, verlinkt mit video_assets.
        await supabase.from("media_assets" as never).insert({
          designer_id: designer.id, kind: "video", origin: "edition", url: card.video_url,
          title: `gemeinsame Kampagne · ${card.editions?.theme ?? ""}`.trim(), rights_granted: rightsGranted,
          video_asset_id: (videoAssetRow as { id: string } | null)?.id ?? null,
          campaign_id: card.campaign_id,
        } as never);
        if (card.campaign_id) await supabase.from("campaigns").update({ status: "approved" }).eq("id", card.campaign_id);
        await supabase.from("edition_participants" as never).update({ status: "approved" } as never).eq("id", card.id);
        toast.success(t("studio.campaigns.edition.approvedToast"));
      } else {
        await supabase.from("edition_participants" as never).update({ status: "declined" } as never).eq("id", card.id);
        toast.success(t("studio.campaigns.edition.declinedToast"));
      }
      void refreshEditions();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEditionBusy(null);
    }
  };

  const decide = async (status: "approved" | "changes_requested", comment?: string) => {
    if (!active || !user) return;
    if (status === "changes_requested" && !comment?.trim()) {
      return toast.error(t("studio.campaigns.changeCommentRequired"));
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
    toast.success(status === "approved" ? t("studio.campaigns.approvedToast") : t("studio.campaigns.changesRequestedToast"));
    setActive(null); setFeedbackText("");
    void refresh();
  };

  if (loading) return <StudioShell title={t("studioShell.nav.clips")}><PawnLoading /></StudioShell>;
  if (!designer) return <StudioShell title={t("studioShell.nav.clips")}><p className="text-muted-foreground">{t("studio.campaigns.noAccess")}</p></StudioShell>;

  return (
    <StudioShell title={t("studioShell.nav.clips")} eyebrow={t("studio.campaigns.eyebrow")}>
      <FlaechenTabs tabs={[
        { label: t("studio.tabs.neu"), to: "/studio/clips" },
        { label: t("studio.tabs.fertig"), to: "/studio/clips/fertig" },
      ]} />
      {/* Teil O — das erste Versprechen der Fläche: professionelle Produktbilder
          aus Handyfotos. Die bestehende Produktbild-Funktion ist die erste
          Handlung; Videos folgen darunter als zweiter Abschnitt. */}
      <section className="al-karte mb-8 p-6 sm:p-8">
        <h2 className="max-w-2xl font-serif text-2xl leading-tight md:text-3xl">{t("studio.clips.versprechen")}</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a href="/studio/clips/neu" className="al-knopf-primaer">{t("studio.clips.produktbild.cta")}</a>
          <button
            type="button"
            onClick={() => setBeispielOffen((v) => !v)}
            aria-expanded={beispielOffen}
            className="al-knopf-leise text-xs"
          >
            {beispielOffen ? t("studio.clips.beispiel.verbergen") : t("studio.clips.beispiel.zeigen")}
          </button>
        </div>
        {beispielOffen && (
          <figure className="al-auftauchen mt-5 max-w-sm">
            <img
              src={beispielProduktbild}
              alt={t("studio.clips.beispiel.caption")}
              width={896}
              height={1200}
              loading="lazy"
              className="w-full rounded-[14px]"
            />
            <figcaption className="mt-2 text-xs text-muted-foreground">{t("studio.clips.beispiel.caption")}</figcaption>
          </figure>
        )}
      </section>

      <p className="mb-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.clips.videos.titel")}</p>
      {!quota.loading && (
        <p className="mb-6 text-xs text-muted-foreground tabular-nums">
          {formatQuota(quota.used.videos, quota.unlimited ? -1 : quota.limits.videos, t("studioShell.videos"))}
        </p>
      )}
      <HowItWorks
        storageKey="campaigns"
        title={t("studioShell.nav.clips")}
        intro={t("studio.campaigns.howItWorks.intro")}
        steps={[
          t("studio.campaigns.howItWorks.step1"),
          t("studio.campaigns.howItWorks.step2"),
          t("studio.campaigns.howItWorks.step3"),
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("studio.campaigns.intro")}
        </p>
        <a href="/studio/kampagnen/neu" className="flex items-center gap-2 border border-foreground bg-foreground px-5 py-2.5 text-[0.68rem] uppercase tracking-[0.28em] text-background hover:opacity-90">
          + {t("studio.campaigns.newCampaign")}
        </a>
      </div>

      {editionCards.length > 0 && (
        <div className="mt-8 space-y-4">
          <p className="editorial-eyebrow">{t("studio.campaigns.edition.sectionTitle")}</p>
          {editionCards.map((card) => (
            <div key={card.id} className="border-[1.5px] border-black bg-white p-5">
              <p className="font-serif text-xl">{card.editions?.theme ?? t("studio.campaigns.edition.fallbackTheme")}</p>
              <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">{card.editions?.world ?? "—"}</p>
              {card.status === "pending" ? (
                <p className="mt-3 text-sm text-muted-foreground">{t("studio.campaigns.edition.producing")}</p>
              ) : (
                <>
                  {card.video_url && (
                    <video src={card.video_url} controls playsInline className="mt-4 aspect-[9/16] w-full max-w-xs border border-border bg-black object-contain" />
                  )}
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("studio.campaigns.edition.disclaimer")}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => decideEdition(card, true)} disabled={editionBusy === card.id}
                      className="border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-background disabled:opacity-50">
                      {t("studio.campaigns.edition.approveBtn")}
                    </button>
                    <button onClick={() => decideEdition(card, false)} disabled={editionBusy === card.id}
                      className="border border-border px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] hover:border-foreground disabled:opacity-50">
                      {t("studio.campaigns.edition.declineBtn")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <PawnEmptyState className="mt-8 p-12" title={t("studio.campaigns.empty.title")} description={t("studio.campaigns.empty.body")} />
      ) : (
        /* Teil N — das Regal: Clips liegen als visuelle Stücke mit Vorschaubild da,
           nicht als Aktenzeilen. Ein Tipp öffnet die Detailkarte wie zuvor. */
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setActive(c)} className="block w-full text-left">
                <div className="al-werk-bild aspect-[9/12] w-full">
                  {c.content.asset_url ? (
                    c.kind === "video" ? (
                      <video src={c.content.asset_url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      <img src={c.content.asset_url} alt="" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true" style={{ opacity: 0.5 }}>
                        <g fill="none" stroke="#f4c667" strokeWidth={1.7}><rect x="8" y="12" width="32" height="24" rx="3" /><path d="M20 20l10 4-10 4z" fill="#f4c667" stroke="none" /></g>
                      </svg>
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate font-serif text-base leading-snug">{c.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(STATUS_LABEL_KEY[c.status])} · {new Date(c.created_at).toLocaleDateString("de-DE")}
                  {c.status === "proposed" && <> · {t("studio.campaigns.reviewOpen")}</>}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setActive(null)}>
          <div className="w-full max-w-2xl border border-border bg-card p-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="editorial-eyebrow">{active.kind} · {t(STATUS_LABEL_KEY[active.status])}</p>
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
                  <p className="editorial-eyebrow">{t("studio.campaigns.script")}</p>
                  <p className="mt-2 whitespace-pre-wrap font-serif italic">{active.content.script}</p>
                </div>
              )}
              {active.content.caption && (
                <div>
                  <p className="editorial-eyebrow">{t("studio.campaigns.caption")}</p>
                  <p className="mt-2 text-sm">{active.content.caption}</p>
                </div>
              )}
              {active.content.hashtags && active.content.hashtags.length > 0 && (
                <p className="text-xs text-muted-foreground">{active.content.hashtags.map((h) => h.startsWith("#") ? h : `#${h}`).join(" ")}</p>
              )}
              {active.status === "approved" && active.content.asset_url && (
                <div className="border border-border bg-muted/40 p-4">
                  <a href={active.content.asset_url} download className="border border-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] hover:bg-foreground hover:text-background">
                    {t("studio.campaigns.downloadForOwnChannel")}
                  </a>
                  <p className="mt-3 text-xs text-muted-foreground">{t("studio.campaigns.musicNote")}</p>
                </div>
              )}
            </section>

            {active.feedback && active.feedback.length > 0 && (
              <section className="mt-6 border-t border-border pt-6">
                <p className="editorial-eyebrow">{t("studio.campaigns.history")}</p>
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
                  <span className="editorial-eyebrow flex items-center gap-2"><MessageSquare className="h-3 w-3" /> {t("studio.campaigns.noteLabel")}</span>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="mt-2 w-full border border-border bg-background p-3 text-sm min-h-24"
                    placeholder={t("studio.campaigns.notePlaceholder")}
                  />
                </label>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => decide("approved", feedbackText || undefined)} disabled={busy}
                    className="flex items-center gap-2 border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
                    <Check className="h-3 w-3" /> {t("studio.campaigns.approveBtn")}
                  </button>
                  <button onClick={() => decide("changes_requested", feedbackText)} disabled={busy}
                    className="border border-destructive px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-destructive disabled:opacity-50">
                    {t("studio.campaigns.requestChangesBtn")}
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
