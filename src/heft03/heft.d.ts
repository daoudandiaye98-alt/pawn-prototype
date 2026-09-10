/**
 * Die Typen des Hefts — für die React-Hülle, nicht für das Heft selbst.
 *
 * Die Module unter `src/heft03/` sind reines JavaScript und bleiben es: sie ziehen
 * unverändert aus dem Prototyp um, damit ein Abgleich mit ihm eine Sache von `diff`
 * bleibt. Getippt werden sie deshalb hier, von außen, nach den Kopfkommentaren der
 * Module (`app.js`, `quelle.mjs`, `routen.mjs`) und `docs/heft03/INTEGRATION.md`.
 *
 * Ambient-Deklarationen auf den Alias-Pfad (`@/heft03/…`), nicht auf den relativen:
 * ein nicht-relativer Bezeichner wird von TypeScript wörtlich zugeordnet und greift
 * damit auch beim dynamischen `import()` in `HeftRoute03.tsx`. `tsconfig.app.json`
 * bleibt unverändert — kein `allowJs`, die `.mjs` werden nicht mitgeprüft.
 *
 * Diese Datei beschreibt, sie erzwingt nichts. Wer ein Modul ändert, ändert sie mit;
 * die Wahrheit steht im Modul.
 */

/** Wo im Heft jemand steht. Intern denkt das Heft in Routen, nicht in Pfaden. */
interface HeftRoute {
  section: string;
  index: number;
  /** nur bei `section: 'haus'` */
  slug?: string;
  /** ein geöffnetes Werk (Produkt-Id) — trägt die Adresse `/werk/<slug>` */
  werk?: string;
  /** die Tasche ist offen */
  tasche?: boolean;
  q?: string;
  world?: string;
  house?: string;
  max?: string;
  available?: string;
  sort?: string;
}

/** Ein Werk im Heft-Modell (aus `adapters.mjs › productFromRow`). */
interface HeftProdukt {
  id: string;
  slug: string;
  name: string;
  house: string;
  world: "mode" | "interior" | "kunst";
  price: number | null;
  image: string;
  /** freigestellte Fassung; nur damit steht das Werk auf der Bühne */
  cutout: string | null;
  material: string;
  description: string;
  note: string;
  sizes: string[];
  stockBySize: Record<string, number>;
  inventory_mode: string;
  stock_quantity: number | null;
  kind: "produkt" | "auftragsarbeit" | "live_portrait" | "massanfertigung";
  lead: string;
  measurements: { rows: string[]; values: Record<string, Record<string, string>> };
  dna: Record<string, unknown>;
  stage: { h: number; lift?: number };
  details: [string, string][];
  verkaufsbereit: boolean;
}

/** Ein Haus im Heft-Modell (aus `adapters.mjs › houseFromRow`). */
interface HeftHaus {
  /** echte designer_id — nur für Signale, nie angezeigt */
  id?: string;
  slug: string;
  name: string;
  number: string;
  world: "mode" | "interior" | "kunst";
  location: string;
  title: string;
  intro: string;
  manifesto: string;
  quote: string;
  image: string;
  portrait: string;
  work: string;
  products: string[];
  blocks: { kind: string; content: Record<string, unknown> }[];
  color: string;
  published: boolean;
  verkaufsbereit: boolean;
}

/** Was `quelle.heft()` zurückgibt — das ganze Heft in einem Griff. */
interface HeftDaten {
  products: Record<string, HeftProdukt>;
  houses: Record<string, HeftHaus>;
  media: Record<string, { url: string; kind: string; thumb: string | null }>;
  kuration: { slugs: string[]; title: string } | null;
  demo?: boolean;
}

/** Antwort von `pawn-chat`, schon auf das Heft übersetzt. */
interface HeftChatAntwort {
  reply: string;
  /** Slugs der Werke, die die Antwort nennt */
  treffer: string[];
  action: { type: string; path: string; label: string } | null;
  session_id: string | null;
  rate_limited?: boolean;
  image_terms?: string[];
  fehler?: string;
}

