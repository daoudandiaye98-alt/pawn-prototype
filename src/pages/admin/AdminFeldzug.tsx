/**
 * WP3 "Die ersten Fünfzig" — der Feldzug: die mobile Sende-Rampe. Wichtigstes Werkzeug dieses
 * Auftrags. Ziel: Daouda schafft 50 DMs in unter 40 Minuten vom iPhone. Entwurfs-Prinzip gilt
 * hart: Instagram-DMs sendet ausschließlich der Mensch, das Organ bereitet nur vor.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Copy, Loader2, ExternalLink, Check, SkipForward } from "lucide-react";

interface FeldzugLead {
  id: string;
  handle: string;
  world: string | null;
  followers: number | null;
  personal_line: string | null;
  message_draft: string | null;
  status: string;
  channel: string | null;
  email: string | null;
  admin_decision: string | null;
  qc_passed: boolean | null;
  contacted_at: string | null;
  kurator_score: number | null;
  blocked_reason: string | null;
  replied_at: string | null;
  reply_sentiment: string | null;
  notes: string | null;
  bounce_type: string | null;
  lead_type: string;
  followup_at: string | null;
  dm_followup_draft: string | null;
  dm_followup_sent_at: string | null;
  contact_url: string | null;
  contact_channel: string | null;
  plate_images: unknown;
  plate_status: string | null;
  language: string | null;
  autopilot_checks: { exception_reason?: string; [key: string]: unknown } | null;
}

type ChannelTab = "dm" | "formular" | "nachfassen" | "multiplikator" | "email" | "blockiert";
type MainTab = "heute" | "pruefen" | "gespraech";

interface InboundEvent {
  id: string;
  from_email: string;
  subject: string | null;
  received_at: string;
}

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openInstagramDeeplink(handle: string) {
  const igMe = `https://ig.me/m/${encodeURIComponent(handle)}`;
  if (isMobileDevice()) {
    window.location.href = igMe;
    window.setTimeout(() => { window.location.href = `https://instagram.com/${encodeURIComponent(handle)}`; }, 900);
  } else {
    window.open(`https://instagram.com/${encodeURIComponent(handle)}`, "_blank", "noopener,noreferrer");
  }
}

/**
 * Befund 2 "Die Rampe zeigt kaputte Bilder": scrape_images sind rohe, signierte Instagram-CDN-
 * Adressen, die nach ca. 5 Tagen verfallen — die Karte zeigte sie trotzdem direkt an, mit dem
 * Ergebnis, dass ein Großteil der Karten (62 von 79 zum Zeitpunkt der Prüfung) kaputte
 * Platzhalter-Icons zeigte. plate_images sind die dauerhaft gespiegelten Kopien im eigenen
 * Storage-Bucket ("einladungen", langlebig signiert) — nur diese werden noch angezeigt.
 */
function plateImages(lead: FeldzugLead): string[] {
  return Array.isArray(lead.plate_images) ? (lead.plate_images as string[]).filter((u) => typeof u === "string").slice(0, 3) : [];
}

/** Ehrlichkeitsgesetz: statt eines Platzhalters oder kaputten Icons nennt die Karte den echten
 * Grund, warum keine Bilder da sind — in Alltagssprache, aus plate_status abgeleitet. */
function plateStatusText(status: string | null): string {
  switch (status) {
    case "bilder_abgelaufen": return "Bildadressen abgelaufen";
    case "bilder_fehlgeschlagen": return "Bilder nicht abrufbar";
    case "zu_wenig_material": return "Zu wenig Material";
    default: return "Bilder noch nicht gespiegelt";
  }
}

/**
 * Befund 4 "Vorbeugung in der Rampe": ein falschsprachiger Entwurf (Befund 1) fällt beim
 * Durchklicken der Karten nur auf, wenn jemand jede Nachricht genau liest — ein kleiner
 * Sprach-Chip macht ihn auf einen Blick sichtbar. Kein Wert (ältere Leads vor der Härtung) zeigt
 * bewusst nichts an, statt eine Sprache zu behaupten, die niemand geprüft hat.
 */
function LanguageChip({ language }: { language: string | null }) {
  if (language !== "de" && language !== "en") return null;
  return (
    <span className="shrink-0 border border-black px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.15em]">
      {language}
    </span>
  );
}

/* ─────────────────────── DM-Karte: eine pro Lead, Vollbild mobil ─────────────────────── */

