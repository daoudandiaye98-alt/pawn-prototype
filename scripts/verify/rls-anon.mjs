#!/usr/bin/env node
/**
 * Was sieht ein Fremder?
 *
 * Das Heft liest OHNE Anmeldung. Diese Prüfung fasst die Datenbank mit genau dem
 * Schlüssel an, den jeder Besucher im Browser hat, und vergleicht mit dem, was
 * sichtbar sein DARF. Sie ersetzt das Lesen von Policies durch eine Messung:
 * eine Policy, die man liest, ist eine Absicht — eine Antwort ist ein Beweis.
 *
 * ── Die Falle, an der diese Prüfung fast wertlos geworden wäre ──────────────
 *
 * „anon sieht `orders` nicht" lässt sich auf einer LEEREN Tabelle nicht messen.
 * PostgREST antwortet bei fehlender Policy nicht mit einem Fehler, sondern mit
 * `[]` — und eine leere Tabelle antwortet genauso. Ein Haken hier hieße also:
 * „ich habe nichts gesehen", nicht „es ist gesperrt". Genau die Sorte Grün, die
 * im September drei Prüfstandsläufe wertlos gemacht hat.
 *
 * Darum zwei Klassen von Kontrollen:
 *
 *   SPALTEN  — tragen IMMER, auch ohne eine einzige Zeile. Fragt man PostgREST
 *              nach einer Spalte, die die Sicht nicht hat, antwortet es 400
 *              („column ... does not exist"). Gibt es sie, kommt 200. Damit ist
 *              Zusage Z10 (kein Stripe-Feld für anon) ohne Daten beweisbar.
 *   ZEILEN   — brauchen Daten. Sie melden `nicht_pruefbar`, solange die Tabelle
 *              leer ist, statt sich ein Bestanden zu nehmen.
 *
 * ── Rückgabewerte ───────────────────────────────────────────────────────────
 *   0  alles, was messbar war, war richtig
 *   1  eine Zusage ist gebrochen — das ist ein Sicherheitsbefund
 *   3  nichts messbar (kein Zugang, kein Netz, kein Schema) — KEIN Urteil
 *
 * Der Schlüssel kommt aus der Umgebung, nie aus dem Repo:
 *   PAWN_SUPABASE_URL / PAWN_ANON_KEY   (oder VITE_SUPABASE_URL /
 *   VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY)
 * Der anon-Schlüssel ist öffentlich — er steht in jedem Browser. Der
 * `service_role`-Schlüssel hat hier nichts zu suchen und wird nie gelesen.
 */

const URL_BASIS = process.env.PAWN_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SCHLUESSEL =
  process.env.PAWN_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

/** Sichten und Tabellen, die das Heft ohne Anmeldung lesen muss. */
const LESBAR = [
  'heft_produkte',
  'heft_haeuser',
  'designer_page_blocks',
  'house_themes',
  'media_assets',
  'curated_collections',
  'collection_items',
];

/**
 * Spalten, die anon NIE sehen darf — je Sicht.
 *
 * Das ist die Zusage Z10 in .claude/regressionen.json. Sie ist der Grund, warum
 * es die Sichten `heft_produkte`/`heft_haeuser` überhaupt gibt: die Policy
 * „designers public read" auf der Tabelle gibt anon sonst auch
 * `stripe_account_id` und `stripe_customer_id`.
 */
/*
 * NUR SICHTEN, bewusst keine Tabellen. Bei einer Sicht ist „die Spalte gibt es"
 * schon der Bruch — heft_haeuser existiert genau deshalb, um sie wegzulassen.
 * Bei einer TABELLE sagt eine vorhandene Spalte nichts: RLS sperrt dort Zeilen,
 * nicht Spalten. `media_assets.user_id` stand hier zuerst mit drin und haette
 * ab dem ersten Schema falschen Alarm geschlagen. Zeilen-Lecks deckt Teil 3 ab.
 *
 * EINMAL ROT VORGEFUEHRT am 11.09.2026 gegen das echte Projekt: mit einem
 * zusaetzlichen `profiles: ['display_name']` in dieser Liste meldete der Lauf
 * „RLS: 0/1 · FEHLER: profiles.display_name" und Rueckgabewert 1. Die Kontrolle
 * ist damit bewiesen, nicht behauptet.
 */
const VERBOTENE_SPALTEN = {
  heft_haeuser: ['stripe_account_id', 'stripe_customer_id', 'user_id', 'email'],
  heft_produkte: ['stripe_price_id', 'user_id'],
};

/** Tabellen, aus denen ein Fremder keine einzige Zeile bekommen darf. */
const GESPERRT = [
  'orders',
  'profiles',
  'message_threads',
  'customer_measurements',
  'kunden_stil',
  'wishlists',
  'jarvis_runs',
  'jarvis_reports',
  'jarvis_notices',
  'jarvis_pending_actions',
];

const befunde = [];
const merke = (status, kontrolle, text) => befunde.push({ status, kontrolle, text });

