// Lightweight i18n. Static dictionaries + Context + t().
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { seedMemory, startAutoTranslate, stopAutoTranslate } from "@/lib/autoTranslate";
import { supabase } from "@/integrations/supabase/client";


export type Locale = "de" | "en";
const KEY = "pawn.locale";

// Teil 22a: beim allerersten Besuch die Browsersprache lesen — nie IP/Standort,
// Sprache folgt dem Menschen. Beginnt sie mit "de" → Deutsch, sonst Englisch.
// Das Ergebnis wird sofort gespeichert und überschreibt die Erkennung dauerhaft:
// jeder spätere Aufruf liest nur noch localStorage, erkennt nie neu.
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "de";
  const primary = navigator.languages?.[0] ?? navigator.language ?? "";
  return primary.toLowerCase().startsWith("de") ? "de" : "en";
}

// Die Woerterbuecher selbst stehen in ./woerterbuch.ts und kommen erst, wenn jemand sie
// braucht: jede Seite ausserhalb des Hefts (App.tsx laedt deren Rahmen zusammen mit
// ladeWoerterbuch), die englische Fassung und die Registrierung im Heft. Das Heft zeichnet
// kein t(); fest eingebunden lud jeder Heft-Besuch rund 300 kB Text, den er nie sah.
type Woerterbuch = typeof import("./woerterbuch");
type Dict = Woerterbuch["de"];
let buch: Woerterbuch | null = null;
let laden: Promise<Woerterbuch> | null = null;
const wartende = new Set<() => void>();
export function ladeWoerterbuch(): Promise<Woerterbuch> {
  laden ??= import("./woerterbuch").then(
    (m) => { buch = m; wartende.forEach((da) => da()); return m; },
    (e) => { laden = null; throw e; },
  );
  return laden;
}

// Teil 25: das Wörterbuch wächst schnell über viele gleichzeitig bearbeitete Seiten —
// String statt striktem keyof, damit neue Schlüssel nicht erst kompilieren müssen, bevor
// sie irgendwo verwendet werden dürfen. Fehlt ein Schlüssel zur Laufzeit, fällt t() auf
// Deutsch und zuletzt auf den Schlüssel selbst zurück (siehe unten).
type Key = string;

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
  refreshOverrides: () => void;
}
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "de";
    const stored = localStorage.getItem(KEY) as Locale | null;
    return stored === "de" || stored === "en" ? stored : detectBrowserLocale();
  });
  // Teil 25, Punkt 5: manuell nachgetragene/verbesserte englische Fassungen aus
  // i18n_overrides — die einzige Möglichkeit, eine fehlende Übersetzung ohne
  // Code-Änderung zu pflegen (das Wörterbuch in woerterbuch.ts ist statischer Code).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const loadOverrides = () => {
    void supabase.from("i18n_overrides").select("key, value_en").then(({ data }) => {
      const map: Record<string, string> = {};
      for (const r of (data ?? []) as { key: string; value_en: string }[]) map[r.key] = r.value_en;
      setOverrides(map);
    });
  };
  useEffect(() => { loadOverrides(); }, []);

  // Das Woerterbuch kommt nachtraeglich. Wer vorher schon gezeichnet hat, zeichnet danach
  // noch einmal, diesmal mit Text: der neue Wert unten erreicht jeden, der useI18n liest.
  const [geladen, setGeladen] = useState(() => buch !== null);
  useEffect(() => {
    if (buch) { setGeladen(true); return; }
    const da = () => setGeladen(true);
    wartende.add(da);
    return () => { wartende.delete(da); };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, locale); } catch { /* noop */ }
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  // Teil 22b: Alles, was nicht im Wörterbuch steht, wird automatisch übersetzt —
  // egal auf welcher Seite und auch bei Texten, die später geändert werden.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (locale !== "en") { stopAutoTranslate(); return; }
    let aktiv = true;
    ladeWoerterbuch().then(({ de, en }) => {
      if (!aktiv) return;
      seedMemory((Object.keys(de) as (keyof Dict)[]).map((k) => [de[k], en[k]] as [string, string]));
      startAutoTranslate();
    }, () => { /* ohne Woerterbuch keine Vorlage: dann bleibt es beim Deutsch */ });
    return () => { aktiv = false; stopAutoTranslate(); };
  }, [locale]);

  const value = useMemo<I18nCtx>(() => ({
    locale,
    setLocale: setLocaleState,
    refreshOverrides: loadOverrides,
    t: (k, vars) => {
      // `buch` wird beim Aufruf gelesen, nicht beim Zeichnen: wer auf ladeWoerterbuch()
      // wartet und dann ein t() von vorher ruft, bekommt schon den Text.
      const active = (buch?.[locale] ?? {}) as Record<string, string>;
      const base = (buch?.de ?? {}) as Record<string, string>;
      let s = (locale === "en" ? overrides[k] : undefined) ?? active[k] ?? base[k] ?? k;
      if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replace(`{${vk}}`, String(vv));
      return s;
    },
  }), [locale, overrides, geladen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
