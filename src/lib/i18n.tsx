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

  // Studio-Shell (Teil 25)
  "studioShell.studioFallback": "Studio",
  "studioShell.group.sell": "Verkaufen",
  "studioShell.group.show": "Zeigen",
  "studioShell.group.brand": "Marke",
  "studioShell.group.account": "Konto",
  "studioShell.nav.start": "Start",
  "studioShell.nav.start.hint": "Dein nächster Schritt",
  "studioShell.nav.aufbau": "Deine Marke aufbauen",
  "studioShell.nav.aufbau.hint": "Schritt für Schritt zum ersten Verkauf",
  "studioShell.nav.produkte": "Kollektion",
  "studioShell.nav.produkte.hint": "Deine Stücke anlegen und pflegen",
  "studioShell.nav.bestellungen": "Bestellungen",
  "studioShell.nav.bestellungen.hint": "Was verkauft wurde",
  "studioShell.nav.versand": "Versand",
  "studioShell.nav.versand.hint": "Pakete vorbereiten und verschicken",
  "studioShell.nav.hausseite": "Deine Markenseite",
  "studioShell.nav.hausseite.hint": "Deine eigene Seite auf PAWN",
  "studioShell.nav.mediathek": "Bilder",
  "studioShell.nav.mediathek.hint": "Fotos hochladen und freistellen",
  "studioShell.nav.kampagnen": "Videos erstellen",
  "studioShell.nav.kampagnen.hint": "Aus Fotos wird ein Clip",
  "studioShell.nav.videothek": "Fertige Videos",
  "studioShell.nav.videothek.hint": "Herunterladen und posten",
  "studioShell.nav.dna": "Markenprofil",
  "studioShell.nav.dna.hint": "Wie PAWN deine Handschrift sieht",
  "studioShell.nav.brand": "Rückblick",
  "studioShell.nav.brand.hint": "Was in letzter Zeit passiert ist",
  "studioShell.nav.contentBegleiter": "Ideen-Begleiter",
  "studioShell.nav.contentBegleiter.hint": "Vorschläge, was du zeigen kannst",
  "studioShell.nav.plan": "Plan",
  "studioShell.nav.plan.hint": "Was diesen Monat noch frei ist",
  "studioShell.nav.auszahlung": "Auszahlung",
  "studioShell.nav.auszahlung.hint": "Wohin dein Geld fließt",
  "studioShell.nav.nachrichten": "Nachrichten",
  "studioShell.nav.nachrichten.hint": "Anfragen von Kundinnen und PAWN",
  "studioShell.nav.empfehlungen": "Empfehlungen",
  "studioShell.nav.empfehlungen.hint": "Andere Häuser einladen",
  "studioShell.nav.einstellungen": "Einstellungen",
  "studioShell.nav.einstellungen.hint": "Konto und Angaben",
  "studioShell.yourStudio": "Dein Studio",
  "studioShell.toExhibition": "Zur Ausstellung →",
  "studioShell.yourMonth": "Dein Monat",
  "studioShell.videos": "Videos",
  "studioShell.studio": "Studio",
  "studioShell.viewMyRetro": "Meine Rückblick ansehen",
  "studioShell.notifications": "Benachrichtigungen",
  "studioShell.strongerModelActive": "Stärkeres Denkmodell aktiv",
  "studioShell.signOut": "Abmelden",
  "studioShell.menu": "Menü",
  "studioShell.highestRank": "Höchster Rang",
  "studioShell.nextRank": "Nächster Rang · {rank}",
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

  "studioShell.studioFallback": "Studio",
  "studioShell.group.sell": "Sell",
  "studioShell.group.show": "Show",
  "studioShell.group.brand": "Brand",
  "studioShell.group.account": "Account",
  "studioShell.nav.start": "Start",
  "studioShell.nav.start.hint": "Your next step",
  "studioShell.nav.aufbau": "Build your brand",
  "studioShell.nav.aufbau.hint": "Step by step to your first sale",
  "studioShell.nav.produkte": "Collection",
  "studioShell.nav.produkte.hint": "Create and manage your pieces",
  "studioShell.nav.bestellungen": "Orders",
  "studioShell.nav.bestellungen.hint": "What has sold",
  "studioShell.nav.versand": "Shipping",
  "studioShell.nav.versand.hint": "Prepare and send parcels",
  "studioShell.nav.hausseite": "Your brand page",
  "studioShell.nav.hausseite.hint": "Your own page on PAWN",
  "studioShell.nav.mediathek": "Images",
  "studioShell.nav.mediathek.hint": "Upload and cut out photos",
  "studioShell.nav.kampagnen": "Create videos",
  "studioShell.nav.kampagnen.hint": "Turn photos into a clip",
  "studioShell.nav.videothek": "Finished videos",
  "studioShell.nav.videothek.hint": "Download and post",
  "studioShell.nav.dna": "Brand profile",
  "studioShell.nav.dna.hint": "How PAWN sees your signature",
  "studioShell.nav.brand": "Retrospective",
  "studioShell.nav.brand.hint": "What's happened recently",
  "studioShell.nav.contentBegleiter": "Idea companion",
  "studioShell.nav.contentBegleiter.hint": "Suggestions for what to show",
  "studioShell.nav.plan": "Plan",
  "studioShell.nav.plan.hint": "What's left this month",
  "studioShell.nav.auszahlung": "Payout",
  "studioShell.nav.auszahlung.hint": "Where your money goes",
  "studioShell.nav.nachrichten": "Messages",
  "studioShell.nav.nachrichten.hint": "Requests from customers and PAWN",
  "studioShell.nav.empfehlungen": "Referrals",
  "studioShell.nav.empfehlungen.hint": "Invite other houses",
  "studioShell.nav.einstellungen": "Settings",
  "studioShell.nav.einstellungen.hint": "Account and details",
  "studioShell.yourStudio": "Your studio",
  "studioShell.toExhibition": "To the exhibition →",
  "studioShell.yourMonth": "Your month",
  "studioShell.videos": "Videos",
  "studioShell.studio": "Studio",
  "studioShell.viewMyRetro": "View my retrospective",
  "studioShell.notifications": "Notifications",
  "studioShell.strongerModelActive": "Stronger reasoning model active",
  "studioShell.signOut": "Sign out",
  "studioShell.menu": "Menu",
  "studioShell.highestRank": "Highest rank",
  "studioShell.nextRank": "Next rank · {rank}",
};

