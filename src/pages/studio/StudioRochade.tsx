/**
 * DIE LANGE ROCHADE — der Lichttisch (Schritt 6) und das Übernehmen (Schritt 7).
 *
 * Hier sieht ein Haus, was von seiner alten Seite geholt wurde: ein Raster aus
 * Bildern, alle vorausgewählt. Abwählen ist ein Tipp. Dann ein einziger Zug:
 * „Übernehmen". Erst dieser Zug macht aus Fundstücken Werke.
 *
 * Zwei Haltungen, die den ganzen Bildschirm bestimmen:
 *   · Fehlendes wird benannt, nicht kaschiert. „Kein Preis gefunden" steht da,
 *     wo ein Preis stünde — es wird keiner erfunden.
 *   · Der Import läuft im Hintergrund weiter. Wer die Seite verlässt und
 *     wiederkommt, findet den Stand vor, nicht einen Neuanfang.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnLoading } from "@/components/pawn/PawnLoading";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { MediaImg } from "@/components/palace/MediaImg";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, RotateCcw } from "lucide-react";

type Welt = "Mode" | "Interior" | "Kunst";

interface Auftrag {
  id: string;
  quell_url: string;
  quell_host: string;
  plattform: string;
  status: string;
  phase: string;
  meldung: string | null;
  kontingent_erreicht: string | null;
  befund: { ueber_text?: string } | null;
}

interface Stand {
  status: string; phase: string; plattform: string;
  kontingent_erreicht: string | null; meldung: string | null;
  seiten_offen: number; seiten_fertig: number; seiten_fehler: number;
  werke: number; werke_gewaehlt: number; werke_ohne_preis: number;
  bilder_offen: number; bilder_fertig: number; bilder_fehler: number;
}

interface Kandidat {
  id: string;
  titel: string | null;
  preis_cent: number | null;
  waehrung: string | null;
  welt: Welt | null;
  angebotstyp: string | null;
  welt_felder: Record<string, string> | null;
  deutung: { beschreibung?: string; wort_dna?: string[]; verworfen?: string[] } | null;
  gewaehlt: boolean;
  status: string;
  quell_url: string | null;
  fehler: string | null;
  bild: string | null;
}

const PHASE_SATZ: Record<string, string> = {
  erkennen: "Wir sehen uns die Seite an.",
  sammeln: "Wir gehen die Seiten durch.",
  bilder: "Wir holen die Bilder.",
  deuten: "Wir ordnen die Funde ein.",
  lichttisch: "Alles da. Du hast die Wahl.",
  uebernehmen: "Wir legen die Werke an.",
  fertig: "Übernommen.",
};

const WELT_LABEL: Record<Welt, string> = { Mode: "Mode", Interior: "Interior", Kunst: "Kunst" };

function preisText(cent: number | null, waehrung: string | null): string {
  if (cent === null) return "Kein Preis gefunden";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: waehrung ?? "EUR" }).format(cent / 100);
}

export default function StudioRochade() {
  const { designer, loading } = useMyDesigner();
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [stand, setStand] = useState<Stand | null>(null);
  const [kandidaten, setKandidaten] = useState<Kandidat[]>([]);
  const [adresse, setAdresse] = useState("");
  const [einwilligung, setEinwilligung] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"alle" | "ohne_preis" | Welt>("alle");
  const takt = useRef<number | null>(null);

  /* ------------------------------------------------ Stand und Funde laden */

  const ladeAuftrag = useCallback(async () => {
    if (!designer) return;
    const { data } = await supabase.from("rochade_auftraege")
      .select("id, quell_url, quell_host, plattform, status, phase, meldung, kontingent_erreicht, befund")
      .eq("designer_id", designer.id)
      .not("status", "in", "(uebernommen,abgebrochen)")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    setAuftrag((data as Auftrag | null) ?? null);
  }, [designer]);

  const ladeStand = useCallback(async (id: string) => {
    const { data } = await supabase.rpc("rochade_stand", { p_auftrag: id });
    if (data) setStand(data as unknown as Stand);
  }, []);

  const ladeKandidaten = useCallback(async (id: string) => {
    const { data } = await supabase.from("rochade_kandidaten")
      .select("id, titel, preis_cent, waehrung, welt, angebotstyp, welt_felder, deutung, gewaehlt, status, quell_url, fehler, rochade_bilder(pfad, reihenfolge, status)")
      .eq("auftrag_id", id).order("sortierung");
    const zeilen = (data ?? []) as unknown as (Kandidat & {
      rochade_bilder: { pfad: string | null; reihenfolge: number; status: string }[];
    })[];
    setKandidaten(zeilen.map((z) => ({
      ...z,
      bild: (z.rochade_bilder ?? [])
        .filter((b) => b.status === "fertig" && b.pfad)
        .sort((a, b) => a.reihenfolge - b.reihenfolge)[0]?.pfad ?? null,
    })));
  }, []);

  useEffect(() => { void ladeAuftrag(); }, [ladeAuftrag]);

  // Solange gesammelt wird, alle sechs Sekunden nachsehen. Steht der Lichttisch,
  // hört das Nachsehen auf — kein Takt ohne Grund.
  useEffect(() => {
    if (!auftrag) return;
    void ladeStand(auftrag.id);
    void ladeKandidaten(auftrag.id);
    const laeuft = auftrag.status === "neu" || auftrag.status === "laeuft";
    if (!laeuft) return;
    takt.current = window.setInterval(() => {
      void ladeStand(auftrag.id);
      void ladeKandidaten(auftrag.id);
      void ladeAuftrag();
    }, 6000);
    return () => { if (takt.current) window.clearInterval(takt.current); };
  }, [auftrag, ladeStand, ladeKandidaten, ladeAuftrag]);

  /* ------------------------------------------------------------- Aktionen */

  const rufe = async (aktion: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("rochade-import", {
      body: { aktion, ...extra },
    });
    if (error) return { ok: false, meldung: "Das hat gerade nicht geklappt. Bitte noch einmal versuchen." };
    return data as { ok: boolean; meldung?: string; auftrag_id?: string; werke?: number; entfernt?: number };
  };

  const starten = async () => {
    if (!adresse.trim()) { toast.error("Bitte gib die Adresse deiner Seite ein."); return; }
    if (!einwilligung) { toast.error("Bitte bestätige, dass die Seite dir gehört."); return; }
    setBusy(true);
    const erg = await rufe("starten", { url: adresse.trim(), einwilligung: true, einwilligung_quelle: "studio" });
    setBusy(false);
    if (!erg.ok) { toast.error(erg.meldung ?? "Das hat nicht geklappt."); return; }
    toast.success(erg.meldung ?? "Wir holen deine Seite.");
    await ladeAuftrag();
  };

  const umschalten = async (k: Kandidat) => {
    setKandidaten((alt) => alt.map((x) => x.id === k.id ? { ...x, gewaehlt: !x.gewaehlt } : x));
    const { error } = await supabase.from("rochade_kandidaten")
      .update({ gewaehlt: !k.gewaehlt }).eq("id", k.id);
    if (error) {
      setKandidaten((alt) => alt.map((x) => x.id === k.id ? { ...x, gewaehlt: k.gewaehlt } : x));
      toast.error("Diese Auswahl ließ sich nicht speichern.");
    }
  };

  const alleSetzen = async (wert: boolean, nur?: (k: Kandidat) => boolean) => {
    const betroffen = kandidaten.filter((k) => (nur ? nur(k) : true) && k.gewaehlt !== wert);
    if (!betroffen.length) return;
    setKandidaten((alt) => alt.map((x) => betroffen.some((b) => b.id === x.id) ? { ...x, gewaehlt: wert } : x));
    await supabase.from("rochade_kandidaten").update({ gewaehlt: wert })
      .in("id", betroffen.map((b) => b.id));
  };

  const uebernehmen = async () => {
    if (!auftrag) return;
    setBusy(true);
    const erg = await rufe("uebernehmen", { auftrag_id: auftrag.id });
    setBusy(false);
    if (!erg.ok) { toast.error(erg.meldung ?? "Das hat nicht geklappt."); return; }
    toast.success(erg.meldung ?? "Übernommen.");
    await ladeAuftrag();
    await ladeKandidaten(auftrag.id);
  };

  const zuruecknehmen = async () => {
    if (!auftrag) return;
    setBusy(true);
    const erg = await rufe("zuruecknehmen", { auftrag_id: auftrag.id });
    setBusy(false);
    toast[erg.ok ? "success" : "error"](erg.meldung ?? "");
    await ladeAuftrag();
    await ladeKandidaten(auftrag.id);
  };

  /* -------------------------------------------------------------- Ansicht */

  const sichtbar = useMemo(() => {
    if (filter === "alle") return kandidaten;
    if (filter === "ohne_preis") return kandidaten.filter((k) => k.preis_cent === null);
    return kandidaten.filter((k) => k.welt === filter);
  }, [kandidaten, filter]);

  const gewaehlt = kandidaten.filter((k) => k.gewaehlt).length;
  const ohnePreisGewaehlt = kandidaten.filter((k) => k.gewaehlt && k.preis_cent === null).length;
  const laeuft = auftrag?.status === "neu" || auftrag?.status === "laeuft";
  const amLichttisch = auftrag?.status === "fertig" || auftrag?.status === "zurueckgenommen";

  // Höchstens drei Verfeinerungen, und nur solche, die etwas ändern.
  const filterReihen = useMemo(() => {
    const reihen: { schluessel: typeof filter; label: string; anzahl: number }[] = [
      { schluessel: "alle", label: "Alle", anzahl: kandidaten.length },
    ];
    for (const w of ["Mode", "Interior", "Kunst"] as Welt[]) {
      const n = kandidaten.filter((k) => k.welt === w).length;
      if (n > 0 && n < kandidaten.length) reihen.push({ schluessel: w, label: WELT_LABEL[w], anzahl: n });
    }
    const ohne = kandidaten.filter((k) => k.preis_cent === null).length;
    if (ohne > 0) reihen.push({ schluessel: "ohne_preis", label: "Ohne Preis", anzahl: ohne });
    return reihen.slice(0, 4);
  }, [kandidaten]);

  if (loading) return <StudioShell title="Rochade"><PawnLoading /></StudioShell>;
  if (!designer) {
    return <StudioShell title="Rochade">
      <p className="text-muted-foreground">Zu diesem Zugang gehört noch kein Haus.</p>
    </StudioShell>;
  }

  /* --- Kein Auftrag: das Formular --- */
  if (!auftrag) {
    return (
      <StudioShell title="Rochade" eyebrow="Deine bestehende Seite">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Du hast schon eine Seite? Dann tipp sie nicht ab. Wir sehen sie uns an, holen deine
          Werke und legen sie dir zur Auswahl vor. Nichts geht live, bevor du es gewählt hast.
        </p>
        <div className="mt-8 max-w-xl border border-border bg-white p-5">
          <label className="block text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
            Adresse deiner Seite
          </label>
          <input
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="atelier-beispiel.de"
            className="mt-2 w-full border border-border px-3 py-2.5 text-sm focus:border-foreground focus:outline-none"
          />
          <label className="mt-5 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={einwilligung} onChange={(e) => setEinwilligung(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-black" />
            <span>
              Diese Seite gehört mir, und ich darf ihre Inhalte hierher übertragen.
              <span className="mt-1 block text-xs text-muted-foreground">
                Wir merken uns, wann und von wem diese Bestätigung kam.
              </span>
            </span>
          </label>
          <button onClick={starten} disabled={busy}
            className="mt-6 w-full border border-foreground px-5 py-3 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background disabled:opacity-40">
            {busy ? "Wir sehen nach …" : "Seite holen"}
          </button>
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell title="Rochade" eyebrow={auftrag.quell_host}>
      {/* ---- Der Stand, immer ehrlich ---- */}
      <div className="border border-border bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-serif text-xl">{PHASE_SATZ[auftrag.phase] ?? "Wir arbeiten."}</p>
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
            {auftrag.plattform === "unbekannt" ? "System unbekannt" : auftrag.plattform}
          </p>
        </div>
        {stand && (
          <p className="mt-3 text-sm text-muted-foreground">
            {stand.werke} Werke gefunden
            {stand.bilder_fertig > 0 ? `, ${stand.bilder_fertig} Bilder geholt` : ""}
            {stand.seiten_offen > 0 ? `, ${stand.seiten_offen} Seiten noch offen` : ""}
            {stand.seiten_fehler > 0 ? ` · ${stand.seiten_fehler} Seiten haben nicht geantwortet` : ""}
            {stand.bilder_fehler > 0 ? ` · ${stand.bilder_fehler} Bilder ließen sich nicht laden` : ""}
          </p>
        )}
        {auftrag.kontingent_erreicht && (
          <p className="mt-3 border-l-2 border-foreground pl-3 text-sm">
            Wir haben hier aufgehört: die Grenze für {auftrag.kontingent_erreicht} war erreicht.
            Was bis dahin da ist, steht vollständig unten — nichts wurde still weggelassen.
          </p>
        )}
        {auftrag.meldung && <p className="mt-3 text-sm">{auftrag.meldung}</p>}
        {laeuft && (
          <p className="mt-3 text-xs text-muted-foreground">
            Das läuft im Hintergrund weiter. Du kannst die Seite schließen und später wiederkommen.
          </p>
        )}
      </div>

      {auftrag.befund?.ueber_text && (
        <div className="mt-5 border border-border bg-white p-5">
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">Vorschlag für deinen Über-Text</p>
          <p className="mt-2 max-w-2xl text-sm">{auftrag.befund.ueber_text}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Beim Übernehmen kannst du ihn auf deiner Doppelseite einsetzen — oder liegen lassen.
          </p>
        </div>
      )}

      {/* ---- Der Lichttisch ---- */}
      {kandidaten.length === 0 ? (
        <PawnEmptyState
          className="mt-10"
          title={laeuft ? "Noch nichts gefunden — wir suchen weiter." : "Auf dieser Seite war nichts, was sich als Werk lesen ließ."}
          action={!laeuft ? (
            <Link to="/studio/werke/neu" className="inline-flex items-center border border-foreground px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
              Werk von Hand anlegen
            </Link>
          ) : undefined}
        />
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {filterReihen.map((f) => (
              <button key={String(f.schluessel)} onClick={() => setFilter(f.schluessel)}
                className={`border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] ${
                  filter === f.schluessel ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                }`}>
                {f.label} · {f.anzahl}
              </button>
            ))}
            <span className="ml-auto flex gap-2">
              <button onClick={() => void alleSetzen(true)}
                className="border border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground">
                Alle wählen
              </button>
              <button onClick={() => void alleSetzen(false)}
                className="border border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground">
                Alle abwählen
              </button>
              {kandidaten.some((k) => k.preis_cent === null) && (
                <button onClick={() => void alleSetzen(false, (k) => k.preis_cent === null)}
                  className="border border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground">
                  Ohne Preis abwählen
                </button>
              )}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sichtbar.map((k) => (
              <button key={k.id} onClick={() => void umschalten(k)} type="button"
                className={`group border text-left transition-colors ${
                  k.gewaehlt ? "border-foreground bg-white" : "border-border bg-white opacity-45"
                }`}>
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-white">
                  {k.bild ? (
                    <MediaImg src={k.bild} alt={k.titel ?? ""} loading="lazy"
                      className="h-full w-full object-cover object-center" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                      Kein Bild gefunden
                    </span>
                  )}
                  <span className={`absolute left-3 top-3 flex h-6 w-6 items-center justify-center border ${
                    k.gewaehlt ? "border-foreground bg-foreground text-background" : "border-border bg-white"
                  }`}>
                    {k.gewaehlt && <Check className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <div className="border-t border-border p-3">
                  <p className="line-clamp-2 text-sm">{k.titel?.trim() || "Ohne Titel"}</p>
                  <p className={`mt-1 text-xs ${k.preis_cent === null ? "text-muted-foreground" : ""}`}>
                    {preisText(k.preis_cent, k.waehrung)}
                  </p>
                  <p className="mt-1 text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
                    {k.welt ? WELT_LABEL[k.welt] : "Welt offen"}
                    {k.angebotstyp ? ` · ${k.angebotstyp}` : ""}
                  </p>
                  {k.welt_felder && Object.keys(k.welt_felder).length > 0 && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {Object.entries(k.welt_felder).map(([f, w]) => `${f}: ${w}`).join(" · ")}
                    </p>
                  )}
                  {k.fehler && <p className="mt-1 text-xs text-muted-foreground">{k.fehler}</p>}
                  {k.status === "uebernommen" && (
                    <p className="mt-1 text-[0.62rem] uppercase tracking-[0.2em]">Übernommen</p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* ---- Ein Zug ---- */}
          {(amLichttisch || laeuft) && (
            <div className="sticky bottom-4 mt-8 border border-foreground bg-white p-4 shadow-[6px_6px_0_#000]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm">
                    <strong>{gewaehlt}</strong> von {kandidaten.length} gewählt
                    {ohnePreisGewaehlt > 0 && (
                      <span className="text-muted-foreground">
                        {" "}· {ohnePreisGewaehlt} davon ohne Preis
                      </span>
                    )}
                  </p>
                  {ohnePreisGewaehlt > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Werke ohne Preis werden als Entwurf angelegt. Sie gehen erst live,
                      wenn du einen Preis gesetzt hast — in einem Zug für alle.
                    </p>
                  )}
                  {laeuft && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Es kommen noch welche dazu. Du kannst warten oder schon übernehmen.
                    </p>
                  )}
                </div>
                <button onClick={uebernehmen} disabled={busy || gewaehlt === 0}
                  className="border border-foreground bg-foreground px-6 py-3 text-[0.65rem] uppercase tracking-[0.28em] text-background hover:bg-background hover:text-foreground disabled:opacity-40">
                  {busy ? "Wir legen an …" : `${gewaehlt} Werke übernehmen`}
                </button>
              </div>
            </div>
          )}

          {auftrag.status === "uebernommen" && (
            <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-4 border border-foreground bg-white p-4">
              <p className="text-sm">Übernommen. Die Werke stehen jetzt auf deiner Wand.</p>
              <span className="flex gap-2">
                <button onClick={zuruecknehmen} disabled={busy}
                  className="flex items-center gap-2 border border-border px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.2em] hover:border-foreground disabled:opacity-40">
                  <RotateCcw className="h-3.5 w-3.5" /> Alles zurücknehmen
                </button>
                <Link to="/studio/werke"
                  className="border border-foreground bg-foreground px-5 py-2.5 text-[0.62rem] uppercase tracking-[0.2em] text-background hover:bg-background hover:text-foreground">
                  Zur Wand
                </Link>
              </span>
            </div>
          )}
        </>
      )}
    </StudioShell>
  );
}
