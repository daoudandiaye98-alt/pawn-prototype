import { WorldPage } from "@/components/palace/WorldPage";

export default function Kunst() {
  return (
    <WorldPage
      world="Kunst"
      eyebrow="Welt · 03"
      headline={<>Kunst. <span className="italic">Was den Raum trägt.</span></>}
      intro="Malerei, Editionen, Tapisserie — Arbeiten, die eine Wand zu einem Ort machen."
    />
  );
}
