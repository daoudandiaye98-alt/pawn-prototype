import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

/**
 * Teil 29 — aus Stilberater.tsx (Teil 20a) herausgezogen, damit die Karte auf /account
 * und das neue Cover auf /dna dieselbe Anfrage/Zustimmung/Ablehnung teilen, statt sie
 * zweimal zu bauen.
 */
export interface Belege { text: string; beleg: string }
export interface StilberaterResult {
  ok: boolean;
  fruehzustand: { erreicht: boolean; aktuell: number; ziel: number };
  urteil?: string;
  einordnung?: string;
  stilname?: string;
  belege?: Belege[];
  blinder_fleck?: Belege;
  naechster_schritt?: { text: string };
  generated_at?: string;
  error?: string;
  message?: string;
}

export function useStilberater() {
  const { user, profile } = useAuth();
  const [result, setResult] = useState<StilberaterResult | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = (data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
    setResult((prefs.stilberater as StilberaterResult | undefined) ?? null);
    setDismissed((prefs.stilberater_dismissed as string[] | undefined) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const anfordern = async (isRegen: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-dna-voice", { body: { mode: "kunde" } });
      if (error) throw error;
      const r = data as StilberaterResult;
      if (!r.ok) { toast.error(r.message ?? r.error ?? "Konnte noch keine Einschätzung schreiben."); return; }
      setResult(r);
      if (r.fruehzustand?.erreicht && (r.urteil || r.einordnung)) {
        setDismissed([]);
        toast.success(isRegen ? "Neu eingeschätzt." : "Dein Stilberater ist da.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (id: string) => {
    if (!user) return;
    const next = [...dismissed, id];
    setDismissed(next);
    const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = (data as { preferences?: Record<string, unknown> } | null)?.preferences ?? {};
    await supabase.from("user_memory" as never).update({ preferences: { ...prefs, stilberater_dismissed: next }, updated_at: new Date().toISOString() } as never).eq("user_id", user.id);
  };

  /** Teil 29 — Teil von "Alles löschen": Urteil + Ablehnungen zurücksetzen. */
  const resetAll = async () => {
    if (!user) return;
    setResult(null);
    setDismissed([]);
    const { data } = await supabase.from("user_memory" as never).select("preferences").eq("user_id", user.id).maybeSingle();
    const prefs = { ...(((data as { preferences?: Record<string, unknown> } | null)?.preferences) ?? {}) };
    delete prefs.stilberater;
    delete prefs.stilberater_dismissed;
    await supabase.from("user_memory" as never).update({ preferences: prefs, updated_at: new Date().toISOString() } as never).eq("user_id", user.id);
  };

  const personalizationOff = !!profile && profile.consent.personalization === false;

  return { result, dismissed, loading, busy, load, anfordern, dismiss, resetAll, personalizationOff };
}
