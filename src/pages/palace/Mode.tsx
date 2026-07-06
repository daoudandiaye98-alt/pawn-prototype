import { WorldPage } from "@/components/palace/WorldPage";

export default function Mode() {
  return (
    <WorldPage
      world="Mode"
      eyebrow="Welt · 01"
      headline={<>Mode. <span className="italic">Kleidung als Sprache.</span></>}
      intro="Sechs Ateliers, die jeden Schnitt zweimal denken. Vom leisen Mantel bis zur harten Kante."
    />
  );
}
