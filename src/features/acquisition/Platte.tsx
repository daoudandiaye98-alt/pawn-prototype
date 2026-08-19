import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * PART 43 WP3 — „Die Platte". Die Einladung als Magazinseite: dunkel, ruhig, ein Objekt in der
 * Vitrine. Die Fotos sind die einzige Farbe — und selbst die laufen in Schwarzweiß, damit aus
 * ungleicher Bildqualität eine Handschrift wird. Alle Angaben stammen aus echten Daten; fehlt
 * eine Angabe, steht sie schlicht nicht da (Ehrlichkeitsgesetz).
 */

interface Props {
  handle: string;
  world: string | null;
  refCode: string;
  plateNumber: number | null;
  personalLine: string | null;
  images: string[];
  seatsTaken: number;
  seatsTotal: number;
  language: "de" | "en";
}

const COL = {
  grund: "#0A0A0B",
  panel: "#141416",
  schrift: "#F2F0EA",
  sekundaer: "#89857D",
  linie: "#26262A",
  akzent: "#A8BEB2",
};

const BILD_FILTER = "grayscale(1) contrast(1.06) brightness(.94)";
const LICHTKEGEL = "radial-gradient(120% 70% at 50% 0%, rgba(242,240,234,.16), transparent 62%)";

const TEXTE = {
  de: {
    ausgabe: "Ausgabe 01",
    platte: "Platte",
    kurator2: "Diese Seite ist nicht öffentlich. Sie existiert vorerst nur für dich.",
    fuenfzig: "Die Fünfzig",
    zaehler: (t: number, g: number) => `${t} von ${g} Plätzen vergeben`,
    zaehlerLeer: (g: number) => `${g} Plätze offen`,
    kond: [
      ["Einstieg", "kostenlos"],
      ["Dein Anteil", "93 % je Verkauf"],
      ["Antwort", "in 48 Stunden"],
    ],
    cta: "Dein Haus eröffnen",
    ausstieg: "Wenn es nicht passt, genügt ein Wort — dann bleibt es bei dieser Seite.",
  },
  en: {
    ausgabe: "Issue 01",
    platte: "Plate",
    kurator2: "This page is not public. For now it exists only for you.",
    fuenfzig: "The Fifty",
    zaehler: (t: number, g: number) => `${t} of ${g} seats taken`,
    zaehlerLeer: (g: number) => `${g} seats open`,
    kond: [
      ["Entry", "free"],
      ["Your share", "93 % per sale"],
      ["Reply", "within 48 hours"],
    ],
    cta: "Open your house",
    ausstieg: "If it does not fit, one word is enough — then this page is all there was.",
  },
} as const;

function useSchriften() {
  useEffect(() => {
    const href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500&display=swap";
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, []);
}

const DISPLAY = '"Fraunces", Georgia, serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SANS = 'Inter, system-ui, sans-serif';

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer, margin: 0 }}>
      {children}
    </p>
  );
}

function Vitrine({ src, alt, ratio, delay }: { src: string; alt: string; ratio: string; delay: number }) {
  return (
    <div style={{ position: "relative", background: COL.panel, aspectRatio: ratio, overflow: "hidden" }}>
      <img
        src={src}
        alt={alt}
        loading={delay === 0 ? "eager" : "lazy"}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: BILD_FILTER }}
        draggable={false}
      />
      <span aria-hidden style={{ position: "absolute", inset: 0, background: LICHTKEGEL, pointerEvents: "none" }} />
    </div>
  );
}

