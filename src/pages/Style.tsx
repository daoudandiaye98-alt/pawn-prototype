import { useEffect } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { PickYourStyle } from "@/components/palace/PickYourStyle";
import { Reveal } from "@/components/palace/Reveal";
import { Editable } from "@/components/palace/Editable";

export default function Style() {
  useEffect(() => { document.title = "Style — deine Handschrift finden · PAWN"; }, []);
  return (
    <PalaceLayout>
      <section className="px-6 pt-36 md:px-14 md:pt-44">
        <div className="mx-auto max-w-[1200px] text-center">
          <Reveal>
            <Editable as="p" contentKey="style_eyebrow" className="palace-eyebrow">Deine Handschrift</Editable>
            <h1
              className="palace-serif mt-8 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.6rem, 8vw, 6.4rem)", lineHeight: 0.94, letterSpacing: "-0.028em" }}
            >
              <Editable as="span" contentKey="style_headline_a">Swipe, was dich </Editable>
              <Editable as="span" contentKey="style_headline_b" className="italic">bewegt.</Editable>
            </h1>
            <Editable
              as="p"
              contentKey="style_subline"
              className="mx-auto mt-8 block max-w-xl text-[1rem] leading-[1.65] text-[#55534E]"
              multiline
            >
              Kein Fragebogen. Nur zwei Gesten. Herz für Ja, Kreuz für weiter — der Raum lernt mit jedem Zug.
            </Editable>
          </Reveal>
        </div>
      </section>
      <section className="py-20 md:py-28">
        <PickYourStyle />
      </section>
    </PalaceLayout>
  );
}

