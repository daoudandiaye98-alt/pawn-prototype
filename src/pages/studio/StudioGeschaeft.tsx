import { Link } from "react-router-dom";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useI18n } from "@/lib/i18n";

/**
 * Teil N — Raum GESCHÄFT: sechs illustrierte Kacheln im Stil der
 * „Papierkram"-Kachel der Referenz — Plan & Rechnung, Auszahlung, Versand,
 * Verträge, Automatik, Empfehlungen. Am Ende der Verweis auf die
 * Einstellungen. Innen: ruhige Formulare im Abendlicht.
 */

type KachelKey = "plan" | "auszahlung" | "versand" | "vertraege" | "automatik" | "empfehlungen";

const KACHELN: { key: KachelKey; to: string }[] = [
  { key: "plan", to: "/studio/plan" },
  { key: "auszahlung", to: "/studio/auszahlung" },
  { key: "versand", to: "/studio/versand" },
  { key: "vertraege", to: "/studio/vertraege" },
  { key: "automatik", to: "/studio/automatik" },
  { key: "empfehlungen", to: "/studio/empfehlungen" },
];

function KachelBild({ art }: { art: KachelKey }) {
  const c = { fill: "none", stroke: "#f4c667", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 72 72" width="48" height="48" aria-hidden="true" style={{ opacity: 0.85 }}>
      {art === "plan" && (<g {...c}><path d="M20 12h24l8 8v40H20z" /><path d="M44 12v8h8" /><path d="M28 34h16M28 42h16M28 50h10" opacity=".6" /><path d="M33 24a5 5 0 1 0 5 5" /></g>)}
      {art === "auszahlung" && (<g {...c}><ellipse cx="36" cy="24" rx="16" ry="7" /><path d="M20 24v12c0 4 7 7 16 7s16-3 16-7V24" /><path d="M20 36v12c0 4 7 7 16 7s16-3 16-7V36" opacity=".6" /></g>)}
      {art === "versand" && (<g {...c}><path d="M14 28l22-12 22 12-22 12z" /><path d="M14 28v20l22 12V40" /><path d="M58 28v20L36 60" /></g>)}
      {art === "vertraege" && (<g {...c}><path d="M22 10h28v44l-6-4-6 4-6-4-6 4-4-3z" /><path d="M30 22h12M30 30h12" opacity=".6" /><circle cx="36" cy="44" r="4" /></g>)}
      {art === "automatik" && (<g {...c}><circle cx="36" cy="36" r="9" /><path d="M36 20v-6M36 58v-6M52 36h6M14 36h6M47 25l4-4M21 51l4-4M47 47l4 4M21 21l4 4" /></g>)}
      {art === "empfehlungen" && (<g {...c}><path d="M14 50V32l10-8 10 8v18" /><path d="M38 50V32l10-8 10 8v18" opacity=".7" /><path d="M10 50h52" /><path d="M30 24h12" opacity=".4" /></g>)}
    </svg>
  );
}

export default function StudioGeschaeft() {
  const { t } = useI18n();

  return (
    <StudioShell title={t("studio.geschaeft.title")} eyebrow={t("studio.geschaeft.title")}>
      <p className="al-stimme mb-6 text-xl">{t("studio.geschaeft.intro")}</p>

      <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KACHELN.map((k) => (
          <Link key={k.key} to={k.to} className="al-karte al-karte-hell flex flex-col gap-4 p-6 transition-transform hover:-translate-y-0.5">
            <KachelBild art={k.key} />
            <div>
              <p className="font-serif text-xl leading-tight">{t(`studio.geschaeft.${k.key}`)}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{t(`studio.geschaeft.${k.key}.sub`)}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Der Verweis am Ende: Einstellungen bleiben mit Wort erreichbar. */}
      <p className="mt-8 text-sm text-muted-foreground">
        {t("studio.geschaeft.einstellungenHinweis")}{" "}
        <Link to="/studio/einstellungen" className="underline underline-offset-4 hover:text-foreground">
          {t("studio.profil.einstellungen")}
        </Link>
      </p>
    </StudioShell>
  );
}
