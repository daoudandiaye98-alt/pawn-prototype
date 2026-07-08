import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AdminShell } from "@/components/pawn/AdminShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowUpRight, ArrowDownRight, Minus, RefreshCw } from "lucide-react";

type World = "Mode" | "Interior" | "Kunst";
interface MomentumRow {
  term: string;
  world: string;
  latest_score: number;
  ema7: number;
  slope: number;
  momentum: "steigend" | "stabil" | "fallend";
  forecast14: number;
  history: number[] | null;
}

function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length === 0) return <span className="text-muted-foreground/40">—</span>;
  const w = 84, h = 24;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="text-foreground">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}

function MomentumIcon({ m }: { m: MomentumRow["momentum"] }) {
  if (m === "steigend") return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (m === "fallend") return <ArrowDownRight className="h-4 w-4 text-rose-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function AdminTrends() {
  const { user, roles, loading } = useAuth();
  const [world, setWorld] = useState<World>("Mode");
  const [rows, setRows] = useState<MomentumRow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [computing, setComputing] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<string | null>(null);

  const load = async (w: World) => {
    setFetching(true);
    try {
      const [{ data, error }, snap] = await Promise.all([
        supabase.rpc("trend_momentum" as never, { _world: w } as never),
        supabase.from("trend_snapshots" as never).select("day").order("day", { ascending: false }).limit(1),
      ]);
      if (error) throw error;
      setRows(((data as unknown) as MomentumRow[]) ?? []);
      const first = (snap.data as { day?: string }[] | null)?.[0];
      setLastSnapshot(first?.day ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setFetching(false); }
  };

  useEffect(() => { if (user && roles.includes("admin")) void load(world); }, [world, user, roles]);

  const recompute = async () => {
    setComputing(true);
    try {
      const { data, error } = await supabase.functions.invoke("compute-trends");
      if (error) throw error;
      const d = data as { upserted?: number; day?: string };
      toast.success(`Neu berechnet · ${d.upserted ?? 0} Snapshots für ${d.day ?? "heute"}`);
      await load(world);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setComputing(false); }
  };

  const top = useMemo(() => rows.slice(0, 40), [rows]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  return (
    <AdminShell title="Trends" eyebrow="Momentum · Prognose · Bewegung">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex border border-border">
          {(["Mode", "Interior", "Kunst"] as World[]).map((w) => (
            <button key={w} onClick={() => setWorld(w)}
              className={`px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] ${world === w ? "bg-foreground text-background" : "hover:bg-muted"}`}>
              {w}
            </button>
          ))}
        </div>
        <span className="text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
          Letzter Snapshot: {lastSnapshot ?? "—"}
        </span>
        <button onClick={recompute} disabled={computing}
          className="ml-auto inline-flex items-center gap-2 border border-foreground bg-foreground px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background hover:bg-black disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${computing ? "animate-spin" : ""}`} />
          {computing ? "Berechne…" : "Jetzt neu berechnen"}
        </button>
      </div>

      <section className="border border-border bg-card">
        {fetching ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Lade…</p>
        ) : top.length === 0 ? (
          <div className="p-14 text-center">
            <p className="font-serif text-2xl">Noch zu wenig Daten für Prognosen.</p>
            <p className="mt-3 text-sm text-muted-foreground">Der Strom wächst mit jedem Besucher. Klick „Jetzt neu berechnen", sobald erste Interaktionen da sind.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
                <th className="px-4 py-3">Begriff</th>
                <th className="px-4 py-3 text-right">Score heute</th>
                <th className="px-4 py-3 text-right">Ø 7 Tage</th>
                <th className="px-4 py-3">Verlauf</th>
                <th className="px-4 py-3">Momentum</th>
                <th className="px-4 py-3 text-right">Prognose (14 T)</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.term} className="border-b border-border/60">
                  <td className="px-4 py-3 font-serif text-base">{r.term}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(r.latest_score).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(r.ema7).toFixed(1)}</td>
                  <td className="px-4 py-3"><Sparkline points={r.history ?? []} /></td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[0.72rem]">
                      <MomentumIcon m={r.momentum} />
                      <span className={r.momentum === "steigend" ? "text-emerald-700" : r.momentum === "fallend" ? "text-rose-700" : "text-muted-foreground"}>{r.momentum}</span>
                      {r.slope !== 0 && (
                        <span className="text-[0.65rem] text-muted-foreground">
                          {r.slope > 0 ? "+" : ""}{Number(r.slope).toFixed(1)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {Number(r.forecast14).toFixed(1)}
                    <span className="ml-1 text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground">Verlauf</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Alle Prognosen entstehen als lineare Fortschreibung des 7-Tage-Verlaufs — sie zeigen die Richtung, nicht die Gewissheit.
        Score = Ansichten · 1 + Likes · 3 + Merken · 4 + Käufe · 10.
      </p>
    </AdminShell>
  );
}
