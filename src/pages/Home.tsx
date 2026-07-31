import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Link } from "react-router-dom";

/**
 * PAWN — Startseite.
 * Eine kuratierte Ausstellungshalle als redaktionelle Doppelseite.
 * Strenges System: nur #FFFFFF / #000000, dazu #F5F5F5 (Flächen) und #404040 (Sekundärtext).
 * border-radius: 0. Schatten hart versetzt. Haarlinien 1.5px. Eine einzige Kurve.
 * Selbstständige Einzelkomponente — keine externen UI-Bibliotheken.
 */

const EASE = "cubic-bezier(0.76, 0, 0.18, 1)";

/* ── Satzspiegel ─────────────────────────────────────────── */
function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-6 md:px-10 ${className}`}>{children}</div>;
}

/* Haarlinie — gliedert, dekoriert nicht. */
function Hairline({ className = "" }: { className?: string }) {
  return <div aria-hidden className={className} style={{ height: "1.5px", background: "#000000" }} />;
}

/* Übertitel — winzig, damit der Sprung zur Schlagzeile dramatisch bleibt. */
function Eyebrow({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`block ${className}`}
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "0.65rem",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.32em",
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* Einblendung: opacity 0 + translateY(24px) → sichtbar, 0.6s. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(24px)",
        transition: `opacity 0.6s ${EASE} ${delay}ms, transform 0.6s ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* Graustufenbild mit sanftem Hover-Zoom. */
function Frame({
  src,
  alt,
  ratio,
  className = "",
}: {
  src: string;
  alt: string;
  ratio: string;
  className?: string;
}) {
  return (
    <div className={`pawn-frame ${className}`} style={{ overflow: "hidden", aspectRatio: ratio, background: "#F5F5F5" }}>
      <img src={src || "/placeholder.svg"} alt={alt} loading="lazy" className="pawn-img" />
    </div>
  );
}

/* Knopf — Haarlinienrahmen, invertiert bei Hover. */
function InvertButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="pawn-btn">
      {children}
    </Link>
  );
}

/* ── Inhalte ─────────────────────────────────────────────── */
const WORLDS = [
  {
    title: "Mode",
    line: "Schnitt, Stoff und Haltung — Garderobe mit Handschrift.",
    img: "/images/pawn/welt-mode.png",
    to: "/mode",
    ratio: "3 / 4",
    offset: "md:mt-0",
  },
  {
    title: "Interior",
    line: "Objekte, die einen Raum erst zu einem Zuhause erklären.",
    img: "/images/pawn/welt-interior.png",
    to: "/interior",
    ratio: "4 / 5",
    offset: "md:mt-24",
  },
  {
    title: "Kunst",
    line: "Editionen und Unikate, direkt aus dem Atelier.",
    img: "/images/pawn/welt-kunst.png",
    to: "/kunst",
    ratio: "3 / 4",
    offset: "md:mt-10",
  },
];

const HOUSES = [
  { name: "Atelier Novembre", world: "Mode", place: "Antwerpen", img: "/images/pawn/haus-01.png", ratio: "3 / 4" },
  { name: "Halden & Co.", world: "Interior", place: "Zürich", img: "/images/pawn/haus-02.png", ratio: "4 / 5" },
  { name: "Institut Blanc", world: "Kunst", place: "Paris", img: "/images/pawn/haus-03.png", ratio: "3 / 4" },
  { name: "Objekt Nº6", world: "Mode", place: "Berlin", img: "/images/pawn/haus-04.png", ratio: "4 / 5" },
  { name: "Werkstatt Lohr", world: "Interior", place: "Wien", img: "/images/pawn/haus-05.png", ratio: "3 / 4" },
];

const MARQUEE = [
  "Mode",
  "Atelier Novembre",
  "Interior",
  "Halden & Co.",
  "Kunst",
  "Institut Blanc",
  "Objekt Nº6",
  "Werkstatt Lohr",
];

