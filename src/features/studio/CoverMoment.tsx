/**
 * Teil 27b — Der Cover-Moment: der Times-Square-Moment als Funktion. Geht ein Stück zum
 * ersten Mal live, sieht der Designer sein Werk einmalig bildschirmfüllend — sein Hausname
 * in Riesentype darüber, die Ausgabennummer klein darunter. Beim Veröffentlichen der
 * Hausseite läuft derselbe Moment, nur kleiner inszeniert (variant="hausseite").
 * Bewusst kein Systemschmuck: nur das Bild, der Name, die Zahl, ein ruhiger Zug.
 */
import { useState } from "react";
import { renderCoverShareKit, downloadBlob } from "@/features/share/shareKit";
import { toast } from "sonner";
import { MediaImg } from "@/components/palace/MediaImg";

interface CoverMomentProps {
  imageUrl: string;
  brandName: string;
  houseNumber: number | null;
  variant: "product" | "hausseite";
  onDone: () => void;
}

export function CoverMoment({ imageUrl, brandName, houseNumber, variant, onDone }: CoverMomentProps) {
  const [sharing, setSharing] = useState(false);
  const isProduct = variant === "product";
  const editionLabel = `№ ${String(houseNumber ?? 0).padStart(3, "0")}`;

  const shareAsImage = async () => {
    setSharing(true);
    try {
      const blob = await renderCoverShareKit({ imageUrl, brandName, houseNumber });
      downloadBlob(blob, `${brandName.toLowerCase().replace(/\s+/g, "-")}-cover.png`);
    } catch (e) {
      toast.error((e as Error).message || "Bild konnte nicht erzeugt werden.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black" role="dialog" aria-modal="true">
      <MediaImg src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="relative flex h-full flex-col justify-end p-8 text-white md:p-16">
        <h1
          className={
            isProduct
              ? "font-serif font-semibold leading-[0.95] text-[3rem] md:text-[6rem]"
              : "font-serif font-semibold leading-[0.95] text-[2.1rem] md:text-[3.4rem]"
          }
        >
          {brandName}
        </h1>
        <p className="mt-3 text-[0.62rem] uppercase tracking-[0.32em] text-white/60">{editionLabel}</p>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <button
            onClick={onDone}
            className="border border-white px-6 py-3 text-[0.68rem] uppercase tracking-[0.28em] hover:bg-white hover:text-black"
          >
            Weiter
          </button>
          <button
            onClick={() => void shareAsImage()}
            disabled={sharing}
            className="text-[0.68rem] uppercase tracking-[0.28em] text-white/70 hover:text-white disabled:opacity-50"
          >
            {sharing ? "…" : "Als Bild teilen"}
          </button>
        </div>
      </div>
    </div>
  );
}
