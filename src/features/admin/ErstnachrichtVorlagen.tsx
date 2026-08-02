/**
 * Erstnachricht — deine feste Vorlage, in Deutsch und Englisch.
 * Jarvis schreibt nur noch den persönlichen Einstiegssatz und setzt ihn an die Stelle
 * <personal_line>. Der Rest bleibt wortgleich so, wie du ihn hier hinterlegst.
 * Reines Frontend gegen `ai_config` (Schlüssel `akquise_config`).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const PLACEHOLDER = "<personal_line>";

export function ErstnachrichtVorlagen() {
  const [de, setDe] = useState("");
  const [en, setEn] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
      if (!alive) return;
      const v = (data?.value ?? {}) as { template_de?: string; template_en?: string };
      setDe(v.template_de ?? "");
      setEn(v.template_en ?? "");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function save() {
    setSaving(true);
    const { data: current } = await supabase.from("ai_config").select("value").eq("key", "akquise_config").maybeSingle();
    const base = (current?.value ?? {}) as Record<string, unknown>;
    const { error } = await supabase.from("ai_config")
      .upsert({ key: "akquise_config", value: { ...base, template_de: de, template_en: en } as unknown as never }, { onConflict: "key" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Erstnachricht gespeichert.");
  }

  const preview = (text: string) =>
    text ? text.split(PLACEHOLDER).join("Deine Keramik hat eine Ruhe, die man selten sieht.") : "";

  return (
    <section className="mb-8 border-[1.5px] border-black">
      <header className="border-b-[1.5px] border-black px-5 py-3">
        <p className="editorial-eyebrow">Erstnachricht · deine Vorlage</p>
      </header>

      <div className="space-y-6 px-5 py-5">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Diese Texte werden wortgleich verschickt. Nur die Stelle <code className="border border-border px-1">{PLACEHOLDER}</code>{" "}
          ersetzt Jarvis durch einen persönlichen Satz über die Arbeit der Person. Deutsche Konten bekommen den
          deutschen Text, englischsprachige den englischen. Beide Felder leer = Jarvis formuliert frei.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Wird geladen …</p>
        ) : (
          <>
            <div>
              <label className="editorial-eyebrow" htmlFor="vorlage-de">Deutsch</label>
              <textarea
                id="vorlage-de" value={de} onChange={(e) => setDe(e.target.value)} rows={10}
                placeholder={`Hey, ich bin Daouda aus Köln. ${PLACEHOLDER}\n\nIch baue gerade PAWN …`}
                className="mt-2 w-full border-[1.5px] border-black bg-background p-3 text-sm"
              />
              {de && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-muted-foreground">Vorschau</summary>
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-black pl-3 text-sm">{preview(de)}</p>
                </details>
              )}
            </div>

            <div>
              <label className="editorial-eyebrow" htmlFor="vorlage-en">English</label>
              <textarea
                id="vorlage-en" value={en} onChange={(e) => setEn(e.target.value)} rows={10}
                placeholder={`Hey, I'm Daouda from Cologne. ${PLACEHOLDER}\n\nI'm building PAWN …`}
                className="mt-2 w-full border-[1.5px] border-black bg-background p-3 text-sm"
              />
              {en && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs uppercase tracking-[0.18em] text-muted-foreground">Preview</summary>
                  <p className="mt-2 whitespace-pre-wrap border-l-2 border-black pl-3 text-sm">{preview(en)}</p>
                </details>
              )}
            </div>

            <button
              type="button" onClick={() => void save()} disabled={saving}
              className="inline-flex items-center gap-2 border-[1.5px] border-black bg-black px-5 py-2 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Speichern
            </button>
          </>
        )}
      </div>
    </section>
  );
}
