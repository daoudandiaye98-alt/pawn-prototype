// Lightweight i18n. Static dictionaries + Context + t().
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "de" | "en";
const KEY = "pawn.locale";

const de = {
  // Navigation
  "nav.mode": "Mode",
  "nav.interior": "Interior",
  "nav.kunst": "Kunst",
  "nav.designer": "Designer",
  "nav.style": "Style",
  "nav.dna": "Deine DNA",
  "nav.frag": "Frag PAWN",
  "nav.login": "Anmelden",
  "nav.account": "Mein Konto",
  "nav.logout": "Abmelden",
  "nav.forDesigners": "Für Designer",
  "nav.myStudio": "Mein Studio",
  "nav.applicationStatus": "Bewerbungsstatus",
  "nav.adminCockpit": "Admin-Cockpit",
  "nav.language": "Sprache wechseln",
  "hero.eyebrow": "Kuratierte Ausstellung",
  "hero.promptPlaceholder": 'Frag PAWN — z.B. „zeig mir skulpturale Mäntel" oder „bring mich zur Kollektion von …"',
  "hero.promptSend": "Fragen",

  // Auth
  "auth.entry": "Zutritt",
  "auth.welcomeBack": "Willkommen zurück.",
  "auth.welcomeBackSub": "Deine Ausstellung, wie du sie verlassen hast.",
  "auth.joinTitle": "Trage dich ein.",
  "auth.signIn": "Anmelden",
  "auth.signUp": "Konto anlegen",
  "auth.registerAs": "Registrieren als",
  "auth.asCustomer": "Kunde",
  "auth.asDesigner": "Designer",
  "auth.designerHint": "Designer bewerben sich über /apply — dort erfährst du unser Angebot.",
  "auth.name": "Name",
  "auth.email": "E-Mail",
  "auth.password": "Passwort",
  "auth.or": "oder",
  "auth.continueGoogle": "Mit Google fortfahren",
  "auth.backToExhibition": "Zurück zur Ausstellung",
  "auth.checkEmail": "Prüfe deine E-Mail zur Bestätigung.",

  // Common actions
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.delete": "Löschen",
  "common.confirm": "Bestätigen",
  "common.change": "Ändern",
  "common.loading": "Lädt…",
  "common.saving": "Speichert…",
  "common.download": "Herunterladen",
  "common.back": "Zurück",

  // Cart & checkout
  "cart.bag": "Deine Tasche",
  "cart.bagHeading": "Tasche",
  "cart.emptyTitle": "Deine Tasche ist noch leer.",
  "cart.emptyBody": "Sieh dich in der Ausstellung um.",
  "cart.enter": "Zur Ausstellung",
  "cart.size": "Größe",
  "cart.less": "Weniger",
  "cart.more": "Mehr",
  "cart.remove": "Entfernen",
  "cart.outOfStock": "Vergriffen",
  "cart.inStock": "Noch {n} auf Lager",
  "cart.subtotal": "Zwischensumme",
  "cart.shipping": "Versand",
  "cart.total": "Gesamt",
  "cart.checkoutExpress": "Zur Kasse — Express",
  "cart.securePayment": "Sichere Bezahlung · verschlüsselt",
  "checkout.setupPending": "Zahlung wird gerade eingerichtet.",

  // Account
  "account.overview": "Übersicht",
  "account.orders": "Bestellungen",
  "account.requests": "Anfragen",
  "account.wishlist": "Merkzettel",
  "account.settings": "Einstellungen",
  "account.mydata": "Meine Daten",
  "account.signOut": "Abmelden",

  // Settings
  "settings.access": "Zugang",
  "settings.accessSubtitle": "Anmeldemethode, E-Mail und Passwort.",
  "settings.signInMethod": "Anmeldemethode",
  "settings.emailAddress": "E-Mail-Adresse",
  "settings.changePassword": "Passwort ändern",
  "settings.session": "Sitzung",
  "settings.payment": "Zahlung",
  "settings.privacy": "Datenschutz",
  "settings.privacySubtitle": "Was PAWN weiß — und was nicht.",
  "settings.personalization": "Personalisierung",
  "settings.dataExport": "Datenauskunft",
  "settings.deleteAccount": "Konto löschen",
  "settings.notifications": "Benachrichtigungen",
  "settings.language": "Sprache",
  "settings.languageOfInterface": "Sprache der Oberfläche",

  "footer.rights": "Alle Rechte vorbehalten.",
  "chat.consent": "Deine Antworten nutzen wir, um dir passende Stücke zu zeigen.",
  "chat.placeholder": "Schreib PAWN etwas…",
  "chat.send": "Senden",
  "chat.thinking": "Pawn denkt nach…",
  "chat.navigating": "Ich bringe dich hin…",
  "lang.toggle": "DE / EN",
};

