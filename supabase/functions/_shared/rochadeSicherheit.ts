/**
 * Die lange Rochade — Schritt 2: Sicherheit vor Funktion.
 *
 * Ein Server, der beliebige URLs abruft, ist eine offene Tür. Jeder Abruf der langen
 * Rochade geht durch dieses Modul, nie direkt über fetch(). Es schützt gegen SSRF
 * (Zugriff auf interne Adressen über eine harmlos aussehende URL), begrenzt Größe und
 * Zeit, respektiert robots.txt und bremst pro Domain.
 *
 * Bewusst ohne Abhängigkeiten, damit es in Deno wie in Node (Tests) läuft.
 */

/** Freundlich und auskunftsfreudig — wer uns sperren will, soll wissen, wen. */
export const USER_AGENT =
  "PAWN-Rochade/1.0 (+https://pawn.vision/rochade; Umzug im Auftrag der Seiteninhaberin; kontakt@pawn.vision)";

export const GRENZEN = {
  html_bytes: 3 * 1024 * 1024,
  bild_bytes: 15 * 1024 * 1024,
  json_bytes: 5 * 1024 * 1024,
  timeout_ms: 12_000,
  weiterleitungen: 3,
  /** Höchstens zwei Abrufe je Sekunde und Domain. */
  abrufe_pro_sekunde: 2,
} as const;

export type ZielFehler =
  | "kein_https"
  | "falscher_port"
  | "private_adresse"
  | "unerlaubter_host"
  | "namen_nicht_aufloesbar"
  | "zu_viele_weiterleitungen"
  | "zu_gross"
  | "falscher_typ"
  | "robots_verbietet"
  | "nicht_erreichbar";

/**
 * Warme Sätze für die Oberfläche. Eine Störung ist nie ein Fehlercode für die
 * Designerin, sondern ein Satz mit Ausweg.
 */
export const FEHLER_SATZ: Record<ZielFehler, string> = {
  kein_https: "Diese Adresse ist nicht gesichert (kein https). Mit https:// davor versuche ich es gern noch einmal.",
  falscher_port: "Diese Adresse zeigt auf einen ungewöhnlichen Anschluss. Ich hole nur von normalen Webadressen.",
  private_adresse: "Diese Adresse zeigt in ein internes Netz, nicht ins offene Web — da gehe ich nicht hin.",
  unerlaubter_host: "Diese Adresse kann ich nicht aufrufen. Prüf sie einmal, oder nimm den Weg über Screenshots.",
  namen_nicht_aufloesbar:
    "Ich konnte nicht sicher feststellen, wohin diese Adresse zeigt — deshalb lasse ich sie lieber stehen. Versuch es gleich noch einmal oder nimm den Weg über Screenshots.",
  zu_viele_weiterleitungen: "Diese Adresse leitet immer weiter. Gib mir die Zieladresse direkt, dann klappt es.",
  zu_gross: "Diese Datei ist größer, als ich am Stück holen kann. Sie überspringe ich und mache weiter.",
  falscher_typ: "Dahinter lag nicht das, was ich erwartet habe. Ich mache mit dem Rest weiter.",
  robots_verbietet: "Diese Seite bittet Maschinen ausdrücklich, sie nicht zu lesen. Das respektiere ich — nimm den Weg über Screenshots.",
  nicht_erreichbar: "Die Seite hat gerade nicht geantwortet. Ich versuche es später noch einmal.",
};

export interface ZielPruefung {
  ok: boolean;
  grund?: ZielFehler;
  /** Für den Bericht: was genau abgelehnt wurde. */
  detail?: string;
}

/* ---------------------------------------------------------------- Adressen */

/** IPv4 als Zahl — nur für saubere Bereichsvergleiche. */
function ipv4ZuZahl(ip: string): number | null {
  const teile = ip.split(".");
  if (teile.length !== 4) return null;
  let wert = 0;
  for (const t of teile) {
    if (!/^\d{1,3}$/.test(t)) return null;
    const n = Number(t);
    if (n > 255) return null;
    wert = wert * 256 + n;
  }
  return wert >>> 0;
}

/**
 * Liegt die Adresse in einem Bereich, den ein Fremder nie erreichen dürfte?
 * Deckt die im Auftrag genannten Bereiche ab und zusätzlich die üblichen
 * Cloud-Metadaten-Adressen, die derselbe Angriff sonst trifft.
 */
