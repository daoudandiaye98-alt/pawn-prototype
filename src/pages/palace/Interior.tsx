import { WorldPage } from "@/components/palace/WorldPage";

export default function Interior() {
  return (
    <WorldPage
      world="Interior"
      eyebrow="Welt · 02"
      headline={<>Interior. <span className="italic">Objekte, mit denen man lebt.</span></>}
      intro="Möbel, Licht, Spiegel, Vasen — Stücke an der Schwelle zwischen Ding und Skulptur."
    />
  );
}
