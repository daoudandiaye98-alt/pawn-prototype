import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useDesignerOrders } from "@/features/studio/useDesignerOrders";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Locale } from "@/lib/i18n";

/**
 * Teil N — Raum POSTFACH: drei ruhige, bebilderte Stapel — Bestellungen,
 * Nachrichten, Türen. Türen zuletzt und am leisesten. Keine Punkte, keine
 * Zähler-Badges: die Zahlen stehen in Worten in den Sätzen der Fläche.
 */

const WORTE_DE = ["keine", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const WORTE_EN = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function inWorten(n: number, locale: Locale): string {
  const worte = locale === "de" ? WORTE_DE : WORTE_EN;
  if (n >= 0 && n < worte.length) {
    const w = worte[n];
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return String(n);
}

function StapelBild({ art }: { art: "bestellungen" | "nachrichten" | "tueren" }) {
  const c = { fill: "none", stroke: "#e09a3a", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 72 72" width="52" height="52" aria-hidden="true" style={{ opacity: 0.85 }}>
      {art === "bestellungen" && (
        <g {...c}>
          <path d="M14 26l22-12 22 12-22 12z" />
          <path d="M14 26v22l22 12V38" />
          <path d="M58 26v22L36 60" />
          <path d="M25 20l22 12" opacity=".5" />
        </g>
      )}
      {art === "nachrichten" && (
        <g {...c}>
          <path d="M12 20h40v26H26l-10 8V20z" />
          <path d="M20 30h24M20 37h16" opacity=".6" />
          <path d="M58 30v22l-6-5" opacity=".4" />
        </g>
      )}
      {art === "tueren" && (
        <g {...c} strokeWidth={1.5} opacity=".8">
          <path d="M26 58V16h20v42" />
          <path d="M22 58h28" />
          <circle cx="41" cy="38" r="1.6" fill="#e09a3a" stroke="none" />
        </g>
      )}
    </svg>
  );
}

export default function StudioPostfach() {
  const { designer } = useMyDesigner();
  const { lines } = useDesignerOrders(designer?.id);
  const { t, locale } = useI18n();

  const [offeneThreads, setOffeneThreads] = useState(0);
  const [neueTueren, setNeueTueren] = useState(0);
  useEffect(() => {
    if (!designer) return;
    (async () => {
      const [msgs, doors] = await Promise.all([
        supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("designer_id", designer.id).eq("status", "open"),
        supabase.from("designer_opportunities" as never).select("id", { count: "exact", head: true }).eq("designer_id", designer.id).eq("status", "gefunden"),
      ]);
      setOffeneThreads(msgs.count ?? 0);
      setNeueTueren(doors.count ?? 0);
    })();
  }, [designer]);

  const wartendeBestellungen = lines.filter((l) => l.order_status === "paid" && l.fulfillment_status === "new").length;

  const satz = (n: number, basis: "bestellungen" | "nachrichten" | "tueren") => {
    if (n === 0) return t(`studio.postfach.${basis}.leer`);
    if (n === 1) return t(`studio.postfach.${basis}.eine`);
    return t(`studio.postfach.${basis}.viele`, { n: inWorten(n, locale) });
  };

  return (
    <StudioShell title={t("studio.postfach.title")} eyebrow={t("studio.postfach.title")}>
      <p className="al-stimme mb-6 text-xl">{t("studio.postfach.intro")}</p>

      <div className="grid max-w-3xl gap-4">
        {/* Stapel 1 — Bestellungen */}
        <Link to="/studio/bestellungen" className="al-karte flex items-center gap-6 p-6 transition-transform hover:-translate-y-0.5">
          <StapelBild art="bestellungen" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl">{locale === "de" ? "Bestellungen" : "Orders"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{satz(wartendeBestellungen, "bestellungen")}</p>
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.postfach.oeffnen")}</span>
        </Link>

        {/* Stapel 2 — Nachrichten */}
        <Link to="/studio/nachrichten" className="al-karte flex items-center gap-6 p-6 transition-transform hover:-translate-y-0.5">
          <StapelBild art="nachrichten" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl">{locale === "de" ? "Nachrichten" : "Messages"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{satz(offeneThreads, "nachrichten")}</p>
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">{t("studio.postfach.oeffnen")}</span>
        </Link>

        {/* Stapel 3 — Türen: zuletzt, am leisesten. */}
        <Link to="/studio/tueren" className="al-karte flex items-center gap-6 p-5 opacity-80 transition-opacity hover:opacity-100">
          <StapelBild art="tueren" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-lg italic" style={{ color: "var(--al-ink-dim)" }}>{locale === "de" ? "Türen" : "Doors"}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--al-ink-leise)" }}>{satz(neueTueren, "tueren")}</p>
          </div>
          <span className="text-[0.62rem] uppercase tracking-[0.24em]" style={{ color: "var(--al-ink-leise)" }}>{t("studio.postfach.oeffnen")}</span>
        </Link>
      </div>
    </StudioShell>
  );
}
