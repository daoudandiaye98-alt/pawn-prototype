/**
 * Texte & Bilder — zentrale Admin-Seite für alle site_content-Schlüssel.
 * Gruppiert nach Seite (contentRegistry), durchsuchbar, mit Bild-Upload,
 * "zuletzt geändert" und einem DE/EN-Umschalter je Schlüssel (Teil 8c).
 * Bilder bleiben sprachunabhängig — nur Texte haben eine englische Fassung.
 * Ersetzt AdminInhalte.tsx (dessen Felder hero_headline/atelier_feature/
 * footer_lines nie von einer echten Seite gelesen wurden).
 */
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { RoleGate } from "@/features/access/RoleGate";
import { supabase } from "@/integrations/supabase/client";
import { invalidateSiteContent } from "@/lib/siteContent";
import { CONTENT_REGISTRY, MISC_PAGE, type ContentEntry } from "@/lib/contentRegistry";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Search, Sparkles } from "lucide-react";

type Lang = "de" | "en";
interface Row { key: string; value: unknown; value_en: unknown; updated_at: string }

export default function AdminContent() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editLang, setEditLang] = useState<Lang>("de");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [ausgabeNummer, setAusgabeNummer] = useState<number>(12);
  const [showSeedContent, setShowSeedContent] = useState(true);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("site_content").select("key, value, value_en, updated_at");
    const map: Record<string, Row> = {};
    for (const r of (data ?? []) as Row[]) map[r.key] = r;
    setRows(map);
    if (typeof map.ausgabe_nummer?.value === "number") setAusgabeNummer(map.ausgabe_nummer.value);
    if (typeof map.show_seed_content?.value === "boolean") setShowSeedContent(map.show_seed_content.value);
    setLoaded(true);
  };

  useEffect(() => { void load(); }, []);

  // Drafts folgen der aktiven Bearbeitungssprache — Bilder bleiben immer die
  // gemeinsame (deutsche) URL, egal welche Sprache gerade bearbeitet wird.
  useEffect(() => {
    const draft: Record<string, string> = {};
    for (const [k, r] of Object.entries(rows)) {
      const isImage = typeof r.value === "string" && r.value.startsWith("http");
      const v = !isImage && editLang === "en" ? r.value_en : r.value;
      if (typeof v === "string") draft[k] = v;
    }
    setDrafts(draft);
  }, [editLang, rows]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const known = new Set(CONTENT_REGISTRY.map((e) => e.key));
    const extraEntries: ContentEntry[] = Object.keys(rows)
      .filter((k) => !known.has(k) && k !== "ausgabe_nummer" && k !== "show_seed_content")
      .sort()
      .map((k) => ({ key: k, page: MISC_PAGE, label: k, type: typeof rows[k]?.value === "string" && String(rows[k].value).startsWith("http") ? "image" : "text" }));
    const all = [...CONTENT_REGISTRY, ...extraEntries];
    const filtered = q
      ? all.filter((e) => e.key.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.page.toLowerCase().includes(q))
      : all;
    const byPage = new Map<string, ContentEntry[]>();
    for (const e of filtered) {
      const list = byPage.get(e.page) ?? [];
      list.push(e);
      byPage.set(e.page, list);
    }
    return Array.from(byPage.entries());
  }, [search, rows]);

  const missingCount = useMemo(() => {
    if (editLang === "de") return 0;
    return CONTENT_REGISTRY.filter((e) => e.type !== "image").filter((e) => {
      const r = rows[e.key];
      return typeof r?.value === "string" && r.value && typeof r?.value_en !== "string";
    }).length;
  }, [editLang, rows]);

  const saveField = async (key: string) => {
    const value = drafts[key] ?? "";
    setBusyKey(key);
    const isImage = typeof rows[key]?.value === "string" && String(rows[key].value).startsWith("http");
    const payload: { key: string; value?: string; value_en?: string } =
      !isImage && editLang === "en" ? { key, value_en: value } : { key, value };
    const { error } = await supabase.from("site_content").upsert(payload as never);
    setBusyKey(null);
    if (error) return toast.error(error.message);
    invalidateSiteContent();
    setRows((prev) => {
      const prevRow = prev[key];
      const next: Row = !isImage && editLang === "en"
        ? { key, value: prevRow?.value ?? "", value_en: value, updated_at: new Date().toISOString() }
        : { key, value, value_en: prevRow?.value_en ?? null, updated_at: new Date().toISOString() };
      return { ...prev, [key]: next };
    });
    toast.success("Gespeichert.");
  };

  const uploadImage = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${key}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("site-assets").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
      const url = data.publicUrl;
      const { error } = await supabase.from("site_content").upsert({ key, value: url } as never);
      if (error) throw error;
      invalidateSiteContent();
      setDrafts((prev) => ({ ...prev, [key]: url }));
      setRows((prev) => ({ ...prev, [key]: { key, value: url, value_en: prev[key]?.value_en ?? null, updated_at: new Date().toISOString() } }));
      toast.success("Bild hochgeladen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  const suggestTranslation = async (key: string) => {
    const source = rows[key]?.value;
    if (typeof source !== "string" || !source) return toast.error("Kein deutscher Text vorhanden.");
    setSuggestingKey(key);
    const { data, error } = await supabase.functions.invoke("suggest-translation", { body: { key, text: source } });
    setSuggestingKey(null);
    const res = data as { suggestion?: string; error?: string; message?: string } | null;
    if (error || res?.error) return toast.error(res?.message ?? error?.message ?? "Vorschlag fehlgeschlagen.");
    if (!res?.suggestion) return toast.error("Keine Übersetzung erhalten.");
    setDrafts((prev) => ({ ...prev, [key]: res.suggestion! }));
    toast.success("Vorschlag eingefügt — bitte prüfen und speichern.");
  };

  const saveSettings = async () => {
    setSettingsBusy(true);
    const { error } = await supabase.from("site_content").upsert([
      { key: "ausgabe_nummer", value: ausgabeNummer },
      { key: "show_seed_content", value: showSeedContent },
    ] as never);
    setSettingsBusy(false);
    if (error) return toast.error(error.message);
    invalidateSiteContent();
    toast.success("Gespeichert.");
  };

  return (
    <RoleGate role="admin">
      <AdminShell title="Texte & Bilder" eyebrow="CMS · alle Seiten">
        {!loaded ? (
          <div className="h-64 animate-pulse bg-muted" />
        ) : (
          <div className="grid gap-8">
            <section className="border border-border bg-card p-6">
              <p className="editorial-eyebrow">Einstellungen</p>
              <div className="mt-4 flex flex-wrap items-end gap-6">
                <label className="block">
                  <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Ausgabe (Nummer)</span>
                  <input type="number" value={ausgabeNummer} onChange={(e) => setAusgabeNummer(Number(e.target.value))}
                    className="mt-2 w-32 border border-border bg-background p-2 text-sm" />
                </label>
                <label className="flex items-center gap-3 border border-border bg-background p-3">
                  <input type="checkbox" checked={showSeedContent} onChange={(e) => setShowSeedContent(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm">Beispiel-Inhalte anzeigen</span>
                </label>
                <button onClick={saveSettings} disabled={settingsBusy}
                  className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
                  {settingsBusy ? "…" : "Speichern"}
                </button>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suchen (Seite, Schlüssel, Bezeichnung) …"
                  className="w-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                {editLang === "en" && missingCount > 0 && (
                  <span className="text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">{missingCount} ohne Übersetzung</span>
                )}
                <div className="flex border border-border">
                  {(["de", "en"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setEditLang(l)}
                      className={cn(
                        "min-h-[40px] px-4 text-[0.68rem] uppercase tracking-[0.22em] transition-colors",
                        editLang === l ? "bg-foreground text-background" : "bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {groups.map(([page, entries]) => (
              <section key={page} className="border border-border bg-card p-6">
                <p className="editorial-eyebrow">{page}</p>
                <div className="mt-6 grid gap-5">
                  {entries.map((e) => {
                    const hasGerman = typeof rows[e.key]?.value === "string" && !!rows[e.key]?.value;
                    const hasEnglish = typeof rows[e.key]?.value_en === "string" && !!rows[e.key]?.value_en;
                    return (
                      <FieldRow
                        key={e.key}
                        entry={e}
                        value={drafts[e.key] ?? ""}
                        updatedAt={rows[e.key]?.updated_at}
                        busy={busyKey === e.key}
                        uploading={uploadingKey === e.key}
                        suggesting={suggestingKey === e.key}
                        editLang={editLang}
                        missing={editLang === "en" && e.type !== "image" && hasGerman && !hasEnglish}
                        onChange={(v) => setDrafts((prev) => ({ ...prev, [e.key]: v }))}
                        onSave={() => saveField(e.key)}
                        onUpload={(f) => uploadImage(e.key, f)}
                        onSuggest={() => suggestTranslation(e.key)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </AdminShell>
    </RoleGate>
  );
}

function FieldRow({ entry, value, updatedAt, busy, uploading, suggesting, editLang, missing, onChange, onSave, onUpload, onSuggest }: {
  entry: ContentEntry; value: string; updatedAt?: string; busy: boolean; uploading: boolean; suggesting: boolean;
  editLang: Lang; missing: boolean;
  onChange: (v: string) => void; onSave: () => void; onUpload: (f: File) => void; onSuggest: () => void;
}) {
  return (
    <div className={cn("border border-border bg-background p-4", missing && "border-dashed")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">
          {entry.label}
          {missing && <span className="border border-border px-1.5 py-0.5 text-[0.58rem] text-foreground">Fehlt · {editLang.toUpperCase()}</span>}
        </span>
        <span className="text-[0.58rem] text-muted-foreground/70">
          {entry.key}{updatedAt ? ` · zuletzt geändert ${new Date(updatedAt).toLocaleString("de-DE")}` : " · noch nicht gesetzt"}
        </span>
      </div>
      {entry.type === "image" ? (
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center border border-border bg-muted">
            {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
          </div>
          <label className="cursor-pointer border border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background">
            {uploading ? "Lädt…" : "Bild hochladen"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={(ev) => { const f = ev.target.files?.[0]; if (f) onUpload(f); }} />
          </label>
          <span className="text-[0.6rem] text-muted-foreground">Bilder gelten für beide Sprachen.</span>
        </div>
      ) : (
        <>
          {entry.type === "multiline" ? (
            <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onSave} rows={3}
              className="mt-3 w-full border border-border bg-white p-2 text-sm leading-relaxed" />
          ) : (
            <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onSave}
              className="mt-3 w-full border border-border bg-white p-2 text-sm" />
          )}
          {missing && (
            <button
              type="button"
              onClick={onSuggest}
              disabled={suggesting}
              className="mt-2 flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" /> {suggesting ? "…" : "Englisch vorschlagen"}
            </button>
          )}
        </>
      )}
      {busy && <p className="mt-1 text-[0.6rem] text-muted-foreground">Speichert…</p>}
    </div>
  );
}
