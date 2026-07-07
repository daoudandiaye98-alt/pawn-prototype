import { useEffect, useState } from "react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";

interface SignalRow { id: string; at: string; payload: Record<string, unknown> }
interface SessionRow { session_id: string; user_id: string | null; turns: number; extracted: Record<string, unknown>; updated_at: string }
interface ResponseRow { id: string; at: string; payload: Record<string, unknown> }
interface IntegrationRow {
  id: string; kind: "gmail" | "instagram" | "webhook" | "custom"; label: string;
  config: Record<string, unknown>; enabled: boolean; event_types: string[]; created_at: string;
}

const DEFAULT_PROMPT =
  "Du bist PAWN, eine leise, warme und kuratierende Stimme. Antworte auf Deutsch, in maximal 2 kurzen Sätzen. Stelle EINE konkrete, warme Frage pro Antwort. Erkläre nie Technik. Nie aufdringlich. Wenn du genug weißt (Welt + Stimmung), empfiehl 2-3 konkrete Stücke oder Designer mit einer kurzen Zeile Begründung.";
const DEFAULT_COPILOT =
  "Du bist PAWN Copilot — ein leiser, präziser Partner für unabhängige Designer. Antworte auf Deutsch, sachlich, ohne Marketing-Floskeln. Baue jede Antwort auf den konkreten Store-Daten des Designers auf. Ein Vorschlag pro Antwort, wenn möglich.";

type Tab = "persona" | "signale" | "responses" | "integrationen";

