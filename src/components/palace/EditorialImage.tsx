import { bildVariante, useMediaUrl } from "@/lib/media";

interface Props {
  src?: string | null;
  seed: string;
  ratio?: "3/4" | "4/5" | "3/2" | "1/1" | "16/9" | "5/4";
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  color?: boolean;
  /**
   * Wie breit das Bild höchstens gezeigt wird, in CSS-Pixeln. Daraus wird die
   * ausgelieferte Größe bestimmt (doppelt, für scharfe Bildschirme).
   *
   * 600 als Vorgabe deckt den Normalfall ab: eine Karte in einem Raster steht
   * selten breiter. Wer bildschirmfüllend zeigt, gibt eine größere Zahl an —
   * es ist besser, hier eine Zahl zu nennen, als ein 725-kB-PNG für eine
   * Kachel zu laden (siehe `bildVariante` in `src/lib/media.ts`).
   */
  anzeigeBreite?: number;
}

export function EditorialImage({
  src,
  ratio = "3/4",
  className = "",
  alt = "",
  priority,
color = false,
  anzeigeBreite = 600,
}: Props) {
  const roh = useMediaUrl(src);
  const aufgeloest = bildVariante(roh, { breite: anzeigeBreite * 2 });
  const hasSrc = typeof aufgeloest === "string" && aufgeloest.trim().length > 0;

  return (
    <div
      className={`palace-image relative overflow-hidden bg-[#FFFFFF] ${className}`}
      style={{ aspectRatio: ratio.replace("/", " / ") }}
    >
      {hasSrc ? (
        <img
          src={aufgeloest}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className="palace-image-inner absolute inset-0 h-full w-full object-cover"
          style={color ? { filter: "none" } : undefined}
          draggable={false}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border-[1.5px] border-black bg-[#FFFFFF]">
          <span className="palace-eyebrow text-[#000000]">Ohne Bild</span>
        </div>
      )}
    </div>
  );
}
