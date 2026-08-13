import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  ARCHETYPEN, ARCHETYP_PLATES, aktiverArchetyp, gewaehlterArchetyp, archetypVorschlag,
  type Archetyp,
} from "@/features/houseTheme/archetyp";

/**
 * Teil K (Abschnitt 4) — die Archetyp-Wahl im Tab Stil: vier Kacheln, ein Tipp genügt,
 * die Vorschau daneben zeigt sofort mit den echten Werken des Hauses, wie die Seite
 * erzählen würde. Gespeichert wird in designers.brand_dna.archetyp (jsonb).
 */

type WerkLite = { id: string; name: string; image_url: string | null };

export function ArchetypWahl({ designerId, brandDna, onSaved }: {
  designerId: string;
  brandDna: Record<string, unknown> | null;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [gewaehlt, setGewaehlt] = useState<Archetyp>(aktiverArchetyp(brandDna));
  const [explizit, setExplizit] = useState<boolean>(gewaehlterArchetyp(brandDna) !== null);
  const [werke, setWerke] = useState<WerkLite[]>([]);

  useEffect(() => {
    setGewaehlt(aktiverArchetyp(brandDna));
    setExplizit(gewaehlterArchetyp(brandDna) !== null);
  }, [brandDna]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("id, name, image_url")
        .eq("designer_id", designerId).eq("status", "published")
        .order("created_at", { ascending: false }).limit(4);
      setWerke(((data ?? []) as WerkLite[]).filter((w) => !!w.image_url));
    })();
  }, [designerId]);

  const waehle = async (a: Archetyp) => {
    setGewaehlt(a);
    setExplizit(true);
    const next = { ...(brandDna ?? {}), archetyp: a };
    const { error } = await supabase.from("designers").update({ brand_dna: next } as never).eq("id", designerId);
    if (error) { toast.error(error.message); return; }
    toast.success(t("studio.brand.toast.saved"));
    onSaved();
  };

  const vorschlag = archetypVorschlag(brandDna);

  return (
    <section className="mb-12 border-[1.5px] border-foreground bg-white p-6 md:p-8">
      <p className="editorial-eyebrow">{t("studio.archetyp.eyebrow")}</p>
      <h3 className="mt-1 font-serif text-xl leading-tight">{t("studio.archetyp.heading")}</h3>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("studio.archetyp.hint")}</p>
      {!explizit && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("studio.archetyp.vorschlag", { name: t(`studio.archetyp.${vorschlag}.name`) })}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-2">
          {ARCHETYPEN.map((a) => {
            const aktiv = a === gewaehlt;
            return (
              <button
                key={a}
                type="button"
                onClick={() => void waehle(a)}
                aria-pressed={aktiv}
                className={`border-[1.5px] p-0 text-left ${aktiv ? "border-foreground" : "border-border hover:border-foreground"}`}
              >
                <div className="relative h-20 w-full overflow-hidden md:h-24" aria-hidden="true">
                  <img src={ARCHETYP_PLATES[a]} alt="" className="h-full w-full object-cover opacity-40 grayscale" loading="lazy" />
                </div>
                <div className={`px-3 py-2.5 ${aktiv ? "bg-foreground text-background" : "bg-white"}`}>
                  <p className="text-[0.62rem] uppercase tracking-[0.24em]">{t(`studio.archetyp.${a}.name`)}</p>
                  <p className={`mt-1 text-xs ${aktiv ? "opacity-80" : "text-muted-foreground"}`}>{t(`studio.archetyp.${a}.line`)}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Teil N — die Vorschau zeigt die öffentliche Erzählung und bleibt deshalb
            Schwarz-Weiß (Magazin-Ausnahme), im warmen Studio-Rahmen. */}
        <div className="al-magazin border border-border p-4">
          <p className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.archetyp.preview")}</p>
          <div className="mt-3">
            {werke.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("studio.archetyp.preview.empty")}</p>
            ) : (
              <ArchetypVorschau archetyp={gewaehlt} werke={werke} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Miniatur der Werk-Erzählung — dieselben Layout-Rhythmen wie die echte Doppelseite. */
function ArchetypVorschau({ archetyp, werke }: { archetyp: Archetyp; werke: WerkLite[] }) {
  const thumb = (w: WerkLite, cls: string) => (
    <img key={w.id} src={w.image_url ?? ""} alt={w.name} loading="lazy" className={`${cls} border border-border object-cover`} />
  );
  if (archetyp === "galerie") {
    return (
      <div className="space-y-6 py-2">
        {werke.slice(0, 2).map((w) => (
          <div key={w.id} className="mx-auto w-3/4">{thumb(w, "aspect-[3/4] w-full")}</div>
        ))}
      </div>
    );
  }
  if (archetyp === "atelier") {
    return (
      <div>
        <div className="mb-2 h-6 w-full overflow-hidden" aria-hidden="true">
          <img src={ARCHETYP_PLATES.atelier} alt="" className="h-full w-full object-cover opacity-40 grayscale" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {werke.slice(0, 4).map((w, i) => (
            <div key={w.id} className={i % 2 === 1 ? "mt-4" : ""}>{thumb(w, "aspect-[4/5] w-full")}</div>
          ))}
        </div>
      </div>
    );
  }
  if (archetyp === "archiv") {
    return (
      <ol className="grid grid-cols-3 gap-2">
        {werke.slice(0, 3).map((w, i) => (
          <li key={w.id}>
            <p className="mb-1 font-serif text-xs tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
            {thumb(w, "aspect-square w-full")}
          </li>
        ))}
      </ol>
    );
  }
  // editorial — versetzte Reihe wie das horizontale Kino der Standardseite.
  return (
    <div className="flex items-start gap-3 overflow-hidden">
      {werke.slice(0, 3).map((w, i) => (
        <div key={w.id} className={`w-1/3 shrink-0 ${i % 2 === 1 ? "mt-5" : ""}`}>{thumb(w, "aspect-[3/4] w-full")}</div>
      ))}
    </div>
  );
}
