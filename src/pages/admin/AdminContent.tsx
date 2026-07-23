/**
 * Texte & Bilder — zentrale Admin-Seite für alle site_content-Schlüssel.
 * Gruppiert nach Seite (contentRegistry), durchsuchbar, mit Bild-Upload und
 * "zuletzt geändert". Ersetzt AdminInhalte.tsx (dessen Felder hero_headline/
 * atelier_feature/footer_lines nie von einer echten Seite gelesen wurden).
 */
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { RoleGate } from "@/features/access/RoleGate";
import { supabase } from "@/integrations/supabase/client";
import { invalidateSiteContent } from "@/lib/siteContent";
import { CONTENT_REGISTRY, MISC_PAGE, type ContentEntry } from "@/lib/contentRegistry";
import { toast } from "sonner";
import { Image as ImageIcon, Search } from "lucide-react";

interface Row { key: string; value: unknown; updated_at: string }

export default function AdminContent() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [ausgabeNummer, setAusgabeNummer] = useState<number>(12);
  const [showSeedContent, setShowSeedContent] = useState(true);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("site_content").select("key, value, updated_at");
    const map: Record<string, Row> = {};
    for (const r of (data ?? []) as Row[]) map[r.key] = r;
    setRows(map);
    const draft: Record<string, string> = {};
    for (const [k, r] of Object.entries(map)) {
      if (typeof r.value === "string") draft[k] = r.value;
    }
    setDrafts(draft);
    if (typeof map.ausgabe_nummer?.value === "number") setAusgabeNummer(map.ausgabe_nummer.value);
    if (typeof map.show_seed_content?.value === "boolean") setShowSeedContent(map.show_seed_content.value);
    setLoaded(true);
  };

  useEffect(() => { void load(); }, []);

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

  const saveField = async (key: string) => {
    const value = drafts[key] ?? "";
    setBusyKey(key);
    const { error } = await supabase.from("site_content").upsert({ key, value } as never);
    setBusyKey(null);
    if (error) return toast.error(error.message);
    invalidateSiteContent();
    setRows((prev) => ({ ...prev, [key]: { key, value, updated_at: new Date().toISOString() } }));
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
      setRows((prev) => ({ ...prev, [key]: { key, value: url, updated_at: new Date().toISOString() } }));
      toast.success("Bild hochgeladen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingKey(null);
    }
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

            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen (Seite, Schlüssel, Bezeichnung) …"
                className="w-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>

            {groups.map(([page, entries]) => (
              <section key={page} className="border border-border bg-card p-6">
                <p className="editorial-eyebrow">{page}</p>
                <div className="mt-6 grid gap-5">
                  {entries.map((e) => (
                    <FieldRow
                      key={e.key}
                      entry={e}
                      value={drafts[e.key] ?? ""}
                      updatedAt={rows[e.key]?.updated_at}
                      busy={busyKey === e.key}
                      uploading={uploadingKey === e.key}
                      onChange={(v) => setDrafts((prev) => ({ ...prev, [e.key]: v }))}
                      onSave={() => saveField(e.key)}
                      onUpload={(f) => uploadImage(e.key, f)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </AdminShell>
    </RoleGate>
  );
}

function FieldRow({ entry, value, updatedAt, busy, uploading, onChange, onSave, onUpload }: {
  entry: ContentEntry; value: string; updatedAt?: string; busy: boolean; uploading: boolean;
  onChange: (v: string) => void; onSave: () => void; onUpload: (f: File) => void;
}) {
  return (
    <div className="border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">{entry.label}</span>
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
        </div>
      ) : entry.type === "multiline" ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} onBlur={onSave} rows={3}
          className="mt-3 w-full border border-border bg-white p-2 text-sm leading-relaxed" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onSave}
          className="mt-3 w-full border border-border bg-white p-2 text-sm" />
      )}
      {busy && <p className="mt-1 text-[0.6rem] text-muted-foreground">Speichert…</p>}
    </div>
  );
}
