import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { supabase } from "@/integrations/supabase/client";

/**
 * Teil 39 AP4 — Ziel des Ein-Klick-Abmeldelinks aus Akquise-E-Mails. Kein Login, kein Formular:
 * die Seite meldet den Lead beim Laden ab und zeigt eine ehrliche Bestätigung oder einen Fehler.
 */
export default function AkquiseAbmelden() {
  const [params] = useSearchParams();
  const leadId = params.get("lead");
  const [state, setState] = useState<"lädt" | "fertig" | "fehler">("lädt");

  useEffect(() => {
    if (!leadId) { setState("fehler"); return; }
    supabase.functions.invoke("akquise-abmelden", { body: { lead_id: leadId } })
      .then(({ data, error }) => {
        const ok = !error && (data as { ok?: boolean } | null)?.ok;
        setState(ok ? "fertig" : "fehler");
      })
      .catch(() => setState("fehler"));
  }, [leadId]);

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[620px] px-6 pt-32 pb-24 text-center md:pt-40">
        <Reveal>
          <p className="palace-eyebrow">Abmeldung</p>
          <h1
            className="palace-serif mt-6 font-light text-[#000000]"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            {state === "lädt" && "Einen Moment."}
            {state === "fertig" && "Du bist ausgetragen."}
            {state === "fehler" && "Das hat nicht geklappt."}
          </h1>
          <p className="mt-6 font-sans text-[0.95rem] leading-relaxed text-[#000000]/80">
            {state === "lädt" && "Wir tragen dich gerade aus der Liste aus."}
            {state === "fertig" && "Du bekommst von PAWN keine weiteren Akquise-Nachrichten mehr. Kein Konto, keine weitere Aktion nötig."}
            {state === "fehler" && (
              <>
                Der Link scheint fehlerhaft zu sein. Schreib uns kurz an{" "}
                <a href="mailto:pawnstudio.co@gmail.com" className="underline">pawnstudio.co@gmail.com</a>, dann tragen wir dich von Hand aus.
              </>
            )}
          </p>
        </Reveal>
      </section>
    </PalaceLayout>
  );
}
