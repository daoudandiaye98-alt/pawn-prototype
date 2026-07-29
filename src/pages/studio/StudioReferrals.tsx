/**
 * Teil 17d: Der Reichweiten-Hebel — jedes Haus bekommt einen Empfehlungslink (sein eigener
 * Slug als Code, kein neues Feld nötig). Bringt der Link jemand Neues zu PAWN, der eine
 * Bestellung abschließt, gibt es eine KI-Credit-Gutschrift — nie Geld, nie für Selbstkäufe,
 * nie vor Bestellabschluss. Die serverseitige Prüfung sitzt in grant_referral_credit.
 */
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { StudioShell } from "@/components/pawn/StudioShell";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy } from "lucide-react";

interface ReferralRow { id: string; created_at: string }

export default function StudioReferrals() {
  const { designer, loading } = useMyDesigner();
  const [qr, setQr] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(20);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [reach, setReach] = useState<{ houses: number; views: number } | null>(null);

  const link = designer ? `${window.location.origin}/?ref=${designer.slug}` : "";

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { margin: 1, width: 240, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(null));
  }, [link]);

  useEffect(() => {
    void supabase.from("ai_config").select("value").eq("key", "referral_program").maybeSingle()
      .then(({ data }) => setCredits(Number(((data?.value ?? {}) as { credits?: number }).credits ?? 20)));
  }, []);

  useEffect(() => {
    if (!designer) return;
    void supabase.from("referrals" as never).select("id, created_at").eq("referrer_designer_id", designer.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setReferrals((data as unknown as ReferralRow[]) ?? []));
  }, [designer?.id]);

  useEffect(() => {
    void (async () => {
      const { count: houses } = await supabase.from("designers").select("id", { count: "exact", head: true }).eq("published", true);
      const { data: prods } = await supabase.from("products").select("view_count").eq("status", "published");
      const views = ((prods ?? []) as { view_count: number | null }[]).reduce((s, p) => s + (p.view_count ?? 0), 0);
      setReach({ houses: houses ?? 0, views });
    })();
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(link).then(() => toast.success("Link kopiert.")).catch(() => toast.error("Kopieren fehlgeschlagen."));
  };

  if (loading) return <StudioShell title="Empfehlungen"><div className="h-64 animate-pulse bg-muted" /></StudioShell>;
  if (!designer) return <StudioShell title="Empfehlungen"><p className="text-muted-foreground">Kein Studio-Zugang.</p></StudioShell>;

  return (
    <StudioShell title="Empfehlungen" eyebrow="Reichweite teilen">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-muted-foreground">
          Wer über deinen Link zu PAWN kommt und seine erste Bestellung abschließt — bei irgendeinem Haus,
          nicht nur bei dir — bringt dir {credits} KI-Credits ein. Nie Geld, kein Selbstkauf, keine Gutschrift
          vor abgeschlossener Bestellung.
        </p>

        <div className="mt-8 border-[1.5px] border-foreground bg-white p-6">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Dein Link</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all border border-border bg-muted/40 px-3 py-2 text-sm">{link}</code>
            <button type="button" onClick={copyLink}
              className="inline-flex shrink-0 items-center gap-1.5 border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-background hover:bg-black">
              <Copy className="h-3.5 w-3.5" /> Kopieren
            </button>
          </div>
          {qr && (
            <div className="mt-6 flex flex-col items-center gap-2">
              <img src={qr} alt="QR-Code für deinen Empfehlungslink" className="border border-border" width={160} height={160} />
              <p className="text-xs text-muted-foreground">Zum Scannen — für Karten, Aufsteller oder Stories.</p>
            </div>
          )}
        </div>

        {reach && (
          <p className="mt-6 text-sm text-muted-foreground">
            Gemeinsam erreichen die {reach.houses} veröffentlichten Häuser von PAWN {reach.views.toLocaleString("de-DE")} Aufrufe —
            das ist das Netzwerk, das dein Link mitnutzt.
          </p>
        )}

        <div className="mt-10">
          <p className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Deine Empfehlungen · {referrals.length}</p>
          {referrals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Noch keine — sobald der erste Kauf über deinen Link abgeschlossen ist, steht er hier.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border border-border bg-white">
              {referrals.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{new Date(r.created_at).toLocaleDateString("de-DE")}</span>
                  <span className="text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">+{credits} Credits gutgeschrieben</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
