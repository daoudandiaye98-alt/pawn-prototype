/**
 * Die Werkkarte der öffentlichen Bühne.
 *
 * Teil S: Boutique, Welt-Seiten und „Deine Boutique" zeigen dieselbe Karte —
 * nur die Auswahl unterscheidet sich. Deshalb steht sie ab hier an einer Stelle
 * statt in jeder Fläche noch einmal.
 *
 * Bild zuerst, runde Preise, genau eine Handlung: der Klick aufs Werk. Das
 * Merken-Herz ist keine zweite Handlung, sondern ein stiller Schalter auf dem
 * Bild — ohne Zähler, ohne Zwischenschritt.
 */
import { useRef } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { EditorialImage } from "@/components/palace/EditorialImage";
import { merkeAbflug, merkeHallenstand, useAnkunft, werkSchluessel } from "@/hooks/useFlug";
import { useI18n } from "@/lib/i18n";

export interface WerkKartenDaten {
  id: string;
  slug: string;
  name: string;
  price: number;
  image_url: string | null;
  inventory_mode?: string | null;
  stock_quantity?: number | null;
  designers?: { slug?: string; brand_name?: string } | null;
}

export function WerkKarte({
  werk,
  gemerkt,
  onMerken,
  seedPrefix = "werk",
}: {
  werk: WerkKartenDaten;
  gemerkt?: boolean;
  /** Fehlt der Griff, gibt es kein Herz — z. B. für Gäste ohne Konto. */
  onMerken?: (id: string) => void;
  seedPrefix?: string;
}) {
  const { t } = useI18n();
  const ausverkauft = werk.inventory_mode === "stock" && Number(werk.stock_quantity ?? 0) <= 0;
  /* Teil S — dieses Feld ist Start und Ziel des Flugs: hin zur Werkseite und
     auf demselben Weg zurück. Das Bild landet exakt wieder in seiner Kachel. */
  const bildFeld = useRef<HTMLDivElement>(null);
  const schluessel = werkSchluessel(werk.slug);
  useAnkunft(schluessel, bildFeld);

  return (
    <Link
      to={`/product/${werk.slug}`}
      data-werk-id={schluessel}
      onClick={() => { merkeHallenstand(); merkeAbflug(schluessel, bildFeld.current); }}
      className="group block"
    >
      <div className="relative" ref={bildFeld}>
        <EditorialImage
          src={werk.image_url}
          alt={`${werk.name} — ${werk.designers?.brand_name ?? "PAWN"}`}
          color
          seed={`${seedPrefix}-${werk.slug}`}
          ratio="4/5"
        />
        {ausverkauft && (
          <span className="absolute left-0 top-0 bg-[#000000] px-3 py-1 text-[0.58rem] uppercase tracking-[0.32em] text-[#FFFFFF]">
            {t("product.badge.soldOut")}
          </span>
        )}
        {onMerken && (
          <button
            type="button"
            aria-label={gemerkt ? t("shop.merken.gemerktAria", { name: werk.name }) : t("shop.merken.aria", { name: werk.name })}
            aria-pressed={!!gemerkt}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMerken(werk.id); }}
            className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center border-[1.5px] border-black transition-colors ${
              gemerkt ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"
            }`}
          >
            <Heart className={`h-4 w-4 ${gemerkt ? "fill-current" : ""}`} strokeWidth={1.4} />
          </button>
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-4">
        <div>
          <p className="palace-serif italic text-[1.1rem] leading-tight text-[#000000]">{werk.name}</p>
          <p className="palace-eyebrow mt-2">{werk.designers?.brand_name ?? "PAWN"}</p>
        </div>
        <p className="palace-eyebrow text-[#000000]">€{Number(werk.price).toLocaleString("de-DE")}</p>
      </div>
    </Link>
  );
}
