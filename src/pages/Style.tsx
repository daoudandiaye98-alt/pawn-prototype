import { useEffect } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { PickYourStyle } from "@/components/palace/PickYourStyle";
import { Reveal } from "@/components/palace/Reveal";

export default function Style() {
  useEffect(() => { document.title = "Style — deine Handschrift finden · PAWN"; }, []);
  return (
    <PalaceLayout>
      <section className="px-6 pt-36 md:px-14 md:pt-44">
        <div className="mx-auto max-w-[1200px] text-center">
          <Reveal>
            <p className="palace-eyebrow">Deine Handschrift</p>
            <h1
              className="palace-serif mt-8 font-light text-[#0C0C0E]"
              style={{ fontSize: "clamp(2.4rem, 6vw, 5.4rem)", lineHeight: 0.98, letterSpacing: "-0.02em" }}
            >
              Swipe, was dich <span className="italic">bewegt.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[1rem] leading-[1.65] text-[#55534E]">
              Kein Fragebogen. Nur zwei Gesten. Herz für Ja, Kreuz für weiter — der Raum lernt mit jedem Zug.
            </p>
          </Reveal>
        </div>
      </section>
      <section className="py-20 md:py-28">
        <PickYourStyle />
      </section>
    </PalaceLayout>
  );
}
