/**
 * Die Hülle des Hefts — eine Komponente für alle Heft-Adressen.
 *
 * **Ein Heft, ein DOM.** React rendert das Gerüst genau einmal und fasst es danach nie
 * wieder an. Alles unter `#stage`, `#reader-layer`, `#editorial`, `#drawer`, `#pawn-chat`,
 * `#begleiter` und `#mobile-reader` gehört dem Heft; es hält seine eigene Zustandsmaschine,
 * seine eigene Bewegung und seinen eigenen Zeichentakt. React setzt Routen und liest
 * Zustand — mehr nicht. Zwei Besitzer desselben Knotens waren der Fehler des alten
 * Magazins (siehe `.claude/archiv/heft-architektur-audit.md`); er wird hier nicht wiederholt.
 *
 * **Das Gerüst kommt aus `referenz/index.html`**, nicht aus einer abgeschriebenen Kopie.
 * Eine Kopie liefe auseinander, sobald der Prototyp eine Schaltfläche bekommt — und das
 * fiele erst auf, wenn das Heft im Browser nach einem Knoten sucht, den es nicht gibt.
 *
 * **Die Stylesheets hängen an dieser Seite, nicht am Bündel.** `style.css` setzt
 * `body{overflow:hidden}` und nimmt jedem Knopf seinen Rahmen — als Vite-Import bliebe das
 * auf `/auth`, `/studio` und in den Rechtstexten liegen. Deshalb zwei `<link>`-Elemente,
 * die beim Verlassen wieder verschwinden.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConsent } from "@/lib/consent";
import { bildVariante, signiereMedia } from "@/lib/media";
import { createCustomRequestThread } from "@/features/messages/customRequest";
import { track } from "@/lib/analytics";
import { Seo } from "@/components/palace/Seo";
import { JsonLd, SITE_URL } from "@/components/palace/JsonLd";
import { pfadAusRoute, routeAusPfad } from "@/heft03/routen.mjs";
import geruestRoh from "./referenz/index.html?raw";
import heftCss from "./style.css?url";
import schriftenCss from "./schriften.css?url";

/**
 * Das Gerüst: alles zwischen `<body>` und `</body>`, ohne den Starter der Vorschau und
 * ohne den Vorschau-Stempel (Entscheidung D6 — der Regler „Papier & Bewegung" bleibt).
 */
const GERUEST = (() => {
  const anfang = geruestRoh.indexOf("<body");
  const ende = geruestRoh.lastIndexOf("</body>");
  const koerper = geruestRoh.slice(anfang, ende);
  return koerper
    .slice(koerper.indexOf(">") + 1)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<span class="prototype-badge">[\s\S]*?<\/span>/g, "")
    .trim();
})();

/** Die Klassen, die das Heft am `<body>` setzt und `stop()` wieder abräumt. */
const KOERPER_KLASSE = "is-intro";

/* Der Griff kommt aus `heft.d.ts` (`interface HeftGriff`), nicht aus einer Ableitung über
   `Awaited<ReturnType<…>>`. Der Unterschied ist nicht kosmetisch: die Ableitung war immer
   wahr — sie beschrieb, was das Modul zufällig zurückgibt, und hätte jede Änderung daran
   stillschweigend mitgemacht. Die Erklärung ist eine Zusage, gegen die `tsc` prüft. */
type Griff = HeftGriff;
type Daten = typeof import("@/heft03/data.mjs");

/** Ein Stylesheet, das nur solange gilt, wie das Heft offen ist. */
function stylesheet(href: string): HTMLLinkElement {
  const el = document.createElement("link");
  el.rel = "stylesheet";
  el.href = href;
  el.dataset.heft03 = "";
  document.head.appendChild(el);
  return el;
}

