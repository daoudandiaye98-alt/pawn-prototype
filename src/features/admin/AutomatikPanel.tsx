/**
 * Die Automatik: Studios mit gefundener E-Mail schreibt Jarvis rund um die Uhr selbst an.
 * Hier siehst du, ob sie läuft, was heute rausging — und hältst sie mit einem Griff an.
 * DM-Kontakte und Presse bleiben unabhängig davon bei deiner Freigabe.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

interface AkquiseConfigValue {
  autosend_email?: boolean;
  autosend_min_score?: number;
  email_daily_cap?: number;
  [key: string]: unknown;
}

export function AutomatikPanel() {
  const [config, setConfig] = useState<AkquiseConfigValue | null>(null);
  const [heute, setHeute] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const seit = new Date();
    seit.setHours(0, 0, 0, 0);

    const [{ data: cfg }, { count }] = await Promise.all([
      supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle(),
      supabase.from("ai_actions_log").select("id", { count: "exact", head: true })
        .eq("action", "akquise_erstkontakt_email").eq("status", "ok")
        .gte("created_at", seit.toISOString()),
    ]);
    setConfig((cfg?.value ?? {}) as AkquiseConfigValue);
    setHeute(count ?? 0);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(next: boolean) {
    if (!config) return;
    setSaving(true);
    const value = { ...config, autosend_email: next };
    const { error } = await supabase.from("ai_config").update({ value }).eq("key", "akquise_config");
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setConfig(value);
    toast.success(next
      ? "Automatik läuft — Studios mit E-Mail werden selbstständig angeschrieben."
      : "Automatik angehalten. Ab jetzt geht nur raus, was du freigibst.");
  }

  const an = config?.autosend_email === true;
  const cap = config?.email_daily_cap ?? 10;
  const minScore = config?.autosend_min_score ?? 70;

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">Automatik · E-Mail rund um die Uhr</p>
        <label className="flex items-center gap-3 text-xs uppercase tracking-[0.18em]">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {an ? "Läuft" : "Angehalten"}
          <Switch checked={an} disabled={saving || !config} onCheckedChange={(v) => void toggle(v)} />
        </label>
      </header>

      <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 sm:divide-y-0">
        {[
          { label: "Heute gesendet", value: `${heute} / ${cap}` },
          { label: "Ab Score", value: minScore },
          { label: "Freigabe nötig", value: "DM · Presse" },
        ].map((s) => (
          <div key={s.label} className="px-5 py-3">
            <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-serif text-2xl tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
        Alle sechs Stunden läuft die ganze Kette: suchen, Profile laden, prüfen, schreiben, senden.
        Studios mit gefundener Adresse und starkem Urteil gehen direkt raus — alles andere wartet auf dein „Ja".
      </p>
    </section>
  );
}
