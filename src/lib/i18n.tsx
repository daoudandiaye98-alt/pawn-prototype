// Lightweight i18n. Static dictionaries + Context + t().
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "de" | "en";
const KEY = "pawn.locale";

const de = {
  "nav.mode": "Mode",
  "nav.interior": "Interior",
  "nav.kunst": "Kunst",
  "nav.designer": "Designer",
  "nav.frag": "Frag PAWN",
  "nav.login": "Anmelden",
  "nav.account": "Mein Konto",
  "nav.logout": "Abmelden",
  "nav.forDesigners": "Für Designer",
  "hero.eyebrow": "Kuratierte Ausstellung",
  "hero.promptPlaceholder": 'Frag PAWN — z.B. „zeig mir skulpturale Mäntel" oder „bring mich zur Kollektion von …"',
  "hero.promptSend": "Fragen",
  "auth.signIn": "Anmelden",
  "auth.signUp": "Konto anlegen",
  "auth.registerAs": "Registrieren als",
  "auth.asCustomer": "Kunde",
  "auth.asDesigner": "Designer",
  "auth.designerHint": "Designer bewerben sich über /apply.",
  "footer.rights": "Alle Rechte vorbehalten.",
  "chat.consent": "Deine Antworten nutzen wir, um dir passende Stücke zu zeigen.",
  "chat.placeholder": "Schreib PAWN etwas…",
  "chat.send": "Senden",
  "chat.thinking": "Pawn denkt nach…",
  "chat.navigating": "Ich bringe dich hin…",
  "cart.empty": "Ein leerer Auftritt.",
  "cart.enter": "Zur Boutique",
  "checkout.setupPending": "Zahlung wird gerade eingerichtet.",
  "account.mydata": "Meine Daten",
  "lang.toggle": "DE / EN",
};

const en: Record<keyof typeof de, string> = {
  "nav.mode": "Fashion",
  "nav.interior": "Interior",
  "nav.kunst": "Art",
  "nav.designer": "Designers",
  "nav.frag": "Ask PAWN",
  "nav.login": "Sign in",
  "nav.account": "My account",
  "nav.logout": "Sign out",
  "nav.forDesigners": "For designers",
  "hero.eyebrow": "Curated exhibition",
  "hero.promptPlaceholder": "Ask PAWN — \"show me sculptural coats\" or \"take me to the collection of …\"",
  "hero.promptSend": "Ask",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.registerAs": "Register as",
  "auth.asCustomer": "Customer",
  "auth.asDesigner": "Designer",
  "auth.designerHint": "Designers apply via /apply.",
  "footer.rights": "All rights reserved.",
  "chat.consent": "We use your answers to show you pieces that fit.",
  "chat.placeholder": "Write PAWN something…",
  "chat.send": "Send",
  "chat.thinking": "PAWN is thinking…",
  "chat.navigating": "Taking you there…",
  "cart.empty": "An empty stage.",
  "cart.enter": "Enter the boutique",
  "checkout.setupPending": "Payment is being set up.",
  "account.mydata": "My data",
  "lang.toggle": "DE / EN",
};

type Dict = typeof de;
type Key = keyof Dict;
const dicts: Record<Locale, Dict> = { de, en };

interface I18nCtx { locale: Locale; setLocale: (l: Locale) => void; t: (k: Key) => string }
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "de";
    return ((localStorage.getItem(KEY) as Locale) ?? "de");
  });
  useEffect(() => { try { localStorage.setItem(KEY, locale); } catch { /* noop */ } }, [locale]);
  const value = useMemo<I18nCtx>(() => ({
    locale,
    setLocale: setLocaleState,
    t: (k) => dicts[locale][k] ?? dicts.de[k] ?? String(k),
  }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
