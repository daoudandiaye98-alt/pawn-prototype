import { Link } from "react-router-dom";
import { PortalShell } from "@/components/pawn/PortalShell";
import { RoleGate, PrototypeAccessBanner } from "@/features/access/RoleGate";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useI18n } from "@/lib/i18n";
import { ArrowUpRight } from "lucide-react";

/**
 * Teil R9 — ECHTE WERTE ODER LEERER ZUSTAND, KEINE PLATZHALTERZAHLEN.
 *
 * Diese Seite war eine Attrappe aus der ersten Bauphase. Jede Zahl darauf war
 * erfunden: 128.460 € Umsatz, 284 Bestellungen, 4,2 % Konversion, 18.420 €
 * nächste Auszahlung, Bestellungen „#P-24818 · Berlin", Nachrichten von einer
 * „Marie L.", ein Entwurf „SS26 · Look 04 · Deconstructed Blazer" und eine
 * DNA-Verteilung 62/24/14. Keine einzige davon hatte eine Quelle. Dazu stand
 * überall der Name eines echten, fremden Modehauses — das ist nach dem
 * Markengesetz des Projekts ohnehin verboten.
 *
 * Warum hier nicht einfach echte Zahlen stehen: die gibt es schon, an genau
 * einer Stelle — im Studio unter `/studio` (`StudioOverview.tsx`), an der
 * Datenbank verdrahtet. Eine zweite Fassung derselben Kennzahlen wäre ein
 * zweites Modell für dieselbe Sache und würde beim nächsten Umbau auseinander
 * laufen. Deshalb: hier stehen keine Zahlen, sondern der Weg dorthin.
 *
 * Was echt ist, steht echt da: der Name des eigenen Hauses aus `designers`.
 */

function Weg({ to, titel, text }: { to: string; titel: string; text: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start justify-between gap-4 border border-[hsl(var(--border-strong))] bg-card p-6 transition-colors hover:bg-foreground hover:text-background"
    >
      <div>
        <p className="t-display-sm font-normal">{titel}</p>
        <p className="mt-1 text-sm text-muted-foreground group-hover:text-background/70">{text}</p>
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0" />
    </Link>
  );
}

function StudioBody() {
  const { t } = useI18n();
  const { designer, loading } = useMyDesigner();

  const haus = designer?.brand_name?.trim();

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-8">
        <p className="editorial-eyebrow">{t("portal.overview.eyebrow")}</p>
        <h2 className="mt-2 font-serif text-4xl">
          {loading ? "…" : haus ? t("portal.overview.greeting", { brand: haus }) : t("portal.overview.greetingNoHouse")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("portal.overview.subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Weg to="/studio" titel={t("portal.overview.weg.studio.title")} text={t("portal.overview.weg.studio.body")} />
        <Weg to="/portal/editor" titel={t("portal.overview.weg.profil.title")} text={t("portal.overview.weg.profil.body")} />
      </div>
    </div>
  );
}

const PortalOverview = () => {
  const { t } = useI18n();
  return (
    <RoleGate role="designer">
      <PortalShell eyebrow={t("portal.overview.eyebrow")} title={t("account.overview")}>
        <PrototypeAccessBanner role="Designer Studio" />
        <StudioBody />
      </PortalShell>
    </RoleGate>
  );
};

export default PortalOverview;
