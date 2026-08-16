/**
 * DEINE BOUTIQUE — die persönliche Ausgabe (Teil S).
 *
 * Drei Flächen, klar getrennt:
 *   /shop        alles, was gerade im Raum steht — mit Suche und Filtern
 *   /boutique    diese hier: die kuratierte Auswahl für diese eine Person
 *   /mode …      die Boutique mit vorgewählter Welt
 * Dieselben Werkkarten (WerkKarte.tsx), dieselbe Werkseite — nur die Auswahl
 * unterscheidet sich.
 *
 * Keine Filter, keine Regler: Kuratierung ist unsere Arbeit, nicht die Aufgabe
 * der Besucherin.
 *
 * Das Gesetz dieser Seite: **keine Reihe ohne Begründung.** Jede Überschrift
 * sagt, warum diese Stücke hier stehen, und jede Begründung stammt aus einem
 * Signal, das wirklich vorliegt. Lässt sich nichts belegen, fällt die Reihe
 * weg — sie wird nie mit einer erfundenen Begründung aufgefüllt.
 *
 * Woher die Signale kommen (nichts davon ist neu angelegt):
 *   · eingeloggt → usePersonalization (domain_events „ai.taste_signal" +
 *     user_memory.preferences) und wishlists über useWishlist
 *   · Gast       → features/personalization/sitzungsspur.ts, eine flüchtige
 *     Spur im sessionStorage, die mit dem Fenster stirbt
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { WerkKarte, type WerkKartenDaten } from "@/components/palace/WerkKarte";
import { supabase } from "@/integrations/supabase/client";
import { usePersonalization } from "@/features/personalization";
import { leseSitzungsspur, weltDerSitzung, haeuserDerSitzung } from "@/features/personalization/sitzungsspur";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { istZeigbar } from "@/lib/publicData";

const JE_REIHE = 6;

interface Werk extends WerkKartenDaten {
  world: string;
  created_at: string;
  product_dna: unknown;
  designers: { slug: string; brand_name: string } | null;
}

interface Reihe {
  schluessel: string;
  /** Die Begründung — sie IST der Titel. Ohne sie gibt es die Reihe nicht. */
  titel: string;
  werke: Werk[];
}