export function istPrivateAdresse(ip: string): boolean {
  const roh = ip.trim().replace(/^\[|\]$/g, "").toLowerCase();

  // IPv6
  if (roh.includes(":")) {
    if (roh === "::1" || roh === "::") return true;
    // IPv4-abgebildete Adressen (::ffff:10.0.0.1) mitprüfen
    const abgebildet = roh.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (abgebildet) return istPrivateAdresse(abgebildet[1]);
    // fc00::/7 (unique local), fe80::/10 (link local)
    if (/^f[cd]/.test(roh)) return true;
    if (/^fe[89ab]/.test(roh)) return true;
    return false;
  }

  const zahl = ipv4ZuZahl(roh);
  if (zahl === null) return false;
  const inBereich = (netz: string, bits: number) => {
    const basis = ipv4ZuZahl(netz);
    if (basis === null) return false;
    const maske = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (zahl & maske) === (basis & maske);
  };
  return (
    inBereich("0.0.0.0", 8) ||       // "dieses Netz"
    inBereich("127.0.0.0", 8) ||     // loopback
    inBereich("10.0.0.0", 8) ||      // privat
    inBereich("172.16.0.0", 12) ||   // privat
    inBereich("192.168.0.0", 16) ||  // privat
    inBereich("169.254.0.0", 16) ||  // link local + Cloud-Metadaten (169.254.169.254)
    inBereich("100.64.0.0", 10) ||   // Carrier-NAT
    inBereich("192.0.0.0", 24) ||
    inBereich("198.18.0.0", 15) ||   // Benchmark
    inBereich("224.0.0.0", 4) ||     // Multicast
    inBereich("240.0.0.0", 4)        // reserviert
  );
}

const GESPERRTE_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function istIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

/* ------------------------------------------------------ Namensauflösung */

/**
 * Zwei DoH-Anbieter. Der erste, der antwortet, entscheidet — beide werden
 * gegen dieselbe Sperrliste geprüft. Diese Adressen gehen bewusst NICHT durch
 * pruefeZiel (das wäre eine Endlosschleife); sie sind fest verdrahtet.
 */
