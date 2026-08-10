import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { Button } from "@/components/ui/button";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";
import { supabase } from "@/integrations/supabase/client";
import { captureRefCode } from "@/features/acquisition/leadAttribution";

interface Invitation { handle: string; world: string | null; personal_line: string | null; lead_type: string }

const FOUNDING_SEATS = 50;

/**
 * WP2 "Die ersten Fünfzig" — die persönliche Einladungsseite. Wer über einen Akquise-Link
 * kommt, landet nicht auf der generischen Bewerbungsseite, sondern auf einer, die für ihn/sie
 * geschrieben wirkt. Ungültiger/fehlender Code: sauberer Fallback auf /apply, kein Fehlerbild.
 */
export default function Einladung() {
  const { refCode } = useParams<{ refCode: string }>();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [foundingCount, setFoundingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!refCode) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const [{ data: leadRows }, { data: count }] = await Promise.all([
        supabase.rpc("get_lead_invitation", { _ref_code: refCode }),
        supabase.rpc("count_founding_designers"),
      ]);
      const row = (leadRows as Invitation[] | null)?.[0] ?? null;
      if (!row) { setNotFound(true); setLoading(false); return; }
      captureRefCode(refCode);
      setInvitation(row);
      setFoundingCount(typeof count === "number" ? count : 0);
      setLoading(false);
    })();
  }, [refCode]);

  if (loading) return null;
  if (notFound || !invitation) return <Navigate to="/apply" replace />;

  const seatsTaken = foundingCount ?? 0;
  const seatsLine = seatsTaken <= 0
    ? "Die ersten 50 Plätze sind offen — du wärst unter den Allerersten."
    : seatsTaken >= FOUNDING_SEATS
      ? "Die ersten 50 Plätze sind vergeben — schreib uns trotzdem, wir führen eine Warteliste."
      : `${seatsTaken} von ${FOUNDING_SEATS} Plätzen sind vergeben.`;

  return (
    <PalaceLayout transparentHeader={false}>
      <section className="mx-auto max-w-[720px] px-6 pt-32 pb-24 md:pt-40">
        <Reveal>
          <div className="mb-8 flex justify-center">
            <PawnFigurSvg className="h-14 w-auto" />
          </div>
          {invitation.world && (
            <p className="palace-eyebrow text-center">{invitation.world}</p>
          )}
          <h1
            className="palace-serif mt-4 text-center font-light text-[#000000]"
            style={{ fontSize: "clamp(2rem,5vw,3.2rem)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
          >
            PAWN hat deine Arbeit gesehen, @{invitation.handle}.
          </h1>
          {invitation.personal_line && (
            <p className="mx-auto mt-6 max-w-[560px] text-center font-serif text-lg italic text-[#000000]/80">
              {invitation.personal_line}
            </p>
          )}
        </Reveal>

        <Reveal>
          <div className="mt-14 border-[1.5px] border-[#000000] p-6 text-center md:p-8">
            <p className="palace-eyebrow">Die ersten 50 Plätze.</p>
            <p className="mt-3 font-serif text-xl">{seatsLine}</p>
            <p className="mt-4 text-sm text-[#000000]/70">
              Kostenloser Einstieg, du behältst 93 % jedes Verkaufs. Kein Abo nötig, um zu starten.
            </p>
            <Button asChild variant="editorial" size="chip" className="mt-6 justify-center border-black bg-black text-white hover:bg-white hover:text-black">
              <Link to="/apply/form">Jetzt bewerben →</Link>
            </Button>
          </div>
        </Reveal>

        <p className="mt-10 text-center text-xs text-[#000000]/50">
          Kein Interesse? Diese Einladung verfällt einfach — es passiert nichts automatisch.
        </p>
      </section>
    </PalaceLayout>
  );
}