/** Der Port nach außen. Jede Methode gibt ein Promise zurück. */
interface HeftQuelle {
  art: "demo" | "supabase";
  bild(url: string): string;
  heft(): Promise<HeftDaten>;
  chat(a: {
    messages?: { role: string; content: string }[];
    bilder?: string[];
    kontext?: Record<string, unknown>;
    session_id?: string;
  }): Promise<HeftChatAntwort | null>;
  kasse(a: {
    cart: { id: string; size?: string; qty: number }[];
    products: Record<string, HeftProdukt>;
    email?: string;
    locale?: string;
  }): Promise<{ url?: string; id?: string; fehler?: string; fehlt?: string[]; text?: string }>;
  anfrage(a: { product: HeftProdukt; text: string; kontakt?: string }): Promise<{
    ok?: boolean; thread_id?: string; anmelden?: boolean; fehler?: string; vorschau?: boolean;
  }>;
  bewerbung(werte: Record<string, unknown>): Promise<{
    ok: boolean; application_id?: string; needs_email_confirmation?: boolean; fehler?: string; vorschau?: boolean;
  }>;
  stil: {
    laden(): Promise<{ stil: Record<string, string>; foto?: Record<string, unknown>; fuerWen?: string } | null>;
    speichern(stil: Record<string, string>, foto: Record<string, unknown>, fuerWen: string): Promise<{ ok: boolean }>;
  };
  masse: {
    laden(): Promise<Record<string, unknown> | null>;
    speichern(zeile: Record<string, unknown>): Promise<{ ok: boolean }>;
  };
  merkliste: {
    laden(): Promise<string[] | null>;
    setzen(productId: string, an: boolean): Promise<{ ok: boolean }>;
  };
  signal(art: string, daten?: Record<string, unknown>): Promise<void>;
  /** Texte, die im Admin gepflegt werden (`site_content`): Schlüssel → Text. */
  texte?(): Promise<Record<string, string>>;
  /** Die heute geltenden Vertragsfassungen für Schritt 5 der Bewerbung. */
  vertraege?(): Promise<{ id: string; titel: string; url: string; art: string }[]>;
  /** „Alles löschen" — auch auf dem Server, nicht nur auf diesem Gerät. */
  vergessen?(): Promise<{ ok: boolean; fehler?: string; nurGeraet?: boolean }>;
  konto: {
    aktuell(): Promise<{ id: string; name: string; email: string; member_number?: number | null } | null>;
    anmelden(): Promise<void>;
    abmelden(): Promise<void>;
    bestellungen(): Promise<Record<string, unknown>[]>;
    /** Die eigenen Fäden zu den Häusern (`message_threads`). */
    anfragen?(): Promise<Record<string, unknown>[]>;
    /** Signierte Adresse der Rechnung, gültig eine Stunde. */
    rechnung?(orderId: string): Promise<string | null>;
  };
}

/** Der Zustand, den das Heft mit sich führt. React liest ihn, schreibt ihn aber nicht. */
interface HeftZustand {
  saved: string[];
  cart: { id: string; size?: string; qty: number }[];
  orders: Record<string, unknown>[];
  consent: boolean | null;
  stil: Record<string, string>;
  frag: Record<string, string>;
  measurements: Record<string, string>;
  profile: { id?: string; name: string; email: string } | null;
  [key: string]: unknown;
}

/** Was `startHeft()` zurückgibt. */
interface HeftGriff {
  /** Route setzen. `push=false`, wenn die Adresse schon steht (Aufruf aus React Router). */
  go(route: HeftRoute, push?: boolean): void;
  route(): HeftRoute;
  state: HeftZustand;
  /** Doppelseite neu zeichnen. `still=true` lässt die Einstiegs-Choreografie aus. */
  refresh(still?: boolean): void;
  quelle: HeftQuelle;
  /** Konto und Gedächtnis vom Server über das Gerätegedächtnis legen. */
  kontoLaden(): Promise<void>;
  /** Nach bezahlter Kasse: die Stücke dieses Hauses aus der Tasche nehmen. */
  tascheLeeren(haus?: string): void;
  /** Alle Hörer abmelden, Bewegung anhalten, 3D freigeben. Beim Unmount Pflicht. */
  stop(): void;
}

