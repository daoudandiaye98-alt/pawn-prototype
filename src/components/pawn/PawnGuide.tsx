import { useEffect, useRef, useState } from "react";
import { PawnFigurSvg } from "./PawnFigur";
import { useI18n } from "@/lib/i18n";

/**
 * Scroll-Begleitung — kleine Figur (Desktop links, Mobil unten), die pro Sektion einen Satz
 * zeigt. Verhalten 1:1 aus docs/design-referenz/bauer.html: erscheint erst, wenn der Hero
 * (#studio-hero, sofern auf der Seite vorhanden) aus dem Bild ist; hört auf [data-guide]-
 * Elemente; Sprechblase löst sich nach 4,5s selbst auf, Hover holt sie zurück.
 *
 * Satz-Map je Route: die sechs im Auftrag genannten Räume (Werkbank/Kampagne/Dein Raum/
 * Schaufenster/Archiv/Außenauge) haben eine eigene Zeile. Seiten ohne eigene [data-guide]-
 * Sektionen (z.B. Bestellungen, Plan) zeigen diesen einen Routen-Satz statt mehrerer.
 */

const ROUTE_GUIDE: Array<{ prefix: string; key: string }> = [
  { prefix: "/studio/produkte", key: "studio.guide.route.produkte" },
  { prefix: "/studio/kampagnen", key: "studio.guide.route.kampagnen" },
  { prefix: "/studio/hausseite", key: "studio.guide.route.hausseite" },
  { prefix: "/studio/mediathek", key: "studio.guide.route.mediathek" },
  { prefix: "/studio/videothek", key: "studio.guide.route.videothek" },
  { prefix: "/studio/dna", key: "studio.guide.route.dna" },
];

export function PawnGuide({ pathname, enabled }: { pathname: string; enabled: boolean }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");
  const [talking, setTalking] = useState(false);
  const [popKey, setPopKey] = useState(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastText = useRef<string>("");

  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    const hero = document.getElementById("studio-hero");
    if (!hero) { setVisible(true); return; }
    setVisible(false);
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setVisible(!e.isIntersecting && e.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, [pathname, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const speak = (next: string) => {
      if (!next || next === lastText.current) return;
      lastText.current = next;
      setText(next);
      setTalking(true);
      setPopKey((k) => k + 1);
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setTalking(false), 4500);
    };

    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-guide]"));
    if (sections.length === 0) {
      const route = ROUTE_GUIDE.find((r) => pathname.startsWith(r.prefix));
      speak(route ? t(route.key) : t("studio.guide.route.default"));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const txt = e.target.getAttribute("data-guide");
            if (txt) speak(txt);
          }
        }
      },
      { rootMargin: "-38% 0px -52% 0px" },
    );
    sections.forEach((s) => obs.observe(s));
    return () => { obs.disconnect(); clearTimeout(fadeTimer.current); };
  }, [pathname, enabled, t]);

  if (!enabled || !visible) return null;

  return (
    <>
      <div className="fixed left-4 top-1/2 z-40 hidden w-[118px] -translate-y-1/2 lg:block">
        <div key={popKey} className="mx-auto w-14">
          <PawnFigurSvg className="pf-guide-fig pf-pop" />
        </div>
        <div
          className={`mt-2 border-[1.5px] border-foreground bg-white p-3 font-serif text-sm italic leading-snug shadow-[5px_5px_0_0_#000] transition-opacity duration-300 ${talking ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onMouseEnter={() => { clearTimeout(fadeTimer.current); setTalking(true); }}
          onMouseLeave={() => { fadeTimer.current = setTimeout(() => setTalking(false), 1500); }}
        >
          {text}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 bg-foreground px-4 py-3 text-background lg:hidden">
        <PawnFigurSvg invert className="h-7 w-5 shrink-0" />
        <p className="font-serif text-sm italic leading-snug">{text}</p>
      </div>
    </>
  );
}