function DmCard({
  lead, onSent, onSkip, busy, textOverride, skipHidden,
}: {
  lead: FeldzugLead;
  onSent: () => void;
  onSkip: (reason: string) => void;
  busy: boolean;
  /** WP5 "Die Rampe auf Hochtouren": für Nachfass-Karten zeigt/kopiert die Karte
   * dm_followup_draft statt der ursprünglichen Erstnachricht. */
  textOverride?: string | null;
  skipHidden?: boolean;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 = frisch, 1 = kopiert, 2 = Instagram geöffnet
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [images, setImages] = useState(() => plateImages(lead));
  const text = textOverride ?? lead.message_draft;

  useEffect(() => { setImages(plateImages(lead)); }, [lead.id, lead.plate_images]);

  useEffect(() => { setStep(0); setSkipOpen(false); setSkipReason(""); }, [lead.id]);

  async function copyText() {
    await navigator.clipboard.writeText(text ?? "");
    toast.success("Nachricht kopiert.");
    setStep((s) => (s < 1 ? 1 : s));
  }

  function openInstagram() {
    openInstagramDeeplink(lead.handle);
    setStep(2);
  }

  function confirmSkip() {
    if (!skipReason.trim()) { toast.error("Bitte kurz einen Grund angeben."); return; }
    onSkip(skipReason.trim());
  }

  return (
    <div className="border-[1.5px] border-black bg-white">
      <header className="border-b-[1.5px] border-black px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="editorial-eyebrow">{lead.world ?? "—"}</p>
            <h2 className="font-serif text-2xl">@{lead.handle}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {lead.followers != null && (
              <span className="text-xs text-muted-foreground">{lead.followers.toLocaleString("de-DE")} Follower</span>
            )}
            <LanguageChip language={lead.language} />
          </div>
        </div>
        {images.length > 0 ? (
          <div className="mt-3 flex gap-2">
            {images.map((src) => (
              <img
                key={src}
                src={src}
                alt={`Arbeit von @${lead.handle}`}
                loading="lazy"
                className="h-16 w-16 border border-black object-cover"
                onError={() => setImages((cur) => cur.filter((u) => u !== src))}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">{plateStatusText(lead.plate_status)}</p>
        )}
      </header>

      <div className="px-5 py-5">
        <p className="editorial-eyebrow mb-2">Nachricht</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{text || "Entwurf wird neu geschrieben."}</p>
      </div>

      {text ? (
        <div className="grid grid-cols-1 gap-2 border-t-[1.5px] border-black p-5 sm:grid-cols-3">
          <Button
            onClick={copyText}
            variant={step === 0 ? "default" : "outline"}
            className={cn("rounded-none justify-center", step === 0 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
          >
            <Copy className="mr-2 h-4 w-4" /> Kopieren
          </Button>
          <Button
            onClick={openInstagram}
            variant={step === 1 ? "default" : "outline"}
            className={cn("rounded-none justify-center", step === 1 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Instagram öffnen
          </Button>
          <Button
            onClick={onSent}
            disabled={busy}
            variant={step === 2 ? "default" : "outline"}
            className={cn("rounded-none justify-center", step === 2 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Gesendet ✓
          </Button>
        </div>
      ) : (
        // Befund 4 "Vorbeugung in der Rampe": ohne Entwurf gibt es nichts zu senden — kein
        // Senden-Knopf, der eine unversendete Nachricht als "Gesendet ✓" markieren könnte.
        <div className="border-t-[1.5px] border-black p-5 text-xs text-muted-foreground">
          PAWN schreibt diesen Entwurf beim nächsten Lauf neu (z. B. nach einer Sprachkorrektur) — noch nichts zu tun.
        </div>
      )}

      {!skipHidden && (
        <div className="border-t border-border px-5 py-3">
          {!skipOpen ? (
            <button
              type="button"
              onClick={() => setSkipOpen(true)}
              className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" /> Überspringen
            </button>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                rows={2}
                placeholder="Warum überspringen? (Pflichtfeld)"
                className="rounded-none border-black text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmSkip} disabled={busy} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
                  Überspringen bestätigen
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setSkipOpen(false); setSkipReason(""); }} className="rounded-none border-black">
                  Abbrechen
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Formular-Karte: Website-Kontaktformular als eigener Zug ─────────────────────── */

/**
 * Teil 41 „Treffsicherheit": Häuser ohne offene E-Mail-Adresse, aber mit Kontaktformular auf der
 * eigenen Seite. Gleiche Handgriffe wie bei der DM: Nachricht kopieren → Formular öffnen →
 * Gesendet ✓. Auch hier sendet ausschließlich der Mensch.
 */
function FormularCard({
  lead, onSent, onSkip, busy,
}: {
  lead: FeldzugLead;
  onSent: () => void;
  onSkip: (reason: string) => void;
  busy: boolean;
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [skipOpen, setSkipOpen] = useState(false);
  const [skipReason, setSkipReason] = useState("");

  useEffect(() => { setStep(0); setSkipOpen(false); setSkipReason(""); }, [lead.id]);

  async function copyText() {
    await navigator.clipboard.writeText(lead.message_draft ?? "");
    toast.success("Nachricht kopiert.");
    setStep((s) => (s < 1 ? 1 : s));
  }

  function openForm() {
    if (!lead.contact_url) return;
    window.open(lead.contact_url, "_blank", "noopener,noreferrer");
    setStep(2);
  }

  return (
    <div className="border-[1.5px] border-black bg-white">
      <header className="border-b-[1.5px] border-black px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="editorial-eyebrow">{lead.world ?? "—"} · Formular</p>
          <LanguageChip language={lead.language} />
        </div>
        <h2 className="font-serif text-2xl">@{lead.handle}</h2>
        {lead.contact_url && (
          <p className="mt-1 break-all text-xs text-muted-foreground">{lead.contact_url}</p>
        )}
      </header>

      <div className="px-5 py-5">
        <p className="editorial-eyebrow mb-2">Nachricht</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
          {lead.message_draft || "Entwurf wird neu geschrieben."}
        </p>
      </div>

      {lead.message_draft ? (
        <div className="grid grid-cols-1 gap-2 border-t-[1.5px] border-black p-5 sm:grid-cols-3">
          <Button
            onClick={copyText}
            variant={step === 0 ? "default" : "outline"}
            className={cn("rounded-none justify-center", step === 0 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
          >
            <Copy className="mr-2 h-4 w-4" /> Nachricht kopieren
          </Button>
          <Button
            onClick={openForm}
            disabled={!lead.contact_url}
            variant={step === 1 ? "default" : "outline"}
            className={cn("rounded-none justify-center", step === 1 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
          >
            <ExternalLink className="mr-2 h-4 w-4" /> Formular öffnen
          </Button>
          <Button
            onClick={onSent}
            disabled={busy}
            variant={step === 2 ? "default" : "outline"}
            className={cn("rounded-none justify-center", step === 2 ? "bg-black text-white hover:bg-white hover:text-black" : "border-black hover:bg-black hover:text-white")}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Gesendet ✓
          </Button>
        </div>
      ) : (
        // Befund 4: ohne Entwurf kein Senden-Knopf, der eine unversendete Nachricht als
        // "Gesendet ✓" markieren könnte.
        <div className="border-t-[1.5px] border-black p-5 text-xs text-muted-foreground">
          PAWN schreibt diesen Entwurf beim nächsten Lauf neu — noch nichts zu tun.
        </div>
      )}

      <div className="border-t border-border px-5 py-3">
        {!skipOpen ? (
          <button
            type="button"
            onClick={() => setSkipOpen(true)}
            className="inline-flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-3.5 w-3.5" /> Überspringen
          </button>
        ) : (
          <div className="space-y-2">
            <Textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={2}
              placeholder="Warum überspringen? (Pflichtfeld)"
              className="rounded-none border-black text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !skipReason.trim()} onClick={() => onSkip(skipReason.trim())} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
                Überspringen bestätigen
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setSkipOpen(false); setSkipReason(""); }} className="rounded-none border-black">
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── E-Mail-Status (automatischer Kanal, nur Anzeige) ─────────────────────── */

function emailQueueStatus(lead: FeldzugLead): string {
  if (lead.bounce_type) return "gebounced";
  if (lead.contacted_at) return "gesendet";
  return "wartet";
}

function kurzDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

/** WP5 "Die Rampe auf Hochtouren": statt nur eines Status-Worts die ganze E-Mail-Spur eines Leads
 * im selben Tab — Erstkontakt, Nachfassen, Antwort — jeweils mit Datum, wenn vorhanden. */
function EmailStatusList({ leads }: { leads: FeldzugLead[] }) {
  if (leads.length === 0) return <p className="p-6 text-sm text-muted-foreground">Keine E-Mail-Leads in der Warteschlange.</p>;
  return (
    <>
      <p className="border-b border-border bg-background px-5 py-2 text-xs text-muted-foreground">
        Eine Antwort erfassen: Tab „Im Gespräch" — dort erscheint jede kontaktierte E-Mail-Lead ohne Antwort.
      </p>
      <ul className="divide-y divide-border">
      {leads.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
          <div>
            <p className="font-serif text-base">@{l.handle}</p>
            <p className="text-xs text-muted-foreground">{l.world ?? "—"}</p>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              {l.contacted_at ? `Erstkontakt ${kurzDatum(l.contacted_at)}` : "Noch kein Erstkontakt"}
              {l.followup_at && ` · Nachgefasst ${kurzDatum(l.followup_at)}`}
              {l.replied_at && ` · Antwort ${kurzDatum(l.replied_at)}`}
            </p>
          </div>
          <span className="shrink-0 border border-black px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.22em]">
            {emailQueueStatus(l)}
          </span>
        </li>
      ))}
      </ul>
    </>
  );
}

/* ─────────────────────── Blockiert-Ansicht ─────────────────────── */

function BlockedList({ leads }: { leads: FeldzugLead[] }) {
  if (leads.length === 0) return <p className="p-6 text-sm text-muted-foreground">Nichts blockiert.</p>;
  return (
    <ul className="divide-y divide-border">
      {leads.map((l) => (
        <li key={l.id} className="px-5 py-3">
          <p className="font-serif text-base">@{l.handle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{l.blocked_reason}</p>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────── Prüfen: Autopilot-Ausnahmen ─────────────────────── */

/**
 * PART 49 "Autopilot" WP4: Leads, die an genau einer weichen Autopilot-Bedingung gescheitert
 * sind (Sprache ohne Beleg oder Entwurf ohne Einladungslink — siehe akquise_autopilot), landen
 * hier statt automatisch versendet zu werden. Alles, was den Autopilot besteht, taucht hier nie
 * auf. Freigeben = admin_decision='ja' (geht mit dem nächsten Versandlauf raus wie jede manuelle
 * Freigabe); Zurückstellen = derselbe blocked_reason-Handgriff wie das "Überspringen" anderswo im
 * Feldzug — ein Grund ist Pflicht, damit ein Zurückstellen nachvollziehbar bleibt.
 */
function PruefenCard({
  lead, onFreigeben, onZurueckstellen, busy,
}: {
  lead: FeldzugLead;
  onFreigeben: () => void;
  onZurueckstellen: (reason: string) => void;
  busy: boolean;
}) {
  const [zurueckOpen, setZurueckOpen] = useState(false);
  const [reason, setReason] = useState("");
  const grund = lead.autopilot_checks?.exception_reason;

  return (
    <li className="border-b border-border px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-serif text-base">@{lead.handle}</p>
          <p className="text-xs text-muted-foreground">{lead.world ?? "—"}</p>
        </div>
        <LanguageChip language={lead.language} />
      </div>
      {grund && <p className="mt-2 text-sm">{grund}</p>}
      {lead.message_draft && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-muted-foreground">Entwurf ansehen</summary>
          <p className="mt-2 whitespace-pre-wrap border-l-2 border-black pl-3 text-sm">{lead.message_draft}</p>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onFreigeben} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
          Freigeben
        </Button>
        {!zurueckOpen && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setZurueckOpen(true)} className="rounded-none border-black hover:bg-black hover:text-white">
            Zurückstellen
          </Button>
        )}
      </div>
      {zurueckOpen && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Grund für das Zurückstellen…"
            className="rounded-none border-black text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !reason.trim()} onClick={() => onZurueckstellen(reason.trim())} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
              Bestätigen
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setZurueckOpen(false); setReason(""); }} className="rounded-none border-black">
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function PruefenList({
  leads, onFreigeben, onZurueckstellen, busyId,
}: {
  leads: FeldzugLead[];
  onFreigeben: (lead: FeldzugLead) => void;
  onZurueckstellen: (lead: FeldzugLead, reason: string) => void;
  busyId: string | null;
}) {
  if (leads.length === 0) return <p className="p-16 text-center text-muted-foreground">Nichts zu prüfen — der Autopilot ist mit allem einig oder wartet noch auf Entwürfe.</p>;
  return (
    <ul>
      {leads.map((l) => (
        <PruefenCard
          key={l.id}
          lead={l}
          busy={busyId === l.id}
          onFreigeben={() => onFreigeben(l)}
          onZurueckstellen={(reason) => onZurueckstellen(l, reason)}
        />
      ))}
    </ul>
  );
}

/* ─────────────────────── Im Gespräch ─────────────────────── */

const SENTIMENTS: { key: "positiv" | "neutral" | "negativ"; label: string }[] = [
  { key: "positiv", label: "Positiv" },
  { key: "neutral", label: "Neutral" },
  { key: "negativ", label: "Negativ" },
];

function GespraechCard({
  lead, onReplied, onRuhe, busy,
}: {
  lead: FeldzugLead;
  onReplied: (sentiment: "positiv" | "neutral" | "negativ") => void;
  onRuhe: (reason: string) => void;
  busy: boolean;
}) {
  const [ruheOpen, setRuheOpen] = useState(false);
  const [ruheReason, setRuheReason] = useState("");

  return (
    <li className="border-b border-border px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-serif text-base">@{lead.handle}</p>
        <span className="text-xs text-muted-foreground">
          {lead.world ?? "—"}
          {lead.channel === "email" && lead.email ? ` · ${lead.email}` : lead.channel === "email" ? " · E-Mail" : " · Instagram DM"}
        </span>
      </div>
      {lead.dm_followup_sent_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nachfassen bereits gesendet am {new Date(lead.dm_followup_sent_at).toLocaleDateString("de-DE")} — ein zweites Nachfassen ist nicht vorgesehen, eher Richtung Ruhe.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Hat geantwortet:</p>
        {SENTIMENTS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onReplied(s.key)}
            className="rounded-none border-black text-[0.65rem] hover:bg-black hover:text-white"
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div className="mt-2">
        {!ruheOpen ? (
          <button
            type="button"
            onClick={() => setRuheOpen(true)}
            className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            Ruhe (kein Interesse)
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            <Textarea
              value={ruheReason}
              onChange={(e) => setRuheReason(e.target.value)}
              rows={2}
              placeholder="Kurzer Grund…"
              className="rounded-none border-black text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={busy || !ruheReason.trim()} onClick={() => onRuhe(ruheReason.trim())} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
                Bestätigen
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setRuheOpen(false); setRuheReason(""); }} className="rounded-none border-black">
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/* ─────────────────────── Eingehende Mails ohne Zuordnung ─────────────────────── */

/**
 * PART 47 Befund 1 "Die Verlorenen": solange Resend Inbound nicht per MX eingerichtet ist,
 * bleibt diese Liste leer — das ist ehrlich so und kein Fehler. Sobald sie läuft, landen hier
 * eingehende Mails, deren Absenderadresse keiner (oder mehr als einer) Lead eindeutig zuzuordnen
 * war. Ein Mensch sucht die passende Lead und verknüpft — die RPC `match_inbound_email` setzt
 * dann auch replied_at/status auf der Lead selbst.
 */
function InboundMailEventRow({ event, onResolved }: { event: InboundEvent; onResolved: (eventId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; handle: string; email: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("acquisition_leads")
        .select("id, handle, email")
        .or(`handle.ilike.%${query.trim()}%,email.ilike.%${query.trim()}%`)
        .limit(8);
      if (!cancelled) { setResults((data as { id: string; handle: string; email: string | null }[] | null) ?? []); setSearching(false); }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query]);

  async function assign(leadId: string) {
    setAssigning(true);
    const { error } = await supabase.rpc("match_inbound_email", { _event_id: event.id, _lead_id: leadId });
    setAssigning(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Antwort zugeordnet.");
    onResolved(event.id);
  }

  return (
    <li className="border-b border-border px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-serif text-base">{event.from_email}</p>
          <p className="text-xs text-muted-foreground">
            {event.subject || "Ohne Betreff"} · {new Date(event.received_at).toLocaleString("de-DE")}
          </p>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="rounded-none border-black hover:bg-black hover:text-white">
            Lead zuordnen
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={1}
            placeholder="Handle oder E-Mail suchen…"
            className="rounded-none border-black text-sm"
          />
          {searching && <p className="text-xs text-muted-foreground">Suche…</p>}
          {results.length > 0 && (
            <ul className="divide-y divide-border border border-border">
              {results.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm">@{r.handle} {r.email && <span className="text-muted-foreground">· {r.email}</span>}</span>
                  <Button size="sm" disabled={assigning} onClick={() => void assign(r.id)} className="rounded-none bg-black text-white hover:bg-white hover:text-black">
                    Zuordnen
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" variant="outline" onClick={() => { setOpen(false); setQuery(""); setResults([]); }} className="rounded-none border-black">
            Abbrechen
          </Button>
        </div>
      )}
    </li>
  );
}

function InboundMailPanel({ events, onResolved }: { events: InboundEvent[]; onResolved: (eventId: string) => void }) {
  if (events.length === 0) return null;
  return (
    <div className="mb-6 border-[1.5px] border-black">
      <header className="border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">Eingehende Mails ohne Zuordnung ({events.length})</p>
      </header>
      <ul>
        {events.map((e) => (
          <InboundMailEventRow key={e.id} event={e} onResolved={onResolved} />
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────── Hauptseite ─────────────────────── */

interface TodayFunnel {
  neu: number;
  kontaktiert: number;
  geantwortet: number;
  beworben: number;
}

export default function AdminFeldzug() {
  const { user, roles, loading } = useAuth();
  const [rows, setRows] = useState<FeldzugLead[]>([]);
  const [fetching, setFetching] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("heute");
  const [channelTab, setChannelTab] = useState<ChannelTab>("dm");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [todayFunnel, setTodayFunnel] = useState<TodayFunnel | null>(null);
  // WP5 "Die Rampe auf Hochtouren": Tagesziel aus ai_config.akquise_config.daily_goal, Standard 50.
  const [dailyGoal, setDailyGoal] = useState(50);
  // WP6/WP7 "Das Attributions-Netz": wie viele Bewerbungen lassen sich auf einen Akquise-Kontakt
  // zurückführen — "X von Y", nie mehr behauptet als real gezählt.
  const [attribution, setAttribution] = useState<{ attributed: number; total: number } | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  // WP8 "Zufuhr-Verzehnfachung": Multiplikatoren (Concept-Stores, Showrooms, Kurator:innen mit
  // eigenem Designer-Netzwerk) sind eine eigene Zielgruppe — eigene Warteschlange, eigener Tab,
  // niemals in der Designer-Warteschlange gemischt (die filtert ohnehin schon auf lead_type='designer').
  const [multiplikatorRows, setMultiplikatorRows] = useState<FeldzugLead[]>([]);
  // PART 47 Befund 1: eingehende Mails, die der Resend-Inbound-Webhook keiner Lead eindeutig
  // zuordnen konnte (kein/mehrdeutiger Treffer per Absenderadresse) — warten auf einen Menschen.
  const [inboundEvents, setInboundEvents] = useState<InboundEvent[]>([]);
  // PART 49 "Autopilot" WP4: Stand der Notbremse + Aufwärmkurve-Zielwert für das Kopfband.
  const [autopilotPause, setAutopilotPause] = useState(false);
  const [autopilotPauseGrund, setAutopilotPauseGrund] = useState("");
  const [emailDailyCap, setEmailDailyCap] = useState(50);
  const [bremseBusy, setBremseBusy] = useState(false);

  const load = async () => {
    setFetching(true);
    const heuteStart = new Date(); heuteStart.setHours(0, 0, 0, 0);
    const heuteIso = heuteStart.toISOString();
    const [leadsRes, neuRes, kontaktiertRes, geantwortetRes, beworbenRes, configRes, attributionRes, multiplikatorRes, inboundRes] = await Promise.all([
      supabase
        .from("acquisition_leads")
        .select("id, handle, world, followers, personal_line, message_draft, status, channel, email, admin_decision, qc_passed, contacted_at, kurator_score, blocked_reason, replied_at, reply_sentiment, notes, bounce_type, lead_type, followup_at, dm_followup_draft, dm_followup_sent_at, contact_url, contact_channel, plate_images, plate_status, language, autopilot_checks")
        .eq("lead_type", "designer")
        .in("status", ["qualifiziert", "kontaktiert"])
        .order("kurator_score", { ascending: false, nullsFirst: false }),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("created_at", heuteIso),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("contacted_at", heuteIso),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("replied_at", heuteIso),
      supabase.from("acquisition_leads").select("id", { count: "exact", head: true }).gte("applied_at", heuteIso),
      supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle(),
      supabase.rpc("get_attribution_stats"),
      supabase
        .from("acquisition_leads")
        .select("id, handle, world, followers, personal_line, message_draft, status, channel, email, admin_decision, qc_passed, contacted_at, kurator_score, blocked_reason, replied_at, reply_sentiment, notes, bounce_type, lead_type, followup_at, dm_followup_draft, dm_followup_sent_at, contact_url, contact_channel, plate_images, plate_status, language, autopilot_checks")
        .eq("lead_type", "multiplikator").eq("status", "qualifiziert").is("contacted_at", null)
        .not("message_draft", "is", null)
        .order("kurator_score", { ascending: false, nullsFirst: false }),
      supabase
        .from("inbound_email_events")
        .select("id, from_email, subject, received_at")
        .is("matched_lead_id", null)
        .order("received_at", { ascending: false })
        .limit(20),
    ]);
    if (leadsRes.error) toast.error(leadsRes.error.message);
    setRows((leadsRes.data as FeldzugLead[] | null) ?? []);
    setMultiplikatorRows((multiplikatorRes.data as FeldzugLead[] | null) ?? []);
    setInboundEvents((inboundRes.data as InboundEvent[] | null) ?? []);
    setTodayFunnel({
      neu: neuRes.count ?? 0,
      kontaktiert: kontaktiertRes.count ?? 0,
      geantwortet: geantwortetRes.count ?? 0,
      beworben: beworbenRes.count ?? 0,
    });
    const cfg = configRes.data?.value as { daily_goal?: number; email_daily_cap?: number; autopilot_pause?: boolean; autopilot_pause_grund?: string } | null;
    if (typeof cfg?.daily_goal === "number" && cfg.daily_goal > 0) setDailyGoal(cfg.daily_goal);
    if (typeof cfg?.email_daily_cap === "number" && cfg.email_daily_cap > 0) setEmailDailyCap(cfg.email_daily_cap);
    setAutopilotPause(cfg?.autopilot_pause === true);
    setAutopilotPauseGrund(cfg?.autopilot_pause_grund ?? "");
    const attrRow = (attributionRes.data as { attributed: number; total: number }[] | null)?.[0] ?? null;
    if (attrRow) setAttribution(attrRow);
    setFetching(false);
  };

  async function runBackfill() {
    setBackfillBusy(true);
    const { data, error } = await supabase.rpc("backfill_lead_attribution");
    setBackfillBusy(false);
    if (error) { toast.error(error.message); return; }
    const result = (data as { matched_count: number; examined_count: number }[] | null)?.[0];
    if (!result || result.examined_count === 0) {
      toast("Keine unzugeordneten Bewerbungen mit Instagram-Handle gefunden.");
    } else if (result.matched_count === 0) {
      toast(`${result.examined_count} geprüft, aber kein eindeutiger Instagram-Handle-Treffer gefunden.`);
    } else {
      toast.success(`${result.matched_count} von ${result.examined_count} geprüften Bewerbungen zugeordnet.`);
    }
    void load();
  }

  /** PART 49 WP4: die Notbremse lösen darf nur ein Mensch (WP3) — dieser Knopf ist die einzige
   * Stelle im Feldzug, die autopilot_pause zurücksetzt. */
  async function bremseLoesen() {
    setBremseBusy(true);
    const { data: cfg } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
    const value = { ...(cfg?.value as Record<string, unknown> ?? {}), autopilot_pause: false, autopilot_pause_grund: "" };
    const { error } = await supabase.from("ai_config").update({ value }).eq("key", "akquise_config");
    setBremseBusy(false);
    if (error) { toast.error(error.message); return; }
    setAutopilotPause(false);
    setAutopilotPauseGrund("");
    toast.success("Notbremse gelöst — der Autopilot kann wieder senden.");
  }

  useEffect(() => { if (user && roles.includes("admin")) void load(); }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  function patch(id: string, p: Partial<FeldzugLead>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  // "Heutige Züge": freigegeben, geprüft, noch nicht kontaktiert.
  const readyToday = rows.filter((r) => r.admin_decision === "ja" && r.qc_passed === true && !r.contacted_at);
  // Teil 41: Formular-Leads sind ein eigener Zug — sie tauchen nicht mehr in der DM-Liste auf.
  const formularQueue = readyToday.filter((r) => r.contact_channel === "formular" && !!r.contact_url && !r.blocked_reason);
  const dmQueue = readyToday.filter((r) => r.channel !== "email" && !r.blocked_reason && !formularQueue.includes(r));
  // WP5: die E-Mail-Ansicht zeigt jetzt die ganze Spur (auch schon Kontaktierte), nicht nur die
  // Warteschlange — sonst ist von "Erstkontakt/Nachgefasst/Antwort" nie etwas zu sehen.
  const emailQueue = rows.filter((r) => r.channel === "email");
  const blockedQueue = readyToday.filter((r) => !!r.blocked_reason);
  // WP5: vorbereitete Nachfass-Entwürfe, noch nicht gesendet — eigener Zug neben der Erstnachricht.
  const nachfassenQueue = rows.filter((r) => r.dm_followup_draft && !r.dm_followup_sent_at);
  // Befund 4 "Vorbeugung in der Rampe": ohne diesen Zähler sammelt sich der Rückstau an kaputten
  // Bildern (Befund 2) still an, bis wieder jemand von Hand hinschaut — der Rückstau bleibt so
  // sichtbar, solange geladene Leads (Designer + Multiplikatoren) ohne gespiegelte Platte da sind.
  const missingPlateCount = [...rows, ...multiplikatorRows].filter((r) => plateImages(r).length === 0).length;

  // PART 49 "Autopilot" WP4: Leads mit genau einer weichen Ausnahme aus akquise_autopilot,
  // noch ohne Entscheidung — alles, was der Autopilot durchwinkt, taucht hier nie auf.
  const pruefenQueue = rows.filter((r) => r.lead_type === "designer" && !r.admin_decision && !!r.autopilot_checks?.exception_reason);
  // Heute automatisch versendet — dieselbe Definition wie "Heute gesendet" oben, nur auf
  // admin_decision='auto' eingeschränkt, damit Autopilot und manuelle Freigabe sichtbar getrennt bleiben.
  const heuteStartFuerBand = new Date(); heuteStartFuerBand.setHours(0, 0, 0, 0);
  const autopilotSentToday = rows.filter((r) => r.admin_decision === "auto" && r.contacted_at && new Date(r.contacted_at) >= heuteStartFuerBand).length;

  // "Im Gespräch": kontaktiert, noch keine Antwort erfasst — PART 47 Befund 1: auch E-Mail-Leads
  // gehören hierher. Solange der automatische Antworten-Abgleich (Resend Inbound) nicht per MX
  // eingerichtet ist, ist dieser Tab der einzige Ort, an dem eine Antwort überhaupt erfasst
  // werden kann — vorher fielen E-Mail-Leads hier komplett heraus und blieben für immer ohne
  // Möglichkeit, "geantwortet" zu werden.
  const gespraech = rows.filter((r) => r.status === "kontaktiert" && !r.replied_at);

  const currentDm = dmQueue[0] ?? null;
  const currentFormular = formularQueue[0] ?? null;
  const currentNachfassen = nachfassenQueue[0] ?? null;
  const currentMultiplikator = multiplikatorRows[0] ?? null;

  async function markMultiplikatorSent(lead: FeldzugLead) {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "kontaktiert", contacted_at: now, updated_at: now }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    setMultiplikatorRows((rs) => rs.filter((r) => r.id !== lead.id));
    toast.success(`@${lead.handle} als gesendet markiert.`);
  }

  async function skipMultiplikator(lead: FeldzugLead, reason: string) {
    setBusyId(lead.id);
    const { error } = await supabase.from("acquisition_leads")
      .update({ blocked_reason: reason, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    setMultiplikatorRows((rs) => rs.filter((r) => r.id !== lead.id));
    toast.success(`@${lead.handle} übersprungen.`);
  }

  async function markSent(lead: FeldzugLead) {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "kontaktiert", contacted_at: now, updated_at: now }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { status: "kontaktiert", contacted_at: now });
    toast.success(`@${lead.handle} als gesendet markiert.`);
  }

  async function markNachfassenSent(lead: FeldzugLead) {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ dm_followup_sent_at: now, updated_at: now }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { dm_followup_sent_at: now });
    toast.success(`@${lead.handle}: Nachfassen als gesendet markiert.`);
  }

  async function skipLead(lead: FeldzugLead, reason: string) {
    setBusyId(lead.id);
    const { error } = await supabase.from("acquisition_leads")
      .update({ blocked_reason: reason, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { blocked_reason: reason });
    toast.success(`@${lead.handle} übersprungen.`);
  }

  // PART 49 "Autopilot" WP4: Freigeben = dieselbe manuelle Freigabe wie im Prüf-Stapel — geht
  // mit dem nächsten Versandlauf raus, keine erneute Prüfung nötig.
  async function freigebenAutopilotAusnahme(lead: FeldzugLead) {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ admin_decision: "ja", decided_at: now, updated_at: now }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { admin_decision: "ja" });
    toast.success(`@${lead.handle} freigegeben — geht mit dem nächsten Versandlauf raus.`);
  }

  async function zurueckstellenAutopilotAusnahme(lead: FeldzugLead, reason: string) {
    setBusyId(lead.id);
    const { error } = await supabase.from("acquisition_leads")
      .update({ blocked_reason: reason, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { blocked_reason: reason });
    toast.success(`@${lead.handle} zurückgestellt.`);
  }

  async function markReplied(lead: FeldzugLead, sentiment: "positiv" | "neutral" | "negativ") {
    setBusyId(lead.id);
    const now = new Date().toISOString();
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "geantwortet", replied_at: now, reply_channel: lead.channel, reply_sentiment: sentiment, updated_at: now })
      .eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { status: "geantwortet", replied_at: now, reply_sentiment: sentiment });
    toast.success(`@${lead.handle}: Antwort erfasst.`);
  }

  async function markRuhe(lead: FeldzugLead, reason: string) {
    setBusyId(lead.id);
    const notes = [lead.notes, `Ruhe: ${reason}`].filter(Boolean).join("\n");
    const { error } = await supabase.from("acquisition_leads")
      .update({ status: "ruhe", notes, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    patch(lead.id, { status: "ruhe", notes });
    toast.success(`@${lead.handle}: Ruhe.`);
  }

  return (
    <AdminShell title="Feldzug" eyebrow="Die mobile Sende-Rampe">
      {/* WP7 "Wirkungs-Cockpit": ehrliches Heute-Band statt reiner Warteschlangen-Zahlen —
          nur Felder mit echtem Zeitstempel (created_at/contacted_at/replied_at/applied_at). */}
      {todayFunnel && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-px border-[1.5px] border-black bg-black sm:grid-cols-4">
            {[
              { label: "Neu heute", value: todayFunnel.neu },
              { label: "Heute gesendet", value: `${todayFunnel.kontaktiert} / ${dailyGoal}` },
              { label: "Geantwortet heute", value: todayFunnel.geantwortet },
              { label: "Beworben heute", value: todayFunnel.beworben },
            ].map((s) => (
              <div key={s.label} className="bg-white px-4 py-3">
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-serif text-2xl tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          {/* WP5 "Die Rampe auf Hochtouren": freundlicher Hinweis am Tagesziel, kein Stopp — der
              Feldzug bleibt bedienbar, egal wie hoch der Zähler steht. */}
          {todayFunnel.kontaktiert >= dailyGoal && (
            <p className="mb-6 border-[1.5px] border-black bg-white px-4 py-3 text-sm">
              Tagesziel von {dailyGoal} erreicht — großartig. Du kannst gerne weitermachen, musst aber nicht.
            </p>
          )}
        </>
      )}

      {/* Befund 4 "Vorbeugung in der Rampe": macht den Rückstau an nicht gespiegelten Bildern
          (Befund 2) sichtbar, statt dass er sich still ansammelt. */}
      {!fetching && (
        <p className="mb-6 border-[1.5px] border-black bg-white px-4 py-3 text-sm">
          <span className="font-serif text-lg tabular-nums">{missingPlateCount} von {rows.length + multiplikatorRows.length}</span>{" "}
          <span className="text-muted-foreground">Karten ohne gespiegelte Bilder.</span>
        </p>
      )}

      {/* PART 49 "Autopilot" WP4: das Band macht sichtbar, was sonst nur im Versandlauf selbst
          passiert — wie viele E-Mails heute automatisch rausgingen, wie viele auf eine
          Ausnahme-Prüfung warten, und ob die Notbremse (Akquise-Wache oder von Hand) aktiv ist. */}
      {!fetching && (
        <div className={cn(
          "mb-6 flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-black px-4 py-3 text-sm",
          autopilotPause ? "bg-black text-white" : "bg-white",
        )}>
          <p>
            Heute automatisch gesendet{" "}
            <span className="font-serif text-lg tabular-nums">{autopilotSentToday}/{emailDailyCap}</span>{" "}
            · Ausnahmen <span className="font-serif text-lg tabular-nums">{pruefenQueue.length}</span>{" "}
            · Bremse: {autopilotPause ? `ROT (${autopilotPauseGrund || "kein Grund erfasst"})` : "grün"}
          </p>
          {autopilotPause && (
            <Button
              size="sm"
              variant="outline"
              disabled={bremseBusy}
              onClick={() => void bremseLoesen()}
              className="rounded-none border-white bg-white text-black hover:bg-black hover:text-white"
            >
              {bremseBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Bremse lösen
            </Button>
          )}
        </div>
      )}

      <InboundMailPanel
        events={inboundEvents}
        onResolved={(eventId) => setInboundEvents((es) => es.filter((e) => e.id !== eventId))}
      />

      {/* WP7 "Das Attributions-Netz": ehrliche Zuordnungsrate + manueller Nachzieh-Lauf. */}
      {attribution && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-black bg-white px-4 py-3">
          <p className="text-sm">
            <span className="font-serif text-lg tabular-nums">{attribution.attributed} von {attribution.total}</span>{" "}
            <span className="text-muted-foreground">Bewerbungen einem Akquise-Kontakt zugeordnet.</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={backfillBusy}
            onClick={() => void runBackfill()}
            className="rounded-none border-black hover:bg-black hover:text-white"
          >
            {backfillBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ursprünge nachziehen
          </Button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {(["heute", "pruefen", "gespraech"] as MainTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={cn(
              "border-[1.5px] border-black px-4 py-2 text-[0.65rem] uppercase tracking-[0.22em]",
              mainTab === t ? "bg-black text-white" : "hover:bg-black hover:text-white",
            )}
          >
            {t === "heute"
              ? `Heutige Züge (${dmQueue.length})`
              : t === "pruefen"
              ? `Prüfen (${pruefenQueue.length})`
              : `Im Gespräch (${gespraech.length})`}
          </button>
        ))}
      </div>

      {fetching ? (
        <div className="flex items-center justify-center p-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lade Feldzug…
        </div>
      ) : mainTab === "heute" ? (
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              { key: "dm" as ChannelTab, label: `DM (${dmQueue.length})` },
              { key: "formular" as ChannelTab, label: `Formular (${formularQueue.length})` },
              { key: "nachfassen" as ChannelTab, label: `Nachfassen (${nachfassenQueue.length})` },
              { key: "multiplikator" as ChannelTab, label: `Multiplikatoren (${multiplikatorRows.length})` },
              { key: "email" as ChannelTab, label: `E-Mail (${emailQueue.length})` },
              { key: "blockiert" as ChannelTab, label: `Blockiert (${blockedQueue.length})` },
            ]).map((c) => (
              <button
                key={c.key}
                onClick={() => setChannelTab(c.key)}
                className={cn(
                  "border border-border px-3 py-1 text-[0.65rem] uppercase tracking-[0.22em]",
                  channelTab === c.key ? "border-black bg-black text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {channelTab === "dm" && (
            currentDm ? (
              <DmCard
                lead={currentDm}
                busy={busyId === currentDm.id}
                onSent={() => void markSent(currentDm)}
                onSkip={(reason) => void skipLead(currentDm, reason)}
              />
            ) : (
              <div className="border-[1.5px] border-black p-16 text-center text-muted-foreground">
                Für heute erledigt — alle freigegebenen DMs sind raus.
              </div>
            )
          )}
          {channelTab === "formular" && (
            currentFormular ? (
              <FormularCard
                lead={currentFormular}
                busy={busyId === currentFormular.id}
                onSent={() => void markSent(currentFormular)}
                onSkip={(reason) => void skipLead(currentFormular, reason)}
              />
            ) : (
              <div className="border-[1.5px] border-black p-16 text-center text-muted-foreground">
                Kein Formular-Zug offen — hier erscheinen Häuser mit Kontaktformular auf der eigenen
                Seite, sobald PAWN eines gefunden hat.
              </div>
            )
          )}
          {channelTab === "nachfassen" && (
            currentNachfassen ? (
              <DmCard
                lead={currentNachfassen}
                busy={busyId === currentNachfassen.id}
                textOverride={currentNachfassen.dm_followup_draft}
                onSent={() => void markNachfassenSent(currentNachfassen)}
                onSkip={(reason) => void skipLead(currentNachfassen, reason)}
              />
            ) : (
              <div className="border-[1.5px] border-black p-16 text-center text-muted-foreground">
                Kein Nachfassen fällig — PAWN bereitet Nachfass-Entwürfe automatisch vor, sobald
                kontaktierte Leads seit mindestens drei Tagen ohne Antwort sind.
              </div>
            )
          )}
          {channelTab === "multiplikator" && (
            currentMultiplikator ? (
              <DmCard
                lead={currentMultiplikator}
                busy={busyId === currentMultiplikator.id}
                onSent={() => void markMultiplikatorSent(currentMultiplikator)}
                onSkip={(reason) => void skipMultiplikator(currentMultiplikator, reason)}
              />
            ) : (
              <div className="border-[1.5px] border-black p-16 text-center text-muted-foreground">
                Keine Multiplikator-Anfrage fällig — das sind Concept-Stores, Showrooms und
                Kurator:innen mit eigenem Designer-Netzwerk, keine Designer:innen selbst. Eine
                Partnerschafts-Anfrage, nie eine Einladung zum Bewerben.
              </div>
            )
          )}
          {channelTab === "email" && (
            <div className="border-[1.5px] border-black">
              <EmailStatusList leads={emailQueue} />
            </div>
          )}
          {channelTab === "blockiert" && (
            <div className="border-[1.5px] border-black">
              <BlockedList leads={blockedQueue} />
            </div>
          )}
        </div>
      ) : mainTab === "pruefen" ? (
        <div className="border-[1.5px] border-black">
          <PruefenList
            leads={pruefenQueue}
            onFreigeben={(l) => void freigebenAutopilotAusnahme(l)}
            onZurueckstellen={(l, r) => void zurueckstellenAutopilotAusnahme(l, r)}
            busyId={busyId}
          />
        </div>
      ) : (
        <div className="border-[1.5px] border-black">
          {gespraech.length === 0 ? (
            <p className="p-16 text-center text-muted-foreground">Keine offenen Gespräche.</p>
          ) : (
            <ul>
              {gespraech.map((l) => (
                <GespraechCard
                  key={l.id}
                  lead={l}
                  busy={busyId === l.id}
                  onReplied={(s) => void markReplied(l, s)}
                  onRuhe={(r) => void markRuhe(l, r)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </AdminShell>
  );
}