async function frage(pfad) {
  const antwort = await fetch(`${URL_BASIS}/rest/v1/${pfad}`, {
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${SCHLUESSEL}` },
  });
  let koerper = null;
  try {
    koerper = await antwort.json();
  } catch {
    koerper = null;
  }
  return { status: antwort.status, koerper };
}

async function lauf() {
  if (!URL_BASIS || !SCHLUESSEL) {
    console.log('  kein Zugang in der Umgebung (PAWN_SUPABASE_URL / PAWN_ANON_KEY)');
    console.log('RLS: 0/0 · FEHLER: keine · NICHT PRUEFBAR: ohne Schlüssel lässt sich nichts messen');
    return 3;
  }

  // Erreichbarkeit zuerst. Ohne sie ist jede folgende Zahl eine Erfindung.
  try {
    const wurzel = await fetch(`${URL_BASIS}/rest/v1/`, { headers: { apikey: SCHLUESSEL } });
    if (wurzel.status >= 500) throw new Error(`REST-Wurzel antwortet ${wurzel.status}`);
  } catch (e) {
    console.log(`  ${URL_BASIS} nicht erreichbar: ${e.message}`);
    console.log('RLS: 0/0 · FEHLER: keine · NICHT PRUEFBAR: die Datenbank antwortet nicht');
    return 3;
  }

  // ── 1 · Was lesbar sein muss, muss lesbar sein ────────────────────────────
  for (const t of LESBAR) {
    const { status } = await frage(`${t}?select=*&limit=1`);
    if (status === 404) merke('nicht_pruefbar', t, 'gibt es noch nicht (Schema fehlt)');
    else if (status === 200) merke('bestanden', t, 'lesbar ohne Anmeldung');
    else merke('gefallen', t, `antwortet ${status} — das Heft könnte sie nicht lesen`);
  }

  // ── 2 · Was nie sichtbar sein darf (trägt auch ohne Daten) ────────────────
  for (const [sicht, spalten] of Object.entries(VERBOTENE_SPALTEN)) {
    for (const spalte of spalten) {
      const { status, koerper } = await frage(`${sicht}?select=${spalte}&limit=1`);
      if (status === 404) {
        merke('nicht_pruefbar', `${sicht}.${spalte}`, 'Sicht gibt es noch nicht');
      } else if (status === 400 && /does not exist|column/i.test(JSON.stringify(koerper || {}))) {
        merke('bestanden', `${sicht}.${spalte}`, 'nicht vorhanden — genau so soll es sein');
      } else if (status === 200) {
        // Die Sicht hat die Spalte. Ob gerade Zeilen darin stehen, ist gleichgueltig:
        // die Zusage lautet, dass es sie in der oeffentlichen Sicht NICHT gibt.
        merke('gefallen', `${sicht}.${spalte}`, 'DIE ÖFFENTLICHE SICHT HAT DIESE SPALTE — Zusage Z10 gebrochen');
      } else {
        merke('nicht_pruefbar', `${sicht}.${spalte}`, `unerwartete Antwort ${status}`);
      }
    }
  }

  // ── 3 · Gesperrte Tabellen — nur mit Daten beweisbar ──────────────────────
  //
  // Eine leere Antwort kann zweierlei heißen: gesperrt, oder nichts drin. Diese
  // Prüfung nimmt sich deshalb KEIN Bestanden, solange sie das nicht trennen
  // kann. Ein Fund (Zeilen kommen durch) ist dagegen immer eindeutig.
  for (const t of GESPERRT) {
    const { status, koerper } = await frage(`${t}?select=*&limit=1`);
    if (status === 404) merke('nicht_pruefbar', t, 'gibt es noch nicht');
    else if (status === 401 || status === 403) merke('bestanden', t, `verweigert (${status})`);
    else if (status === 200 && Array.isArray(koerper) && koerper.length === 0)
      merke('nicht_pruefbar', t, 'leere Antwort — gesperrt oder nur leer, das trennt erst ein Datensatz');
    else if (status === 200) merke('gefallen', t, `GIBT ${koerper?.length ?? '?'} ZEILE(N) AN EINEN FREMDEN HERAUS`);
    else merke('nicht_pruefbar', t, `unerwartete Antwort ${status}`);
  }

  const bestanden = befunde.filter((b) => b.status === 'bestanden');
  const gefallen = befunde.filter((b) => b.status === 'gefallen');
  const offen = befunde.filter((b) => b.status === 'nicht_pruefbar');

  for (const b of gefallen) console.log(`  ✗ ${b.kontrolle} — ${b.text}`);
  for (const b of offen) console.log(`  ? ${b.kontrolle} — ${b.text}`);
  if (!gefallen.length && !offen.length) console.log(`  alle ${bestanden.length} Kontrollen bestanden`);

  const messbar = bestanden.length + gefallen.length;
  const schwanz = offen.length ? ` · NICHT PRUEFBAR: ${offen.length}` : '';
  console.log(
    `RLS: ${bestanden.length}/${messbar} · FEHLER: ${gefallen.length ? gefallen.map((b) => b.kontrolle).join(',') : 'keine'}${schwanz}`,
  );

  if (gefallen.length) return 1;
  if (messbar === 0) return 3;
  return 0;
}

process.exit(await lauf());
