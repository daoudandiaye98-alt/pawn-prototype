/**
 * E3 — DER BAUER SPRICHT AUS DER DATENBANK.
 *
 * Im Heft läuft der Begleiter seit PR #196 über `begleiter_saetze` und
 * `begleiter_regeln`. Im Studio sprach er bis hierher aus i18n-Schlüsseln im
 * Code — jeder neue Satz war ein Deploy. Dieser Hook ist dieselbe Mechanik für
 * die Fläche `studio`, in React und ohne Import aus `src/heft03/`.
 *
 * Ereignis → Regel → Satz. Höchste `prioritaet` gewinnt. `einmal` ('sitzung' |
 * 'immer') wird gegen `begleiter_gedaechtnis` geprüft und über die RPC
 * `begleiter_merken` fortgeschrieben.
 *
 * DAS EHRLICHKEITSGESETZ: ein Platzhalter, der nicht gefüllt werden kann,
 * überspringt den Satz. Nicht raten, nicht durch „ein Stück" ersetzen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export interface BegleiterZustand {
  /** Werte für die Platzhalter im Satz, z. B. { werk: "Mantel 01" }. */
  werte?: Record<string, string | number | null | undefined>;
  /** Alles, wogegen `bedingung` geprüft wird. */
  [schluessel: string]: unknown;
}

export interface Blase {
  key: string;
  satz_key: string;
  text: string;
  prioritaet: number;
  aktion: Record<string, unknown>;
}

interface Satz {
  key: string;
  varianten: Record<string, string[]> | null;
}

interface Regel {
  key: string;
  ereignis: string;
  bedingung: Record<string, unknown> | null;
  satz_key: string | null;
  aktion: Record<string, unknown> | null;
  prioritaet: number;
  abklingzeit_s: number;
  einmal: string | null;
}

