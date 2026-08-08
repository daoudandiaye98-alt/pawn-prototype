import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PawnFigurSvg } from "./PawnFigur";
import { useI18n } from "@/lib/i18n";
import { schreibePawnSignal, roomKeyForPath } from "@/lib/pawnSignal";

/**
 * Teil 31 — das PAWN-Deck: ersetzt die Scroll-Leiste (PawnGuide), den alten Ask-PAWN-Knopf
 * (Begleiter) und den Copilot-Knopf im Studio. "Unten existiert genau ein PAWN-Element" —
 * eine fixe schwarze Leiste (weiße Figur, ein Satz, Safe-Area). Antippen klappt ein Sheet
 * mit routenabhängigen Chips + Eingabefeld auf, das an pawn-chat geht.
 *
 * Der Leisten-Satz ist die Scroll-Begleitung: übernimmt PawnGuides bisherige Logik
 * ([data-guide]-Sätze je Sichtbarkeit, sonst ein Satz je Route).
 *
 * Teil 29 — wiederverwendet als Kunden-Deck auf /dna: eigener heroId (Cover statt
 * Studio-Hero), eigene Chips (per Prop statt Route-Tabelle) und ein Chip kann statt
 * einer Nachricht auch zu einem Seitenabschnitt scrollen ("Bilder hochladen").
 */

const ROUTE_GUIDE: Array<{ prefix: string; key: string }> = [
  { prefix: "/studio/produkte", key: "studio.guide.route.produkte" },
  { prefix: "/studio/kampagnen", key: "studio.guide.route.kampagnen" },
  { prefix: "/studio/hausseite", key: "studio.guide.route.hausseite" },
  { prefix: "/studio/mediathek", key: "studio.guide.route.mediathek" },
  { prefix: "/studio/videothek", key: "studio.guide.route.videothek" },
  { prefix: "/studio/dna", key: "studio.guide.route.dna" },
];

const ROUTE_CHIPS: Record<string, string[]> = {
  "/studio": ["studio.deck.chip.hub.takeOver", "studio.deck.chip.hub.explain", "studio.deck.chip.hub.week"],
  "/studio/tueren": ["studio.deck.chip.tueren.explain"],
};
const GENERIC_CHIPS = ["studio.deck.chip.generic.explain", "studio.deck.chip.generic.next"];

export interface DeckChip { i18nKey: string; action?: "scroll"; target?: string }

interface Msg { role: "user" | "assistant"; content: string }

interface PawnDeckProps {
  pathname: string;
  enabled: boolean;
  /** ID des Hero-Elements, unterhalb dessen die Leiste erscheint. Default: Studio-Hub-Hero. */
  heroId?: string;
  /** Feste Chip-Liste statt der Studio-Routen-Tabelle (für Nicht-Studio-Seiten). */
  chips?: DeckChip[];
  /** Fester Satz statt [data-guide]-Rotation/Studio-Routen-Tabelle (für Nicht-Studio-Seiten). */
  fallbackSentenceKey?: string;
}

export function PawnDeck({ pathname, enabled, heroId = "studio-hero", chips, fallbackSentenceKey }: PawnDeckProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [sentence, setSentence] = useState("");
  const lastSentence = useRef<string>("");

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) { setVisible(false); return; }
    const hero = document.getElementById(heroId);
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
  }, [pathname, enabled, heroId]);

  useEffect(() => {
    if (!enabled) return;
    const speak = (next: string) => {
      if (!next || next === lastSentence.current) return;
      lastSentence.current = next;
      setSentence(next);
    };

    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-guide]"));
    if (sections.length === 0) {
      if (fallbackSentenceKey) { speak(t(fallbackSentenceKey)); return; }
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
    return () => obs.disconnect();
  }, [pathname, enabled, t, fallbackSentenceKey]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    void schreibePawnSignal("deck_frage", { ort: roomKeyForPath(pathname) ?? (pathname === "/studio" ? "hub" : pathname) });
    try {
      const { data, error } = await supabase.functions.invoke("pawn-chat", {
        body: { messages: [...messages, { role: "user", content: q }], page_context: { route: pathname } },
      });
      if (error) throw error;
      const reply = (data as { reply?: string })?.reply ?? "…";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Verbindung stockt. Versuch's gleich nochmal." }]);
    } finally {
      setBusy(false);
    }
  };

  const handleChip = (c: DeckChip) => {
    if (c.action === "scroll" && c.target) {
      setOpen(false);
      document.getElementById(c.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    void sendMessage(t(c.i18nKey));
  };

  if (!enabled || !visible) return null;

  const resolvedChips: DeckChip[] = chips ?? (ROUTE_CHIPS[pathname] ?? GENERIC_CHIPS).map((k) => ({ i18nKey: k }));

  return (
    <>
      {open && <div className="fixed inset-0 z-[44] bg-black/25" onClick={() => setOpen(false)} aria-hidden="true" />}

      {open && (
        <div
          className="fixed inset-x-0 bottom-0 z-[46] mx-auto flex max-h-[70vh] w-full max-w-lg flex-col border-[1.5px] border-t-[1.5px] border-foreground bg-white shadow-[0_-8px_0_0_rgba(0,0,0,0.06)]"
          style={{ marginBottom: "calc(3.4rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">PAWN</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("studio.deck.closeAria")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {messages.length > 0 && (
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "flex items-start gap-2"}>
                  {m.role === "assistant" && <PawnFigurSvg className="mt-0.5 h-4 w-3 shrink-0" />}
                  <p className={`inline-block max-w-[85%] whitespace-pre-wrap text-sm ${m.role === "assistant" ? "font-serif italic" : ""}`}>{m.content}</p>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2">
                  <PawnFigurSvg className="h-4 w-3 shrink-0" />
                  <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.deck.thinking")}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            {resolvedChips.map((c) => (
              <button
                key={c.i18nKey}
                type="button"
                onClick={() => handleChip(c)}
                className="border-[1.5px] border-foreground px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.2em] hover:bg-foreground hover:text-background"
              >
                {t(c.i18nKey)}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("studio.deck.inputPlaceholder")}
              className="flex-1 border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <button type="submit" disabled={busy || !input.trim()} className="border-[1.5px] border-foreground bg-foreground px-4 py-2 text-[0.6rem] uppercase tracking-[0.24em] text-background disabled:opacity-40">
              {t("studio.deck.send")}
            </button>
          </form>
        </div>
      )}

      {/* Teil 31: "Ein PAWN unten, nie zwei" — die einzige PAWN-Präsenz am unteren Rand. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("studio.guide.openChatAria")}
        className="fixed inset-x-0 bottom-0 z-40 flex w-full items-center gap-3 bg-foreground px-4 pt-3 text-left text-background"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <PawnFigurSvg invert className="h-7 w-5 shrink-0" />
        <p className="flex-1 font-serif text-sm italic leading-snug">{sentence}</p>
      </button>
    </>
  );
}
