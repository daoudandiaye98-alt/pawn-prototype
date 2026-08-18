/**
 * X9 — der Beileger.
 *
 * **Warum eine eigene Fläche und kein Blatt.** Das Heft blättert; die Kasse
 * nicht. Wer mitten im Bezahlen steht, soll nicht wenden, nicht das Gerät
 * drehen und nichts suchen müssen. `/kasse` steht deshalb schon länger in
 * `NIE_SPERREN` (`drehhinweis.tsx`) — diese Datei ist das, wofür der Eintrag
 * gemacht wurde: ein loses Blatt, das aus dem Heft fällt.
 *
 * **Die eine Stelle ohne gestalterische Freiheit.** Die letzte Schaltfläche
 * heißt „Zahlungspflichtig bestellen". Nicht „Kaufen", nicht „Jetzt kaufen",
 * nicht „Zug machen". § 312j Abs. 3 BGB verlangt eine ausdrückliche Bestätigung
 * der Zahlungspflicht; fehlt sie, kommt kein Vertrag zustande. Wer hier eine
 * schönere Formulierung sucht, sucht einen Rechtsfehler.
 *
 * **Warum der verbindliche Knopf HIER steht und nicht bei Stripe.** Bezahlt
 * wird über Stripes eigene Seite (`create-checkout` legt die Sitzung an und
 * leitet dorthin um). Deren Schaltfläche heißt „Jetzt bezahlen" und ist von uns
 * nicht frei beschriftbar. Also wird die Bestellung hier ausgelöst — mit der
 * Formulierung, die das Gesetz verlangt — und Stripe führt danach nur noch die
 * Zahlung aus. Die Bestellzeile entsteht dabei ebenfalls hier: `create-checkout`
 * schreibt sie in `orders`, BEVOR umgeleitet wird.
 *
 * **Die Rechtstexte.** Vor diesem Umbau war in Korb und Kasse kein einziger
 * verlinkt — auf einer Fläche, auf der echtes Geld fließt. Sie stehen jetzt hier
 * und werden von der Routen-Wache mitgeprüft: ein toter Link in der Kasse ist
 * kein Schönheitsfehler.
 */
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/palace/Seo";
import { PawnWordmark } from "@/components/pawn/PawnWordmark";

/**
 * Die Pflichttexte, die in der Kasse erreichbar sein müssen.
 *
 * Die Adressen stehen alle in `routen.js` — die Wache dort hält sie am Leben.
 * Sollte eine je verschwinden, fällt sie im Prüfstand auf, nicht erst bei einer
 * Abmahnung.
 */
const RECHTSTEXTE = [
  { zu: "/agb", text: "AGB" },
  { zu: "/widerruf", text: "Widerrufsrecht" },
  { zu: "/datenschutz", text: "Datenschutz" },
  { zu: "/impressum", text: "Impressum" },
] as const;

