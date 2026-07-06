import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { HelixScene } from "@/components/palace/HelixScene";
import { Reveal } from "@/components/palace/Reveal";
import { useAuth } from "@/lib/auth";
import { usePersonalization, type Signal } from "@/features/personalization";

/**
 * /dna — the living, correctable identity dossier.
 *
 * Structure:
 *  01 · Hero — rotating helix + one sentence
 *  02 · Living state — signal cards ("Weil du …") with "Stimmt nicht"
 *  03 · Empty invitation (no signals yet)
 *  04 · What PAWN does NOT do — trust section
 */

function labelForSignal(s: Signal): { title: string; because: string } {
  switch (s.kind) {
    case "world":
      return { title: `Deine Welt: ${s.value}`, because: `Weil du im Gespräch oft von ${s.value} sprichst.` };
    case "mood":
      return {
        title: s.value === "ruhig" ? "Stimmung: ruhig, skulptural" : s.value === "spannung" ? "Stimmung: Spannung, Kontrast" : `Stimmung: ${s.value}`,
        because: s.value === "ruhig"
          ? "Weil du zurückhaltende, minimale Handschriften bevorzugst."
          : s.value === "spannung"
          ? "Weil du kontrastreiche, dramatische Momente wählst."
          : `Weil sich ${s.value} in deinen Antworten wiederholt.`,
      };
    case "tag":
      return { title: `Interesse: ${s.value}`, because: `Weil du „${s.value}" im Gespräch erwähnt hast.` };
    case "designer":
      return { title: `Designer: ${s.value}`, because: `Weil du ${s.value} gemerkt oder besucht hast.` };
    case "message":
    default:
      return { title: "Ein Fragment deiner Sprache", because: `Weil du geschrieben hast: „${s.value}…"` };
  }
}

function SignalCard({ signal, onCorrect }: { signal: Signal; onCorrect: () => void }) {
  const { title, because } = labelForSignal(signal);
  return (
    <div className="group flex flex-col justify-between border-t border-[rgba(12,12,14,.13)] py-8">
      <div>
        <p className="palace-eyebrow">Signal</p>
        <p className="palace-serif mt-4 text-[1.5rem] font-light leading-[1.15] text-[#0C0C0E]">
          {title}
        </p>
        <p className="mt-4 max-w-md text-[0.95rem] leading-[1.65] text-[#0C0C0E]/80">
          {because}
        </p>
      </div>
      <div className="mt-8 flex items-center gap-6">
        <button
          type="button"
          onClick={onCorrect}
          className="palace-eyebrow uline text-[#6B6862] hover:text-[#0C0C0E] motion-micro"
        >
          Stimmt nicht →
        </button>
        <span className="text-[0.6rem] uppercase tracking-[0.32em] text-[#8F8B82]">
          {new Date(signal.at).toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
        </span>
      </div>
    </div>
  );
}

function EmptyInvitation() {
  const [prompt, setPrompt] = useState("");
  const openChat = (msg?: string) => {
    if (msg) window.dispatchEvent(new CustomEvent("palace:hero-prompt", { detail: msg }));
    window.dispatchEvent(new Event("palace:open-chat"));
  };
  return (
    <div className="mx-auto max-w-2xl border border-[rgba(12,12,14,.13)] bg-[#F1EEE7] p-10 md:p-14">
      <p className="palace-eyebrow">Noch leer — und das ist gut so</p>
      <h3 className="palace-serif mt-6 text-[2rem] font-light leading-[1.05] text-[#0C0C0E]">
        Erzähl mir von dir — <span className="italic">oder stöbere einfach, ich schaue zu.</span>
      </h3>
      <p className="mt-6 text-[0.95rem] leading-[1.65] text-[#0C0C0E]/75">
        Deine DNA entsteht in Gesprächen und aus dem, was du dir merkst. Nichts wird gespeichert, was du nicht selbst gesagt hast.
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); openChat(prompt); setPrompt(""); }}
        className="mt-8 flex items-center border-b border-[rgba(12,12,14,.28)] pb-2"
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={"z.B. \u201eich mag ruhige, skulpturale Mode\u201c"}
          className="flex-1 bg-transparent px-2 py-2 text-[0.95rem] text-[#0C0C0E] placeholder:text-[#8F8B82] focus:outline-none"
        />
        <button type="submit" className="palace-eyebrow uline text-[#0C0C0E]">Los →</button>
      </form>
    </div>
  );
}