const DOH_ANBIETER = [
  (host: string, typ: string) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${typ}`,
  (host: string, typ: string) => `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${typ}`,
];

/** DNS-Antworttypen, die eine Adresse tragen. */
const A = 1, AAAA = 28;

async function ueberDoh(host: string): Promise<string[] | null> {
  for (const bau of DOH_ANBIETER) {
    const adressen: string[] = [];
    let geantwortet = false;
    for (const typ of ["A", "AAAA"]) {
      try {
        const res = await fetch(bau(host, typ), {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const daten = await res.json() as { Status?: number; Answer?: { type?: number; data?: string }[] };
        geantwortet = true;
        // Status 3 = NXDOMAIN: der Name existiert nicht. Das ist eine gültige Antwort.
        if (daten.Status === 3) return [];
        for (const a of daten.Answer ?? []) {
          if ((a.type === A || a.type === AAAA) && typeof a.data === "string") adressen.push(a.data);
        }
      } catch { /* nächster Typ, dann nächster Anbieter */ }
    }
    if (geantwortet) return adressen;
  }
  return null; // kein Anbieter erreichbar
}

/**
 * Löst einen Namen auf und gibt ALLE gefundenen Adressen zurück.
 * `null` heißt: konnte nicht aufgelöst werden — der Aufrufer bricht dann ab.
 * Deno.resolveDns wird bevorzugt, DoH ist der Rückfall.
 */
export async function aufloesen(host: string): Promise<string[] | null> {
  const resolver = (globalThis as { Deno?: { resolveDns?: (h: string, t: string) => Promise<string[]> } }).Deno?.resolveDns;
  if (typeof resolver === "function") {
    const adressen: string[] = [];
    let ging = false;
    for (const typ of ["A", "AAAA"]) {
      try { adressen.push(...(await resolver(host, typ))); ging = true; }
      catch (e) {
        // "NotFound" heißt: dieser Typ fehlt — kein Grund zur Sorge.
        if ((e as Error)?.name === "NotFound") ging = true;
      }
    }
    if (ging) return adressen;
  }
  return await ueberDoh(host);
}

/**
 * Prüft eine einzelne URL, bevor sie abgerufen wird. Wird bei Weiterleitungen
 * für JEDES Ziel erneut aufgerufen — genau da liegt die Lücke, die man sonst
 * übersieht: die erste URL ist harmlos, die Weiterleitung zeigt nach innen.
 */
export async function pruefeZiel(rohUrl: string): Promise<ZielPruefung> {
  let url: URL;
  try {
    url = new URL(rohUrl);
  } catch {
    return { ok: false, grund: "unerlaubter_host", detail: "keine gültige Adresse" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, grund: "kein_https", detail: url.protocol };
  }

  // Nur der Standard-Anschluss. Ein abweichender Port ist im offenen Web die
  // Ausnahme und im Angriffsfall die Regel (interne Dienste hören selten auf 443).
  if (url.port !== "" && url.port !== "443") {
    return { ok: false, grund: "falscher_port", detail: url.port };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (GESPERRTE_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, grund: "unerlaubter_host", detail: host };
  }

  if (istIpLiteral(host)) {
    if (istPrivateAdresse(host)) return { ok: false, grund: "private_adresse", detail: host };
    return { ok: true };
  }

  // Namen auflösen — bevorzugt über die Laufzeit, sonst über DNS-over-HTTPS.
  // FAIL CLOSED: lässt sich der Name nicht auflösen, wird NICHT geladen. Lieber
  // ein warmer Satz als ein Abruf, dessen Ziel wir nicht kennen.
  const adressen = await aufloesen(host);
  if (adressen === null) {
    return { ok: false, grund: "namen_nicht_aufloesbar", detail: host };
  }
  if (adressen.length === 0) {
    return { ok: false, grund: "nicht_erreichbar", detail: `${host} existiert nicht` };
  }
  const schlimm = adressen.find((a) => istPrivateAdresse(a));
  if (schlimm) return { ok: false, grund: "private_adresse", detail: `${host} → ${schlimm}` };

  return { ok: true };
}

/* ------------------------------------------------------------ Ratenbremse */

const letzterAbruf = new Map<string, number>();

/** Höchstens zwei Abrufe pro Sekunde und Domain — wir sind Gast, nicht Gast­geber. */
export async function warteAufFreigabe(host: string): Promise<void> {
  const abstand = 1000 / GRENZEN.abrufe_pro_sekunde;
  const zuletzt = letzterAbruf.get(host) ?? 0;
  const wartezeit = zuletzt + abstand - Date.now();
  if (wartezeit > 0) await new Promise((r) => setTimeout(r, wartezeit));
  letzterAbruf.set(host, Date.now());
}

/* ------------------------------------------------------------- robots.txt */

const robotsCache = new Map<string, string[]>();

/** Sehr bewusst schlicht: nur Disallow-Pfade für * und für uns. */
function parseRobots(text: string): string[] {
  const verboten: string[] = [];
  let gilt = false;
  for (const zeile of text.split("\n")) {
    const z = zeile.split("#")[0].trim();
    if (!z) continue;
    const [feldRoh, ...rest] = z.split(":");
    const feld = feldRoh.trim().toLowerCase();
    const wert = rest.join(":").trim();
    if (feld === "user-agent") {
      gilt = wert === "*" || wert.toLowerCase().includes("pawn");
    } else if (feld === "disallow" && gilt && wert) {
      verboten.push(wert);
    }
  }
  return verboten;
}

export async function robotsErlaubt(url: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const ursprung = u.origin;
  let regeln = robotsCache.get(ursprung);
  if (!regeln) {
    try {
      await warteAufFreigabe(u.hostname);
      const res = await fetch(`${ursprung}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });
      regeln = res.ok ? parseRobots((await res.text()).slice(0, 200_000)) : [];
    } catch {
      // Keine robots.txt erreichbar heißt: keine Einschränkung bekannt.
      regeln = [];
    }
    robotsCache.set(ursprung, regeln);
  }
  const pfad = u.pathname + u.search;
  return !regeln.some((r) => r === "/" ? pfad.startsWith("/") : pfad.startsWith(r));
}

/* ----------------------------------------------------------- Sicherer Abruf */

export interface AbrufErgebnis {
  ok: boolean;
  grund?: ZielFehler;
  detail?: string;
  status?: number;
  /** Endgültige Adresse nach allen Weiterleitungen. */
  url?: string;
  contentType?: string;
  text?: string;
  bytes?: Uint8Array;
}

interface AbrufOptionen {
  /** "html" | "json" | "bild" — bestimmt Größenlimit und erlaubte Typen. */
  art: "html" | "json" | "bild";
  /** robots.txt prüfen (bei Bildern derselben Domain unnötig). */
  robots?: boolean;
}

