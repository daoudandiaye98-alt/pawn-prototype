import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { emptyBody, type BodyMeasurements, type FitPreference } from "./measurements";

interface Row {
  height_cm: number | null;
  shoulder_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  inseam_cm: number | null;
  foot_cm: number | null;
  fit_preference: string | null;
  room_note: string | null;
}

const toBody = (r: Row | null): BodyMeasurements | null =>
  r
    ? {
        ...emptyBody(),
        height_cm: r.height_cm,
        shoulder_cm: r.shoulder_cm,
        chest_cm: r.chest_cm,
        waist_cm: r.waist_cm,
        hip_cm: r.hip_cm,
        inseam_cm: r.inseam_cm,
        foot_cm: r.foot_cm,
        fit_preference: (r.fit_preference as FitPreference) ?? "gerade",
        room_note: r.room_note,
      }
    : null;

export function useMyMeasurements() {
  const { user } = useAuth();
  const [body, setBody] = useState<BodyMeasurements | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setBody(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("customer_measurements")
      .select("height_cm, shoulder_cm, chest_cm, waist_cm, hip_cm, inseam_cm, foot_cm, fit_preference, room_note")
      .eq("user_id", user.id)
      .maybeSingle();
    setBody(toBody((data as Row | null) ?? null));
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(
    async (next: BodyMeasurements) => {
      if (!user) return;
      const { error } = await supabase
        .from("customer_measurements")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      if (error) throw error;
      setBody(next);
    },
    [user],
  );

  const clear = useCallback(async () => {
    if (!user) return;
    await supabase.from("customer_measurements").delete().eq("user_id", user.id);
    setBody(null);
  }, [user]);

  return { body, loading, save, clear, refresh: load, signedIn: !!user };
}