export default function AdminKI() {
  const { user, roles, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("persona");
  const [prompt, setPrompt] = useState("");
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [usage, setUsage] = useState<{ chat: number; copilot: number; campaigns: number }>({ chat: 0, copilot: 0, campaigns: 0 });
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [newIntegration, setNewIntegration] = useState<Partial<IntegrationRow> | null>(null);
  const [provider, setProvider] = useState<"openai" | "fallback" | "unknown">("unknown");

  const refreshAll = async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [cfg, cfgCopilot, sig, ses, resp, usageAll, ints] = await Promise.all([
      supabase.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "copilot_prompt").maybeSingle(),
      supabase.from("domain_events").select("id, at, payload").eq("type", "ai.taste_signal").order("at", { ascending: false }).limit(50),
      supabase.from("ai_sessions").select("session_id, user_id, turns, extracted, updated_at").order("updated_at", { ascending: false }).limit(50),
      supabase.from("domain_events").select("id, at, payload").eq("type", "ai.response_logged").order("at", { ascending: false }).limit(20),
      supabase.from("domain_events").select("payload").eq("type", "ai.response_logged").gte("at", since),
      supabase.from("ai_integrations").select("*").order("created_at", { ascending: false }),
    ]);
    setPrompt(((cfg.data?.value as { system_prompt?: string })?.system_prompt) ?? DEFAULT_PROMPT);
    setCopilotPrompt(((cfgCopilot.data?.value as { system_prompt?: string })?.system_prompt) ?? DEFAULT_COPILOT);
    setSignals((sig.data ?? []) as SignalRow[]);
    setSessions((ses.data ?? []) as SessionRow[]);
    setResponses((resp.data ?? []) as ResponseRow[]);
    let chat = 0, copilot = 0, campaigns = 0;
    for (const e of usageAll.data ?? []) {
      const m = (e.payload as { mode?: string })?.mode;
      if (m === "chat") chat += 1;
      else if (m === "campaign_draft") { copilot += 1; campaigns += 1; }
      else if (m) copilot += 1;
    }
    setUsage({ chat, copilot, campaigns });
    setIntegrations((ints.data ?? []) as IntegrationRow[]);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refreshAll();
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("pawn-chat", { body: { probe: true, messages: [] } });
        setProvider((data as { provider?: string })?.provider === "openai" ? "openai" : "fallback");
      } catch { setProvider("fallback"); }
    })();
  }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const savePrompt = async (key: "pawn_chat_persona" | "copilot_prompt", value: string) => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key, value: { system_prompt: value }, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Gespeichert.");
  };

  const saveIntegration = async (i: Partial<IntegrationRow>) => {
    if (!i.kind || !i.label) return toast.error("Kind und Label sind Pflicht.");
    const payload = {
      kind: i.kind, label: i.label, config: i.config ?? {},
      enabled: i.enabled ?? true, event_types: i.event_types ?? [],
      created_by: user.id,
    };
    const q = i.id
      ? supabase.from("ai_integrations").update(payload).eq("id", i.id)
      : supabase.from("ai_integrations").insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success("Integration gespeichert.");
    setNewIntegration(null);
    await refreshAll();
  };

  const toggleIntegration = async (i: IntegrationRow) => {
    await supabase.from("ai_integrations").update({ enabled: !i.enabled }).eq("id", i.id);
    await refreshAll();
  };
  const removeIntegration = async (id: string) => {
    if (!confirm("Integration entfernen?")) return;
    await supabase.from("ai_integrations").delete().eq("id", id);
    await refreshAll();
  };

  return (
    <AdminShell title="KI Cockpit" eyebrow="Persona · Copilot · Signale · Integrationen">
      <div className="mb-6 flex flex-wrap items-center gap-3 border border-border bg-card p-4">
        <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Provider</span>
        <span className={`inline-flex items-center gap-2 border px-3 py-1 text-[0.65rem] uppercase tracking-[0.28em] ${provider === "openai" ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${provider === "openai" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {provider === "openai" ? "OpenAI aktiv" : provider === "unknown" ? "prüfe…" : "Fallback aktiv"}
        </span>
        <span className="text-xs text-muted-foreground">Secret <code>OPENAI_API_KEY</code> in den Edge-Function-Secrets hinterlegen.</span>
        <div className="ml-auto flex items-center gap-4 text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Chat 7T: <b className="text-foreground">{usage.chat}</b></span>
          <span>Copilot 7T: <b className="text-foreground">{usage.copilot}</b></span>
          <span>Kampagnen 7T: <b className="text-foreground">{usage.campaigns}</b></span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {(["persona","signale","responses","integrationen"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "persona" ? "Persona" : t === "signale" ? "Signale" : t === "responses" ? "Antwort-Log" : "Integrationen"}
          </button>
        ))}
      </div>

      {tab === "persona" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <PromptEditor label="Frag PAWN (Chat)" description="Diese Stimme antwortet Kund:innen im öffentlichen Chat." value={prompt} setValue={setPrompt} onSave={() => savePrompt("pawn_chat_persona", prompt)} onReset={() => setPrompt(DEFAULT_PROMPT)} busy={busy} />
          <PromptEditor label="PAWN Copilot (Studio)" description="Diese Stimme unterstützt Designer im Studio." value={copilotPrompt} setValue={setCopilotPrompt} onSave={() => savePrompt("copilot_prompt", copilotPrompt)} onReset={() => setCopilotPrompt(DEFAULT_COPILOT)} busy={busy} />
        </div>
      )}

      {tab === "signale" && (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="border border-border bg-card p-8">
            <p className="editorial-eyebrow">Sessions</p>
            <ul className="mt-6 max-h-[520px] divide-y divide-border overflow-y-auto">
              {sessions.map((s) => {
                const ex = s.extracted as { world?: string; mood?: string; occasion?: string };
                return (
                  <li key={s.session_id} className="py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[0.7rem] text-muted-foreground">{s.session_id.slice(0, 12)}…</span>
                      <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">{s.turns} Turns</span>
                    </div>
                    <p className="mt-1 text-[0.85rem]">{ex.world ?? "—"} · {ex.mood ?? "—"} {ex.occasion ? `· ${ex.occasion}` : ""}</p>
                  </li>
                );
              })}
              {sessions.length === 0 && <li className="py-6 text-sm text-muted-foreground">Noch keine Sessions.</li>}
            </ul>
          </div>
          <div className="border border-border bg-card p-8">
            <p className="editorial-eyebrow">Taste-Signale · letzte 50</p>
            <ul className="mt-6 max-h-[520px] divide-y divide-border overflow-y-auto">
              {signals.map((s) => {
                const p = s.payload as { raw?: string; world?: string; mood?: string };
                return (
                  <li key={s.id} className="py-3 text-sm">
                    <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                      <span>{new Date(s.at).toLocaleString("de-DE")}</span>
                      <span>{p.world ?? "—"} · {p.mood ?? "—"}</span>
                    </div>
                    <p className="mt-1 text-[0.9rem]">{p.raw ?? "—"}</p>
                  </li>
                );
              })}
              {signals.length === 0 && <li className="py-6 text-sm text-muted-foreground">Noch keine Signale.</li>}
            </ul>
          </div>
        </section>
      )}

      {tab === "responses" && (
        <section className="border border-border bg-card p-8">
          <p className="editorial-eyebrow">Letzte 20 KI-Antworten · Qualitätskontrolle</p>
          <ul className="mt-6 divide-y divide-border">
            {responses.map((r) => {
              const p = r.payload as { mode?: string; provider?: string; prompt?: string; reply?: string };
              return (
                <li key={r.id} className="py-4">
                  <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">
                    <span>{new Date(r.at).toLocaleString("de-DE")} · {p.mode ?? "—"} · {p.provider ?? "—"}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">→ {p.prompt ?? "—"}</p>
                  <p className="mt-1 text-sm text-foreground">« {p.reply ?? "—"} »</p>
                </li>
              );
            })}
            {responses.length === 0 && <li className="py-8 text-sm text-muted-foreground">Noch keine geloggten Antworten.</li>}
          </ul>
        </section>
      )}

      {tab === "integrationen" && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Externe Dienste, die PAWN auf Events auslöst (webhooks jetzt, Gmail / Instagram als Stub bis Credentials da sind).</p>
            <button onClick={() => setNewIntegration({ kind: "webhook", label: "", config: {}, enabled: true, event_types: [] })}
              className="flex items-center gap-2 border border-accent bg-accent px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground">
              <Plus className="h-3 w-3" /> Neue Integration
            </button>
          </div>

          <ul className="divide-y divide-border border border-border bg-card">
            {integrations.map((i) => (
              <li key={i.id} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg">{i.label} <span className="ml-2 text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{i.kind}</span></p>
                  <p className="text-xs text-muted-foreground">Events: {i.event_types.join(", ") || "—"}</p>
                </div>
                <button onClick={() => toggleIntegration(i)} className={`border px-3 py-1 text-[0.6rem] uppercase tracking-[0.28em] ${i.enabled ? "border-emerald-500/40 text-emerald-600" : "border-muted text-muted-foreground"}`}>
                  {i.enabled ? "Aktiv" : "Aus"}
                </button>
                <button onClick={() => setNewIntegration(i)} className="text-[0.62rem] uppercase tracking-[0.28em] hover:text-foreground">Bearbeiten</button>
                <button onClick={() => removeIntegration(i.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {integrations.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Noch keine Integrationen.</li>}
          </ul>

          {newIntegration && (
            <IntegrationDialog value={newIntegration} onCancel={() => setNewIntegration(null)} onSave={saveIntegration} />
          )}
        </section>
      )}
    </AdminShell>
  );
}

function PromptEditor(props: { label: string; description: string; value: string; setValue: (v: string) => void; onSave: () => void; onReset: () => void; busy: boolean }) {
  return (
    <section className="border border-border bg-card p-8">
      <p className="editorial-eyebrow">{props.label}</p>
      <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
      <textarea value={props.value} onChange={(e) => props.setValue(e.target.value)} rows={12}
        className="mt-6 w-full border border-border bg-background p-4 font-mono text-[0.85rem] leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent" />
      <div className="mt-4 flex items-center justify-between">
        <button onClick={props.onReset} className="text-[0.6rem] uppercase tracking-[0.32em] text-muted-foreground hover:text-foreground">Standard</button>
        <button onClick={props.onSave} disabled={props.busy} className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground disabled:opacity-50">
          {props.busy ? "…" : "Speichern"}
        </button>
      </div>
    </section>
  );
}

const EVENT_OPTIONS = ["order.placed", "designer.approved", "campaign.approved", "product.published", "ai.response_logged"];

function IntegrationDialog({ value, onCancel, onSave }: { value: Partial<IntegrationRow>; onCancel: () => void; onSave: (i: Partial<IntegrationRow>) => void }) {
  const [i, setI] = useState<Partial<IntegrationRow>>(value);
  const cfg = (i.config ?? {}) as Record<string, string>;
  const setCfg = (k: string, v: string) => setI({ ...i, config: { ...(i.config ?? {}), [k]: v } });
  const toggleEvent = (e: string) => {
    const cur = i.event_types ?? [];
    setI({ ...i, event_types: cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e] });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onCancel}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto border border-border bg-card p-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl">{i.id ? "Integration bearbeiten" : "Neue Integration"}</h2>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="editorial-eyebrow">Typ</span>
            <select value={i.kind ?? "webhook"} onChange={(e) => setI({ ...i, kind: e.target.value as IntegrationRow["kind"] })}
              className="mt-2 w-full border border-border bg-background p-2 text-sm">
              <option value="webhook">Webhook</option>
              <option value="gmail">Gmail (Stub)</option>
              <option value="instagram">Instagram (Stub)</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="block">
            <span className="editorial-eyebrow">Label</span>
            <input value={i.label ?? ""} onChange={(e) => setI({ ...i, label: e.target.value })}
              className="mt-2 w-full border border-border bg-background p-2 text-sm" />
          </label>

          {i.kind === "webhook" && (
            <>
              <label className="block">
                <span className="editorial-eyebrow">Ziel-URL</span>
                <input value={cfg.url ?? ""} onChange={(e) => setCfg("url", e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm" placeholder="https://…" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Secret-Env (optional)</span>
                <input value={cfg.secret_env ?? ""} onChange={(e) => setCfg("secret_env", e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm" placeholder="z. B. WEBHOOK_SECRET" />
                <span className="mt-1 block text-xs text-muted-foreground">Name des Secrets in den Edge-Function-Env — wird für HMAC-Signatur genutzt.</span>
              </label>
            </>
          )}
          {i.kind === "gmail" && (
            <>
              <label className="block">
                <span className="editorial-eyebrow">Absender-Adresse</span>
                <input value={cfg.from ?? ""} onChange={(e) => setCfg("from", e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm" placeholder="atelier@pawn.de" />
              </label>
              <p className="text-xs text-muted-foreground">Benötigt Secret <code>GMAIL_API_KEY</code> (OAuth-Token). Stub bis dahin.</p>
            </>
          )}
          {i.kind === "instagram" && (
            <>
              <label className="block">
                <span className="editorial-eyebrow">Account-Handle</span>
                <input value={cfg.handle ?? ""} onChange={(e) => setCfg("handle", e.target.value)}
                  className="mt-2 w-full border border-border bg-background p-2 text-sm" placeholder="@pawn" />
              </label>
              <p className="text-xs text-muted-foreground">Benötigt Meta Graph API-Zugang. Stub bis dahin.</p>
            </>
          )}

          <div>
            <span className="editorial-eyebrow">Auf welche Events</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((e) => (
                <button key={e} type="button" onClick={() => toggleEvent(e)}
                  className={`border px-3 py-1 text-[0.6rem] uppercase tracking-[0.28em] ${(i.event_types ?? []).includes(e) ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={i.enabled ?? true} onChange={(e) => setI({ ...i, enabled: e.target.checked })} />
            Aktiv
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onCancel} className="border border-border px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em]">Abbrechen</button>
            <button onClick={() => onSave(i)} className="border border-accent bg-accent px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-accent-foreground">Speichern</button>
          </div>
        </div>
      </div>
    </div>
  );
}