const en: Record<keyof typeof de, string> = {
  "nav.mode": "Fashion",
  "nav.interior": "Interior",
  "nav.kunst": "Art",
  "nav.designer": "Designers",
  "nav.style": "Style",
  "nav.dna": "Your DNA",
  "nav.frag": "Ask PAWN",
  "nav.login": "Sign in",
  "nav.account": "My account",
  "nav.logout": "Sign out",
  "nav.forDesigners": "For designers",
  "nav.myStudio": "My studio",
  "nav.applicationStatus": "Application status",
  "nav.adminCockpit": "Admin cockpit",
  "nav.language": "Switch language",
  "hero.eyebrow": "Curated exhibition",
  "hero.promptPlaceholder": "Ask PAWN — \"show me sculptural coats\" or \"take me to the collection of …\"",
  "hero.promptSend": "Ask",

  "auth.entry": "Entry",
  "auth.welcomeBack": "Welcome back.",
  "auth.welcomeBackSub": "Your exhibition, just as you left it.",
  "auth.joinTitle": "Join us.",
  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.registerAs": "Register as",
  "auth.asCustomer": "Customer",
  "auth.asDesigner": "Designer",
  "auth.designerHint": "Designers apply via /apply — you'll find our offer there.",
  "auth.name": "Name",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.or": "or",
  "auth.continueGoogle": "Continue with Google",
  "auth.backToExhibition": "Back to the exhibition",
  "auth.checkEmail": "Check your email to confirm.",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.confirm": "Confirm",
  "common.change": "Change",
  "common.loading": "Loading…",
  "common.saving": "Saving…",
  "common.download": "Download",
  "common.back": "Back",

  "cart.bag": "Your bag",
  "cart.bagHeading": "Bag",
  "cart.emptyTitle": "Your bag is still empty.",
  "cart.emptyBody": "Take a look around the exhibition.",
  "cart.enter": "Enter the exhibition",
  "cart.size": "Size",
  "cart.less": "Less",
  "cart.more": "More",
  "cart.remove": "Remove",
  "cart.outOfStock": "Out of stock",
  "cart.inStock": "{n} left in stock",
  "cart.subtotal": "Subtotal",
  "cart.shipping": "Shipping",
  "cart.total": "Total",
  "cart.checkoutExpress": "Checkout — Express",
  "cart.securePayment": "Secure payment · encrypted",
  "checkout.setupPending": "Payment is being set up.",

  "account.overview": "Overview",
  "account.orders": "Orders",
  "account.requests": "Requests",
  "account.wishlist": "Wishlist",
  "account.settings": "Settings",
  "account.mydata": "My data",
  "account.signOut": "Sign out",

  "settings.access": "Access",
  "settings.accessSubtitle": "Sign-in method, email and password.",
  "settings.signInMethod": "Sign-in method",
  "settings.emailAddress": "Email address",
  "settings.changePassword": "Change password",
  "settings.session": "Session",
  "settings.payment": "Payment",
  "settings.privacy": "Privacy",
  "settings.privacySubtitle": "What PAWN knows — and what it doesn't.",
  "settings.personalization": "Personalization",
  "settings.dataExport": "Data export",
  "settings.deleteAccount": "Delete account",
  "settings.notifications": "Notifications",
  "settings.language": "Language",
  "settings.languageOfInterface": "Interface language",

  "footer.rights": "All rights reserved.",
  "chat.consent": "We use your answers to show you pieces that fit.",
  "chat.placeholder": "Write PAWN something…",
  "chat.send": "Send",
  "chat.thinking": "PAWN is thinking…",
  "chat.navigating": "Taking you there…",
  "lang.toggle": "DE / EN",
};

type Dict = typeof de;
type Key = keyof Dict;
const dicts: Record<Locale, Dict> = { de, en };

interface I18nCtx { locale: Locale; setLocale: (l: Locale) => void; t: (k: Key, vars?: Record<string, string | number>) => string }
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
    t: (k, vars) => {
      let s = dicts[locale][k] ?? dicts.de[k] ?? String(k);
      if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replace(`{${vk}}`, String(vv));
      return s;
    },
  }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