export function Platte({ handle, world, refCode, plateNumber, personalLine, images, seatsTaken, seatsTotal, language }: Props) {
  useSchriften();
  const [licht, setLicht] = useState(false);
  const [text, setText] = useState(false);
  const T = TEXTE[language];

  useEffect(() => {
    const reduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduziert) { setLicht(true); setText(true); return; }
    const a = window.setTimeout(() => setLicht(true), 120);
    const b = window.setTimeout(() => setText(true), 1500);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, []);

  const etikett = [
    plateNumber ? `${T.platte} ${plateNumber}` : null,
    world,
    refCode,
  ].filter(Boolean).join(" · ");

  const zaehler = seatsTaken > 0 ? T.zaehler(seatsTaken, seatsTotal) : T.zaehlerLeer(seatsTotal);
  const nebenbilder = images.slice(1, 3);
  const anstieg = (an: boolean, y = 18) => ({
    opacity: an ? 1 : 0,
    transform: an ? "translateY(0)" : `translateY(${y}px)`,
    transition: "opacity .9s var(--kurve-fein), transform .9s var(--kurve-fein)",
  });

  return (
    <div style={{ background: COL.grund, color: COL.schrift, minHeight: "100vh", fontFamily: SANS, fontWeight: 300 }}>
      <main style={{ margin: "0 auto", maxWidth: 760, padding: "24px 20px 72px" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 22 }}>
          <Etikett>♟ PAWN</Etikett>
          <Etikett>{T.ausgabe}</Etikett>
        </header>

        <section style={{ position: "relative", ...anstieg(licht, 0) }}>
          <Vitrine src={images[0]} alt={handle} ratio="3 / 4" delay={0} />
          <div
            aria-hidden
            style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${COL.grund} 99%)` }}
          />
          <h1
            style={{
              position: "absolute", left: 0, right: 0, bottom: 4, margin: 0, padding: "0 4px",
              fontFamily: DISPLAY, fontWeight: 400, fontSize: "clamp(40px,12.5vw,84px)", lineHeight: .9,
              letterSpacing: "-0.02em", color: COL.schrift, ...anstieg(text, 24),
            }}
          >
            {handle}
          </h1>
        </section>

        <div style={{ marginTop: 18, ...anstieg(text) }}>
          <Etikett>{etikett}</Etikett>
        </div>

        {personalLine && (
          <p style={{ marginTop: 22, fontSize: 17, lineHeight: 1.65, color: COL.schrift, ...anstieg(text) }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 46, lineHeight: .8, float: "left", marginRight: 10, marginTop: 4, color: COL.akzent }}>
              {personalLine.trim().charAt(0)}
            </span>
            {personalLine.trim().slice(1)}
          </p>
        )}
        <p style={{ marginTop: 18, fontSize: 15, lineHeight: 1.7, color: COL.sekundaer, ...anstieg(text) }}>
          {T.kurator2}
        </p>

        {nebenbilder.length === 2 && (
          <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {nebenbilder.map((src, i) => (
              <Vitrine key={src} src={src} alt={handle} ratio="4 / 5" delay={i + 1} />
            ))}
          </div>
        )}

        <section style={{ marginTop: 48, borderTop: `1px solid ${COL.linie}`, paddingTop: 22 }}>
          <Etikett>{T.fuenfzig}</Etikett>
          <p style={{ fontFamily: DISPLAY, fontSize: 26, margin: "10px 0 24px", color: COL.schrift }}>{zaehler}</p>
          <dl style={{ margin: 0 }}>
            {T.kond.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, borderTop: `1px solid ${COL.linie}`, padding: "12px 0" }}>
                <dt style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".19em", textTransform: "uppercase", color: COL.sekundaer }}>{k}</dt>
                <dd style={{ margin: 0, fontSize: 15, color: COL.schrift }}>{v}</dd>
              </div>
            ))}
          </dl>

          <Link
            to="/apply/form"
            style={{
              display: "block", marginTop: 28, textAlign: "center", padding: "16px 20px",
              border: `1px solid ${COL.akzent}`, color: COL.akzent, textDecoration: "none",
              fontFamily: MONO, fontSize: 11, letterSpacing: ".19em", textTransform: "uppercase",
            }}
          >
            {T.cta}
          </Link>
          <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6, color: COL.sekundaer }}>{T.ausstieg}</p>
        </section>

        <footer style={{ marginTop: 56, borderTop: `1px solid ${COL.linie}`, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
          <Etikett>♟</Etikett>
          <Etikett>{`PAWN — ${T.ausgabe}${plateNumber ? ` — ${plateNumber}` : ""}`}</Etikett>
        </footer>
      </main>
    </div>
  );
}
