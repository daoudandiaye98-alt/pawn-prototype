/**
 * Wachstum: PAWN geht raus in die Welt. Erster Weg ist die Presse — Jarvis sucht
 * Journalist:innen, Newsletter und Blogs, die über unabhängiges Design schreiben,
 * schreibt je Kontakt einen Pitch über EIN konkretes Haus, und du entscheidest.
 * Gleiche Mechanik wie die Häuser-Akquise: suchen → Entwurf → dein Ja → raus.
 */
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { PruefStapel, type PruefLead } from "@/features/admin/PruefStapel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Radar, PenLine } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  qualifiziert: "Wartet auf dich",
  kontaktiert: "Angeschrieben",
  aussortiert: "Aussortiert",
  antwort: "Hat geantwortet",
  ruhe: "Ruhe",
};

export default function AdminWachstum() {
  const [rows, setRows] = useState<PruefLead[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("acquisition_leads")
      .select("*")
      .eq("lead_type", "presse")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown as PruefLead[]));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function run(mode: "presse_jagd" | "presse_verfassen", label: string) {
    setBusy(mode);
    const { data, error } = await supabase.functions.invoke("pawn-jarvis", { body: { mode } });
    setBusy(null);
    if (error) { toast.error(`${label}: ${error.message}`); return; }
    const result = data as { ok?: boolean; error?: string; message?: string; angelegt?: number; gefunden?: number; ready?: number; processed?: number } | null;
    if (result?.ok === false) { toast.error(result.error ?? `${label} fehlgeschlagen.`); return; }
    const detail = mode === "presse_jagd"
      ? `${result?.angelegt ?? 0} neue Kontakte von ${result?.gefunden ?? 0} gefundenen`
      : `${result?.ready ?? 0} von ${result?.processed ?? 0} Pitches geschrieben`;
    toast.success(`${label}: ${detail}${result?.message ? ` · ${result.message}` : ""}`);
    void load();
  }

  function patchRow(id: string, patch: Partial<PruefLead>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const wartend = rows.filter((r) => r.status === "qualifiziert" && !r.admin_decision).length;
  const mitEntwurf = rows.filter((r) => !!r.message_draft).length;
  const mitEmail = rows.filter((r) => !!r.email).length;
  const kontaktiert = rows.filter((r) => r.status === "kontaktiert").length;

  return (
    <AdminShell title="Wachstum" subtitle="Wie PAWN in die Welt kommt">
      <section className="mb-8 border-[1.5px] border-black">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Presse · Jarvis sucht Redaktionen</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" disabled={busy !== null} onClick={() => void run("presse_jagd", "Presse suchen")}
              className="rounded-none bg-black text-white hover:bg-white hover:text-black"
            >
              {busy === "presse_jagd" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
              Presse suchen
            </Button>
            <Button
              size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("presse_verfassen", "Pitches schreiben")}
              className="rounded-none border-black hover:bg-black hover:text-white"
            >
              {busy === "presse_verfassen" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PenLine className="mr-2 h-4 w-4" />}
              Pitches schreiben
            </Button>
          </div>
        </header>

        <dl className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
          {[
            { label: "Wartet auf dich", value: wartend },
            { label: "Mit Pitch", value: mitEntwurf },
            { label: "Mit E-Mail", value: mitEmail },
            { label: "Angeschrieben", value: kontaktiert },
          ].map((s) => (
            <div key={s.label} className="px-5 py-3">
              <dt className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-serif text-2xl tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <p className="border-t border-border px-5 py-4 text-sm text-muted-foreground">
          Jarvis sucht Redaktionen, die wirklich über unabhängiges Design schreiben, und pitcht ihnen
          immer ein einzelnes Haus statt der Plattform. Nichts geht raus, bevor du „Ja" gedrückt hast.
        </p>
      </section>

      <PruefStapel
        rows={rows}
        onChange={patchRow}
        leadType="presse"
        title="Presse prüfen · dein Ja verschickt den Pitch"
      />

      <section className="border-[1.5px] border-black">
        <header className="border-b-[1.5px] border-black px-5 py-3">
          <p className="editorial-eyebrow">Alle Presse-Kontakte · {rows.length}</p>
        </header>
        {loading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Wird geladen …</p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Noch keine Kontakte. „Presse suchen" schickt Jarvis auf die erste Runde.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-serif text-base">{r.contact_name || r.outlet || r.handle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.outlet ? `${r.outlet} · ` : ""}{r.world}
                    {r.email ? ` · ${r.email}` : " · keine Adresse"}
                  </p>
                </div>
                <span className="border border-black px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em]">
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
