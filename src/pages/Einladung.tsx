import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { Reveal } from "@/components/palace/Reveal";
import { Button } from "@/components/ui/button";
import { PawnFigurSvg } from "@/components/pawn/PawnFigur";
import { supabase } from "@/integrations/supabase/client";
import { captureRefCode } from "@/features/acquisition/leadAttribution";
import { useI18n, type Locale } from "@/lib/i18n";

interface Invitation { handle: string; world: string | null; personal_line: string | null; lead_type: string; language: string | null }

const FOUNDING_SEATS = 50;

/**
 * WP2 "Die ersten Fünfzig" — die persönliche Einladungsseite. Wer über einen Akquise-Link
 * kommt, landet nicht auf der generischen Bewerbungsseite, sondern auf einer, die für ihn/sie
 * geschrieben wirkt. Ungültiger/fehlender Code: sauberer Fallback auf /apply, kein Fehlerbild.
 *
 * PART 40 WP2 "Sprachheilung": die Seite wählt beim Laden die Sprache des Leads (aus dem
 * verfassten Draft) als Ausgangspunkt — der Sprach-Toggle im Header bleibt danach voll bedienbar,
 * das setzt nur den Startzustand, damit ein englischsprachiger Lead nicht auf einer deutschen
 * Seite landet.
 */
export default function Einladung() {
  const { refCode } = useParams<{ refCode: string }>();
  const { t, setLocale } = useI18n();
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
      if (row.language === "en" || row.language === "de") setLocale(row.language as Locale);
      setFoundingCount(typeof count === "number" ? count : 0);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refCode]);

  if (loading) return null;
  if (notFound || !invitation) return <Navigate to="/apply" replace />;

  const seatsTaken = foundingCount ?? 0;
  const seatsLine = seatsTaken <= 0
    ? t("einladung.seatsOpen")
    : seatsTaken >= FOUNDING_SEATS
      ? t("einladung.seatsFull")
      : t("einladung.seatsProgress", { taken: seatsTaken, total: FOUNDING_SEATS });

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
            {t("einladung.title", { handle: invitation.handle })}
          </h1>
          {invitation.personal_line && (
            <p className="mx-auto mt-6 max-w-[560px] text-center font-serif text-lg italic text-[#000000]/80">
              {invitation.personal_line}
            </p>
          )}
        </Reveal>

        <Reveal>
          <div className="mt-14 border-[1.5px] border-[#000000] p-6 text-center md:p-8">
            <p className="palace-eyebrow">{t("einladung.eyebrow")}</p>
            <p className="mt-3 font-serif text-xl">{seatsLine}</p>
            <p className="mt-4 text-sm text-[#000000]/70">{t("einladung.offer")}</p>
            <Button asChild variant="editorial" size="chip" className="mt-6 justify-center border-black bg-black text-white hover:bg-white hover:text-black">
              <Link to="/apply/form">{t("einladung.cta")}</Link>
            </Button>
          </div>
        </Reveal>

        <p className="mt-10 text-center text-xs text-[#000000]/50">{t("einladung.decline")}</p>
      </section>
    </PalaceLayout>
  );
}
