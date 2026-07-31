import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { HelixScene } from "@/components/palace/HelixScene";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { useAuth } from "@/lib/auth";
import { usePersonalization, type Signal } from "@/features/personalization";
import { supabase } from "@/integrations/supabase/client";
import { Stilberater } from "@/components/palace/Stilberater";
import { DnaChat } from "@/components/palace/DnaChat";
import { DnaKompass } from "@/components/palace/DnaKompass";
import { PasstDas } from "@/components/palace/PasstDas";
import { MoveLadder, type Move } from "@/components/palace/MoveLadder";
import { useStore, marketplaceSelectors } from "@/core";
import { X } from "lucide-react";

/**
 * /dna — das große "Über dich" (Teil 21c). Von oben nach unten: das Urteil
 * (Teil 20, Stilberater) · der Kompass mit dem Ziel und dem Weg (21b) · das
 * Gespräch mit Bildern (21a) · "Steht mir das?" · was PAWN sich gemerkt hat,
 * einzeln löschbar · Vertrauen.
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

function SignalCard({ signal, index, onCorrect }: { signal: Signal; index?: number; onCorrect: () => void }) {
  const { title, because } = labelForSignal(signal);
  return (
    <div className="group flex flex-col justify-between border-t-[1.5px] border-black py-8 motion-micro">
      <div>
        <div className="flex items-center gap-3">
          {typeof index === "number" && (
            <span className="nav-mono flex h-6 w-6 flex-none items-center justify-center border-[1.5px] border-black text-[0.58rem] tabular-nums text-black">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <span className="h-[1.5px] w-6 bg-black" />
          <p className="sys-label">Signal</p>
        </div>
        <p className="palace-serif mt-5 text-[1.6rem] leading-[1.1] tracking-[-0.02em] text-black">
          {title}
        </p>
        <p className="mt-4 max-w-md text-[0.95rem] leading-[1.65] text-black">
          {because}
        </p>
      </div>
      <div className="mt-8 flex items-center gap-6">
        <button
          type="button"
          onClick={onCorrect}
          className="sys-label uline text-black hover:text-black/50 motion-micro"
        >
          Stimmt nicht →
        </button>
        <span className="nav-mono text-[0.58rem] tabular-nums tracking-[0.2em] text-black/45">
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
    <div className="mx-auto max-w-2xl border-[1.5px] border-black bg-white">
      <div className="sys-meta border-t-0">
        <span className="text-black">Leeres Brett</span>
        <span className="ml-auto text-black">Zug 01</span>
      </div>
      <div className="p-10 md:p-14">
        <p className="sys-label">Bereit für dein erstes Signal</p>
        <h3 className="palace-serif mt-6 text-[2.2rem] leading-[1.0] tracking-[-0.03em] text-black">
          Erzähl mir von dir — <span className="italic">oder stöbere einfach, ich schaue zu.</span>
        </h3>
        <p className="mt-6 text-[0.95rem] leading-[1.65] text-black">
          Deine DNA entsteht aus Gesprächen und dem, was du dir merkst. Alles, was hier landet, hast du selbst gesagt oder ausgewählt.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); openChat(prompt); setPrompt(""); }}
          className="mt-8 flex items-center border-b-[1.5px] border-black pb-2 transition-colors focus-within:border-black"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={"z.B. \u201eich mag ruhige, skulpturale Mode\u201c"}
            className="flex-1 bg-transparent px-2 py-2 text-[16px] text-black placeholder:text-black/40 focus:outline-none md:text-[0.95rem]"
          />
          <button type="submit" className="sys-label uline text-black">Los →</button>
        </form>
      </div>
    </div>
  );
}

export default function DNA() {
  const { user } = useAuth();
  const { hasSignals, world, mood, signals, correct, loading, refresh } = usePersonalization();
  const heroRef = useRef<HTMLElement | null>(null);
  const urteilRef = useRef<HTMLElement | null>(null);
  const [facts, setFacts] = useState<string[]>([]);

  useEffect(() => { document.title = "Deine DNA — PAWN"; }, []);

  const loadFacts = useCallback(async () => {
    if (!user) { setFacts([]); return; }
    const { data } = await supabase.from("user_memory" as never).select("facts").eq("user_id", user.id).maybeSingle();
    const f = ((data as { facts?: string[] } | null)?.facts) ?? [];
    setFacts(Array.isArray(f) ? f : []);
  }, [user]);
  useEffect(() => { void loadFacts(); }, [loadFacts]);

  const deleteFact = async (fact: string) => {
    if (!user) return;
    const next = facts.filter((f) => f !== fact);
    setFacts(next);
    await supabase.from("user_memory" as never).update({ facts: next, updated_at: new Date().toISOString() } as never).eq("user_id", user.id);
    await supabase.from("domain_events").insert({
      type: "ai.memory_deleted",
      actor: user.id,
      payload: { fact, user_id: user.id },
    } as never);
  };

  // The dossier as a game: each move is a real section a visitor can jump to.
  // Built dynamically so gated sections never produce dead coordinates.
  const moves: Move[] = [
    { coord: "A1", id: "dna-hero", label: "Übersicht" },
    ...(user ? [
      { coord: "B2", id: "dna-urteil", label: "Das Urteil" },
      { coord: "C3", id: "dna-kompass", label: "Ziel & Weg" },
      { coord: "D4", id: "dna-gespraech", label: "Das Gespräch" },
      { coord: "E5", id: "dna-passt", label: "Steht mir das?" },
    ] : []),
    { coord: "F6", id: "dna-signale", label: "Was der Raum liest" },
    ...(user && facts.length > 0 ? [{ coord: "G7", id: "dna-memory", label: "PAWN erinnert sich" }] : []),
    { coord: "1–0", id: "dna-vertrauen", label: "Vertrauen" },
  ];

  return (
    <PalaceLayout>
      <MoveLadder moves={moves} />
      {/* 01 · Hero */}
      <section id="dna-hero" ref={heroRef} className="relative min-h-[86vh] overflow-hidden bg-[#FFFFFF]">
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          <HelixScene />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFFFFF]/45 via-transparent to-[#FFFFFF]/85" />

        <div className="relative z-10 mx-auto flex min-h-[86vh] max-w-[1200px] flex-col items-center justify-center px-6 pt-32 text-center md:px-14">
          <Reveal>
            <div className="measure-head mx-auto w-fit">
              <span className="coord-chip-invert coord-chip">A1</span>
              <span className="h-[1.5px] w-16 bg-black" />
              <Editable as="span" contentKey="dna_hero_eyebrow" className="sys-label">Deine DNA — Dossier</Editable>
            </div>
            <h1
              className="palace-serif mt-10 font-light text-[#000000]"
              style={{ fontSize: "clamp(2.8rem, 9vw, 8.4rem)", lineHeight: 0.88, letterSpacing: "-0.045em" }}
            >
              <Editable as="span" contentKey="dna_hero_headline_a">Was der Raum </Editable>
              <Editable as="span" contentKey="dna_hero_headline_b" className="italic">über dich weiß.</Editable>
            </h1>
            <Editable
              as="p"
              contentKey="dna_hero_subline"
              className="mx-auto mt-10 block max-w-xl font-serif italic text-[1.1rem] leading-relaxed text-[#000000]"
              multiline
            >
              Kein Profil. Kein Score. Eine lebendige Skizze deiner Handschrift — jederzeit korrigierbar.
            </Editable>
            {hasSignals && (
              <div className="sys-meta mt-14 inline-flex flex-wrap items-stretch justify-center bg-[#FFFFFF]">
                {world && (
                  <div className="flex-col items-start gap-2 !py-4">
                    <span className="sys-label text-black/55">Welt</span>
                    <span className="palace-serif text-[1.4rem] italic normal-case tracking-normal text-black">{world}</span>
                  </div>
                )}
                <div className="flex-col items-start gap-2 !py-4">
                  <span className="sys-label text-black/55">Stimmung</span>
                  <span className="palace-serif text-[1.4rem] italic normal-case tracking-normal text-black">
                    {mood === "ruhig" ? "ruhig · skulptural" : mood === "spannung" ? "spannung · kontrast" : "im Werden"}
                  </span>
                </div>
                <div className="flex-col items-start gap-2 !py-4">
                  <span className="sys-label text-black/55">Signale</span>
                  <span className="palace-serif text-[1.4rem] italic normal-case tracking-normal tabular-nums text-black">{signals.length}</span>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* 01b · Das Urteil (Teil 20) */}
      {user && (
        <section id="dna-urteil" ref={urteilRef} className="border-t-[1.5px] border-black px-6 py-24 md:px-14 md:py-32">
          <div className="mx-auto max-w-[900px]">
            <div className="measure-head mb-12">
              <span className="coord-chip">B2</span>
              <span className="measure-rule" />
              <span className="sys-label">Das Urteil</span>
            </div>
            <Stilberater />
          </div>
        </section>
      )}

      {/* 01c · Das Ziel und der Weg (Teil 21b) */}
      {user && (
        <section id="dna-kompass" className="border-t-[1.5px] border-black px-6 py-24 md:px-14 md:py-32">
          <div className="mx-auto max-w-[900px]">
            <div className="measure-head mb-12">
              <span className="coord-chip-invert coord-chip">C3</span>
              <span className="measure-rule" />
              <span className="sys-label">Ziel & Weg</span>
            </div>
            <DnaKompass />
          </div>
        </section>
      )}

      {/* 01d · Das Gespräch findet auf der Seite statt (Teil 21a) */}
      {user && (
        <section id="dna-gespraech" className="border-t-[1.5px] border-black px-6 py-24 md:px-14 md:py-32">
          <div className="mx-auto max-w-[900px]">
            <div className="measure-head mb-12">
              <span className="coord-chip">D4</span>
              <span className="measure-rule" />
              <span className="sys-label">Das Gespräch</span>
            </div>
            <DnaChat />
          </div>
        </section>
      )}

      {/* 01e · Steht mir das? (Teil 21c) */}
      {user && (
        <section id="dna-passt" className="border-t-[1.5px] border-black px-6 py-24 md:px-14 md:py-32">
          <div className="mx-auto max-w-[900px]">
            <div className="measure-head mb-12">
              <span className="coord-chip-invert coord-chip">E5</span>
              <span className="measure-rule" />
              <span className="sys-label">Steht mir das?</span>
            </div>
            <StehtMirDas />
          </div>
        </section>
      )}

      {/* 02 · Living state */}
      <section id="dna-signale" className="border-t-[1.5px] border-black px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <div className="measure-head">
              <span className="coord-chip-invert coord-chip">F6</span>
              <span className="measure-rule" />
              <span className="sys-label">Was der Raum liest</span>
            </div>
            <h2
              className="palace-serif mt-8 text-black"
              style={{ fontSize: "clamp(2.2rem, 4.4vw, 4rem)", lineHeight: 0.94, letterSpacing: "-0.035em" }}
            >
              Jede Erkenntnis <span className="italic">mit Herkunft.</span>
            </h2>
            <p className="mt-6 max-w-xl text-[0.95rem] leading-[1.65] text-black">
              Wenn etwas nicht stimmt, sag es. Das Signal verschwindet — und der Raum lernt.
            </p>
          </Reveal>

          <div className="mt-16">
            {!user ? (
              <div className="border-t-[1.5px] border-black pt-10">
                <p className="palace-serif text-[1.4rem] italic text-black">
                  Melde dich an, um deine eigene Konstellation zu sehen.
                </p>
                <Link to="/auth" className="sys-label uline mt-6 inline-block text-black">Anmelden →</Link>
              </div>
            ) : loading && !hasSignals ? (
              <p className="sys-label text-black/55">Lade Signale…</p>
            ) : hasSignals ? (
              <div className="grid gap-x-16 md:grid-cols-2">
                {signals.map((s, i) => (
                  <SignalCard key={s.id} signal={s} index={i} onCorrect={() => { void correct(s.id); }} />
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
                className="sys-label uline text-black/55 hover:text-black"
              >
                Neu laden →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 02b · PAWN erinnert sich */}
      {user && facts.length > 0 && (
        <section id="dna-memory" className="border-t-[1.5px] border-black bg-white px-6 py-20 md:px-14 md:py-28">
          <div className="mx-auto max-w-[1200px]">
            <div className="measure-head">
              <span className="coord-chip">G7</span>
              <span className="measure-rule" />
              <span className="sys-label">PAWN erinnert sich</span>
            </div>
            <h2 className="palace-serif mt-8 font-light text-[clamp(2.2rem,4.4vw,4rem)] leading-[0.94] tracking-[-0.035em] text-black">
              Was aus deinen <span className="italic">Sätzen blieb.</span>
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-black">
              Kleine Notizen, die PAWN aus deinen Gesprächen mitgenommen hat. Alles einzeln löschbar.
            </p>
            <div className="mt-10 grid gap-0 border-l-[1.5px] border-t-[1.5px] border-black md:grid-cols-2">
              {facts.map((f, i) => (
                <div key={f} className="relative border-b-[1.5px] border-r-[1.5px] border-black bg-white p-8">
                  <span className="nav-mono absolute left-3 top-3 text-[0.52rem] tabular-nums tracking-[0.18em] text-black/40">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="palace-serif mt-5 pr-8 text-[1.15rem] italic leading-[1.5] text-black">„{f}"</p>
                  <button
                    type="button"
                    onClick={() => void deleteFact(f)}
                    aria-label="Merksatz löschen"
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center border-[1.5px] border-black bg-white text-black hover:bg-black hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* 03 · Wie PAWN mit dir umgeht */}
      <section id="dna-vertrauen" className="border-t-[1.5px] border-black bg-black px-6 py-24 text-white md:px-14 md:py-32">
        <div className="mx-auto grid max-w-[1200px] gap-16 md:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="nav-mono flex h-9 min-w-[2.4rem] items-center justify-center border-[1.5px] border-white px-2 text-[0.6rem] tabular-nums text-white">1–0</span>
              <span className="h-[1.5px] flex-1 bg-white" />
              <span className="nav-mono text-[0.58rem] tracking-[0.4em] text-white">Vertrauen</span>
            </div>
            <h2
              className="palace-serif mt-8 text-white"
              style={{ fontSize: "clamp(2.2rem, 4.4vw, 4rem)", lineHeight: 0.94, letterSpacing: "-0.035em" }}
            >
              Wie PAWN <span className="italic">mit dir umgeht.</span>
            </h2>
          </div>
          <ul className="flex flex-col">
            {[
              { t: "Deine Signale gehören dir.", b: "Alles einsehbar in deiner DNA, einzeln löschbar mit einem Klick — hier auf dieser Seite." },
              { t: "Deine Daten arbeiten nur für deine Auswahl.", b: "Sie helfen dir, Handschriften zu finden, die zu dir passen. Sie bleiben bei uns." },
              { t: "Volle Kontrolle: Konto löschen entfernt alles, sofort.", b: "Konto → Einstellungen → Datenschutz → Konto löschen. Profil, Signale, Sessions — vollständig entfernt." },
            ].map((x, i) => (
              <li key={x.t} className="flex gap-5 border-t-[1.5px] border-white py-7">
                <span className="nav-mono flex-none pt-1 text-[0.58rem] tabular-nums tracking-[0.18em] text-white/50">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="palace-serif text-[1.5rem] italic leading-[1.1] text-white">{x.t}</p>
                  <p className="mt-3 max-w-md text-[0.95rem] leading-[1.65] text-white/75">{x.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-16 max-w-[1200px]">
          <Link to="/datenschutz" className="nav-mono uline text-[0.62rem] tracking-[0.26em] text-white">Datenschutz im Detail →</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}

function StehtMirDas() {
  const products = useStore(marketplaceSelectors.getAllProductViews);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<{ slug: string; name: string } | null>(null);

  const matches = query.trim().length >= 2
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="border-[1.5px] border-black bg-white">
      <div className="sys-meta border-t-0">
        <span className="text-black">Steht mir das?</span>
        <span className="ml-auto text-black">Prüfung</span>
      </div>
      <div className="p-6 md:p-8">
        <h2 className="palace-serif text-[2rem] leading-[1.0] tracking-[-0.03em] text-black">Frag zu jedem Stück bei PAWN.</h2>

        {!picked ? (
          <div className="mt-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name eines Stücks…"
              className="w-full border-b-[1.5px] border-black bg-transparent px-1 py-2 text-[16px] text-black placeholder:text-black/40 focus:outline-none md:text-sm"
            />
            {matches.length > 0 && (
              <ul className="mt-3 border-[1.5px] border-black">
                {matches.map((p, i) => (
                  <li key={p.slug} className={i > 0 ? "border-t-[1.5px] border-black" : ""}>
                    <button type="button" onClick={() => { setPicked({ slug: p.slug, name: p.name }); setQuery(""); }}
                      className="flex w-full items-baseline gap-2 px-3 py-2.5 text-left text-sm text-black hover:bg-black hover:text-white">
                      <span className="palace-serif italic">{p.name}</span>
                      <span className="nav-mono text-[0.54rem] tracking-[0.14em] opacity-60">— {p.designer}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <p className="palace-serif text-[1.15rem] italic text-black">{picked.name}</p>
            <div className="mt-4 flex items-center gap-5">
              <PasstDas productSlug={picked.slug} productName={picked.name} />
              <button type="button" onClick={() => setPicked(null)} className="nav-mono text-[0.58rem] tracking-[0.22em] text-black/45 hover:text-black">
                Anderes Stück
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
