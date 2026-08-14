/**
 * DIE LANGE ROCHADE — der Arbeiter.
 *
 * Bringt eine bestehende Website eines Hauses nach PAWN. Alles, was hier
 * passiert, ist in Häppchen aufgeteilt und ruft sich selbst weiter auf: eine
 * Edge Function hat begrenzte Zeit, ein Shop hat es nicht.
 *
 * Aktionen:
 *   starten        Auftrag anlegen, Plattform erkennen, erste Adressen einreihen
 *   weiter         ein Häppchen Seiten + ein Häppchen Bilder, dann Selbstaufruf
 *   deuten         die Kandidaten in Bündeln von 10–20 einordnen (Schritt 5)
 *   uebernehmen    die gewählten Kandidaten werden Werke (Schritt 7)
 *   zuruecknehmen  die ganze Übernahme rückgängig machen
 *
 * Vier Gesetze:
 *   1. Nichts geht live ohne die Auswahl der Designerin. „uebernehmen" ist der
 *      einzige Weg zu einem products-Eintrag, und er kommt nur von ihr.
 *   2. Struktur schlägt Intelligenz. Erst Adapter (Schritt 3), dann Deutung.
 *   3. Importiert wird Identität, nie CSS. Farbwerte und Schriften werden in
 *      _shared/rochadeDeutung.ts entfernt, bevor irgendetwas gespeichert wird.
 *   4. Nichts erfinden. Fehlende Werte bleiben leer.
 *
 * Nach draußen geht es ausschließlich über _shared/rochadeSicherheit.ts.
 * Rohe Antwortkörper verlassen diese Function nie — nur extrahierte Felder.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sicherAbrufen, FEHLER_SATZ } from "../_shared/rochadeSicherheit.ts";
import {
  bilderAusHtml, entdopple, erkennePlattform, groessteAusSrcset, istWerkBild,
  jsonLdLesen, produktEndpunkt, schluesselVon, shopifyLesen, sitemapAdressen,
  squarespaceLesen, wooLesen,
  type AdapterErgebnis, type KandidatRoh, type Plattform,
} from "../_shared/rochadeAdapter.ts";
import { ablageOrt, bildAufbereiten, inhaltHash, istZierbild, typFuer } from "../_shared/rochadeBild.ts";
import {
  buendeln, deutungLesen, nutzerPrompt, systemPrompt,
  type DeutungsKontext,
} from "../_shared/rochadeDeutung.ts";

const MODELL = "claude-sonnet-4-5";
/** Wie viel je Aufruf. Klein genug, dass ein Häppchen sicher fertig wird. */
const SEITEN_JE_LAUF = 4;
const BILDER_JE_LAUF = 6;
const BUENDEL_JE_LAUF = 2;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jwtSub(auth: string | null): string | null {
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p?.sub === "string" ? p.sub : null;
  } catch { return null; }
}

/** Adresse ohne Fragment, ohne Tracking-Parameter, ohne Schrägstrich am Ende. */
function urlSchluessel(roh: string): string {
  try {
    const u = new URL(roh);
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(p)) u.searchParams.delete(p);
    }
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch { return roh; }
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/* ------------------------------------------------------------- Kontingent */

async function buchen(admin: SupabaseClient, auftrag: string, feld: string, menge = 1): Promise<boolean> {
  const { data } = await admin.rpc("rochade_kontingent_buchen", {
    p_auftrag: auftrag, p_feld: feld, p_menge: menge,
  });
  return (data as { ok?: boolean } | null)?.ok === true;
}

/* --------------------------------------------------------- Selbstaufruf */