/* ── Seite ───────────────────────────────────────────────── */
export default function Home() {
  return (
    <div className="pawn-home" style={{ background: "#FFFFFF", color: "#000000", minHeight: "100vh" }}>
      <PawnStyles />

      {/* 1 — KOPFZEILE ------------------------------------------------- */}
      <header>
        <Container className="flex items-center justify-between py-5 md:py-6">
          <div className="flex items-baseline gap-3 md:gap-4">
            <Link
              to="/"
              aria-label="PAWN — Startseite"
              className="font-serif"
              style={{ fontWeight: 600, fontSize: "1.5rem", letterSpacing: "0.02em", textTransform: "uppercase", lineHeight: 1 }}
            >
              Pawn
            </Link>
            <span
              className="hidden sm:inline"
              style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, fontSize: "0.95rem", color: "#404040" }}
            >
              Ausgabe 07
            </span>
          </div>

          <nav aria-label="Hauptnavigation" className="hidden items-center gap-10 md:flex">
            <NavItem to="/shop">Ausstellung</NavItem>
            <NavItem to="/designers">Häuser</NavItem>
            <NavItem to="/kontakt">Über</NavItem>
          </nav>

          <div className="flex items-center gap-6">
            <Link to="/shop" aria-label="Suche" className="pawn-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.5" y2="16.5" />
              </svg>
            </Link>
            <Link to="/cart" aria-label="Tasche" className="pawn-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" aria-hidden>
                <path d="M6 7h12l-1 14H7L6 7z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
              </svg>
            </Link>
            <NavItem to="/auth" className="hidden sm:block">
              Anmelden
            </NavItem>
          </div>
        </Container>
        <Hairline />
      </header>

      <main>
        {/* 2 — AUFMACHER --------------------------------------------- */}
        <section aria-labelledby="aufmacher-titel">
          <Container className="pt-16 md:pt-28 pb-20 md:pb-40">
            <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
              <div>
                <Eyebrow className="mb-10 md:mb-16" style={{ color: "#404040" }}>
                  Ausgabe 07 · Titelgeschichte
                </Eyebrow>
                <h1
                  id="aufmacher-titel"
                  className="font-serif"
                  style={{ fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 0.95, fontSize: "clamp(3rem, 7vw, 6.5rem)" }}
                >
                  <span className="pawn-rise-line block overflow-hidden">
                    <span className="pawn-rise pawn-rise-1 block">Die Häuser, die wir</span>
                  </span>
                  <span className="pawn-rise-line block overflow-hidden">
                    <span className="pawn-rise pawn-rise-2 block italic" style={{ fontWeight: 500 }}>
                      sammeln.
                    </span>
                  </span>
                </h1>
                <p
                  className="mt-10 max-w-md"
                  style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 400, fontSize: "1.05rem", lineHeight: 1.55, color: "#404040" }}
                >
                  Eine kuratierte Ausstellung unabhängiger Designer und Künstler. Jedes Haus bespielt seinen
                  eigenen Raum — Sie treten durch die Halle.
                </p>
                <div className="mt-12">
                  <InvertButton to="/shop">Die Ausstellung betreten</InvertButton>
                </div>
              </div>

              {/* Angeschnittenes Hochformat, rechts über den Satzspiegel hinaus. */}
              <Reveal delay={120} className="md:-mr-10">
                <Frame src="/images/pawn/hero-cover.png" alt="Titelgeschichte — Modeaufnahme in Graustufen" ratio="3 / 4" />
              </Reveal>
            </div>
          </Container>
        </section>

        {/* 3 — LAUFBAND ---------------------------------------------- */}
        <section aria-label="Welten und Häuser">
          <Hairline />
          <div className="overflow-hidden py-4">
            <div className="pawn-marquee flex w-max whitespace-nowrap">
              {[...MARQUEE, ...MARQUEE].map((item, i) => (
                <span key={`${item}-${i}`} className="flex items-center">
                  <Eyebrow className="px-8">{item}</Eyebrow>
                  <span aria-hidden style={{ width: "5px", height: "5px", background: "#000000" }} />
                </span>
              ))}
            </div>
          </div>
          <Hairline />
        </section>

        {/* 4 — DIE DREI WELTEN --------------------------------------- */}
        <section aria-labelledby="welten-titel">
          <Container className="pt-24 md:pt-36 pb-16 md:pb-24">
            <div className="mb-16 flex flex-col gap-6 md:mb-24 md:flex-row md:items-end md:justify-between">
              <div>
                <Eyebrow style={{ color: "#404040" }}>Drei Welten</Eyebrow>
                <h2
                  id="welten-titel"
                  className="font-serif mt-6"
                  style={{ fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.0, fontSize: "clamp(2rem, 4.5vw, 3.75rem)" }}
                >
                  Ein Haus für <span className="italic" style={{ fontWeight: 500 }}>jede Disziplin.</span>
                </h2>
              </div>
              <p
                className="max-w-xs"
                style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.92rem", lineHeight: 1.55, color: "#404040" }}
              >
                Mode, Interior und Kunst — gleichwertig gesetzt, nicht sortiert.
              </p>
            </div>

            {/* Bewusst versetzt — eine gesetzte Doppelseite, kein Kachelraster. */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-3">
              {WORLDS.map((w, i) => (
                <Reveal key={w.title} delay={i * 90} className={w.offset}>
                  <Link to={w.to} className="pawn-tile group block">
                    <Frame src={w.img} alt={`${w.title} — Aufnahme in Graustufen`} ratio={w.ratio} />
                    <h3
                      className="font-serif mt-6 italic"
                      style={{ fontWeight: 500, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", letterSpacing: "-0.015em", lineHeight: 1.1 }}
                    >
                      {w.title}
                    </h3>
                    <p
                      className="mt-3 max-w-xs"
                      style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.92rem", lineHeight: 1.55, color: "#404040" }}
                    >
                      {w.line}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* 5 — AUSGEWÄHLTE HÄUSER ------------------------------------ */}
        <section aria-labelledby="haeuser-titel">
          <Container className="pt-16 md:pt-28 pb-24 md:pb-40">
            <Hairline className="mb-10" />
            <div className="mb-14 flex items-end justify-between gap-8 md:mb-20">
              <h2
                id="haeuser-titel"
                className="font-serif"
                style={{ fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.0, fontSize: "clamp(2rem, 4.5vw, 3.75rem)" }}
              >
                Ausgewählte <span className="italic" style={{ fontWeight: 500 }}>Häuser.</span>
              </h2>
              <Link to="/designers" className="pawn-underline hidden shrink-0 md:block">
                <Eyebrow>Alle Häuser →</Eyebrow>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-14 md:grid-cols-5 md:gap-x-5">
              {HOUSES.map((h, i) => (
                <Reveal key={h.name} delay={i * 70}>
                  <Link to="/designers" className="pawn-tile group block">
                    <Frame src={h.img} alt={`${h.name} — ${h.world}`} ratio={h.ratio} />
                    <Eyebrow className="mt-5" style={{ color: "#404040" }}>
                      {h.world}
                    </Eyebrow>
                    <h3
                      className="font-serif mt-3"
                      style={{ fontWeight: 600, fontSize: "1.35rem", letterSpacing: "-0.01em", lineHeight: 1.1 }}
                    >
                      {h.name}
                    </h3>
                    <p
                      className="mt-1"
                      style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.8rem", lineHeight: 1.55, color: "#404040" }}
                    >
                      {h.place}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        {/* 6 — DIE DNA ----------------------------------------------- */}
        <section aria-labelledby="dna-titel" style={{ background: "#F5F5F5" }}>
          <Hairline />
          <Container className="py-24 md:py-32">
            <div className="grid grid-cols-1 items-center gap-14 md:grid-cols-2 md:gap-20">
              <Reveal>
                <Eyebrow style={{ color: "#404040" }}>Die DNA</Eyebrow>
                <h2
                  id="dna-titel"
                  className="font-serif mt-6"
                  style={{ fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.0, fontSize: "clamp(2rem, 4vw, 3.4rem)" }}
                >
                  Beim Sehen, beim Verweilen, <span className="italic" style={{ fontWeight: 500 }}>beim Zurückkommen.</span>
                </h2>
                <p
                  className="mt-8 max-w-md"
                  style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "1.05rem", lineHeight: 1.55, color: "#404040" }}
                >
                  Die Ausstellung merkt sich, wo Sie stehenbleiben. Mit jedem Besuch ordnet sie die Räume ein
                  wenig mehr nach Ihrer Handschrift — bis die Halle Ihre eigene wird.
                </p>
                <div className="mt-10">
                  <InvertButton to="/dna">Die DNA verstehen</InvertButton>
                </div>
              </Reveal>

              {/* Abstrakte, feine Linienstruktur aus Haarlinien — kein Diagramm, keine Icons. */}
              <Reveal delay={140}>
                <DnaLines />
              </Reveal>
            </div>
          </Container>
          <Hairline />
        </section>

        {/* 7 — SCHLUSSBILD ------------------------------------------- */}
        <section aria-labelledby="schluss-titel">
          <Container className="py-28 md:py-44 text-center">
            <Reveal>
              <h2
                id="schluss-titel"
                className="font-serif mx-auto max-w-5xl text-balance"
                style={{ fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.02, fontSize: "clamp(2.5rem, 6.5vw, 6rem)" }}
              >
                Die Bühne steht. <span className="italic" style={{ fontWeight: 500 }}>Der Auftritt gehört dir.</span>
              </h2>
              <div className="mt-14 flex justify-center">
                <InvertButton to="/apply">Ein Haus eröffnen</InvertButton>
              </div>
            </Reveal>
          </Container>
        </section>
      </main>

      {/* 8 — FUSSZEILE ----------------------------------------------- */}
      <footer>
        <Hairline />
        <Container className="grid grid-cols-2 gap-10 py-16 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <span
              className="font-serif"
              style={{ fontWeight: 600, fontSize: "1.35rem", textTransform: "uppercase", letterSpacing: "0.02em" }}
            >
              Pawn
            </span>
            <p
              className="mt-4 max-w-xs"
              style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.8rem", lineHeight: 1.55, color: "#404040" }}
            >
              Eine kuratierte Ausstellung für unabhängige Designer und Künstler aus Mode, Interior und Kunst.
            </p>
          </div>
          <FooterCol title="Ausstellung" links={[{ label: "Mode", to: "/mode" }, { label: "Interior", to: "/interior" }, { label: "Kunst", to: "/kunst" }, { label: "Neu", to: "/neu" }]} />
          <FooterCol title="Häuser" links={[{ label: "Alle Häuser", to: "/designers" }, { label: "Ein Haus eröffnen", to: "/apply" }, { label: "Studio", to: "/studio" }, { label: "Style DNA", to: "/dna" }]} />
          <FooterCol title="Haus" links={[{ label: "Kontakt", to: "/kontakt" }, { label: "Versand", to: "/versand" }, { label: "AGB", to: "/agb" }, { label: "Impressum", to: "/impressum" }]} />
        </Container>
        <Hairline />
        <Container className="flex flex-col items-start justify-between gap-3 py-6 md:flex-row md:items-center">
          <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.75rem", color: "#404040" }}>
            © {new Date().getFullYear()} PAWN · Ausgabe 07
          </span>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/auth" className="pawn-underline">
              <Eyebrow>Anmelden</Eyebrow>
            </Link>
            <Link to="/datenschutz" className="pawn-underline">
              <Eyebrow>Datenschutz</Eyebrow>
            </Link>
          </div>
        </Container>
      </footer>
    </div>
  );
}

/* ── Bausteine ───────────────────────────────────────────── */
function NavItem({ to, children, className = "" }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`pawn-nav ${className}`}>
      <Eyebrow>{children}</Eyebrow>
    </Link>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <Eyebrow style={{ color: "#404040" }}>{title}</Eyebrow>
      <ul className="mt-5 space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="pawn-underline"
              style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: "0.85rem", lineHeight: 1.55 }}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Feine Linienstruktur — Haarlinien, die aus einem Punkt auffächern. */
function DnaLines() {
  const lines = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div style={{ border: "1.5px solid #000000", background: "#FFFFFF", aspectRatio: "5 / 4", overflow: "hidden" }}>
      <svg viewBox="0 0 500 400" width="100%" height="100%" preserveAspectRatio="none" aria-hidden role="presentation">
        {lines.map((i) => {
          const t = i / (lines.length - 1);
          const y2 = 20 + t * 360;
          const stroke = i % 3 === 0 ? "#000000" : "#404040";
          return <line key={i} x1={30} y1={200} x2={480} y2={y2} stroke={stroke} strokeWidth={1} />;
        })}
        {lines.map((i) => {
          const t = i / (lines.length - 1);
          const x2 = 60 + t * 420;
          return <line key={`v-${i}`} x1={30} y1={200} x2={x2} y2={20} stroke="#404040" strokeWidth={0.75} />;
        })}
        <circle cx={30} cy={200} r={2.5} fill="#000000" />
      </svg>
    </div>
  );
}

/* ── Stil — auf .pawn-home begrenzt ──────────────────────── */
function PawnStyles() {
  return (
    <style>{`
      .pawn-home a { color: inherit; text-decoration: none; }

      .pawn-home .pawn-img {
        width: 100%; height: 100%; object-fit: cover; display: block;
        filter: grayscale(1) contrast(1.06);
        transition: transform 0.8s ${EASE};
        will-change: transform;
      }
      .pawn-home .pawn-tile:hover .pawn-img { transform: scale(1.04); }

      .pawn-home .pawn-btn {
        display: inline-flex; align-items: center; gap: 0.6rem;
        border: 1.5px solid #000000; background: #FFFFFF; color: #000000;
        padding: 0.8rem 1.4rem;
        font-family: Inter, system-ui, sans-serif;
        font-size: 0.65rem; font-weight: 500;
        letter-spacing: 0.36em; text-transform: uppercase;
        transition: background-color 0.25s ${EASE}, color 0.25s ${EASE};
      }
      .pawn-home .pawn-btn:hover { background: #000000; color: #FFFFFF; }

      .pawn-home .pawn-nav, .pawn-home .pawn-icon {
        transition: color 0.25s ${EASE}, opacity 0.25s ${EASE};
        color: #000000;
      }
      .pawn-home .pawn-nav:hover, .pawn-home .pawn-icon:hover { color: #404040; }

      .pawn-home .pawn-underline { position: relative; display: inline-block; }
      .pawn-home .pawn-underline::after {
        content: ""; position: absolute; left: 0; bottom: -3px;
        width: 100%; height: 1.5px; background: #000000;
        transform: scaleX(0); transform-origin: left;
        transition: transform 0.25s ${EASE};
      }
      .pawn-home .pawn-underline:hover::after { transform: scaleX(1); }

      .pawn-home a:focus-visible, .pawn-home button:focus-visible {
        outline: 1.5px solid #000000; outline-offset: 3px;
      }

      @keyframes pawn-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .pawn-home .pawn-marquee { animation: pawn-marquee 60s linear infinite; }

      @keyframes pawn-rise { from { transform: translateY(110%); } to { transform: translateY(0); } }
      .pawn-home .pawn-rise { animation: pawn-rise 0.9s ${EASE} both; }
      .pawn-home .pawn-rise-1 { animation-delay: 0.05s; }
      .pawn-home .pawn-rise-2 { animation-delay: 0.22s; }

      @media (prefers-reduced-motion: reduce) {
        .pawn-home .pawn-marquee { animation: none; }
        .pawn-home .pawn-rise { animation: none; transform: none; }
        .pawn-home .pawn-img { transition: none; }
        .pawn-home .pawn-tile:hover .pawn-img { transform: none; }
      }
    `}</style>
  );
}
