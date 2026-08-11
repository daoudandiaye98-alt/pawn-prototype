/**
 * PART 49 "Autopilot": Studios mit geprüfter E-Mail-Adresse gehen automatisch raus, wenn die
 * Autopilot-Regel (akquise_autopilot) sie freigegeben hat — sichtbar in autopilot_checks je Lead,
 * nicht mehr aus einem stillen Score-Vergleich beim Versand selbst. Hier siehst du, ob der Kanal
 * offen ist, was heute rausging — und hältst ihn mit einem Griff an (die gleiche Notbremse, die
 * auch die Akquise-Wache bei Bounce-Quote oder Beschwerde selbst zieht).
 * DM-Kontakte und Presse bleiben unabhängig davon bei deiner Freigabe.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface AkquiseConfigValue {
  autopilot_pause?: boolean;
  autopilot_pause_grund?: string;
  autopilot_min_score?: number;
  autopilot_started_at?: string | null;
  email_daily_cap?: number;
  [key: string]: unknown;
}

/** Gleiche Aufwärmkurve wie im Versand-Lauf (aufwaermkurveCap in pawn-jarvis/index.ts) — nur zur
 * Anzeige hier dupliziert, da die Zahl aus reiner Datumsarithmetik entsteht und clientseitig
 * genauso ehrlich berechenbar ist wie serverseitig. */
function aufwaermkurveCap(startedAt: string | null | undefined, tagesLimit: number): number {
  const start = startedAt ? new Date(startedAt) : new Date();
  const tag = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
  const kurve = tag <= 3 ? 15 : 15 + (tag - 3) * 10;
  return Math.min(tagesLimit, kurve);
}

export function AutomatikPanel() {
  const [config, setConfig] = useState<AkquiseConfigValue | null>(null);
  const [heute, setHeute] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scoreInput, setScoreInput] = useState("0");

  const load = useCallback(async () => {
    const seit = new Date();
    seit.setHours(0, 0, 0, 0);

    const [{ data: cfg }, { count }] = await Promise.all([
      supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle(),
      supabase.from("ai_actions_log").select("id", { count: "exact", head: true })
        .in("action", ["akquise_erstkontakt_email", "akquise_followup_email"]).eq("status", "ok")
        .gte("created_at", seit.toISOString()),
    ]);
    const value = (cfg?.value ?? {}) as AkquiseConfigValue;
    setConfig(value);
    setScoreInput(String(value.autopilot_min_score ?? 0));
    setHeute(count ?? 0);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save(patch: AkquiseConfigValue) {
    if (!config) return;
    setSaving(true);
    const value = { ...config, ...patch };
    const { error } = await supabase.from("ai_config").update({ value }).eq("key", "akquise_config");
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setConfig(value);
  }

  async function toggle(anEin: boolean) {
    await save(anEin
      ? { autopilot_pause: false, autopilot_pause_grund: "" }
      : { autopilot_pause: true, autopilot_pause_grund: "Manuell pausiert" });
    toast.success(anEin
      ? "Autopilot läuft — freigegebene Studios werden automatisch angeschrieben."
      : "Notbremse gezogen. Ab jetzt geht nur raus, was du von Hand freigibst.");
  }

  async function saveScore() {
    const parsed = Math.max(0, Math.min(100, Number(scoreInput) || 0));
    await save({ autopilot_min_score: parsed });
    toast.success(`Mindest-Score für den Autopilot: ${parsed}.`);
  }

  const paused = config?.autopilot_pause === true;
  const pauseGrund = config?.autopilot_pause_grund;
  const cap = aufwaermkurveCap(config?.autopilot_started_at, config?.email_daily_cap ?? 50);
  const ziel = config?.email_daily_cap ?? 50;

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">Autopilot · E-Mail-Erstkontakt</p>
        <label className="flex items-center gap-3 text-xs uppercase tracking-[0.18em]">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {paused ? "Notbremse" : "Läuft"}
          <Switch checked={!paused} disabled={saving || !config} onCheckedChange={(v) => void toggle(v)} />
        </label>
      </header>

      {paused && pauseGrund && (
        <p className="border-b border-border bg-foreground/5 px-5 py-3 text-sm">
          Grund: {pauseGrund}
        </p>
      )}

      <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 sm:divide-y-0">
        <div className="px-5 py-3">
          <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Heute gesendet</dt>
          <dd className="mt-1 font-serif text-2xl tabular-nums">{heute} / {cap}</dd>
        </div>
        <div className="px-5 py-3">
          <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Ziel (Aufwärmkurve)</dt>
          <dd className="mt-1 font-serif text-2xl tabular-nums">{ziel}</dd>
        </div>
        <div className="px-5 py-3">
          <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Freigabe nötig</dt>
          <dd className="mt-1 font-serif text-2xl tabular-nums">DM · Presse</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ab Kurator-Score
          <input
            type="number" min={0} max={100} value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
            className="w-16 border-[1.5px] border-black px-2 py-1 text-sm text-foreground"
          />
        </label>
        <button
          type="button" disabled={saving} onClick={() => void saveScore()}
          className="border-[1.5px] border-black px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors hover:bg-black hover:text-white disabled:opacity-50"
        >
          Speichern
        </button>
      </div>

      <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
        Ein eigener Prüflauf (akquise_autopilot) gibt jedes Studio einzeln frei — Herkunft der
        Adresse, belegte Sprache und ein fertiger Entwurf mit Einladungslink müssen stimmen. Was
        knapp daran vorbeigeht, wartet im Feldzug unter „Prüfen" auf dich. Die Aufwärmkurve hält
        die ersten Tage bewusst klein, die Akquise-Wache zieht die Notbremse selbst, wenn zu viele
        Mails abprallen oder eine Beschwerde eingeht.
      </p>
    </section>
  );
}