export default function Kasse() {
  const cart = useCart();
  const { user } = useAuth();
  const { locale } = useI18n();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);

  /*
   * Ein Kauf gehört genau einem Haus — dieselbe Regel wie bisher in der Kasse
   * und in `create-checkout`, das gemischte Körbe ablehnt. Steht kein Haus in
   * der Adresse, wird der ganze Korb gezeigt; die Sperre greift dann serverseitig
   * und sagt es freundlich.
   */
  const hausSchluessel = params.get("haus");
  const stuecke = useMemo(
    () => (hausSchluessel
      ? cart.items.filter((i) => (i.product.designerSlug || i.product.designer) === hausSchluessel)
      : cart.items),
    [cart.items, hausSchluessel],
  );
  const summe = stuecke.reduce((s, i) => s + i.product.price * i.qty, 0);

  async function bestellen() {
    if (stuecke.length === 0 || busy) return;
    setBusy(true);
    try {
      const ursprung = window.location.origin;
      const hausZusatz = hausSchluessel ? `&haus=${encodeURIComponent(hausSchluessel)}` : "";
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: stuecke.map((i) => ({
            name: `${i.product.name} · ${i.size}`,
            unit_amount: Math.round(i.product.price * 100),
            qty: i.qty,
            slug: i.product.slug,
            size: i.size,
          })),
          customer_email: user?.email,
          locale,
          success_url: `${ursprung}/order/success?session_id={CHECKOUT_SESSION_ID}${hausZusatz}`,
          cancel_url: `${ursprung}/kasse?abgebrochen=1`,
        },
      });

      if (!error && data?.url) {
        window.location.href = data.url as string;
        return;
      }
      /* `mixed_cart` und `designer_not_ready` sind bewusste Sperren mit eigenem
         Klartext, kein technischer Ausfall — deshalb deren Satz, nicht unserer. */
      if (!error && data?.error) {
        toast.error(data.message ?? "Der Kauf ist gerade nicht möglich.");
        return;
      }
      toast.error("Die Zahlung ließ sich nicht starten. Bitte gleich noch einmal versuchen.");
    } catch {
      toast.error("Die Zahlung ließ sich nicht starten. Bitte gleich noch einmal versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FFFFFF] text-[#000000]">
      <Seo title="Kasse · PAWN" description="Deine Bestellung abschließen." noindex />

      <div className="mx-auto w-full max-w-[46rem] px-6 py-14 md:px-10 md:py-20">
        <Link to="/heft/umschlag" className="inline-block" aria-label="Zurück ins Heft">
          <PawnWordmark className="h-6" />
        </Link>

        <p className="mt-12 font-sans text-[0.68rem] uppercase tracking-[0.28em]">Beileger</p>
        <h1 className="palace-serif mt-3 text-[clamp(2rem,6vw,3.2rem)] leading-[1.05]">Kasse</h1>

        {stuecke.length === 0 ? (
          /* Ehrlich und ohne Pathos — es fehlt nichts, es ist nur noch nichts
             gewählt. Der Weg zurück ist ein Weg ins Verzeichnis, keine Sackgasse. */
          <div className="mt-12 border-[1.5px] border-[#000000] p-8">
            <p className="font-serif text-[1.05rem] italic">Der Korb ist noch leer.</p>
            <div className="mt-6">
              <Button asChild variant="editorial" size="chip">
                <Link to="/verzeichnis/1">Ins Verzeichnis</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-12 border-t-[1.5px] border-[#000000]">
              {stuecke.map((i) => (
                <li
                  key={`${i.product.id}-${i.size}`}
                  className="flex items-baseline justify-between gap-6 border-b-[1.5px] border-[#000000] py-5"
                >
                  <span className="font-sans text-[0.95rem]">
                    {i.product.name}
                    <span className="opacity-60"> · {i.size}</span>
                    {i.qty > 1 && <span className="opacity-60"> · {i.qty}×</span>}
                  </span>
                  <span className="font-sans text-[0.95rem] tabular-nums">
                    {formatPrice(i.product.price * i.qty, locale)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-baseline justify-between gap-6">
              <span className="font-sans text-[0.68rem] uppercase tracking-[0.28em]">Summe</span>
              <span className="palace-serif text-[1.6rem] tabular-nums">{formatPrice(summe, locale)}</span>
            </div>
            <p className="mt-2 font-sans text-[0.8rem] opacity-70">
              Versandkosten und Lieferadresse folgen im nächsten Schritt bei der Zahlung.
            </p>

            {/*
              Die Pflichtangaben stehen VOR der Schaltfläche, nicht darunter:
              wer bestellt, soll sie gelesen haben können, nicht nachträglich
              finden müssen.
            */}
            <div className="mt-12 border-[1.5px] border-[#000000] p-6">
              <p className="font-sans text-[0.85rem] leading-relaxed">
                Mit der Bestellung stimmst du den{" "}
                <Link to="/agb" className="underline underline-offset-4">AGB</Link> zu und bestätigst,
                die{" "}
                <Link to="/widerruf" className="underline underline-offset-4">Widerrufsbelehrung</Link>{" "}
                gelesen zu haben. Wie deine Angaben verarbeitet werden, steht in der{" "}
                <Link to="/datenschutz" className="underline underline-offset-4">Datenschutzerklärung</Link>.
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                {RECHTSTEXTE.map((r) => (
                  <li key={r.zu}>
                    <Link
                      to={r.zu}
                      className="font-sans text-[0.68rem] uppercase tracking-[0.2em] underline underline-offset-4"
                    >
                      {r.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/*
              § 312j Abs. 3 BGB. Diese Beschriftung ist keine Gestaltungsfrage.
              Sie steht als Zeichenkette hier und NICHT in der Übersetzungstabelle:
              eine Übersetzung, die „Jetzt kaufen" daraus macht, wäre ein
              Rechtsfehler, den niemand bemerkt.
            */}
            <div className="mt-10">
              <Button
                variant="editorial"
                onClick={bestellen}
                disabled={busy}
                className="w-full py-5 text-[1rem]"
              >
                {busy ? "Einen Moment…" : "Zahlungspflichtig bestellen"}
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
