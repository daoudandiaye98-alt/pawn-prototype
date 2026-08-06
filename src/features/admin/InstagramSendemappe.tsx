/**
 * Die Instagram-Sendemappe (Teil 23): PAWN bereitet vor, der Mensch versendet.
 * Es gibt keinen automatischen Versand über Instagram — nur fertige Texte, zum
 * Kopieren und Einfügen direkt in der App. Eine Tagesportion statt Fließband,
 * damit Instagram unauffälliges Handarbeiten nie mit einem Bot verwechselt.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink, Loader2, Pencil, SkipForward, Check, MessageCircleReply } from "lucide-react";

export interface SendemappeLead {
  id: string;
  handle: string;
  world: string;
  followers: number | null;
  status: string;
  channel: string | null;
  message_draft: string | null;
  kurator_score: number | null;
  score_reasons: Record<string, unknown> | null;
  scrape_images: unknown;
  contact_attempts: number | null;
  contacted_at: string | null;
  next_touch_at: string | null;
  opt_out: boolean;
  notes: string | null;
}

interface DmConfig { dm_daily_cap: number; dm_followup_after_days: number; max_touches: number }

interface QueueItem { lead: SendemappeLead; kind: "erstkontakt" | "followup" }

const FOLLOWUP_DM = "Kurzer Nachtrag, falls meine erste Nachricht untergegangen ist: pawn.vision — kostenlos, du behältst 93 %. Wenn's nichts für dich ist, alles gut.";

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function images(lead: SendemappeLead): string[] {
  return Array.isArray(lead.scrape_images) ? (lead.scrape_images as string[]).slice(0, 3) : [];
}

function reasonText(lead: SendemappeLead): string | null {
  const r = lead.score_reasons;
  if (!r) return null;
  const candidate = r.begruendung ?? r.hinweis ?? r.reason ?? r.urteil;
  return typeof candidate === "string" ? candidate : null;
}

function buildQueue(rows: SendemappeLead[]): QueueItem[] {
  const now = Date.now();
  const items: QueueItem[] = [];
  for (const r of rows) {
    if (r.channel !== "instagram" || r.opt_out) continue;
    const touchReady = !r.next_touch_at || new Date(r.next_touch_at).getTime() <= now;
    if (!touchReady) continue;
    if (r.status === "qualifiziert" && r.message_draft) {
      items.push({ lead: r, kind: "erstkontakt" });
    } else if (r.status === "kontaktiert" && (r.contact_attempts ?? 0) === 1 && r.next_touch_at) {
      items.push({ lead: r, kind: "followup" });
    }
  }
  return items.sort((a, b) => (b.lead.kurator_score ?? 0) - (a.lead.kurator_score ?? 0));
}

export function InstagramSendemappe({
  rows, onChange,
}: { rows: SendemappeLead[]; onChange: (id: string, patch: Partial<SendemappeLead>) => void }) {
  const [config, setConfig] = useState<DmConfig | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyNote, setReplyNote] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
      const v = (data?.value ?? {}) as Partial<DmConfig>;
      setConfig({
        dm_daily_cap: v.dm_daily_cap ?? 20,
        dm_followup_after_days: v.dm_followup_after_days ?? 7,
        max_touches: v.max_touches ?? 2,
      });
    })();
  }, []);

  const sentToday = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return rows.filter((r) => r.channel === "instagram" && r.contacted_at && new Date(r.contacted_at).getTime() >= start.getTime()).length;
  }, [rows]);

  const queue = useMemo(() => buildQueue(rows), [rows]);
  const dailyCap = config?.dm_daily_cap ?? 20;
  const remainingToday = Math.max(0, dailyCap - sentToday);
  const visibleQueue = queue.slice(0, remainingToday);
  const waitingCount = Math.max(0, queue.length - visibleQueue.length);

  function textFor(lead: SendemappeLead, kind: QueueItem["kind"]): string {
    if (edited[lead.id] != null) return edited[lead.id];
    return kind === "followup" ? FOLLOWUP_DM : (lead.message_draft ?? "");
  }

  async function openAndCopy(item: QueueItem) {
    const text = textFor(item.lead, item.kind);
    if (!text) { toast.error("Noch kein Text vorhanden."); return; }
    await navigator.clipboard.writeText(text);
    if (isMobileDevice()) {
      window.location.href = `instagram://user?username=${encodeURIComponent(item.lead.handle)}`;
    } else {
      window.open(`https://instagram.com/${item.lead.handle}`, "_blank", "noopener,noreferrer");
    }
    toast.success("Nachricht kopiert.");
  }

  async function markSent(item: QueueItem) {
    setBusyId(item.lead.id);
    const now = new Date().toISOString();
    const attempts = (item.lead.contact_attempts ?? 0) + 1;
    const allowFollowup = item.kind === "erstkontakt" && (config?.max_touches ?? 2) >= 2;
    const nextTouch = allowFollowup ? new Date(Date.now() + (config?.dm_followup_after_days ?? 7) * 86_400_000).toISOString() : null;
    const patch: Partial<SendemappeLead> = { status: "kontaktiert", contacted_at: now, contact_attempts: attempts, next_touch_at: nextTouch };
    const { error } = await supabase.from("acquisition_leads").update({ ...patch, updated_at: now }).eq("id", item.lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    onChange(item.lead.id, patch);
    toast.success(`@${item.lead.handle} als gesendet markiert.`);
  }

  async function skip(item: QueueItem) {
    setBusyId(item.lead.id);
    const next_touch_at = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ next_touch_at, updated_at: new Date().toISOString() }).eq("id", item.lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    onChange(item.lead.id, { next_touch_at });
    toast.success(`@${item.lead.handle} kommt frühestens in 14 Tagen wieder.`);
  }

  async function markReplied(item: QueueItem) {
    setBusyId(item.lead.id);
    const now = new Date().toISOString();
    const notes = replyNote[item.lead.id]?.trim() || null;
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "antwort", notes, updated_at: now }).eq("id", item.lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    onChange(item.lead.id, { status: "antwort", notes });
    toast.success(`@${item.lead.handle}: Antwort vermerkt.`);
  }

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
      const top = visibleQueue[0];
      if (!top || busyId) return;
      if (e.key === "c" || e.key === "Enter") { e.preventDefault(); void openAndCopy(top); }
      else if (e.key === "g") { e.preventDefault(); void markSent(top); }
      else if (e.key === "s") { e.preventDefault(); void skip(top); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleQueue, edited, config, busyId]);

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-black pb-3">
        <p className="editorial-eyebrow">Sendemappe · Instagram · {sentToday} / {dailyCap} heute</p>
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          Tasten: C kopieren & öffnen · G gesendet · S überspringen
        </p>
      </header>

      <p className="mb-6 text-sm text-muted-foreground">
        Nichts hier verschickt sich selbst — jede Karte ist ein Vorschlag, du entscheidest und sendest von Hand in der Instagram-App.
      </p>

      {queue.length === 0 ? (
        <div className="border-[1.5px] border-black p-10 text-center text-muted-foreground">
          Noch keine Instagram-Entwürfe bereit — Jarvis schreibt sie, sobald qualifizierte Häuser ohne Adresse warten.
        </div>
      ) : visibleQueue.length === 0 ? (
        <div className="border-[1.5px] border-black p-10 text-center text-muted-foreground">
          Für heute erledigt. {waitingCount} {waitingCount === 1 ? "Karte wartet" : "Karten warten"} noch — morgen geht's weiter.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleQueue.map((item, i) => {
            const lead = item.lead;
            const text = textFor(lead, item.kind);
            const reason = reasonText(lead);
            const isBusy = busyId === lead.id;
            return (
              <article
                key={`${lead.id}-${item.kind}`}
                className={i === 0 ? "border-[1.5px] border-black shadow-[6px_6px_0_#000]" : "border-[1.5px] border-black"}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b-[1.5px] border-black px-5 py-3">
                  <div>
                    <a
                      href={`https://instagram.com/${lead.handle}`} target="_blank" rel="noopener noreferrer"
                      className="font-serif text-lg underline-offset-4 hover:underline"
                    >
                      @{lead.handle}
                    </a>
                    <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                      {lead.world}
                      {lead.followers != null ? ` · ${lead.followers.toLocaleString("de-DE")} Follower` : ""}
                      {lead.kurator_score != null ? ` · Score ${lead.kurator_score}` : ""}
                    </p>
                  </div>
                  <span className="border border-black px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]">
                    {item.kind === "erstkontakt" ? "Erstkontakt" : "Nachfassen"}
                  </span>
                </header>

                <div className="space-y-4 p-5">
                  {images(lead).length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {images(lead).map((src) => (
                        <img key={src} src={src} alt={`Arbeit von @${lead.handle}`} loading="lazy"
                          className="h-24 w-24 shrink-0 border border-black object-cover" />
                      ))}
                    </div>
                  )}

                  {reason && (
                    <div>
                      <p className="editorial-eyebrow mb-1">Kurator-Begründung</p>
                      <p className="text-sm text-foreground/80">{reason}</p>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="editorial-eyebrow">Nachricht</p>
                      <button
                        type="button"
                        onClick={() => setEditOpen((s) => ({ ...s, [lead.id]: !s[lead.id] }))}
                        className="flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
                      >
                        <Pencil className="h-3 w-3" /> Text ändern
                      </button>
                    </div>
                    {editOpen[lead.id] ? (
                      <Textarea
                        value={text}
                        onChange={(e) => setEdited((s) => ({ ...s, [lead.id]: e.target.value }))}
                        rows={5}
                        className="rounded-none border-black text-sm"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap border-l-2 border-black pl-3 text-sm">{text}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button
                      disabled={isBusy}
                      onClick={() => void openAndCopy(item)}
                      className="col-span-2 rounded-none bg-black text-white hover:bg-white hover:text-black sm:flex-1"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Öffnen &amp; kopieren
                    </Button>
                    <Button
                      variant="outline" disabled={isBusy}
                      onClick={() => void markSent(item)}
                      className="rounded-none border-black hover:bg-black hover:text-white"
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Gesendet
                    </Button>
                    <Button
                      variant="outline" disabled={isBusy}
                      onClick={() => void skip(item)}
                      className="rounded-none border-black hover:bg-black hover:text-white"
                    >
                      <SkipForward className="mr-2 h-4 w-4" /> Überspringen
                    </Button>
                  </div>

                  <div className="border-t border-border pt-3">
                    {replyOpen[lead.id] ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={replyNote[lead.id] ?? ""}
                          onChange={(e) => setReplyNote((s) => ({ ...s, [lead.id]: e.target.value }))}
                          placeholder="Notiz zur Antwort (optional)…"
                          className="rounded-none border-black"
                        />
                        <Button
                          disabled={isBusy} onClick={() => void markReplied(item)}
                          className="shrink-0 rounded-none bg-black text-white hover:bg-white hover:text-black"
                        >
                          Vermerken
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReplyOpen((s) => ({ ...s, [lead.id]: true }))}
                        className="flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground underline-offset-4 hover:underline"
                      >
                        <MessageCircleReply className="h-3.5 w-3.5" /> Hat geantwortet
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {waitingCount > 0 && visibleQueue.length > 0 && (
        <p className="mt-6 flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" /> {waitingCount} weitere {waitingCount === 1 ? "Karte wartet" : "Karten warten"} auf morgen — die Tagesportion schützt dein Konto.
        </p>
      )}
    </section>
  );
}