export default function DNA() {
  const { user } = useAuth();
  const { hasSignals, world, mood, signals, correct, loading, refresh } = usePersonalization();
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => { document.title = "Deine DNA — PAWN"; }, []);

  return (
    <PalaceLayout>
      {/* 01 · Hero */}
      <section ref={heroRef} className="relative min-h-[86vh] overflow-hidden bg-[#F1EEE7]">
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <HelixScene />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F1EEE7]/60 via-[#F1EEE7]/30 to-[#F1EEE7]/80" />

        <div className="relative z-10 mx-auto flex min-h-[86vh] max-w-[1200px] flex-col items-center justify-center px-6 pt-32 text-center md:px-14">
          <Reveal>
            <p className="palace-eyebrow">Deine DNA</p>
            <h1
              className="palace-serif mt-10 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.4rem, 6vw, 5.6rem)", lineHeight: 0.98, letterSpacing: "-0.02em" }}
            >
              Was der Raum <span className="italic">über dich weiß.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-xl font-serif italic text-[1.1rem] leading-relaxed text-[#0C0C0E]/75">
              Kein Profil. Kein Score. Eine lebendige Skizze deiner Handschrift — jederzeit korrigierbar.
            </p>
            {hasSignals && (
              <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {world && (
                  <div>
                    <p className="palace-eyebrow">Welt</p>
                    <p className="palace-serif mt-2 text-[1.4rem] italic text-[#0C0C0E]">{world}</p>
                  </div>
                )}
                <div>
                  <p className="palace-eyebrow">Stimmung</p>
                  <p className="palace-serif mt-2 text-[1.4rem] italic text-[#0C0C0E]">
                    {mood === "ruhig" ? "ruhig · skulptural" : mood === "spannung" ? "spannung · kontrast" : "im Werden"}
                  </p>
                </div>
                <div>
                  <p className="palace-eyebrow">Signale</p>
                  <p className="palace-serif mt-2 text-[1.4rem] italic text-[#0C0C0E]">{signals.length}</p>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* 02 · Living state */}
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <p className="palace-eyebrow">Was der Raum liest</p>
            <h2
              className="palace-serif mt-6 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)", lineHeight: 1.05, letterSpacing: "-0.015em" }}
            >
              Jede Erkenntnis <span className="italic">mit Herkunft.</span>
            </h2>
            <p className="mt-6 max-w-xl text-[0.95rem] leading-[1.65] text-[#0C0C0E]/75">
              Wenn etwas nicht stimmt, sag es. Das Signal verschwindet — und der Raum lernt.
            </p>
          </Reveal>

          <div className="mt-16">
            {!user ? (
              <div className="border-t border-[rgba(12,12,14,.13)] pt-10">
                <p className="palace-serif text-[1.4rem] italic text-[#0C0C0E]/80">
                  Melde dich an, um deine eigene Konstellation zu sehen.
                </p>
                <Link to="/auth" className="palace-eyebrow uline mt-6 inline-block text-[#0C0C0E]">Anmelden →</Link>
              </div>
            ) : loading && !hasSignals ? (
              <p className="palace-eyebrow text-[#6B6862]">Lade Signale…</p>
            ) : hasSignals ? (
              <div className="grid gap-x-16 md:grid-cols-2">
                {signals.map((s) => (
                  <SignalCard key={s.id} signal={s} onCorrect={() => { void correct(s.id); }} />
                ))}
              </div>
            ) : (
              <EmptyInvitation />
            )}
          </div>

          {user && hasSignals && (
            <div className="mt-12">
              <button
                type="button"
                onClick={() => { void refresh(); }}
                className="palace-eyebrow uline text-[#6B6862] hover:text-[#0C0C0E]"
              >
                Neu laden →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 03 · What PAWN does NOT do */}
      <section className="border-t border-[rgba(12,12,14,.13)] bg-[#0C0C0E] px-6 py-24 text-[#F1EEE7] md:px-14 md:py-32">
        <div className="mx-auto grid max-w-[1200px] gap-16 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="palace-eyebrow" style={{ color: "#A8A49B" }}>Vertrauen</p>
            <h2
              className="palace-serif mt-8 font-light"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)", lineHeight: 1.05, color: "#F1EEE7" }}
            >
              Was PAWN <span className="italic">nicht</span> tut.
            </h2>
          </div>
          <ul className="space-y-8">
            {[
              { t: "Keine Werbe-Cookies.", b: "Wir tracken dich nicht über andere Seiten hinweg. Punkt." },
              { t: "Kein Verkauf von Daten.", b: "Deine Signale bleiben bei uns — sie sind das Werkzeug, nicht die Ware." },
              { t: "Löschung jederzeit.", b: "Ein Klick in deinem Konto — und alles ist weg. Auch die Signale, die du hier siehst." },
            ].map((x) => (
              <li key={x.t} className="border-t border-[rgba(241,238,231,0.16)] pt-6">
                <p className="palace-serif text-[1.4rem] italic" style={{ color: "#F1EEE7" }}>{x.t}</p>
                <p className="mt-3 max-w-md text-[0.95rem] leading-[1.65]" style={{ color: "rgba(241,238,231,0.75)" }}>{x.b}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-16 max-w-[1200px]">
          <Link to="/datenschutz" className="palace-eyebrow uline" style={{ color: "#F1EEE7" }}>Datenschutz im Detail →</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}