/** Eine Bedingung gegen den Zustand prüfen. Unbekannter Schlüssel = schweigen. */
export function bedingungTrifft(
  bedingung: Record<string, unknown> | null | undefined,
  zustand: BegleiterZustand,
): boolean {
  if (!bedingung || typeof bedingung !== "object") return true;
  for (const [schluessel, soll] of Object.entries(bedingung)) {
    const zahl = (v: unknown) => Number(v ?? 0);
    switch (schluessel) {
      case "besuch":
      case "kontext":
      case "welt":
        if (zustand[schluessel] !== soll) return false;
        break;
      case "konto":
      case "avatar":
      case "linie":
      case "cutout":
      case "bestellung":
      case "merk_sichtbar":
        if (!!zustand[schluessel] !== !!soll) return false;
        break;
      case "min_ms":
        if (!(zahl(zustand.ms) >= Number(soll))) return false;
        break;
      case "merkliste_min":
        if (!(zahl(zustand.merkliste) >= Number(soll))) return false;
        break;
      case "merkliste_eq":
        if (zahl(zustand.merkliste) !== Number(soll)) return false;
        break;
      case "stuecke_lt":
        if (!(zahl(zustand.stuecke) < Number(soll))) return false;
        break;
      case "aufrufe_min":
        if (!(zahl(zustand.aufrufe) >= Number(soll))) return false;
        break;
      case "anfragen_offen_min":
        if (!(zahl(zustand.anfragen_offen) >= Number(soll))) return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

/** Alle Platzhalter eines Textes — `{werk}` → `werk`. */
export function platzhalterIn(text: string): string[] {
  return [...String(text).matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
}

/** Fehlt ein Platzhalter, gibt es keinen Satz. */
export function fuelle(text: string, werte: Record<string, unknown>): string | null {
  const fehlt = platzhalterIn(text).some((p) => {
    const w = werte[p];
    return w === undefined || w === null || String(w).trim() === "";
  });
  if (fehlt) return null;
  return text.replace(/\{([a-z_]+)\}/g, (_, p: string) => String(werte[p]));
}

const SITZUNG_ABLAGE = "pawn.begleiter.sitzung.v1";

function sitzungGesagt(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SITZUNG_ABLAGE) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function sitzungMerke(key: string) {
  try {
    const alt = sitzungGesagt();
    alt[key] = Date.now();
    sessionStorage.setItem(SITZUNG_ABLAGE, JSON.stringify(alt));
  } catch {
    /* voller Speicher stört den Besuch nicht */
  }
}

export function useBegleiter(flaeche: "studio" | "heft" = "studio") {
  const { locale } = useI18n();
  const [saetze, setSaetze] = useState<Satz[]>([]);
  const [regeln, setRegeln] = useState<Regel[]>([]);
  const [blase, setBlase] = useState<Blase | null>(null);
  const gedaechtnis = useRef<{ gesagt: Record<string, string>; abgelehnt: string[] }>({ gesagt: {}, abgelehnt: [] });

  useEffect(() => {
    let lebt = true;
    void (async () => {
      const [s, r, g] = await Promise.all([
        supabase.from("begleiter_saetze").select("key, varianten").eq("flaeche", flaeche).eq("aktiv", true),
        supabase
          .from("begleiter_regeln")
          .select("key, ereignis, bedingung, satz_key, aktion, prioritaet, abklingzeit_s, einmal")
          .eq("flaeche", flaeche)
          .eq("aktiv", true),
        supabase.from("begleiter_gedaechtnis").select("gesagt, abgelehnt").maybeSingle(),
      ]);
      if (!lebt) return;
      setSaetze((s.data ?? []) as unknown as Satz[]);
      setRegeln((r.data ?? []) as unknown as Regel[]);
      const gd = g.data as { gesagt?: Record<string, string>; abgelehnt?: string[] } | null;
      gedaechtnis.current = { gesagt: gd?.gesagt ?? {}, abgelehnt: gd?.abgelehnt ?? [] };
    })();
    return () => {
      lebt = false;
    };
  }, [flaeche]);

  const satzNach = useMemo(() => new Map(saetze.map((s) => [s.key, s])), [saetze]);
  const sortiert = useMemo(
    () => [...regeln].sort((a, b) => (b.prioritaet ?? 0) - (a.prioritaet ?? 0)),
    [regeln],
  );

  /** Ein Ereignis melden. Gibt die Blase zurück oder null (der Normalfall). */
  const melde = useCallback(
    (ereignis: string, zustand: BegleiterZustand = {}): Blase | null => {
      const jetzt = Date.now();
      const inSitzung = sitzungGesagt();
      for (const regel of sortiert) {
        if (regel.ereignis !== ereignis) continue;
        if (!regel.satz_key) continue;
        if (!bedingungTrifft(regel.bedingung, zustand)) continue;
        if (gedaechtnis.current.abgelehnt.includes(regel.satz_key)) continue;
        if (regel.einmal === "sitzung" && inSitzung[regel.key]) continue;
        const zuletzt = gedaechtnis.current.gesagt[regel.satz_key];
        const zuletztMs = zuletzt ? Date.parse(zuletzt) : 0;
        if (regel.einmal === "immer" && zuletztMs > 0) continue;
        const abkling = Number(regel.abklingzeit_s ?? 0) * 1000;
        if (abkling > 0 && jetzt - zuletztMs < abkling) continue;

        const satz = satzNach.get(regel.satz_key);
        const liste = satz?.varianten?.[locale] ?? satz?.varianten?.de ?? [];
        if (!liste.length) continue;
        const roh = liste[Math.floor(Math.random() * liste.length)];
        const text = fuelle(roh, (zustand.werte ?? {}) as Record<string, unknown>);
        if (text === null) continue; // Ehrlichkeitsgesetz

        sitzungMerke(regel.key);
        gedaechtnis.current.gesagt[regel.satz_key] = new Date(jetzt).toISOString();
        void supabase.rpc("begleiter_merken", { _satz_key: regel.satz_key });

        const neue: Blase = {
          key: regel.key,
          satz_key: regel.satz_key,
          text,
          prioritaet: regel.prioritaet ?? 0,
          aktion: regel.aktion ?? { art: "sagen" },
        };
        setBlase(neue);
        return neue;
      }
      return null;
    },
    [sortiert, satzNach, locale],
  );

  /** Das × — dieser Satz nie wieder. */
  const ablehnen = useCallback((satz_key: string) => {
    gedaechtnis.current.abgelehnt = [...gedaechtnis.current.abgelehnt, satz_key];
    setBlase(null);
    void supabase.rpc("begleiter_merken", { _satz_key: satz_key, _antwort: "abgelehnt" });
  }, []);

  const schliessen = useCallback(() => setBlase(null), []);

  return { blase, melde, ablehnen, schliessen, bereit: regeln.length > 0 };
}