/** Ruft sich selbst weiter auf, ohne auf die Antwort zu warten. */
function weiterMachen(auftragId: string, aktion: string): void {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/rochade-import`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Bewusst kein await: dieser Lauf ist fertig, der nächste läuft eigenständig.
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "x-rochade-intern": "1" },
    body: JSON.stringify({ aktion, auftrag_id: auftragId, intern: true }),
  }).catch(() => { /* Bleibt liegen — der Cron-Aufräumer nimmt es wieder auf. */ });
}

/* ------------------------------------------------------------ Seiten lesen */

interface SeitenZeile { id: string; url: string; art: string }

/** Wählt den passenden Adapter für eine geladene Antwort. */
function auswerten(plattform: Plattform, art: string, url: string, text: string): AdapterErgebnis {
  const basis = new URL(url).origin;
  if (art === "api") {
    let daten: unknown;
    try { daten = JSON.parse(text); } catch { return { plattform, stufe: "keine", kandidaten: [], weitere_seite: null }; }
    const seite = Number(new URL(url).searchParams.get("page") ?? "1") || 1;
    if (plattform === "shopify") return shopifyLesen(daten, basis, seite);
    if (plattform === "woocommerce") return wooLesen(daten, basis, seite);
    if (plattform === "squarespace") return squarespaceLesen(daten, url);
    return { plattform, stufe: "keine", kandidaten: [], weitere_seite: null };
  }
  // Stufe 3: strukturierte Daten in der Seite selbst.
  return jsonLdLesen(text, url);
}

async function seitenHaeppchen(
  admin: SupabaseClient, auftrag: Record<string, unknown>,
): Promise<{ gefunden: number; offen: boolean }> {
  const auftragId = auftrag.id as string;
  const plattform = (auftrag.plattform as Plattform) ?? "unbekannt";
  const { data: seiten } = await admin.rpc("rochade_seiten_holen", {
    p_auftrag: auftragId, p_anzahl: SEITEN_JE_LAUF,
  });
  const liste = (seiten ?? []) as SeitenZeile[];
  if (liste.length === 0) return { gefunden: 0, offen: false };

  let gefunden = 0;
  for (const seite of liste) {
    if (!(await buchen(admin, auftragId, "seiten"))) {
      // Kontingent erreicht: die geholte Zeile ehrlich zurücklegen und aufhören.
      await admin.from("rochade_seiten").update({ status: "offen" }).eq("id", seite.id);
      return { gefunden, offen: false };
    }

    const art: "html" | "json" = seite.art === "api" ? "json" : "html";
    const abruf = await sicherAbrufen(seite.url, { art, robots: seite.art !== "robots" });
    if (!abruf.ok) {
      await admin.from("rochade_seiten").update({
        status: "fehler", http_status: abruf.status ?? null,
        fehler: abruf.grund ? FEHLER_SATZ[abruf.grund] : "Diese Adresse hat nicht geantwortet.",
      }).eq("id", seite.id);
      continue; // Eine Seite scheitert, der Auftrag läuft weiter.
    }
    const text = abruf.text ?? "";

    // Sitemaps reihen neue Adressen ein, statt Werke zu liefern.
    if (seite.art === "sitemap") {
      const { seiten: adressen, weitereSitemaps } = sitemapAdressen(text);
      const neue = [
        ...weitereSitemaps.slice(0, 5).map((u) => ({ u, art: "sitemap" })),
        ...adressen.filter((u) => /\/(products?|shop|produkt|werk|artikel|store)\//i.test(u))
          .slice(0, 200).map((u) => ({ u, art: "werk" })),
      ];
      await einreihen(admin, auftragId, neue);
      await admin.from("rochade_seiten").update({
        status: "fertig", http_status: abruf.status ?? null, gefunden: neue.length,
      }).eq("id", seite.id);
      continue;
    }

    const ergebnis = auswerten(plattform, seite.art, abruf.url ?? seite.url, text);
    const kandidaten = entdopple(ergebnis.kandidaten);

    // Stufe 4: gar nichts Strukturiertes — wenigstens die Bilder der Seite retten.
    if (kandidaten.length === 0 && seite.art === "werk") {
      const bilder = bilderAusHtml(text, abruf.url ?? seite.url);
      if (bilder.length) {
        const titel = (text.match(/<title[^>]*>([^<]{2,120})<\/title>/i)?.[1] ?? "").trim();
        kandidaten.push({
          quell_id: urlSchluessel(seite.url), quell_url: seite.url,
          titel: titel || seite.url, beschreibung_html: null, beschreibung_text: null,
          preis_cent: null, waehrung: null, bilder, varianten: [], kategorien: [], verfuegbar: null,
        });
      }
    }

    const angelegt = await kandidatenSchreiben(admin, auftrag, seite.id, kandidaten);
    gefunden += angelegt;

    // Blätternde Endpunkte reihen ihre nächste Seite selbst ein.
    if (ergebnis.weitere_seite) await einreihen(admin, auftragId, [{ u: ergebnis.weitere_seite, art: "api" }]);

    await admin.from("rochade_seiten").update({
      status: "fertig", http_status: abruf.status ?? null, gefunden: angelegt,
    }).eq("id", seite.id);
  }

  const { count } = await admin.from("rochade_seiten")
    .select("id", { count: "exact", head: true })
    .eq("auftrag_id", auftragId).in("status", ["offen", "laeuft"]);
  return { gefunden, offen: (count ?? 0) > 0 };
}

/** Legt Adressen an, ohne je eine doppelt einzureihen (Unique-Index + upsert). */
async function einreihen(
  admin: SupabaseClient, auftragId: string, adressen: { u: string; art: string }[],
): Promise<void> {
  if (!adressen.length) return;
  const zeilen = adressen.map(({ u, art }) => ({
    auftrag_id: auftragId, url: u, url_schluessel: urlSchluessel(u), art,
  }));
  await admin.from("rochade_seiten")
    .upsert(zeilen, { onConflict: "auftrag_id,url_schluessel", ignoreDuplicates: true });
}

/** Schreibt Kandidaten und ihre Bild-Zeilen. Ein zweiter Lauf ändert nichts. */
async function kandidatenSchreiben(
  admin: SupabaseClient, auftrag: Record<string, unknown>, seiteId: string, kandidaten: KandidatRoh[],
): Promise<number> {
  const auftragId = auftrag.id as string;
  let angelegt = 0;
  for (const k of kandidaten) {
    if (!(await buchen(admin, auftragId, "werke"))) return angelegt;
    const { data: zeile, error } = await admin.from("rochade_kandidaten").upsert({
      auftrag_id: auftragId,
      designer_id: auftrag.designer_id as string,
      seite_id: seiteId,
      quell_url: k.quell_url,
      schluessel: schluesselVon(k),
      titel: k.titel || null,
      beschreibung_text: k.beschreibung_text,
      preis_cent: k.preis_cent,
      waehrung: k.waehrung,
      verfuegbar: k.verfuegbar,
      varianten: k.varianten,
      roh: { kategorien: k.kategorien, quell_id: k.quell_id },
      sortierung: angelegt,
    }, { onConflict: "auftrag_id,schluessel" }).select("id").single();
    if (error || !zeile) continue;
    angelegt++;

    const bilder = k.bilder.filter((u) => istWerkBild(u) && !istZierbild(u)).slice(0, 12);
    if (!bilder.length) continue;
    if (!(await buchen(admin, auftragId, "bilder", bilder.length))) continue;
    await admin.from("rochade_bilder").upsert(
      bilder.map((u, i) => ({
        auftrag_id: auftragId, kandidat_id: zeile.id as string,
        quell_url: u, reihenfolge: i,
      })),
      { onConflict: "auftrag_id,quell_url", ignoreDuplicates: true },
    );
  }
  return angelegt;
}

/* ------------------------------------------------------------ Bilder laden */

interface BildZeile { id: string; kandidat_id: string; quell_url: string; reihenfolge: number }

async function bilderHaeppchen(
  admin: SupabaseClient, auftrag: Record<string, unknown>,
): Promise<{ offen: boolean }> {
  const auftragId = auftrag.id as string;
  const userId = auftrag.user_id as string;
  const { data: bilder } = await admin.rpc("rochade_bilder_holen", {
    p_auftrag: auftragId, p_anzahl: BILDER_JE_LAUF,
  });
  const liste = (bilder ?? []) as BildZeile[];

  for (const bild of liste) {
    // data-src und srcset liefern oft eine größere Fassung als src.
    const adresse = bild.quell_url.includes(",") && /\s\d+[wx]/.test(bild.quell_url)
      ? (groessteAusSrcset(bild.quell_url) ?? bild.quell_url)
      : bild.quell_url;

    const abruf = await sicherAbrufen(adresse, { art: "bild", robots: false });
    if (!abruf.ok || !abruf.bytes) {
      await admin.from("rochade_bilder").update({
        status: "fehler",
        fehler: abruf.grund ? FEHLER_SATZ[abruf.grund] : "Dieses Bild ließ sich nicht laden. Die übrigen sind da.",
      }).eq("id", bild.id);
      continue;
    }
    if (!(await buchen(admin, auftragId, "bytes", abruf.bytes.length))) {
      await admin.from("rochade_bilder").update({
        status: "uebersprungen", fehler: "Das Bildkontingent dieses Imports war erreicht.",
      }).eq("id", bild.id);
      continue;
    }

    const hash = await inhaltHash(abruf.bytes);
    // Dasselbe Bild unter zweiter Adresse: einmal reicht.
    const { data: schon } = await admin.from("rochade_bilder")
      .select("id").eq("auftrag_id", auftragId).eq("inhalt_hash", hash).limit(1).maybeSingle();
    if (schon) {
      await admin.from("rochade_bilder").update({
        status: "uebersprungen", fehler: "Dasselbe Bild lag schon unter einer anderen Adresse.",
      }).eq("id", bild.id);
      continue;
    }

    const auf = await bildAufbereiten(abruf.bytes, adresse);
    if (auf.zierat) {
      await admin.from("rochade_bilder").update({
        status: "uebersprungen", inhalt_hash: hash, fehler: auf.hinweis,
      }).eq("id", bild.id);
      continue;
    }

    const pfad = ablageOrt(userId, auftragId, hash, auf.format);
    const { error: hochError } = await admin.storage.from("designer-media")
      .upload(pfad, auf.gross, { contentType: auf.unveraendert ? typFuer(auf.format) : "image/webp", upsert: true });
    if (hochError) {
      await admin.from("rochade_bilder").update({
        status: "fehler", inhalt_hash: hash,
        fehler: "Dieses Bild ließ sich nicht ablegen. Die übrigen sind da.",
      }).eq("id", bild.id);
      continue;
    }
    let pfadKlein: string | null = null;
    if (auf.klein) {
      pfadKlein = ablageOrt(userId, auftragId, hash, auf.format, true);
      const { error } = await admin.storage.from("designer-media")
        .upload(pfadKlein, auf.klein, { contentType: "image/webp", upsert: true });
      if (error) pfadKlein = null;
    }

    await admin.from("rochade_bilder").update({
      status: "fertig", inhalt_hash: hash, pfad, pfad_klein: pfadKlein,
      breite: auf.breite, hoehe: auf.hoehe, bytes: auf.gross.length, fehler: auf.hinweis,
    }).eq("id", bild.id);
  }

  const { count } = await admin.from("rochade_bilder")
    .select("id", { count: "exact", head: true })
    .eq("auftrag_id", auftragId).in("status", ["offen", "laeuft"]);
  return { offen: (count ?? 0) > 0 };
}

/* ---------------------------------------------------------------- Deutung */

async function claude(apiKey: string, system: string, nutzer: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELL, max_tokens: 4000, system, messages: [{ role: "user", content: nutzer }] }),
    });
    if (!res.ok) return null;
    const daten = await res.json();
    return (daten.content ?? []).filter((b: { type: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text ?? "").join("\n");
  } catch { return null; }
}

async function deutenHaeppchen(
  admin: SupabaseClient, auftrag: Record<string, unknown>,
): Promise<{ offen: boolean; meldung: string | null }> {
  const auftragId = auftrag.id as string;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { offen: false, meldung: "Die Einordnung ist gerade nicht erreichbar. Die Werke stehen trotzdem am Lichttisch — sie sind nur noch keiner Welt zugeordnet." };

  const { data: offene } = await admin.from("rochade_kandidaten")
    .select("id, schluessel, titel, beschreibung_text, preis_cent, varianten, roh, quell_url")
    .eq("auftrag_id", auftragId).eq("status", "neu")
    .order("sortierung").limit(BUENDEL_JE_LAUF * 20);
  const zeilen = (offene ?? []) as Record<string, unknown>[];
  if (zeilen.length === 0) return { offen: false, meldung: null };

  const { data: haus } = await admin.from("designers")
    .select("brand_name, brand_dna").eq("id", auftrag.designer_id as string).maybeSingle();
  const signale = ((haus?.brand_dna as { signals?: unknown })?.signals);
  const kontextBasis: DeutungsKontext = {
    haus_name: (haus?.brand_name as string) ?? null,
    bekannte_worte: Array.isArray(signale) ? (signale as string[]).slice(0, 12) : [],
  };

  const alsRoh = (z: Record<string, unknown>): KandidatRoh => ({
    quell_id: z.schluessel as string,
    quell_url: (z.quell_url as string) ?? null,
    titel: (z.titel as string) ?? "",
    beschreibung_html: null,
    beschreibung_text: (z.beschreibung_text as string) ?? null,
    preis_cent: (z.preis_cent as number) ?? null,
    waehrung: null, bilder: [],
    varianten: (z.varianten as KandidatRoh["varianten"]) ?? [],
    kategorien: ((z.roh as { kategorien?: string[] })?.kategorien) ?? [],
    verfuegbar: null,
  });

  const buendel = buendeln(zeilen).slice(0, BUENDEL_JE_LAUF);
  let ueberText: string | null = null;
  for (const b of buendel) {
    if (!(await buchen(admin, auftragId, "ki_aufrufe"))) break;
    const rohe = b.map(alsRoh);
    const erstesBuendel = !auftrag.befund || !(auftrag.befund as Record<string, unknown>).ueber_text;
    const antwort = await claude(apiKey, systemPrompt(),
      nutzerPrompt(rohe, { ...kontextBasis, ueber_text_gewuenscht: erstesBuendel }));
    if (!antwort) {
      // Kein Ergebnis: die Werke bleiben stehen, ohne Deutung. Nicht verloren.
      await admin.from("rochade_kandidaten").update({
        status: "gedeutet", fehler: "Die Einordnung kam nicht zurück — bitte Welt und Felder selbst setzen.",
      }).in("id", b.map((z) => z.id as string));
      continue;
    }
    const gelesen = deutungLesen(antwort, rohe);
    if (gelesen.ueber_text && !ueberText) ueberText = gelesen.ueber_text;

    const nachSchluessel = new Map(b.map((z) => [z.schluessel as string, z.id as string]));
    for (const d of gelesen.deutungen) {
      const id = nachSchluessel.get(d.schluessel);
      if (!id) continue;
      await admin.from("rochade_kandidaten").update({
        welt: d.welt, angebotstyp: d.angebotstyp, welt_felder: d.welt_felder,
        deutung: { beschreibung: d.beschreibung, wort_dna: d.wort_dna, verworfen: d.verworfen },
        status: "gedeutet",
      }).eq("id", id);
    }
    // Alles, was das Modell übergangen hat, bleibt nicht ewig „neu" stehen.
    const gedeutet = new Set(gelesen.deutungen.map((d) => d.schluessel));
    const uebergangen = b.filter((z) => !gedeutet.has(z.schluessel as string)).map((z) => z.id as string);
    if (uebergangen.length) {
      await admin.from("rochade_kandidaten").update({
        status: "gedeutet", fehler: "Ohne Einordnung — bitte Welt selbst wählen.",
      }).in("id", uebergangen);
    }
  }

  if (ueberText) {
    await admin.from("rochade_auftraege").update({
      befund: { ...(auftrag.befund as Record<string, unknown> ?? {}), ueber_text: ueberText },
    }).eq("id", auftragId);
  }

  const { count } = await admin.from("rochade_kandidaten")
    .select("id", { count: "exact", head: true })
    .eq("auftrag_id", auftragId).eq("status", "neu");
  return { offen: (count ?? 0) > 0, meldung: null };
}

/* ------------------------------------------------------------ Übernehmen */

async function uebernehmen(
  admin: SupabaseClient, auftrag: Record<string, unknown>,
): Promise<{ werke: number; ohne_preis: number }> {
  const auftragId = auftrag.id as string;
  const designerId = auftrag.designer_id as string;
  const { data: haus } = await admin.from("designers")
    .select("brand_name").eq("id", designerId).maybeSingle();
  const markenName = (haus?.brand_name as string) ?? "haus";

  const { data: gewaehlte } = await admin.from("rochade_kandidaten")
    .select("*").eq("auftrag_id", auftragId).eq("gewaehlt", true)
    .neq("status", "uebernommen").order("sortierung");
  const liste = (gewaehlte ?? []) as Record<string, unknown>[];

  let werke = 0;
  let ohnePreis = 0;
  for (const k of liste) {
    const { data: bilder } = await admin.from("rochade_bilder")
      .select("pfad, reihenfolge").eq("kandidat_id", k.id as string).eq("status", "fertig")
      .order("reihenfolge");
    const pfade = ((bilder ?? []) as { pfad: string | null }[]).map((b) => b.pfad).filter(Boolean) as string[];

    const welt = (k.welt as string) ?? "Kunst";
    const deutung = (k.deutung as { beschreibung?: string }) ?? {};
    const felder = (k.welt_felder as Record<string, string>) ?? {};
    const preis = (k.preis_cent as number | null);
    if (preis === null) ohnePreis++;

    const name = ((k.titel as string) ?? "").trim() || "Ohne Titel";
    const beschreibung = [deutung.beschreibung ?? k.beschreibung_text ?? null,
      ...Object.entries(felder).map(([f, w]) => `${f}: ${w}`)].filter(Boolean).join("\n\n") || null;

    // Ohne Preis geht kein Werk live — es wird angelegt, aber als Entwurf.
    const { data: produkt, error } = await admin.from("products").insert({
      designer_id: designerId,
      name,
      slug: `${slugify(markenName)}-${slugify(name)}-${Date.now().toString(36)}${werke}`,
      price: preis === null ? 0 : preis / 100,
      world: welt,
      description: beschreibung,
      image_url: pfade[0] ?? null,
      status: preis === null ? "draft" : "published",
      inventory_mode: "made_to_order",
      stock_quantity: 0,
      product_dna: {
        ...(welt === "Kunst" && k.angebotstyp ? { kind: k.angebotstyp as string } : {}),
        ...felder,
        rochade: { auftrag_id: auftragId, quelle: k.quell_url ?? null },
      },
    }).select("id").single();
    if (error || !produkt) {
      await admin.from("rochade_kandidaten").update({
        status: "fehler", fehler: "Dieses Werk ließ sich nicht anlegen. Die übrigen sind da.",
      }).eq("id", k.id as string);
      continue;
    }

    // Die weiteren Bilder in die Mediathek. Die Reihenfolge der Quelle steckt
    // im Namen der Notiz, weil media_assets keine eigene Sortierspalte hat.
    if (pfade.length > 1) {
      await admin.from("media_assets").insert(pfade.slice(1).map((p, i) => ({
        designer_id: designerId, product_id: produkt.id as string,
        url: p, kind: "bild" as const, origin: "upload" as const,
        note: `Aus der Rochade übernommen (${i + 2}. Bild)`,
      })));
    }

    await admin.from("rochade_kandidaten")
      .update({ status: "uebernommen", product_id: produkt.id as string, fehler: null })
      .eq("id", k.id as string);
    werke++;
  }

  await admin.from("rochade_auftraege")
    .update({ status: "uebernommen", phase: "fertig", letzter_schritt_at: new Date().toISOString() })
    .eq("id", auftragId);
  return { werke, ohne_preis: ohnePreis };
}

/** Die ganze Übernahme rückgängig: die angelegten Werke verschwinden wieder. */
async function zuruecknehmen(admin: SupabaseClient, auftragId: string): Promise<number> {
  const { data: uebernommene } = await admin.from("rochade_kandidaten")
    .select("id, product_id").eq("auftrag_id", auftragId).eq("status", "uebernommen");
  const liste = (uebernommene ?? []) as { id: string; product_id: string | null }[];
  const produkte = liste.map((k) => k.product_id).filter(Boolean) as string[];
  if (produkte.length) {
    await admin.from("media_assets").delete().in("product_id", produkte);
    await admin.from("products").delete().in("id", produkte);
  }
  await admin.from("rochade_kandidaten")
    .update({ status: "gedeutet", product_id: null }).eq("auftrag_id", auftragId);
  await admin.from("rochade_auftraege")
    .update({ status: "zurueckgenommen", phase: "lichttisch" }).eq("id", auftragId);
  return produkte.length;
}

/* ----------------------------------------------------------------- Server */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  let koerper: Record<string, unknown> = {};
  try { koerper = await req.json(); } catch { /* leerer Körper ist auch eine Antwort wert */ }
  const aktion = String(koerper.aktion ?? "stand");
  const intern = req.headers.get("x-rochade-intern") === "1";

  try {
    /* ---- starten: braucht immer eine eingeloggte Inhaberin ---- */
    if (aktion === "starten") {
      const uid = jwtSub(req.headers.get("Authorization"));
      if (!uid) return json({ ok: false, meldung: "Bitte melde dich an, bevor du deine Seite holst." });
      if (koerper.einwilligung !== true) {
        return json({ ok: false, meldung: "Ohne deine Bestätigung, dass die Seite dir gehört, holen wir nichts." });
      }
      const { data: haus } = await admin.from("designers")
        .select("id, brand_name").eq("user_id", uid).maybeSingle();
      if (!haus) return json({ ok: false, meldung: "Zu diesem Zugang gehört noch kein Haus." });

      const roh = String(koerper.url ?? "").trim();
      const start = await sicherAbrufen(roh.startsWith("http") ? roh : `https://${roh}`, { art: "html" });
      if (!start.ok) {
        return json({ ok: false, meldung: start.grund ? FEHLER_SATZ[start.grund] : "Diese Adresse hat nicht geantwortet." });
      }
      const url = new URL(start.url ?? roh);

      // Läuft schon eine Rochade für diese Quelle? Dann die nehmen, keine zweite.
      const { data: schon } = await admin.from("rochade_auftraege")
        .select("id").eq("designer_id", haus.id).eq("quell_host", url.hostname)
        .in("status", ["neu", "laeuft"]).maybeSingle();
      if (schon) return json({ ok: true, auftrag_id: schon.id, meldung: "Für diese Seite läuft schon ein Import." });

      // Plattform erkennen: erst am HTML, dann am Produkt-Endpunkt.
      let plattform = erkennePlattform({ html: start.text ?? "" });
      if (plattform === "unbekannt") {
        const probe = await sicherAbrufen(`${url.origin}/products.json?limit=1`, { art: "json" });
        if (probe.ok) plattform = erkennePlattform({ shopifyProductsJson: true });
      }

      const { data: auftrag, error } = await admin.from("rochade_auftraege").insert({
        designer_id: haus.id, user_id: uid,
        quell_url: url.toString(), quell_host: url.hostname, plattform,
        status: "laeuft", phase: "sammeln",
        einwilligung_at: new Date().toISOString(),
        einwilligung_quelle: String(koerper.einwilligung_quelle ?? "studio"),
        einwilligung_user: uid,
      }).select("id").single();
      if (error || !auftrag) return json({ ok: false, meldung: "Der Import ließ sich nicht anlegen. Bitte noch einmal versuchen." });

      const endpunkt = produktEndpunkt(plattform, url.origin, 1);
      await einreihen(admin, auftrag.id as string, [
        { u: `${url.origin}/sitemap.xml`, art: "sitemap" },
        ...(endpunkt ? [{ u: endpunkt, art: "api" }] : []),
        { u: url.toString(), art: "start" },
      ]);
      weiterMachen(auftrag.id as string, "weiter");
      return json({
        ok: true, auftrag_id: auftrag.id, plattform,
        meldung: plattform === "unbekannt"
          ? "Wir sehen uns die Seite an. Bei unbekannten Systemen dauert es etwas länger."
          : `Erkannt: ${plattform}. Wir holen die Werke.`,
      });
    }

    /* ---- alle übrigen Aktionen brauchen einen Auftrag ---- */
    const auftragId = String(koerper.auftrag_id ?? "");
    if (!auftragId) return json({ ok: false, meldung: "Ohne Auftrag geht hier nichts." });
    const { data: auftrag } = await admin.from("rochade_auftraege")
      .select("*").eq("id", auftragId).maybeSingle();
    if (!auftrag) return json({ ok: false, meldung: "Diesen Import gibt es nicht mehr." });

    // Von außen darf nur die Inhaberin (oder ein Admin) an ihren eigenen Auftrag.
    if (!intern) {
      const uid = jwtSub(req.headers.get("Authorization"));
      if (!uid) return json({ ok: false, meldung: "Bitte melde dich an." });
      if (auftrag.user_id !== uid) {
        const { data: istAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
        if (istAdmin !== true) return json({ ok: false, meldung: "Dieser Import gehört einem anderen Haus." });
      }
    }

    if (aktion === "stand") {
      const { data } = await admin.rpc("rochade_stand", { p_auftrag: auftragId });
      return json({ ok: true, stand: data });
    }

    if (aktion === "weiter") {
      const seiten = await seitenHaeppchen(admin, auftrag);
      const bilder = await bilderHaeppchen(admin, auftrag);
      await admin.from("rochade_auftraege")
        .update({ letzter_schritt_at: new Date().toISOString(), phase: seiten.offen ? "sammeln" : "bilder" })
        .eq("id", auftragId);

      if (seiten.offen || bilder.offen) {
        weiterMachen(auftragId, "weiter");
        return json({ ok: true, weiter: true, gefunden: seiten.gefunden });
      }
      // Gesammelt ist gesammelt — jetzt einordnen.
      await admin.from("rochade_auftraege").update({ phase: "deuten" }).eq("id", auftragId);
      weiterMachen(auftragId, "deuten");
      return json({ ok: true, weiter: false, gefunden: seiten.gefunden });
    }

    if (aktion === "deuten") {
      const erg = await deutenHaeppchen(admin, auftrag);
      if (erg.offen) {
        weiterMachen(auftragId, "deuten");
        return json({ ok: true, weiter: true });
      }
      await admin.from("rochade_auftraege").update({
        status: "fertig", phase: "lichttisch", meldung: erg.meldung,
        letzter_schritt_at: new Date().toISOString(),
      }).eq("id", auftragId);
      return json({ ok: true, weiter: false, meldung: erg.meldung });
    }

    if (aktion === "uebernehmen") {
      if (intern) return json({ ok: false, meldung: "Übernehmen ist immer ein Zug der Inhaberin." });
      const erg = await uebernehmen(admin, auftrag);
      return json({
        ok: true, ...erg,
        meldung: erg.ohne_preis
          ? `${erg.werke} Werke übernommen. ${erg.ohne_preis} davon haben noch keinen Preis und stehen als Entwurf.`
          : `${erg.werke} Werke übernommen.`,
      });
    }

    if (aktion === "zuruecknehmen") {
      if (intern) return json({ ok: false, meldung: "Zurücknehmen ist immer ein Zug der Inhaberin." });
      const weg = await zuruecknehmen(admin, auftragId);
      return json({ ok: true, entfernt: weg, meldung: `${weg} Werke wieder entfernt. Der Lichttisch steht wieder.` });
    }

    return json({ ok: false, meldung: `Unbekannte Aktion: ${aktion}` });
  } catch (e) {
    // Fehler landen nie als 500, immer als 200 mit Klartext.
    return json({ ok: false, meldung: `Da ist etwas schiefgegangen: ${(e as Error).message}` });
  }
});
