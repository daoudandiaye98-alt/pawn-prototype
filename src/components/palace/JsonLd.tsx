/**
 * Teil L3 — strukturierte Daten (schema.org) als JSON-LD.
 * Google liest JSON-LD auch aus dem <body>, deshalb genügt ein einfaches
 * <script>-Element im JSX — kein Head-Management nötig.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const SITE_URL = "https://pawn.vision";

/** Organization — einmal je Seite über PalaceLayout. */
export function organizationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PAWN",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    description:
      "PAWN ist ein kuratierter Marktplatz für unabhängige Designer aus Mode, Interior und Kunst.",
  };
}
