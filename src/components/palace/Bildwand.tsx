/**
 * Teil U1.3 — die Bildwand.
 *
 * Vorher stand hier eine Liste: „🖼 a3f91c2e". Eine Künstlerin hat ihr Foto aus
 * Zeichenketten gesucht. Jetzt ist es eine Wand aus Miniaturen — quadratisch
 * beschnitten, neueste zuerst, Video mit kleinem Zeichen in der Ecke. Antippen
 * wählt aus, sofort sichtbar.
 *
 * Eine Komponente für beide Orte: das alte Formular in `StudioHausseite.tsx` und
 * den Auftritt-Modus auf der echten Hausseite.
 *
 * Farben: nur `--house-fg` / `--house-bg` mit Rückfall auf Schwarz/Weiß. Im Studio
 * (ohne Haus-Thema) ist das exakt die alte Schwarz-Weiß-Sprache; auf einer Hausseite
 * mit eigener Farbwelt fügt sich die Wand ein, statt eine fremde Farbe mitzubringen.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MediaImg } from "@/components/palace/MediaImg";
import type { BlockMediaLite } from "@/components/palace/HausseiteBlocks";

const MAX_BILD_MB = 15;
const MAX_VIDEO_MB = 200;

function artVon(file: File): "bild" | "video" | null {
  if (file.type.startsWith("image/")) return "bild";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

interface BildwandProps {
  designerId: string;
  medien: BlockMediaLite[];
  /** Einzelwahl: die gewählte id. Mehrfachwahl: alle gewählten ids. */
  gewaehlt?: string | string[] | null;
  mehrfach?: boolean;
  nurArt?: "bild" | "video";
  onWahl: (id: string) => void;
  /** Nach einem Upload: das Elternteil lädt seine Medienliste neu. */
  onNeu?: () => void;
  /** Im Blatt trägt schon die Kopfzeile den Titel — dann hier keinen zweiten. */
  ohneTitel?: boolean;
  className?: string;
}

