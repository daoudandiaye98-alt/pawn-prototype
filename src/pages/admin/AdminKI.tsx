import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";

interface SignalRow {
  id: string;
  at: string;
  payload: Record<string, unknown>;
}

interface SessionRow {
  session_id: string;
  user_id: string | null;
  turns: number;
  extracted: Record<string, unknown>;
  updated_at: string;
}

const DEFAULT_PROMPT =
  "Du bist PAWN, eine leise, warme und kuratierende Stimme. Antworte auf Deutsch, in maximal 2 kurzen Sätzen. Stelle EINE konkrete, warme Frage pro Antwort. Erkläre nie Technik. Nie aufdringlich. Wenn du genug weißt (Welt + Stimmung), empfiehl 2-3 konkrete Stücke oder Designer mit einer kurzen Zeile Begründung.";

export default function AdminKI() {
  const { user, roles, loading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [provider, setProvider] = useState<"openai" | "fallback" | "unknown">("unknown");

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    (async () => {
      const [cfg, sig, ses] = await Promise.all([
        supabase.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle(),
        supabase.from("domain_events").select("id, at, payload").eq("type", "ai.taste_signal").order("at", { ascending: false }).limit(50),
        supabase.from("ai_sessions").select("session_id, user_id, turns, extracted, updated_at").order("updated_at", { ascending: false }).limit(50),
      ]);
      const val = cfg.data?.value as { system_prompt?: string; provider_hint?: string } | undefined;
      setPrompt(val?.system_prompt ?? DEFAULT_PROMPT);
      setSignals((sig.data ?? []) as SignalRow[]);
      setSessions((ses.data ?? []) as SessionRow[]);
      // Probe pawn-chat: it returns which provider actually answered when passed a diagnostic ping.
      try {
        const { data } = await supabase.functions.invoke("pawn-chat", { body: { messages: [{ role: "user", content: "__provider_probe__" }], probe: true } });
        const d = data as { provider?: string } | null;
        if (d?.provider === "openai") setProvider("openai");
        else setProvider("fallback");
      } catch { setProvider("fallback"); }
    })();
  }, [user, roles]);


  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("ai_config")
      .upsert({ key: "pawn_chat_persona", value: { system_prompt: prompt }, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Persona gespeichert.");
  };

  return (
    <AdminShell title="KI Cockpit" eyebrow="Persona · Signale · Sessions">
      <div className="mb-6 flex flex-wrap items-center gap-3 border border-border bg-card p-4">
        <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Provider</span>
        <span className={`inline-flex items-center gap-2 border px-3 py-1 text-[0.65rem] uppercase tracking-[0.28em] ${
          provider === "openai" ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${provider === "openai" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {provider === "openai" ? "OpenAI aktiv" : provider === "unknown" ? "prüfe…" : "Fallback aktiv"}
        </span>
        <span className="text-xs text-muted-foreground">
          OpenAI-Anbindung: Secret <code>OPENAI_API_KEY</code> in den Edge-Function-Secrets hinterlegen. Ohne Key nutzt PAWN einen Fallback-Gesprächsbaum.
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="border border-border bg-card p-8">
          <p className="editorial-eyebrow">Persona · pawn-chat</p>
          <h2 className="mt-2 font-serif text-2xl">System-Prompt</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Diese Stimme wird bei jeder Antwort verwendet. Änderungen greifen sofort für neue Nachrichten.
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={14}
            className="mt-6 w-full border border-border bg-background p-4 font-mono text-[0.85rem] leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPrompt(DEFAULT_PROMPT)}
              className="text-[0.6rem] uppercase tracking-[0.32em] text-muted-foreground hover:text-foreground"
            >
              Auf Standard zurücksetzen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50"
            >
              {busy ? "…" : "Speichern"}
            </button>
          </div>
        </section>

        <section className="border border-border bg-card p-8">
          <p className="editorial-eyebrow">Sessions · Übersicht</p>
          <h2 className="mt-2 font-serif text-2xl">{sessions.length} aktive Kontexte</h2>
          <ul className="mt-6 max-h-[420px] divide-y divide-border overflow-y-auto">
            {sessions.map((s) => {
              const ex = s.extracted as { world?: string; mood?: string; occasion?: string };
              return (
                <li key={s.session_id} className="py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.7rem] text-muted-foreground">{s.session_id.slice(0, 12)}…</span>
                    <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{s.turns} Turns</span>
                  </div>
                  <p className="mt-1 text-[0.85rem]">
                    {ex.world ?? "—"} · {ex.mood ?? "—"} {ex.occasion ? `· ${ex.occasion}` : ""}
                  </p>
                </li>
              );
            })}
            {sessions.length === 0 && <li className="py-6 text-sm text-muted-foreground">Noch keine Sessions.</li>}
          </ul>
        </section>
      </div>

      <section className="mt-6 border border-border bg-card p-8">
        <p className="editorial-eyebrow">Taste-Signale · letzte 50</p>
        <h2 className="mt-2 font-serif text-2xl">Roh-Feed</h2>
        <ul className="mt-6 max-h-[500px] divide-y divide-border overflow-y-auto">
          {signals.map((s) => {
            const p = s.payload as { raw?: string; world?: string; mood?: string; session_id?: string };
            return (
              <li key={s.id} className="py-3 text-sm">
                <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                  <span>{new Date(s.at).toLocaleString("de-DE")}</span>
                  <span>{p.world ?? "—"} · {p.mood ?? "—"}</span>
                </div>
                <p className="mt-1 text-[0.9rem] text-foreground">{p.raw ?? "—"}</p>
              </li>
            );
          })}
          {signals.length === 0 && <li className="py-6 text-sm text-muted-foreground">Noch keine Signale.</li>}
        </ul>
      </section>
    </AdminShell>
  );
}
