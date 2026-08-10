/**
 * Teil 37/AP2 — "Erster Zug": ein Akquise-Lead, der über den Wizard-Link (/start?lead=<id>)
 * kommt, wird für 30 Tage erinnert, damit die spätere Bewerbung ihn attribuieren kann.
 * Eigener Schlüssel/Parametername (lead statt ref), um mit dem Referral-Code (Teil 17d,
 * ?ref=<designer-slug>) nicht zu kollidieren — beides kann gleichzeitig gesetzt sein.
 */
const KEY = "pawn:lead-ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredLead { id: string; at: number }

export function captureLeadRef(id: string | null): void {
  if (typeof window === "undefined" || !id) return;
  const trimmed = id.trim();
  if (!trimmed) return;
  window.localStorage.setItem(KEY, JSON.stringify({ id: trimmed, at: Date.now() } as StoredLead));
}

export function readLeadRef(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredLead;
    if (Date.now() - stored.at > TTL_MS) { window.localStorage.removeItem(KEY); return null; }
    return stored.id;
  } catch {
    return null;
  }
}

export function clearLeadRef(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * WP1/WP2 "Die ersten Fünfzig": der kurze, öffentlich sichtbare ref_code aus der
 * Einladungsseite (/einladung/{ref_code}). Eigener Schlüssel, unabhängig vom obigen
 * (raw-UUID-basierten) Lead-Ref UND vom Referral-Code (?ref=<designer-slug>, Teil 17d) —
 * drei getrennte Mechanismen, keiner überschreibt einen anderen.
 */
const REF_CODE_KEY = "pawn:akquise-ref-code";

interface StoredRefCode { code: string; at: number }

export function captureRefCode(code: string | null): void {
  if (typeof window === "undefined" || !code) return;
  const trimmed = code.trim();
  if (!trimmed) return;
  window.localStorage.setItem(REF_CODE_KEY, JSON.stringify({ code: trimmed, at: Date.now() } as StoredRefCode));
}

export function readRefCode(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(REF_CODE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredRefCode;
    if (Date.now() - stored.at > TTL_MS) { window.localStorage.removeItem(REF_CODE_KEY); return null; }
    return stored.code;
  } catch {
    return null;
  }
}

export function clearRefCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REF_CODE_KEY);
}