export function Bildwand({
  designerId, medien, gewaehlt, mehrfach = false, nurArt, onWahl, onNeu, ohneTitel, className,
}: BildwandProps) {
  const { user } = useAuth();
  const [laedt, setLaedt] = useState(false);
  const dateiRef = useRef<HTMLInputElement>(null);
  const liste = nurArt ? medien.filter((m) => m.kind === nurArt) : medien;
  const istGewaehlt = (id: string) =>
    Array.isArray(gewaehlt) ? gewaehlt.includes(id) : gewaehlt === id;

  const hochladen = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setLaedt(true);
    let fertig = 0;
    for (const file of Array.from(files).slice(0, 10)) {
      const art = artVon(file);
      if (!art) { toast.error(`${file.name}: kein Bild und kein Video.`); continue; }
      const maxMb = art === "bild" ? MAX_BILD_MB : MAX_VIDEO_MB;
      if (file.size > maxMb * 1024 * 1024) { toast.error(`${file.name}: größer als ${maxMb} MB.`); continue; }
      try {
        const ext = file.name.split(".").pop() || (art === "bild" ? "jpg" : "mp4");
        const pfad = `${user.id}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
        const { error: upFehler } = await supabase.storage.from("mediathek").upload(pfad, file);
        if (upFehler) throw upFehler;
        const { data: signiert, error: sigFehler } =
          await supabase.storage.from("mediathek").createSignedUrl(pfad, 60 * 60 * 24 * 365);
        if (sigFehler || !signiert) throw sigFehler ?? new Error("Signieren fehlgeschlagen");
        const { error: insFehler } = await supabase.from("media_assets" as never).insert({
          designer_id: designerId, kind: art, origin: "upload", url: signiert.signedUrl,
          title: file.name.replace(/\.[^.]+$/, ""),
        } as never);
        if (insFehler) throw insFehler;
        fertig++;
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
    }
    setLaedt(false);
    if (dateiRef.current) dateiRef.current.value = "";
    if (fertig > 0) { toast.success(fertig === 1 ? "Ein Bild ist eingezogen." : `${fertig} Bilder sind eingezogen.`); onNeu?.(); }
  };

  const rahmen = { borderColor: "var(--house-fg, #000)", color: "var(--house-fg, #000)", background: "var(--house-bg, #fff)" };

  return (
    <div className={className} style={{ color: "var(--house-fg, #000)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="palace-eyebrow">{ohneTitel ? "" : mehrfach ? "Bilder wählen" : "Bild wählen"}</span>
        <button
          type="button"
          onClick={() => dateiRef.current?.click()}
          disabled={laedt}
          className="min-h-[36px] border-[1.5px] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] disabled:opacity-50"
          style={rahmen}
        >
          {laedt ? "Lädt …" : "Neues Bild hochladen"}
        </button>
        <input
          ref={dateiRef} type="file" accept="image/*,video/*" multiple className="hidden"
          onChange={(e) => void hochladen(e.target.files)}
        />
      </div>

      {liste.length === 0 ? (
        <div className="border-[1.5px] p-6 text-center" style={rahmen}>
          <p className="text-sm">Die Mediathek ist noch leer.</p>
          <p className="mt-2 text-sm opacity-70">Lade oben ein Bild hoch — oder lege zuerst in der Mediathek an, was dieses Haus zeigen soll.</p>
          <Link to="/studio/mediathek" className="palace-eyebrow mt-4 inline-block underline">Zur Mediathek</Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {liste.map((m) => {
            const aktiv = istGewaehlt(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onWahl(m.id)}
                aria-pressed={aktiv}
                aria-label={m.kind === "video" ? "Video wählen" : "Bild wählen"}
                className="relative block aspect-square w-full overflow-hidden border-[1.5px]"
                style={{ borderColor: aktiv ? "var(--house-fg, #000)" : "transparent", background: "var(--house-bg, #fff)" }}
              >
                {m.kind === "video" ? (
                  <video src={m.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  <MediaImg src={m.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
                {m.kind === "video" && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center text-[0.5rem] leading-none"
                    style={{ background: "var(--house-bg, #fff)", color: "var(--house-fg, #000)" }}
                  >
                    ▶
                  </span>
                )}
                {aktiv && (
                  <span aria-hidden className="absolute left-0 top-0 h-3 w-3" style={{ background: "var(--house-fg, #000)" }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Das Blatt, in dem die Wand erscheint: mobil von unten, ab Bildschirmbreite als
 * Fläche rechts. Bewegt wird ausschließlich `transform` und `opacity`.
 */
export function Bildblatt({ offen, onSchliessen, titel, children }: {
  offen: boolean; onSchliessen: () => void; titel: string; children: React.ReactNode;
}) {
  useEscape(offen, onSchliessen);
  if (!offen) return null;
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={titel}>
      <button
        type="button" aria-label="Schließen" onClick={onSchliessen}
        className="absolute inset-0 h-full w-full"
        style={{ background: "var(--house-fg, #000)", opacity: 0.25 }}
      />
      <div
        className="bildblatt absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto border-t-[1.5px] p-5 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:border-l-[1.5px] md:border-t-0"
        style={{ background: "var(--house-bg, #fff)", borderColor: "var(--house-fg, #000)", color: "var(--house-fg, #000)" }}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="palace-eyebrow">{titel}</p>
          <button
            type="button" onClick={onSchliessen}
            className="min-h-[36px] border-[1.5px] px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em]"
            style={{ borderColor: "var(--house-fg, #000)", background: "var(--house-bg, #fff)", color: "var(--house-fg, #000)" }}
          >
            Zurück
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Escape schließt — überall gleich, mit Tastatur allein bedienbar (U1-Abnahme 7). */
export function useEscape(aktiv: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!aktiv) return;
    const hoer = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onEscape(); } };
    window.addEventListener("keydown", hoer);
    return () => window.removeEventListener("keydown", hoer);
  }, [aktiv, onEscape]);
}