const ERLAUBTE_TYPEN: Record<AbrufOptionen["art"], RegExp> = {
  html: /^(text\/html|application\/xhtml\+xml|text\/xml|application\/xml)/,
  json: /^(application\/json|application\/ld\+json|text\/json)/,
  bild: /^image\//,
};

/**
 * Der einzige erlaubte Weg nach draußen. Folgt Weiterleitungen von Hand, damit
 * jedes Zwischenziel erneut geprüft wird, und bricht ab, sobald das Größenlimit
 * gerissen wird — statt erst die ganze Antwort in den Speicher zu ziehen.
 *
 * Zwei Regeln, die den Schaden auch im Restrisiko-Fall klein halten:
 *
 * 1. NIEMALS Anmelde- oder Sitzungsdaten mitschicken. Diese Funktion nimmt
 *    bewusst keine Header vom Aufrufer entgegen — sie setzt nur User-Agent und
 *    Accept. Cookies werden weder gesendet noch aus Antworten übernommen
 *    (`credentials: "omit"`), auch nicht über Weiterleitungen hinweg.
 * 2. Das Ergebnis ist ROHMATERIAL für den Arbeiter, nie eine Antwort an den
 *    Browser. Zum Client gehen ausschließlich die extrahierten Felder
 *    (Titel, Preis, Bild-Adresse …) — nie `text` oder `bytes` von hier.
 */
export async function sicherAbrufen(rohUrl: string, opt: AbrufOptionen): Promise<AbrufErgebnis> {
  const limit = opt.art === "bild" ? GRENZEN.bild_bytes : opt.art === "json" ? GRENZEN.json_bytes : GRENZEN.html_bytes;
  let aktuell = rohUrl;

  for (let sprung = 0; sprung <= GRENZEN.weiterleitungen; sprung++) {
    const pruefung = await pruefeZiel(aktuell);
    if (!pruefung.ok) return { ok: false, grund: pruefung.grund, detail: pruefung.detail };

    if (opt.robots !== false && !(await robotsErlaubt(aktuell))) {
      return { ok: false, grund: "robots_verbietet", detail: aktuell };
    }

    const host = new URL(aktuell).hostname;
    await warteAufFreigabe(host);

    let res: Response;
    try {
      res = await fetch(aktuell, {
        redirect: "manual",
        // Nur diese zwei Header. Keine Authorization, kein Cookie, nichts vom Aufrufer.
        headers: { "User-Agent": USER_AGENT, Accept: opt.art === "json" ? "application/json" : "*/*" },
        credentials: "omit",
        signal: AbortSignal.timeout(GRENZEN.timeout_ms),
      });
    } catch (e) {
      return { ok: false, grund: "nicht_erreichbar", detail: (e as Error).message };
    }

    if (res.status >= 300 && res.status < 400) {
      const ziel = res.headers.get("location");
      if (!ziel) return { ok: false, grund: "nicht_erreichbar", detail: "Weiterleitung ohne Ziel" };
      aktuell = new URL(ziel, aktuell).toString();
      continue; // ← und oben wird das neue Ziel erneut geprüft
    }

    if (!res.ok) return { ok: false, grund: "nicht_erreichbar", detail: `HTTP ${res.status}`, status: res.status };

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (contentType && !ERLAUBTE_TYPEN[opt.art].test(contentType)) {
      return { ok: false, grund: "falscher_typ", detail: contentType, status: res.status };
    }

    const angekuendigt = Number(res.headers.get("content-length") ?? "0");
    if (angekuendigt > limit) return { ok: false, grund: "zu_gross", detail: `${angekuendigt} Bytes` };

    const bytes = await leseBegrenzt(res, limit);
    if (!bytes) return { ok: false, grund: "zu_gross", detail: `über ${limit} Bytes` };

    if (opt.art === "bild") {
      return { ok: true, status: res.status, url: aktuell, contentType, bytes };
    }
    return { ok: true, status: res.status, url: aktuell, contentType, text: new TextDecoder().decode(bytes) };
  }

  return { ok: false, grund: "zu_viele_weiterleitungen", detail: aktuell };
}

/** Liest den Körper stückweise und bricht ab, sobald das Limit überschritten ist. */
async function leseBegrenzt(res: Response, limit: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const teile: Uint8Array[] = [];
  let gesamt = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    gesamt += value.byteLength;
    if (gesamt > limit) { await reader.cancel(); return null; }
    teile.push(value);
  }
  const alles = new Uint8Array(gesamt);
  let pos = 0;
  for (const t of teile) { alles.set(t, pos); pos += t.byteLength; }
  return alles;
}