type Dict = typeof de;
// Teil 25: das Wörterbuch wächst schnell über viele gleichzeitig bearbeitete Seiten —
// String statt striktem keyof, damit neue Schlüssel nicht erst kompilieren müssen, bevor
// sie irgendwo verwendet werden dürfen. Fehlt ein Schlüssel zur Laufzeit, fällt t() auf
// Deutsch und zuletzt auf den Schlüssel selbst zurück (siehe unten).
type Key = string;
const dicts: Record<Locale, Dict> = { de, en };
// Für die Übersicht "fehlende Übersetzungen" unter /admin/texte-bilder — dort werden
// die statischen Wörterbücher direkt gegeneinander geprüft, ohne t() aufzurufen.
export { de as deDict, en as enDict };

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
  // Code-Änderung zu pflegen (das Wörterbuch oben ist statischer Code).
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const loadOverrides = () => {
    void supabase.from("i18n_overrides").select("key, value_en").then(({ data }) => {
      const map: Record<string, string> = {};
      for (const r of (data ?? []) as { key: string; value_en: string }[]) map[r.key] = r.value_en;
      setOverrides(map);
    });
  };
  useEffect(() => { loadOverrides(); }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, locale); } catch { /* noop */ }
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  // Teil 22b: Alles, was nicht im Wörterbuch steht, wird automatisch übersetzt —
  // egal auf welcher Seite und auch bei Texten, die später geändert werden.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (locale !== "en") { stopAutoTranslate(); return; }
    seedMemory((Object.keys(de) as (keyof Dict)[]).map((k) => [de[k], en[k]] as [string, string]));
    startAutoTranslate();
    return () => stopAutoTranslate();
  }, [locale]);

  const value = useMemo<I18nCtx>(() => ({
    locale,
    setLocale: setLocaleState,
    refreshOverrides: loadOverrides,
    t: (k, vars) => {
      const active = dicts[locale] as Record<string, string>;
      const base = dicts.de as Record<string, string>;
      let s = (locale === "en" ? overrides[k] : undefined) ?? active[k] ?? base[k] ?? k;
      if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replace(`{${vk}}`, String(vv));
      return s;
    },
  }), [locale, overrides]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used inside I18nProvider");
  return c;
}