export default function HeftRoute03() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const { value: consent, setConsent } = useConsent();

  const heftRef = useRef<Griff | null>(null);
  const datenRef = useRef<Daten | null>(null);
  /** Die Route, wie das Heft sie gerade sieht — nur für Titel und strukturierte Daten. */
  const [route, setRoute] = useState<HeftRoute | null>(null);
  const [bereit, setBereit] = useState(false);

  /* Damit die Rückrufe des Hefts immer die frische Fassung sehen, ohne dass das Heft
     bei jedem Rendern neu starten müsste: die veränderlichen Teile liegen in Refs. */
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const setConsentRef = useRef(setConsent);
  setConsentRef.current = setConsent;
  const userRef = useRef(user);
  userRef.current = user;

  /**
   * Seitenbesuche zählen wie `usePageVisit`: nur eingeloggt, Verweildauer alle 20 s.
   * Anonymes Stöbern bleibt ungezählt — dieselbe Regel wie beim übrigen Geschmacksprofil.
   */
  const besuch = useRef<{ art: "designer" | "product"; id: string } | null>(null);
  const besuchZaehlen = useCallback((art: "designer" | "product", id?: string) => {
    if (!userRef.current || !id) return;
    besuch.current = { art, id };
    void supabase.rpc("record_page_visit" as never, { p_target_type: art, p_target_id: id } as never);
  }, []);

  useEffect(() => {
    const TAKT = 20;
    const id = window.setInterval(() => {
      const b = besuch.current;
      if (!b || !userRef.current || document.visibilityState !== "visible") return;
      void supabase.rpc("add_dwell_seconds" as never, { p_target_type: b.art, p_target_id: b.id, p_seconds: TAKT } as never);
    }, TAKT * 1000);
    return () => window.clearInterval(id);
  }, []);

  /* ——— Das Heft aufstellen. Genau einmal. ——— */
  useEffect(() => {
    let abgebrochen = false;
    const blaetter = [stylesheet(schriftenCss), stylesheet(heftCss)];

    /* Sagt der Selbststart-Sicherung im Prototyp, dass hier schon jemand startet. In der
       Repo-Fassung ist sie entfernt (siehe LIESMICH.md) — die Zeile ist der zweite Boden
       für den Fall, dass jemand sie beim nächsten Abgleich zurückholt. */
    (globalThis as { __pawnBoot?: boolean }).__pawnBoot = true;

    /*
     * Der Geduldsfaden. Für die schweigende DATENBANK ist er nicht mehr zuständig — die
     * Frist in notbetrieb.mjs zieht nach 6 Sekunden und damit lange vorher.
     *
     * Wofür er noch da ist, und das ist kein Restposten: alles, was VOR oder NEBEN der
     * Quelle hängen kann. Ein dynamisches Bündel (`import()`), das nie ankommt, weil das
     * Netz mitten im Laden abbricht. Ein `startHeft`, das nach den Daten hängen bleibt —
     * WebGL, das nicht startet, eine Schrift, die nie lädt. In all diesen Fällen stünde
     * „Eine Welt entfaltet sich" beliebig lange da. Nach 20 Sekunden sagt das Heft darum
     * selbst, was los ist, und bietet den einen Knopf an, der hilft.
     *
     * Die Uhr wird auf BEIDEN Wegen gestoppt: nach dem Aufstellen (unten) und im
     * Aufräumpfad des Effekts — sonst schreibt sie in ein Ladefeld, das niemand mehr sieht.
     */
    const geduld = window.setTimeout(() => {
      if (abgebrochen || heftRef.current) return;
      const laden = document.getElementById("loading");
      if (!laden || laden.hidden) return;
      laden.textContent = "Das Heft braucht heute ungewöhnlich lange. ";
      const knopf = document.createElement("button");
      knopf.className = "outline";
      knopf.textContent = "Noch einmal versuchen";
      knopf.onclick = () => location.reload();
      laden.appendChild(knopf);
    }, 20000);

    void (async () => {
      try {
        await aufstellen();
      } catch (e) {
        /* Kein Heft ist besser als eine weiße Seite: das Ladefeld bleibt stehen und sagt,
           was los ist.
           ACHTUNG, das hat sich geändert: die unerreichbare Datenbank landet hier NICHT
           mehr. Seit dem Vorschau-Betrieb (notbetrieb.mjs) fängt `startHeft` sie selbst ab
           und stellt die Beispielausgabe auf — sichtbar am Streifen, mit gesperrtem Kauf.
           Hier kommt nur noch an, was das Aufstellen selbst zerbricht: ein Bündel, das
           nicht geladen werden kann, ein fehlendes Gerüst, ein Fehler im Heft. */
        if (abgebrochen) return;
        console.error("[heft03]", e);
        const laden = document.getElementById("loading");
        if (laden) {
          laden.hidden = false;
          laden.textContent = "Das Heft lässt sich gerade nicht öffnen. Bitte lade die Seite neu.";
        }
      }
    })();

    async function aufstellen() {
      const [{ startHeft }, { supabaseQuelle }, daten] = await Promise.all([
        import("@/heft03/app.js"),
        import("@/heft03/quelle.mjs"),
        import("@/heft03/data.mjs"),
      ]);
      if (abgebrochen) return;
      datenRef.current = daten as unknown as Daten;

      const quelle = supabaseQuelle({
        client: supabase,
        /* Nur noch die Anzeigegröße: signiert wird eine Runde vorher in `quelle.heft()`,
           weil die Adapter `bild()` synchron rufen und Signieren asynchron ist. */
        bild: (u: string) => bildVariante(u, { breite: 1280 }) ?? u,
        /* Die Sichten aus sql/01 gibt es erst nach der Migration. Bis dahin die Tabellen. */
        sichten: false,
        adressen: {
          erfolg: `${location.origin}/order/success?session_id={CHECKOUT_SESSION_ID}`,
          abbruch: `${location.origin}/tasche`,
        },
        funktionen: {
          anmelden: () => navigateRef.current(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`),
          /** Eine Runde für alle Bildadressen des Hefts. */
          /*
           * Das `null` bleibt ein `null`. Hier stand `?? u`, und das war der Fehler:
           * `signiereMedia` gibt absichtlich `null` zurück, wenn eine Storage-Adresse
           * sich nicht signieren lässt und auch keine eigene http-Adresse ist
           * (`lib/media.ts:52`). Mit `?? u` kam statt der Auskunft „nicht signierbar"
           * wieder der blanke Bucket-Pfad zurück — also eine Adresse, die der Browser
           * nie laden kann. Der Löser in `quelle.mjs` unterscheidet jetzt beides.
           */
          signieren: async (urls: string[]) => {
            const paare = await Promise.all(urls.map(async (u) => [u, await signiereMedia(u)] as const));
            return Object.fromEntries(paare);
          },
          /** Anfragen laufen über den Faden, den das Postfach des Hauses schon kennt. */
          anfrage: async ({ product, text }: { product: HeftProdukt; text: string }) => {
            const u = userRef.current;
            if (!u) return { ok: false, anmelden: true };
            const haus = datenRef.current?.houses?.[product.house];
            if (!haus?.id) return { ok: false, fehler: "haus_unbekannt" };
            try {
              const thread_id = await createCustomRequestThread({
                userId: u.id,
                designerId: haus.id,
                productId: product.id,
                productName: product.name,
                body: text,
              });
              track("anfrage_gesendet", { welt: product.world });
              return { ok: true, thread_id };
            } catch (e) {
              return { ok: false, fehler: e instanceof Error ? e.message : "anfrage_fehlgeschlagen" };
            }
          },
          signal: (art: string, d: Record<string, unknown>) => {
            const p = d.product as HeftProdukt | undefined;
            if (art === "ansehen" && p) besuchZaehlen("product", p.id);
          },
        },
      });

      const heft = await startHeft({
        quelle,
        adresse: "pfad",
        assets: "/heft/assets/",
        zustimmung: consent === "accepted" ? true : consent === "essential" ? false : null,
        auf: {
          /* Das Heft schreibt die History selbst. React Router hört `pushState` nicht —
             ohne diese Zeile wüsste er nach dem ersten Blättern nicht mehr, wo er steht,
             und `Seo` schriebe eine falsche kanonische Adresse. `replace`, weil die
             Adresse bereits steht: es geht nur um den Gleichstand, nicht um einen Eintrag. */
          navigiert: (r: HeftRoute) => {
            setRoute({ ...r });
            navigateRef.current(pfadAusRoute(r), { replace: true });
            if (r.section === "haus" && r.slug) besuchZaehlen("designer", datenRef.current?.houses?.[r.slug]?.id);
          },
          zustimmung: (wert: boolean | null) => {
            if (wert === null) return;
            setConsentRef.current(wert ? "accepted" : "essential");
            /* Wer angemeldet ist, entscheidet fuer sein Konto, nicht fuer dieses Geraet:
               sonst waere dieselbe Antwort am Telefon wieder offen. profiles traegt die
               drei Felder schon (useAuth().profile.consent). */
            const u = userRef.current;
            if (u) {
              void supabase
                .from("profiles")
                .update({ consent_personalization: wert, consent_memory: wert, consent_analytics: wert })
                .eq("id", u.id);
            }
          },
          kauf: () => track("anfrage_gesendet", { schritt: "kasse" }),
          fehler: (e: unknown) => console.error("[heft03]", e),
        },
      });

      if (abgebrochen) {
        heft.stop();
        return;
      }
      heftRef.current = heft;
      window.clearTimeout(geduld);
      setRoute({ ...heft.route() });
      setBereit(true);

      /* Zurück aus der Kasse: nur die Stücke des bezahlten Hauses gehen aus der Tasche. */
      const bezahlt = new URLSearchParams(location.search).get("bezahlt");
      if (bezahlt) heft.tascheLeeren(bezahlt);

      /*
       * Der Umschlag trägt Daoudas Worte, nicht die des Prototyps — sofern er
       * welche gesetzt hat. `site_content` ist die Fläche, die er im Admin pflegt
       * (`landing.*`); was dort leer ist, bleibt beim Text des Hefts.
       *
       * Die Vision-Seiten bleiben ausdrücklich beim Heft-Text (Entscheidung D1).
       */
      const texte = await quelle.texte?.();
      if (texte && !abgebrochen) {
        const hero = daten.displays?.hero;
        const setze = (feld: "kicker" | "title" | "text", schluessel: string) => {
          const wert = texte[schluessel];
          if (hero && typeof wert === "string" && wert.trim()) hero[feld] = wert;
        };
        setze("kicker", "landing.cover_kicker");
        setze("title", "landing.cover_claim");
        setze("text", "landing.cover_text");
        if (texte["landing.cover_kicker"] || texte["landing.cover_claim"] || texte["landing.cover_text"]) heft.refresh();
      }
    }

    return () => {
      abgebrochen = true;
      window.clearTimeout(geduld);
      heftRef.current?.stop();
      heftRef.current = null;
      for (const b of blaetter) b.remove();
      document.body.classList.remove(KOERPER_KLASSE);
      setBereit(false);
    };
    /* Genau einmal. `consent` und `user` wirken über die Effekte darunter — ein Neustart
       des Hefts wegen einer Anmeldung würde die Doppelseite zurück auf den Umschlag werfen. */
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  /* ——— React Router führt, wenn er navigiert (Link aus den Rechtstexten, Zurück-Taste). ——— */
  useEffect(() => {
    const heft = heftRef.current;
    if (!heft) return;
    const jetzt = pathname + search;
    if (pfadAusRoute(heft.route()) === jetzt) return;
    heft.go(routeAusPfad(jetzt), false);
    setRoute({ ...heft.route() });
  }, [pathname, search, bereit]);

  /* ——— Anmelden und Abmelden: das Heft bleibt stehen, sein Gedächtnis wechselt. ——— */
  useEffect(() => {
    const heft = heftRef.current;
    if (!heft) return;
    if (user) void heft.kontoLaden();
    else {
      heft.state.profile = null;
      heft.refresh();
    }
  }, [user, bereit]);

  /* ——— Eine Zustimmung, zwei Anzeigen: die Sprechblase des Hefts und die Leiste. ——— */
  useEffect(() => {
    const heft = heftRef.current;
    if (!heft) return;
    const wert = consent === "accepted" ? true : consent === "essential" ? false : null;
    if (heft.state.consent === wert) return;
    heft.state.consent = wert;
    heft.refresh();
  }, [consent, bereit]);

  const kopf = seitenKopf(route, datenRef.current);
  const werk = route?.werk ? datenRef.current?.products?.[route.werk] : undefined;

  return (
    <>
      <Seo title={kopf.titel} description={kopf.text} />
      {werk && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: werk.name,
            description: werk.description || kopf.text,
            image: werk.image || undefined,
            brand: { "@type": "Brand", name: datenRef.current?.houses?.[werk.house]?.name ?? "PAWN" },
            url: `${SITE_URL}/werk/${werk.slug}`,
            ...(werk.price
              ? {
                  offers: {
                    "@type": "Offer",
                    price: werk.price,
                    priceCurrency: "EUR",
                    availability:
                      werk.stock_quantity === 0
                        ? "https://schema.org/OutOfStock"
                        : "https://schema.org/InStock",
                    url: `${SITE_URL}/werk/${werk.slug}`,
                  },
                }
              : {}),
          }}
        />
      )}
      {/* Ab hier gehört das DOM dem Heft. React rendert es einmal und rührt es nicht mehr an. */}
      <div data-heft03="" dangerouslySetInnerHTML={{ __html: GERUEST }} />
    </>
  );
}

/** Titel und Beschreibung aus der Route — was auf der Doppelseite steht, steht auch im Reiter. */
function seitenKopf(route: HeftRoute | null, daten: Daten | null): { titel: string; text: string } {
  const grund = {
    titel: "PAWN — Eine Welt. Ein Heft.",
    text: "Ein kuratierter Marktplatz für unabhängige Designer aus Mode, Interior und Kunst.",
  };
  if (!route || !daten) return grund;

  if (route.werk) {
    const p = daten.products?.[route.werk];
    if (p) {
      const haus = daten.houses?.[p.house]?.name;
      return {
        titel: `${p.name}${haus ? ` — ${haus}` : ""} · PAWN`,
        text: p.description || p.note || `${p.name}${haus ? ` von ${haus}` : ""} bei PAWN.`,
      };
    }
  }
  if (route.section === "haus" && route.slug) {
    const h = daten.houses?.[route.slug];
    if (h) {
      return {
        titel: `${h.name} — Haus ${h.number} · PAWN`,
        text: h.intro || h.manifesto || h.quote || `Das Haus ${h.name} bei PAWN.`,
      };
    }
  }
  const id = daten.sections?.[route.section]?.[route.index];
  const anzeige = id ? daten.displays?.[id] : undefined;
  const label = daten.labels?.[route.section];
  return {
    titel: `${label ?? "PAWN"} · PAWN`,
    text: anzeige?.text || grund.text,
  };
}