declare module "@/heft03/app.js" {
  export function startHeft(optionen?: {
    quelle?: HeftQuelle;
    /** `'hash'` für die Vorschau (#/mode/1), `'pfad'` für pawn.vision (/mode) */
    adresse?: "hash" | "pfad";
    basis?: string;
    /** Basis der Heft-Bilder, im Projekt `/heft/assets/` */
    assets?: string;
    /** Zustimmung der Hülle vorbelegen: true, false oder null (noch nicht entschieden) */
    zustimmung?: boolean | null;
    auf?: {
      navigiert?(route: HeftRoute): void;
      kauf?(antwort: { url?: string; id?: string }): void;
      anfrage?(ereignis: { product: HeftProdukt; antwort: unknown }): void;
      zustimmung?(wert: boolean | null): void;
      fehler?(e: unknown): void;
    };
  }): Promise<HeftGriff>;
}

declare module "@/heft03/quelle.mjs" {
  export function demoQuelle(): HeftQuelle;
  export function supabaseQuelle(o: {
    /** der eine supabase-js-Client der Anwendung; das Heft legt keinen zweiten an */
    client: unknown;
    /** Storage-Pfade in ladbare Adressen übersetzen */
    bild?: (url: string) => string;
    funktionen?: {
      anmelden?(): void;
      anfrage?(a: { product: HeftProdukt; text: string }): Promise<{ ok?: boolean; anmelden?: boolean; thread_id?: string; fehler?: string }>;
      signal?(art: string, daten: Record<string, unknown>): void;
      /** Bildadressen einmalig signieren, bevor die Adapter sie synchron lesen */
      signieren?(urls: string[]): Promise<Record<string, string>>;
    };
    adressen?: { erfolg?: string; abbruch?: string };
    /** true liest die Spaltenmasken-Sichten aus sql/01 statt der Tabellen */
    sichten?: boolean;
  }): HeftQuelle;
  /** Chat-Antwort → Heft: Karten-Links werden zu Slugs. */
  export function chatAntwort(data: unknown): HeftChatAntwort | null;
  /** Die Spalten, die das öffentliche Heft liest — nie Stripe-, nie Kontospalten. */
  export const SPALTEN: Record<string, string>;
}

declare module "@/heft03/routen.mjs" {
  /** Route → Pfad. Erste Seite ohne Nummer (/mode), DNA mit Namen (/deine-dna/linie). */
  export function pfadAusRoute(route: HeftRoute): string;
  /** Pfad → Route. Unbekanntes landet auf dem Hero. */
  export function routeAusPfad(pfad: string): HeftRoute;
  /** Alle Adressen, die das Heft kennt — für routen.js, vercel.json und die Wachen. */
  export function alleAdressen(): string[];
  /** Alte Adresse → neue. Ziel der 301-Regeln in vercel.json. */
  export const UMZUEGE: Record<string, string>;
  /** Sektion → Pfadsegment. */
  export const PFAD: Record<string, string>;
}

declare module "@/heft03/data.mjs" {
  export const products: Record<string, HeftProdukt>;
  export const houses: Record<string, HeftHaus>;
  export const displays: Record<string, {
    kicker: string; title: string; text: string; action: string;
    section?: string; product?: string; inquiry?: string; pieces?: string[]; leer?: boolean;
  }>;
  export const sections: Record<string, string[]>;
  export const labels: Record<string, string>;
  export const counts: Record<string, number>;
  /** Sektionen und Bühnen aus den Häusern bauen. */
  export function heftFuellen(heft: HeftDaten): { houses: number; products: number };
  /** Nur was freigestellt ist, kommt auf die Bühne. */
  export function buehnenfaehig(p: HeftProdukt): boolean;
}
