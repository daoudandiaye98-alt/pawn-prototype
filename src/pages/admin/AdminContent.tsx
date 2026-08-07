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
import { TranslationWarmup } from "./TranslationWarmup";
import { deDict, enDict, useI18n } from "@/lib/i18n";


type Lang = "de" | "en";
interface Row { key: string; value: unknown; value_en: unknown; value_en_source: unknown; updated_at: string }
interface I18nOverrideRow { key: string; value_en: string; value_en_source: string | null; updated_at: string }

export default function AdminContent() {
  const { refreshOverrides } = useI18n();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editLang, setEditLang] = useState<Lang>("de");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [suggestingKey, setSuggestingKey] = useState<string | null>(null);
  const [bulkSuggesting, setBulkSuggesting] = useState(false);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [ausgabeNummer, setAusgabeNummer] = useState<number>(12);
  const [showSeedContent, setShowSeedContent] = useState(true);
  const [settingsBusy, setSettingsBusy] = useState(false);

  // Teil 25, Punkt 5: Übersteuerungen für fehlende/verbesserte englische Fassungen
  // der Studio-Oberflächentexte (statisches Wörterbuch in src/lib/i18n.tsx).
  const [i18nOverrides, setI18nOverrides] = useState<Record<string, I18nOverrideRow>>({});
  const [i18nSearch, setI18nSearch] = useState("");
  const [i18nBusyKey, setI18nBusyKey] = useState<string | null>(null);
  const [i18nSuggestingKey, setI18nSuggestingKey] = useState<string | null>(null);
  const [i18nBulkBusy, setI18nBulkBusy] = useState(false);
  const [i18nOpen, setI18nOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("site_content").select("key, value, value_en, value_en_source, updated_at");
    const map: Record<string, Row> = {};
    for (const r of (data ?? []) as Row[]) map[r.key] = r;
    setRows(map);
    if (typeof map.ausgabe_nummer?.value === "number") setAusgabeNummer(map.ausgabe_nummer.value);
    if (typeof map.show_seed_content?.value === "boolean") setShowSeedContent(map.show_seed_content.value);
    setLoaded(true);
  };

  const loadI18nOverrides = async () => {
    const { data } = await supabase.from("i18n_overrides").select("key, value_en, value_en_source, updated_at");
    const map: Record<string, I18nOverrideRow> = {};
    for (const r of (data ?? []) as I18nOverrideRow[]) map[r.key] = r;
    setI18nOverrides(map);
  };

  useEffect(() => { void load(); void loadI18nOverrides(); }, []);

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

  /** Alle Schlüssel mit deutschem Text (auch die, die nicht in der Registry stehen). */
  const translatableKeys = useMemo(
    () =>
      Object.values(rows)
        .filter((r) => typeof r.value === "string" && r.value && !String(r.value).startsWith("http"))
        .map((r) => r.key)
        .sort(),
    [rows],
  );

  /** Fehlt die englische Fassung — oder wurde der deutsche Text seither geändert? */
  const isStale = (key: string): boolean => {
    const r = rows[key];
    if (!r || typeof r.value !== "string" || !r.value || String(r.value).startsWith("http")) return false;
    if (typeof r.value_en !== "string" || !r.value_en) return true;
    return typeof r.value_en_source !== "string" || r.value_en_source !== r.value;
  };

  const pendingKeys = useMemo(() => translatableKeys.filter(isStale), [translatableKeys, rows]);
  const missingCount = editLang === "de" ? 0 : pendingKeys.length;


  const saveField = async (key: string) => {
    const value = drafts[key] ?? "";
    setBusyKey(key);
    const isImage = typeof rows[key]?.value === "string" && String(rows[key].value).startsWith("http");
    const germanNow = typeof rows[key]?.value === "string" ? (rows[key].value as string) : "";
    const payload: { key: string; value?: string; value_en?: string; value_en_source?: string } =
      !isImage && editLang === "en" ? { key, value_en: value, value_en_source: germanNow } : { key, value };
    const { error } = await supabase.from("site_content").upsert(payload as never);
    setBusyKey(null);
    if (error) return toast.error(error.message);
    invalidateSiteContent();
    setRows((prev) => {
      const prevRow = prev[key];
      const next: Row = !isImage && editLang === "en"
        ? { key, value: prevRow?.value ?? "", value_en: value, value_en_source: germanNow, updated_at: new Date().toISOString() }
        : { key, value, value_en: prevRow?.value_en ?? null, value_en_source: prevRow?.value_en_source ?? null, updated_at: new Date().toISOString() };
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
      setRows((prev) => ({ ...prev, [key]: { key, value: url, value_en: prev[key]?.value_en ?? null, value_en_source: prev[key]?.value_en_source ?? null, updated_at: new Date().toISOString() } }));
      toast.success("Bild hochgeladen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadingKey(null);
    }
  };

  /**
   * Übersetzt einen Schlüssel und speichert die englische Fassung sofort — zusammen
   * mit dem deutschen Text, aus dem sie entstand. Ändert sich der deutsche Text
   * später, gilt die Übersetzung automatisch als veraltet und wird beim nächsten
   * Knopfdruck erneut übersetzt.
   */
  const translateKey = async (key: string): Promise<boolean> => {
    const source = rows[key]?.value;
    if (typeof source !== "string" || !source) return false;
    const { data, error } = await supabase.functions.invoke("suggest-translation", { body: { key, text: source } });
    const res = data as { suggestion?: string; error?: string; message?: string } | null;
    if (error || res?.error || !res?.suggestion) return false;
    const suggestion = res.suggestion;
    const { error: saveError } = await supabase
      .from("site_content")
      .upsert({ key, value_en: suggestion, value_en_source: source } as never);
    if (saveError) return false;
    setRows((prev) => ({
      ...prev,
      [key]: {
        key,
        value: prev[key]?.value ?? source,
        value_en: suggestion,
        value_en_source: source,
        updated_at: new Date().toISOString(),
      },
    }));
    setDrafts((prev) => (editLang === "en" ? { ...prev, [key]: suggestion } : prev));
    invalidateSiteContent();
    return true;
  };

  const suggestTranslation = async (key: string) => {
    setSuggestingKey(key);
    const ok = await translateKey(key);
    setSuggestingKey(null);
    if (!ok) return toast.error("Übersetzung fehlgeschlagen.");
    toast.success("Übersetzt und gespeichert.");
  };

  /** Übersetzt in einem Durchgang alles, was fehlt oder veraltet ist. */
  const translateAllPending = async (all = false) => {
    const keys = all ? translatableKeys : pendingKeys;
    if (keys.length === 0) return toast.success("Alle Texte sind bereits übersetzt.");
    setBulkSuggesting(true);
    let ok = 0;
    for (const key of keys) {
      if (await translateKey(key)) ok++;
    }
    setBulkSuggesting(false);
    if (ok === 0) toast.error("Keine Übersetzung erhalten.");
    else toast.success(`${ok} von ${keys.length} Texten übersetzt und gespeichert.`);
  };


  /** Alle Studio-Oberflächen-Schlüssel (statisches Wörterbuch) mit ihrem Deckungsstatus. */
  const i18nEntries = useMemo(() => {
    const q = i18nSearch.trim().toLowerCase();
    return Object.keys(deDict)
      .map((key) => {
        const german = deDict[key as keyof typeof deDict];
        const override = i18nOverrides[key];
        const staticEnglish = enDict[key as keyof typeof enDict];
        const english = override?.value_en ?? staticEnglish ?? "";
        // Fehlt komplett, oder wurde nie wirklich übersetzt (identisch mit Deutsch,
        // bei Texten, die länger als ein einzelnes Wort/Markenname sind).
        const missing = !override && (!staticEnglish || (staticEnglish.trim().toLowerCase() === german.trim().toLowerCase() && german.length > 3));
        return { key, german, english, missing, hasOverride: !!override };
      })
      .filter((e) => !q || e.key.toLowerCase().includes(q) || e.german.toLowerCase().includes(q))
      .sort((a, b) => (a.missing === b.missing ? a.key.localeCompare(b.key) : a.missing ? -1 : 1));
  }, [i18nSearch, i18nOverrides]);
  const i18nMissingCount = useMemo(() => i18nEntries.filter((e) => e.missing).length, [i18nEntries]);

  const i18nSaveOverride = async (key: string, valueEn: string, source: string) => {
    setI18nBusyKey(key);
    const { error } = await supabase.from("i18n_overrides").upsert({ key, value_en: valueEn, value_en_source: source } as never);
    setI18nBusyKey(null);
    if (error) return toast.error(error.message);
    setI18nOverrides((prev) => ({ ...prev, [key]: { key, value_en: valueEn, value_en_source: source, updated_at: new Date().toISOString() } }));
    refreshOverrides();
  };

  const i18nSuggestOne = async (key: string, german: string): Promise<boolean> => {
    const { data, error } = await supabase.functions.invoke("suggest-translation", { body: { key, text: german } });
    const res = data as { suggestion?: string; error?: string } | null;
    if (error || res?.error || !res?.suggestion) return false;
    await i18nSaveOverride(key, res.suggestion, german);
    return true;
  };

  const i18nSuggest = async (key: string, german: string) => {
    setI18nSuggestingKey(key);
    const ok = await i18nSuggestOne(key, german);
    setI18nSuggestingKey(null);
    if (!ok) return toast.error("Übersetzung fehlgeschlagen.");
    toast.success("Übersetzt und gespeichert.");
  };

  const i18nSuggestAllMissing = async () => {
    const missing = i18nEntries.filter((e) => e.missing);
    if (missing.length === 0) return toast.success("Alle Studio-Texte sind bereits übersetzt.");
    setI18nBulkBusy(true);
    let ok = 0;
    for (const e of missing) {
      if (await i18nSuggestOne(e.key, e.german)) ok++;
    }
    setI18nBulkBusy(false);
    if (ok === 0) toast.error("Keine Übersetzung erhalten.");
    else toast.success(`${ok} von ${missing.length} Studio-Texten übersetzt und gespeichert.`);
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
                {editLang === "en" && (
                  <>
                    <span className="text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">
                      {missingCount > 0 ? `${missingCount} offen oder veraltet` : "Alles übersetzt"}
                    </span>
                    <button
                      type="button"
                      onClick={() => void translateAllPending(false)}
                      disabled={bulkSuggesting || missingCount === 0}
                      className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" /> {bulkSuggesting ? "…" : "Offene übersetzen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void translateAllPending(true)}
                      disabled={bulkSuggesting}
                      className="flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-background disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" /> {bulkSuggesting ? "…" : "Alle Texte neu übersetzen"}
                    </button>
                    <TranslationWarmup />
                  </>
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
                    const outdated = editLang === "en" && e.type !== "image" && hasGerman && hasEnglish && isStale(e.key);
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
                        outdated={outdated}
                        canTranslate={editLang === "en" && e.type !== "image" && hasGerman}
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

            <section className="border border-border bg-card p-6">
              <button type="button" onClick={() => setI18nOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
                <span>
                  <p className="editorial-eyebrow">Studio-Oberfläche (Englisch)</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    Knopfbeschriftungen, Menüs und Meldungen im Studio — {i18nMissingCount > 0 ? `${i18nMissingCount} von ${i18nEntries.length} ohne Englisch` : `alle ${i18nEntries.length} übersetzt`}.
                  </p>
                </span>
                <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.22em] text-muted-foreground">{i18nOpen ? "Einklappen" : "Anzeigen"}</span>
              </button>

              {i18nOpen && (
                <div className="mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="relative max-w-md flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={i18nSearch}
                        onChange={(e) => setI18nSearch(e.target.value)}
                        placeholder="Schlüssel oder deutschen Text suchen …"
                        className="w-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void i18nSuggestAllMissing()}
                      disabled={i18nBulkBusy || i18nMissingCount === 0}
                      className="flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-background disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" /> {i18nBulkBusy ? "…" : `Englisch vorschlagen (${i18nMissingCount})`}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {i18nEntries.map((e) => (
                      <div key={e.key} className={cn("border border-border bg-background p-3", e.missing && "border-dashed")}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[0.58rem] uppercase tracking-[0.22em] text-muted-foreground/70">{e.key}</span>
                          {e.missing && <span className="border border-border px-1.5 py-0.5 text-[0.58rem] text-foreground">Fehlt · Rückfall Deutsch</span>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{e.german}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={e.english}
                            onChange={(ev) => setI18nOverrides((prev) => ({ ...prev, [e.key]: { key: e.key, value_en: ev.target.value, value_en_source: e.german, updated_at: prev[e.key]?.updated_at ?? new Date().toISOString() } }))}
                            onBlur={(ev) => void i18nSaveOverride(e.key, ev.target.value, e.german)}
                            className="w-full border border-border bg-white p-2 text-sm"
                            placeholder={e.german}
                          />
                          <button
                            type="button"
                            onClick={() => void i18nSuggest(e.key, e.german)}
                            disabled={i18nSuggestingKey === e.key}
                            className="flex shrink-0 items-center gap-1.5 border border-border px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
                          >
                            <Sparkles className="h-3 w-3" /> {i18nSuggestingKey === e.key ? "…" : "Vorschlagen"}
                          </button>
                        </div>
                        {i18nBusyKey === e.key && <p className="mt-1 text-[0.6rem] text-muted-foreground">Speichert…</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </AdminShell>
    </RoleGate>
  );
}

function FieldRow({ entry, value, updatedAt, busy, uploading, suggesting, editLang, missing, outdated, canTranslate, onChange, onSave, onUpload, onSuggest }: {
  entry: ContentEntry; value: string; updatedAt?: string; busy: boolean; uploading: boolean; suggesting: boolean;
  editLang: Lang; missing: boolean; outdated: boolean; canTranslate: boolean;
  onChange: (v: string) => void; onSave: () => void; onUpload: (f: File) => void; onSuggest: () => void;
}) {
  return (
    <div className={cn("border border-border bg-background p-4", (missing || outdated) && "border-dashed")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">
          {entry.label}
          {missing && <span className="border border-border px-1.5 py-0.5 text-[0.58rem] text-foreground">Fehlt · {editLang.toUpperCase()}</span>}
          {outdated && <span className="border border-border px-1.5 py-0.5 text-[0.58rem] text-foreground">Veraltet · Deutsch geändert</span>}
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
          {canTranslate && (
            <button
              type="button"
              onClick={onSuggest}
              disabled={suggesting}
              className="mt-2 flex items-center gap-1.5 border border-border px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" /> {suggesting ? "…" : missing || outdated ? "Ins Englische übersetzen" : "Neu übersetzen"}
            </button>
          )}
        </>
      )}
      {busy && <p className="mt-1 text-[0.6rem] text-muted-foreground">Speichert…</p>}
    </div>
  );
}
