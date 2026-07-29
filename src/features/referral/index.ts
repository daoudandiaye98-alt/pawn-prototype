/**
 * Teil 17d: Der Reichweiten-Hebel — ein Referral-Code ist einfach der Slug des werbenden
 * Hauses (kein neues Feld nötig). Ein Besuch mit ?ref=<slug> merkt sich den Code für 30 Tage;
 * schließt der Nutzer danach seine erste Bestellung ab, bucht grant_referral_credit die
 * Gutschrift — serverseitig geprüft, nie dem Client vertraut.
 */
const KEY = "pawn:ref-code";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredRef { code: string; at: number }

export function captureReferralCode(code: string | null): void {
  if (typeof window === "undefined" || !code) return;
  const trimmed = code.trim();
  if (!trimmed) return;
  window.localStorage.setItem(KEY, JSON.stringify({ code: trimmed, at: Date.now() } as StoredRef));
}

export function readReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as StoredRef;
    if (Date.now() - stored.at > TTL_MS) { window.localStorage.removeItem(KEY); return null; }
    return stored.code;
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
