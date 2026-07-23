import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { HelixScene } from "@/components/palace/HelixScene";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";
import { useAuth } from "@/lib/auth";
import { usePersonalization, explainMatch, scoreForPersonalization, type Signal } from "@/features/personalization";
import { supabase } from "@/integrations/supabase/client";
import { GenomeCard, type GenomeStrand } from "@/components/palace/GenomeCard";
import { X } from "lucide-react";

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
    <div className="group flex flex-col justify-between border-t border-[rgba(0,0,0,.18)] py-8">
      <div>
        <p className="palace-eyebrow">Signal</p>
        <p className="palace-serif mt-4 text-[1.5rem] font-light leading-[1.15] text-[#000000]">
          {title}
        </p>
        <p className="mt-4 max-w-md text-[0.95rem] leading-[1.65] text-[#000000]/80">
          {because}
        </p>
      </div>
      <div className="mt-8 flex items-center gap-6">
        <button
          type="button"
          onClick={onCorrect}
          className="palace-eyebrow uline text-[#6B6862] hover:text-[#000000] motion-micro"
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
    <div className="mx-auto max-w-2xl border border-[rgba(0,0,0,.18)] bg-white p-10 md:p-14">
      <p className="palace-eyebrow">Bereit für dein erstes Signal</p>
      <h3 className="palace-serif mt-6 text-[2rem] font-light leading-[1.05] text-[#000000]">
        Erzähl mir von dir — <span className="italic">oder stöbere einfach, ich schaue zu.</span>
      </h3>
      <p className="mt-6 text-[0.95rem] leading-[1.65] text-[#000000]/75">
        Deine DNA entsteht aus Gesprächen und dem, was du dir merkst. Alles, was hier landet, hast du selbst gesagt oder ausgewählt.
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); openChat(prompt); setPrompt(""); }}
        className="mt-8 flex items-center border-b border-[rgba(0,0,0,.28)] pb-2"
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={"z.B. \u201eich mag ruhige, skulpturale Mode\u201c"}
          className="flex-1 bg-transparent px-2 py-2 text-[0.95rem] text-[#000000] placeholder:text-[#8F8B82] focus:outline-none"
        />
        <button type="submit" className="palace-eyebrow uline text-[#000000]">Los →</button>
      </form>
    </div>
  );
}