export default function DeineBoutique() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { hasSignals, world, mood, preferredTags, preferredDesigners } = usePersonalization();
  const wishlist = useWishlist();

  const [werke, setWerke] = useState<Werk[]>([]);
  const [laedt, setLaedt] = useState(true);
  const spur = useMemo(() => leseSitzungsspur(), []);

  useEffect(() => {
    let abgebrochen = false;
    void supabase
      .from("products")
      .select("id, slug, name, price, world, image_url, created_at, inventory_mode, stock_quantity, product_dna, designers ( slug, brand_name )")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (abgebrochen) return;
        // Teil R7 — nur vorzeigbare Stücke, gleiche Regel wie in der Boutique.
        setWerke(((data ?? []) as unknown as Werk[]).filter(istZeigbar));
        setLaedt(false);
      });
    return () => { abgebrochen = true; };
  }, []);

  /* ------------------------------------------------------ Die Reihen bauen */

  const reihen = useMemo<Reihe[]>(() => {
    if (werke.length === 0) return [];

    const vergeben = new Set<string>();
    const gebaut: Reihe[] = [];
    /** Nimmt bis zu sechs, überspringt bereits gezeigte — ein Werk steht nie zweimal. */
    const nimm = (kandidaten: Werk[]): Werk[] => {
      const raus: Werk[] = [];
      for (const w of kandidaten) {
        if (vergeben.has(w.id)) continue;
        raus.push(w);
        if (raus.length >= JE_REIHE) break;
      }
      return raus;
    };
    const lege = (schluessel: string, titel: string, kandidaten: Werk[]) => {
      const auswahl = nimm(kandidaten);
      // Weniger als zwei Stücke sind keine Reihe, sondern ein Zufall.
      if (auswahl.length < 2) return;
      for (const w of auswahl) vergeben.add(w.id);
      gebaut.push({ schluessel, titel, werke: auswahl });
    };

    const dnaText = (w: Werk) =>
      Object.values((w.product_dna ?? {}) as Record<string, unknown>)
        .filter((v): v is string => typeof v === "string").join(" ").toLowerCase();

    /* 1. Häuser, die diese Person angesehen hat. */
    const haeuser = user
      ? preferredDesigners
      : haeuserDerSitzung(spur);
    if (haeuser.length > 0) {
      lege(
        "haeuser",
        t("boutique.reihe.haeuser"),
        werke.filter((w) => w.designers?.slug && haeuser.includes(w.designers.slug)),
      );
    }

    /* 2. Die Stimmung — nur wenn sie wirklich ausgeprägt ist. */
    if (mood === "ruhig" || mood === "spannung") {
      const worte = mood === "ruhig"
        ? ["ruhig", "schlicht", "klar", "leinen", "wolle", "natur", "minimal"]
        : ["kontrast", "schwarz", "kante", "struktur", "grafisch", "stark"];
      lege(
        `stimmung-${mood}`,
        mood === "ruhig" ? t("boutique.reihe.ruhig") : t("boutique.reihe.spannung"),
        werke.filter((w) => {
          const heu = `${w.name} ${dnaText(w)}`.toLowerCase();
          return worte.some((wort) => heu.includes(wort));
        }),
      );
    }

    /* 3. Ein Interesse aus dem Gespräch. */
    for (const tag of preferredTags.slice(0, 2)) {
      const suche = tag.toLowerCase().trim();
      if (suche.length < 3) continue;
      lege(
        `tag-${suche}`,
        t("boutique.reihe.tag", { tag }),
        werke.filter((w) => `${w.name} ${dnaText(w)}`.toLowerCase().includes(suche)),
      );
    }

    /* 4. Neu in der Welt dieser Person. */
    const eigeneWelt = user ? world : weltDerSitzung(spur);
    if (eigeneWelt) {
      lege(
        "neu-welt",
        t("boutique.reihe.neuInWelt", { welt: eigeneWelt }),
        werke.filter((w) => w.world === eigeneWelt),
      );
    }

    /* 5. In der Nähe des Gemerkten — gleiche Welt wie die gemerkten Stücke. */
    if (wishlist.ids.size > 0) {
      const gemerkteWelten = new Set(
        werke.filter((w) => wishlist.ids.has(w.id)).map((w) => w.world),
      );
      if (gemerkteWelten.size > 0) {
        lege(
          "nahe-gemerkt",
          t("boutique.reihe.gemerkt"),
          werke.filter((w) => !wishlist.ids.has(w.id) && gemerkteWelten.has(w.world)),
        );
      }
    }

    return gebaut;
  }, [werke, user, preferredDesigners, spur, mood, preferredTags, world, wishlist.ids, t]);

  /* Ohne Signale: kein leerer Zustand, sondern die Einladung + die Redaktion. */
  const kenntUns = user ? hasSignals || wishlist.ids.size > 0 : spur.werke.length > 0;
  const redaktion = useMemo(() => werke.slice(0, JE_REIHE), [werke]);

  const merken = user ? (id: string) => void wishlist.toggle(id) : undefined;

  return (
    <PalaceLayout
      title="Deine Boutique — ausgewählt für dich"
      description="Die persönliche Ausgabe der Boutique: eine kuratierte Auswahl aus Mode, Interior und Kunst, die zu dir passt."
    >
      {/* Kopfzeile — eine ruhige Zeile, keine Regler. */}
      <section className="border-b-[1.5px] border-black px-6 pb-12 pt-36 md:px-14 md:pb-16 md:pt-44">
        <Reveal>
          <p className="palace-eyebrow">{t("boutique.eyebrow")}</p>
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2.2rem, 6vw, 5rem)", lineHeight: 0.96, letterSpacing: "-0.025em" }}
          >
            {t("boutique.headline")}
          </h1>
          <p className="mt-6 max-w-[52ch] font-serif italic text-[1.05rem] leading-relaxed text-[#000000]/70">
            {t("boutique.subline")}
          </p>
          {!user && (
            <p className="mt-4 max-w-[52ch] text-[0.8rem] leading-relaxed text-[#000000]/55">
              {t("boutique.gastHinweis")}{" "}
              <Link to="/auth" className="underline underline-offset-4 hover:opacity-70">
                {t("boutique.gastLink")}
              </Link>
            </p>
          )}
        </Reveal>
      </section>

      {laedt ? (
        <section className="px-6 py-24 md:px-14">
          <p className="palace-eyebrow opacity-50">{t("common.loading")}</p>
        </section>
      ) : !kenntUns || reihen.length === 0 ? (
        /* Die Einladung — nie eine leere Seite. */
        <>
          <section className="border-b-[1.5px] border-black px-6 py-16 md:px-14 md:py-24">
            <Reveal>
              <p className="max-w-[46ch] font-serif text-[clamp(1.3rem,3vw,2.1rem)] italic leading-[1.35] text-black">
                {t("boutique.einladung.text")}
              </p>
              <Link
                to="/dna"
                className="mt-10 inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
              >
                {t("boutique.einladung.cta")}
              </Link>
            </Reveal>
          </section>

          {redaktion.length > 0 && (
            <ReihenAbschnitt
              titel={t("boutique.reihe.redaktion")}
              werke={redaktion}
              gemerkt={wishlist.ids}
              onMerken={merken}
            />
          )}
        </>
      ) : (
        reihen.map((r) => (
          <ReihenAbschnitt
            key={r.schluessel}
            titel={r.titel}
            werke={r.werke}
            gemerkt={wishlist.ids}
            onMerken={merken}
          />
        ))
      )}

      {/* Der Weg in die volle Boutique bleibt immer offen. */}
      <section className="px-6 py-16 text-center md:px-14 md:py-24">
        <Link
          to="/shop"
          className="inline-block border-[1.5px] border-black px-8 py-4 text-[0.68rem] uppercase tracking-[0.32em] text-black transition-colors hover:bg-black hover:text-white"
        >
          {t("boutique.alleAnsehen")}
        </Link>
      </section>
    </PalaceLayout>
  );
}

function ReihenAbschnitt({
  titel, werke, gemerkt, onMerken,
}: {
  titel: string;
  werke: Werk[];
  gemerkt: Set<string>;
  onMerken?: (id: string) => void;
}) {
  return (
    <section className="border-b-[1.5px] border-black px-6 py-12 md:px-14 md:py-16">
      <Reveal>
        {/* Die Begründung ist der Titel. Es gibt keinen Titel ohne Grund. */}
        <h2 className="palace-serif max-w-[36ch] text-[clamp(1.1rem,2.2vw,1.6rem)] italic leading-tight text-black">
          {titel}
        </h2>
      </Reveal>
      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-6">
        {werke.map((w, i) => (
          <Reveal key={w.id} delay={Math.min(320, i * 40)}>
            <WerkKarte
              werk={w}
              seedPrefix="deine-boutique"
              gemerkt={gemerkt.has(w.id)}
              onMerken={onMerken}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
