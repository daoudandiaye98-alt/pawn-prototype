/**
 * Teil 17b: Creator Package — alles, was jemand zum Teilen eines Stücks braucht, in einer
 * einzigen ZIP-Datei. Läuft komplett im Browser (JSZip), kein Server-Aufruf, keine Credits.
 */
import JSZip from "jszip";
import { renderShareKit, buildCaption, formatPrice, fetchShareKitTexts, SHARE_FORMAT_LABEL, type ShareFormat } from "./shareKit";

export interface CreatorPackageInput {
  brandName: string;
  brandStory: string | null;
  logoUrl: string | null;
  productName: string;
  productImageUrl: string;
  price: number;
  productLink: string;
  world: string;
}

async function fetchAsBlob(url: string): Promise<{ blob: Blob; ext: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch_failed: ${url}`);
  const blob = await res.blob();
  const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  return { blob, ext };
}

const FORMATS: ShareFormat[] = ["post_1x1", "story_9x16", "pin_2x3", "banner"];

/** Baut die ZIP und liefert sie als Blob — das Aufrufen-und-Herunterladen übernimmt der Aufrufer. */
export async function buildCreatorPackage(input: CreatorPackageInput): Promise<Blob> {
  const zip = new JSZip();
  const texts = await fetchShareKitTexts();
  const priceLabel = formatPrice(input.price);
  const caption = buildCaption(texts.caption_template, {
    brand: input.brandName,
    name: input.productName,
    price: priceLabel,
    link: input.productLink,
  });
  const hashtags = (texts.hashtag_sets[input.world] ?? []).join(" ");

  const images = zip.folder("bilder");
  const original = await fetchAsBlob(input.productImageUrl);
  images?.file(`original.${original.ext}`, original.blob);

  for (const format of FORMATS) {
    const rendered = await renderShareKit(format, {
      imageUrl: input.productImageUrl,
      brandName: input.brandName,
      productName: input.productName,
      price: input.price,
    });
    images?.file(`${format}-${SHARE_FORMAT_LABEL[format].toLowerCase()}.png`, rendered);
  }

  if (input.logoUrl) {
    try {
      const logo = await fetchAsBlob(input.logoUrl);
      zip.file(`logo.${logo.ext}`, logo.blob);
    } catch {
      /* Logo optional — fehlt es, bleibt das Paket trotzdem vollständig nutzbar. */
    }
  }

  const infoLines = [
    `${input.brandName} — ${input.productName}`,
    "",
    input.brandStory?.trim() || "",
    "",
    `Preis: ${priceLabel}`,
    `Link: ${input.productLink}`,
    "",
    "Bildunterschrift-Vorschlag:",
    caption,
    "",
    hashtags ? `Hashtags: ${hashtags}` : "",
  ].filter((l, i, arr) => l !== "" || (arr[i - 1] !== "" && i > 0));
  zip.file("Info.txt", infoLines.join("\n"));

  return zip.generateAsync({ type: "blob" });
}