export default function DNA() {
  const { user } = useAuth();
  const {
    hasSignals, world, mood, signals, correct, loading, refresh,
    worldDistribution, preferredTags, preferredDesigners, designerDna,
  } = usePersonalization();
  const heroRef = useRef<HTMLElement | null>(null);
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

  const worldStrands: GenomeStrand[] = useMemo(() => {
    const total = Object.values(worldDistribution).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return (["Mode", "Interior", "Kunst"] as const).map((w) => ({
      label: w,
      value: Math.round(((worldDistribution[w] ?? 0) / total) * 100),
    }));
  }, [worldDistribution]);

  const houseMatches = useMemo(() => {
    if (!hasSignals) return [];
    const profile = { world, preferredTags, hasSignals, preferredDesigners };
    const withText = Array.from(designerDna.values()).map((dna) => {
      const topWorld = Object.entries(dna.worlds).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0];
      const item = { designerSlug: dna.slug, tags: dna.signals, world: topWorld };
      return { dna, text: explainMatch(item, profile, designerDna), score: scoreForPersonalization(item, profile, designerDna) };
    });
    const matched: { dna: (typeof withText)[number]["dna"]; text: string; score: number }[] = [];
    for (const m of withText) if (m.text) matched.push({ dna: m.dna, text: m.text, score: m.score });
    return matched.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [hasSignals, world, preferredTags, preferredDesigners, designerDna]);


  return (
    <PalaceLayout>
      {/* 01 · Hero */}
      <section ref={heroRef} className="relative min-h-[86vh] overflow-hidden bg-[#FFFFFF]">
        <div className="absolute inset-0 flex items-center justify-center opacity-60">
          <HelixScene />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FFFFFF]/45 via-transparent to-[#FFFFFF]/85" />

        <div className="relative z-10 mx-auto flex min-h-[86vh] max-w-[1200px] flex-col items-center justify-center px-6 pt-32 text-center md:px-14">
          <Reveal>
            <Editable as="p" contentKey="dna_hero_eyebrow" className="palace-eyebrow">Deine DNA</Editable>
            <h1
              className="palace-serif mt-10 font-light text-[#000000]"
              style={{ fontSize: "clamp(2.6rem, 8vw, 7rem)", lineHeight: 0.94, letterSpacing: "-0.03em" }}
            >
              <Editable as="span" contentKey="dna_hero_headline_a">Was der Raum </Editable>
              <Editable as="span" contentKey="dna_hero_headline_b" className="italic">über dich weiß.</Editable>
            </h1>
            <Editable
              as="p"
              contentKey="dna_hero_subline"
              className="mx-auto mt-10 block max-w-xl font-serif italic text-[1.1rem] leading-relaxed text-[#000000]/75"
              multiline
            >
              Kein Profil. Kein Score. Eine lebendige Skizze deiner Handschrift — jederzeit korrigierbar.
            </Editable>
            {hasSignals && (
              <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                {world && (
                  <div>
                    <p className="palace-eyebrow">Welt</p>
                    <p className="palace-serif mt-2 text-[1.4rem] italic text-[#000000]">{world}</p>
                  </div>
                )}
                <div>
                  <p className="palace-eyebrow">Stimmung</p>
                  <p className="palace-serif mt-2 text-[1.4rem] italic text-[#000000]">
                    {mood === "ruhig" ? "ruhig · skulptural" : mood === "spannung" ? "spannung · kontrast" : "im Werden"}
                  </p>
                </div>
                <div>
                  <p className="palace-eyebrow">Signale</p>
                  <p className="palace-serif mt-2 text-[1.4rem] italic text-[#000000]">{signals.length}</p>
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* 01b · Deine Genom-Karte */}
      {user && (
        <section className="border-t border-[rgba(0,0,0,.18)] px-6 py-24 md:px-14 md:py-32">
          <div className="mx-auto max-w-[900px]">
            <GenomeCard
              eyebrow="Dein Geschmack"
              title="Deine Genom-Karte"
              subtitle={hasSignals ? `Stimmung: ${mood === "ruhig" ? "ruhig · skulptural" : mood === "spannung" ? "Spannung · Kontrast" : "im Werden"}` : undefined}
              strands={worldStrands.length > 0 ? worldStrands : undefined}
              strandsLabel="Deine Welten"
              emptyText="Deine Genom-Karte füllt sich, sobald du im Chat erzählst oder Stücke merkst."
            >
              {preferredTags.length > 0 && (
                <div className="mt-6 border-t border-black/15 pt-4">
                  <p className="editorial-eyebrow text-black/50">Deine Signale</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preferredTags.slice(0, 8).map((t) => (
                      <span key={t} className="border-[1.5px] border-black px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-black">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {houseMatches.length > 0 && (
                <div className="mt-6 border-t border-black/15 pt-4">
                  <p className="editorial-eyebrow text-black/50">Passende Häuser</p>
                  <ul className="mt-2 space-y-3">
                    {houseMatches.map(({ dna, text }) => (
                      <li key={dna.slug}>
                        <Link to={`/designer/${dna.slug}`} className="text-sm text-black underline decoration-1 underline-offset-4 hover:no-underline">
                          {dna.brandName}
                        </Link>
                        <p className="mt-0.5 text-sm text-black/70">{text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </GenomeCard>
          </div>
        </section>
      )}

      {/* 02 · Living state */}
      <section className="px-6 py-24 md:px-14 md:py-32">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <p className="palace-eyebrow">Was der Raum liest</p>
            <h2
              className="palace-serif mt-6 font-light text-[#000000]"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)", lineHeight: 1.05, letterSpacing: "-0.015em" }}
            >
              Jede Erkenntnis <span className="italic">mit Herkunft.</span>
            </h2>
            <p className="mt-6 max-w-xl text-[0.95rem] leading-[1.65] text-[#000000]/75">
              Wenn etwas nicht stimmt, sag es. Das Signal verschwindet — und der Raum lernt.
            </p>
          </Reveal>

          <div className="mt-16">
            {!user ? (
              <div className="border-t border-[rgba(0,0,0,.18)] pt-10">
                <p className="palace-serif text-[1.4rem] italic text-[#000000]/80">
                  Melde dich an, um deine eigene Konstellation zu sehen.
                </p>
                <Link to="/auth" className="palace-eyebrow uline mt-6 inline-block text-[#000000]">Anmelden →</Link>
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
                className="palace-eyebrow uline text-[#6B6862] hover:text-[#000000]"
              >
                Neu laden →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 02b · PAWN erinnert sich */}
      {user && facts.length > 0 && (
        <section className="border-t-[1.5px] border-black bg-white px-6 py-20 md:px-14 md:py-28">
          <div className="mx-auto max-w-[1200px]">
            <p className="palace-eyebrow">PAWN erinnert sich</p>
            <h2 className="palace-serif mt-6 font-light text-[clamp(1.8rem,3.5vw,3rem)] leading-[1.05] text-black">
              Was aus deinen <span className="italic">Sätzen blieb.</span>
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-black/70">
              Kleine Notizen, die PAWN aus deinen Gesprächen mitgenommen hat. Alles einzeln löschbar.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {facts.map((f) => (
                <div key={f} className="relative border-[1.5px] border-black bg-white p-6" style={{ boxShadow: "6px 6px 0 #000" }}>
                  <p className="palace-serif italic text-[1.05rem] leading-[1.5] text-black pr-8">„{f}"</p>
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
      <section className="border-t border-[rgba(0,0,0,.18)] bg-[#000000] px-6 py-24 text-[#FFFFFF] md:px-14 md:py-32">
        <div className="mx-auto grid max-w-[1200px] gap-16 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="palace-eyebrow" style={{ color: "#A8A49B" }}>Vertrauen</p>
            <h2
              className="palace-serif mt-8 font-light"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)", lineHeight: 1.05, color: "#FFFFFF" }}
            >
              Wie PAWN <span className="italic">mit dir umgeht.</span>
            </h2>
          </div>
          <ul className="space-y-8">
            {[
              { t: "Deine Signale gehören dir.", b: "Alles einsehbar in deiner DNA, einzeln löschbar mit einem Klick — hier auf dieser Seite." },
              { t: "Deine Daten arbeiten nur für deine Auswahl.", b: "Sie helfen dir, Handschriften zu finden, die zu dir passen. Sie bleiben bei uns." },
              { t: "Volle Kontrolle: Konto löschen entfernt alles, sofort.", b: "Konto → Meine Daten → Konto löschen. Profil, Signale, Sessions — vollständig entfernt." },
            ].map((x) => (
              <li key={x.t} className="border-t border-[rgba(241,238,231,0.16)] pt-6">
                <p className="palace-serif text-[1.4rem] italic" style={{ color: "#FFFFFF" }}>{x.t}</p>
                <p className="mt-3 max-w-md text-[0.95rem] leading-[1.65]" style={{ color: "rgba(241,238,231,0.75)" }}>{x.b}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-16 max-w-[1200px]">
          <Link to="/datenschutz" className="palace-eyebrow uline" style={{ color: "#FFFFFF" }}>Datenschutz im Detail →</Link>
        </div>
      </section>
    </PalaceLayout>
  );
}
