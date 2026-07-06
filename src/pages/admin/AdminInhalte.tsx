import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { RoleGate } from "@/features/access/RoleGate";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULTS, invalidateSiteContent, type SiteContentMap } from "@/lib/siteContent";
import { toast } from "sonner";

type Draft = SiteContentMap;

export default function AdminInhalte() {
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("site_content").select("key, value");
      const map: Record<string, unknown> = {};
      for (const r of (data ?? []) as { key: string; value: unknown }[]) map[r.key] = r.value;
      setDraft({ ...DEFAULTS, ...(map as Partial<SiteContentMap>) });
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    const rows = (Object.keys(draft) as (keyof SiteContentMap)[]).map((k) => ({
      key: k as string,
      value: draft[k] as unknown as never,
    }));
    const { error } = await supabase.from("site_content").upsert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    invalidateSiteContent();
    toast.success("Inhalte gespeichert. Vorschau live.");
  };

  return (
    <RoleGate role="admin">
      <AdminShell title="Inhalte" eyebrow="CMS · Startseite, Banner, Footer">
        {!loaded ? (
          <div className="h-64 animate-pulse bg-muted" />
        ) : (
          <div className="grid gap-8">
            <Section title="Hero" description="Ausgabe, Headline und Unterzeile auf der Startseite.">
              <TextField label="Eyebrow" value={draft.hero_eyebrow} onChange={(v) => setDraft({ ...draft, hero_eyebrow: v })} />
              <TextField label="Headline" value={draft.hero_headline} onChange={(v) => setDraft({ ...draft, hero_headline: v })} />
              <TextArea label="Unterzeile" value={draft.hero_subline} onChange={(v) => setDraft({ ...draft, hero_subline: v })} rows={2} />
              <NumberField label="Ausgabe (Nummer)" value={draft.ausgabe_nummer} onChange={(v) => setDraft({ ...draft, ausgabe_nummer: v })} />
            </Section>

            <Section title="Banner" description="Fallback-Zitat, wenn kein Designer im Rotations-Banner aktiv ist.">
              <TextArea label="Zitat" value={draft.banner_fallback_quote} onChange={(v) => setDraft({ ...draft, banner_fallback_quote: v })} rows={2} />
            </Section>

            <Section title="Atelier-Feature" description="Editorial-Block auf der Startseite.">
              <TextField label="Titel" value={draft.atelier_feature.title} onChange={(v) => setDraft({ ...draft, atelier_feature: { ...draft.atelier_feature, title: v } })} />
              <TextArea label="Text" value={draft.atelier_feature.text} onChange={(v) => setDraft({ ...draft, atelier_feature: { ...draft.atelier_feature, text: v } })} rows={3} />
              <TextField label="Bild-URL (optional)" value={draft.atelier_feature.image ?? ""} onChange={(v) => setDraft({ ...draft, atelier_feature: { ...draft.atelier_feature, image: v || null } })} />
            </Section>

            <Section title="Footer" description="Eine Zeile pro Absatz.">
              <TextArea
                label="Footer-Zeilen"
                value={draft.footer_lines.join("\n")}
                onChange={(v) => setDraft({ ...draft, footer_lines: v.split("\n").map((s) => s.trim()).filter(Boolean) })}
                rows={4}
              />
            </Section>

            <Section title="Beispiel-Inhalte" description="Solange aktiv, ergänzen kuratierte Beispiel-Designer und -Produkte den öffentlichen Katalog. Für den echten Launch ausschalten.">
              <label className="flex items-center gap-3 border border-border bg-card p-4">
                <input
                  type="checkbox"
                  checked={draft.show_seed_content}
                  onChange={(e) => setDraft({ ...draft, show_seed_content: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-sm">Beispiel-Inhalte anzeigen</span>
              </label>
            </Section>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-background/95 py-4 backdrop-blur">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="border border-accent bg-accent px-6 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50"
              >
                {busy ? "…" : "Speichern"}
              </button>
            </div>
          </div>
        )}
      </AdminShell>
    </RoleGate>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card p-6">
      <p className="editorial-eyebrow">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6 grid gap-4">{children}</div>
    </section>
  );
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
    </label>
  );
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-32 border border-border bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
    </label>
  );
}
function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
        className="mt-2 w-full border border-border bg-background p-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent" />
    </label>
  );
}
