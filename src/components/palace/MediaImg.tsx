import { forwardRef, type ImgHTMLAttributes } from "react";
import { useMediaUrl } from "@/lib/media";

/**
 * Drop-in-Ersatz für <img> bei Werkbildern: löst gespeicherte
 * designer-media-Orte beim Anzeigen in eine frische, kurzlebige URL auf.
 * Alle anderen Quellen (externe Bilder, data:, blob:) laufen unverändert durch.
 *
 * Teil S: reicht eine Referenz durch. Der Flug misst das Bild selbst — nicht
 * seinen Kasten. Bei `object-contain` sind das zwei verschiedene Rechtecke.
 */
export const MediaImg = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function MediaImg({ src, ...rest }, ref) {
    const aufgeloest = useMediaUrl(typeof src === "string" ? src : null);
    return <img {...rest} ref={ref} src={aufgeloest} />;
  },
);
