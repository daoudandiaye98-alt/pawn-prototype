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
const DEFAULT_HOUSE_STYLE_LAW =
  "Sag, was ist — nie, was etwas nicht ist. Kurz, konkret, in der bestehenden PAWN-Stimme. Keine Marketing-Floskeln, keine Verneinungen als Stilmittel.";

type Tab = "denklogik" | "credits" | "persona" | "signale" | "responses" | "integrationen";

interface CreditPackRow { id: string; credits: number; eur: number; stripe_price_id: string | null }
interface ModelCatalogRow { id: string; label: string; kind: "image" | "video"; strength: string; credits: number; active: boolean; fal_model: string }

export default function AdminKI() {
  const { user, roles, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("denklogik");
  const [prompt, setPrompt] = useState("");
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [personaCustomer, setPersonaCustomer] = useState("");
  const [personaDesigner, setPersonaDesigner] = useState("");
  const [personaAdmin, setPersonaAdmin] = useState("");
  const [directives, setDirectives] = useState<string[]>([]);
  const [houseStyleLaw, setHouseStyleLaw] = useState("");
  const [suggestion, setSuggestion] = useState<{ key: string; oldText: string; newText: string } | null>(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [usage, setUsage] = useState<{ chat: number; copilot: number; campaigns: number }>({ chat: 0, copilot: 0, campaigns: 0 });
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [newIntegration, setNewIntegration] = useState<Partial<IntegrationRow> | null>(null);
  const [provider, setProvider] = useState<"openai" | "fallback" | "unknown">("unknown");
  const [providerChain, setProviderChain] = useState<string[]>([]);
  const [planCredits, setPlanCredits] = useState<Record<string, number>>({ haus: 30, atelier: 300, maison: 1200 });
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({ product_shot: 1, tryon_shot: 2, tryon_clip: 8, clip_standard: 5, clip_premium: 12 });
  const [creditPacks, setCreditPacks] = useState<CreditPackRow[]>([]);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogRow[]>([]);

  const refreshAll = async () => {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [cfg, cfgCopilot, pc, pd, pa, dir, styleLaw, sig, ses, resp, usageAll, ints, planCreditsCfg, creditCostsCfg, creditPacksCfg, modelCatalogCfg] = await Promise.all([
      supabase.from("ai_config").select("value").eq("key", "pawn_chat_persona").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "copilot_prompt").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "persona_customer").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "persona_designer").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "persona_admin").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "directives").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "house_style_law").maybeSingle(),
      supabase.from("domain_events").select("id, at, payload").eq("type", "ai.taste_signal").order("at", { ascending: false }).limit(50),
      supabase.from("ai_sessions").select("session_id, user_id, turns, extracted, updated_at").order("updated_at", { ascending: false }).limit(50),
      supabase.from("domain_events").select("id, at, payload").eq("type", "ai.response_logged").order("at", { ascending: false }).limit(20),
      supabase.from("domain_events").select("payload").eq("type", "ai.response_logged").gte("at", since),
      supabase.from("ai_integrations").select("*").order("created_at", { ascending: false }),
      supabase.from("ai_config").select("value").eq("key", "plan_credits").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "credit_costs").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "credit_packs").maybeSingle(),
      supabase.from("ai_config").select("value").eq("key", "model_catalog").maybeSingle(),
    ]);
    setPrompt(((cfg.data?.value as { system_prompt?: string })?.system_prompt) ?? DEFAULT_PROMPT);
    setCopilotPrompt(((cfgCopilot.data?.value as { system_prompt?: string })?.system_prompt) ?? DEFAULT_COPILOT);
    setPersonaCustomer(((pc.data?.value as { system_prompt?: string })?.system_prompt) ?? "");
    setPersonaDesigner(((pd.data?.value as { system_prompt?: string })?.system_prompt) ?? "");
    setPersonaAdmin(((pa.data?.value as { system_prompt?: string })?.system_prompt) ?? "");
    setDirectives(((dir.data?.value as { items?: string[] })?.items) ?? []);
    const styleLawVal = styleLaw.data?.value as { text?: string } | string | undefined;
    setHouseStyleLaw((typeof styleLawVal === "string" ? styleLawVal : styleLawVal?.text) || DEFAULT_HOUSE_STYLE_LAW);
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
    if (planCreditsCfg.data?.value) setPlanCredits((prev) => ({ ...prev, ...(planCreditsCfg.data.value as Record<string, number>) }));
    if (creditCostsCfg.data?.value) setCreditCosts((prev) => ({ ...prev, ...(creditCostsCfg.data.value as Record<string, number>) }));
    if (Array.isArray(creditPacksCfg.data?.value)) setCreditPacks(creditPacksCfg.data.value as unknown as CreditPackRow[]);
    if (Array.isArray(modelCatalogCfg.data?.value)) setModelCatalog(modelCatalogCfg.data.value as unknown as ModelCatalogRow[]);
  };

  useEffect(() => {
    if (!user || !roles.includes("admin")) return;
    void refreshAll();
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("pawn-chat", { body: { probe: true, messages: [] } });
        const d = (data ?? {}) as { provider?: string; chain?: string[] };
        setProvider(d.provider === "openai" ? "openai" : "fallback");
        setProviderChain(Array.isArray(d.chain) ? d.chain : []);
      } catch { setProvider("fallback"); }
    })();
  }, [user, roles]);

  if (loading) return null;
  if (!user || !roles.includes("admin")) return <Navigate to="/auth" replace />;

  const savePrompt = async (key: "pawn_chat_persona" | "copilot_prompt" | "persona_customer" | "persona_designer" | "persona_admin", value: string) => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key, value: { system_prompt: value }, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Gespeichert.");
  };

  const saveHouseStyleLaw = async () => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key: "house_style_law", value: { text: houseStyleLaw }, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Gespeichert.");
  };

  const saveDirectives = async (items: string[]) => {
    setBusy(true);
    const clean = items.map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("ai_config").upsert({ key: "directives", value: { items: clean }, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Direktiven aktualisiert."); setDirectives(clean); }
  };

  const savePlanCredits = async (next: Record<string, number>) => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key: "plan_credits", value: next, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Guthaben je Plan gespeichert."); setPlanCredits(next); }
  };

  const saveCreditCosts = async (next: Record<string, number>) => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key: "credit_costs", value: next, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Credit-Kosten gespeichert."); setCreditCosts(next); }
  };

  const saveCreditPacks = async (next: CreditPackRow[]) => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key: "credit_packs", value: next as unknown as never, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Credit-Pakete gespeichert."); setCreditPacks(next); }
  };

  const saveModelCatalog = async (next: ModelCatalogRow[]) => {
    setBusy(true);
    const { error } = await supabase.from("ai_config").upsert({ key: "model_catalog", value: next as unknown as never, updated_by: user.id });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Modell-Katalog gespeichert."); setModelCatalog(next); }
  };

  const requestSuggestion = async (personaKey: "persona_customer" | "persona_designer" | "persona_admin", currentText: string, instruction: string) => {
    if (!instruction.trim()) return toast.error("Bitte kurz beschreiben, was PAWN verbessern soll.");
    setSuggestBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-improve-prompt", {
        body: { persona_key: personaKey, current: currentText, instruction: instruction.trim() },
      });
      if (error) throw error;
      const next = (data as { suggestion?: string })?.suggestion?.trim();
      if (!next) throw new Error("Keine Antwort erhalten.");
      setSuggestion({ key: personaKey, oldText: currentText, newText: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Vorschlag.");
    } finally {
      setSuggestBusy(false);
    }
  };

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    await savePrompt(suggestion.key as "persona_customer" | "persona_designer" | "persona_admin", suggestion.newText);
    if (suggestion.key === "persona_customer") setPersonaCustomer(suggestion.newText);
    if (suggestion.key === "persona_designer") setPersonaDesigner(suggestion.newText);
    if (suggestion.key === "persona_admin") setPersonaAdmin(suggestion.newText);
    setSuggestion(null);
  };

  const saveIntegration = async (i: Partial<IntegrationRow>) => {
    if (!i.kind || !i.label) return toast.error("Kind und Label sind Pflicht.");
    const payload = {
      kind: i.kind, label: i.label,
      config: (i.config ?? {}) as never,
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
      <SecretsPanel />

      <div className="mb-6 flex flex-wrap items-center gap-3 border border-border bg-card p-4">
        <span className="text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground">Provider</span>
        <span className={`inline-flex items-center gap-2 border px-3 py-1 text-[0.65rem] uppercase tracking-[0.28em] ${provider === "openai" ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${provider === "openai" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {provider === "openai" ? "OpenAI aktiv" : provider === "unknown" ? "prüfe…" : "Fallback aktiv"}
        </span>
        <span className="text-xs text-muted-foreground">
          Kette: {providerChain.length ? providerChain.join(" → ") : "—"} → Fallback ·
          Secret <code>ANTHROPIC_API_KEY</code> für Claude, <code>OPENAI_API_KEY</code> für OpenAI hinterlegen.
        </span>
        <div className="ml-auto flex items-center gap-4 text-[0.65rem] uppercase tracking-[0.28em] text-muted-foreground">
          <span>Chat 7T: <b className="text-foreground">{usage.chat}</b></span>
          <span>Copilot 7T: <b className="text-foreground">{usage.copilot}</b></span>
          <span>Kampagnen 7T: <b className="text-foreground">{usage.campaigns}</b></span>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {(["denklogik","credits","persona","signale","responses","integrationen"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-[0.65rem] uppercase tracking-[0.28em] ${tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t === "denklogik" ? "Denklogik" : t === "credits" ? "Credits" : t === "persona" ? "Persona (Legacy)" : t === "signale" ? "Signale" : t === "responses" ? "Antwort-Log" : "Integrationen"}
          </button>
        ))}
      </div>

      {tab === "denklogik" && (
        <div className="space-y-8">
          <PromptEditor
            label="Haus-Stilgesetz"
            description="Gilt für jeden textschreibenden KI-Schritt (Chat, Copilot, Kampagnen, Akquise): sagt, was ist — nie, was etwas nicht ist."
            value={houseStyleLaw}
            setValue={setHouseStyleLaw}
            onSave={saveHouseStyleLaw}
            onReset={() => setHouseStyleLaw(DEFAULT_HOUSE_STYLE_LAW)}
            busy={busy}
          />
          <DirectivesEditor value={directives} onSave={saveDirectives} busy={busy} />
          <PersonaWithSuggestion
            keyName="persona_customer"
            label="Kunden-Persona"
            description="Berater & Guide durchs Kollektiv — versteht Geschmack. Antwortet Kund:innen im öffentlichen Chat."
            value={personaCustomer}
            setValue={setPersonaCustomer}
            onSave={() => savePrompt("persona_customer", personaCustomer)}
            onSuggest={(inst) => requestSuggestion("persona_customer", personaCustomer, inst)}
            busy={busy}
            suggestBusy={suggestBusy}
          />
          <PersonaWithSuggestion
            keyName="persona_designer"
            label="Designer-Persona (Copilot)"
            description="Organisations-Begleiter — kennt den nächsten Zug, erklärt in einfachen Schritten, feiert Fortschritte."
            value={personaDesigner}
            setValue={setPersonaDesigner}
            onSave={() => savePrompt("persona_designer", personaDesigner)}
            onSuggest={(inst) => requestSuggestion("persona_designer", personaDesigner, inst)}
            busy={busy}
            suggestBusy={suggestBusy}
          />
          <PersonaWithSuggestion
            keyName="persona_admin"
            label="Admin-Persona"
            description="Voller Zugriff · zeigt auf Nachfrage aktives Kontextpaket und Direktiven offen an."
            value={personaAdmin}
            setValue={setPersonaAdmin}
            onSave={() => savePrompt("persona_admin", personaAdmin)}
            onSuggest={(inst) => requestSuggestion("persona_admin", personaAdmin, inst)}
            busy={busy}
            suggestBusy={suggestBusy}
          />
          {suggestion && <SuggestionDiff sugg={suggestion} onAccept={acceptSuggestion} onDismiss={() => setSuggestion(null)} />}
        </div>
      )}

      {tab === "credits" && (
        <CreditsEditor
          planCredits={planCredits} onSavePlanCredits={savePlanCredits}
          creditCosts={creditCosts} onSaveCreditCosts={saveCreditCosts}
          creditPacks={creditPacks} onSaveCreditPacks={saveCreditPacks}
          modelCatalog={modelCatalog} onSaveModelCatalog={saveModelCatalog}
          busy={busy}
        />
      )}

      {tab === "persona" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <PromptEditor label="Frag PAWN (Chat, Legacy)" description={'Legacy-Prompt. Der neue Kunden-Persona-Text unter „Denklogik" hat Vorrang.'} value={prompt} setValue={setPrompt} onSave={() => savePrompt("pawn_chat_persona", prompt)} onReset={() => setPrompt(DEFAULT_PROMPT)} busy={busy} />
          <PromptEditor label="PAWN Copilot (Studio, Legacy)" description={'Legacy-Prompt. Der neue Designer-Persona-Text unter „Denklogik" hat Vorrang.'} value={copilotPrompt} setValue={setCopilotPrompt} onSave={() => savePrompt("copilot_prompt", copilotPrompt)} onReset={() => setCopilotPrompt(DEFAULT_COPILOT)} busy={busy} />
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
          <ProviderStatusCards />

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

function DirectivesEditor({ value, onSave, busy }: { value: string[]; onSave: (items: string[]) => void; busy: boolean }) {
  const [items, setItems] = useState<string[]>(value.length ? value : [""]);
  useEffect(() => { setItems(value.length ? value : [""]); }, [value]);
  return (
    <section className="border-[1.5px] border-foreground bg-card p-8">
      <p className="editorial-eyebrow">Direktiven — Leitplanken jeder Antwort</p>
      <p className="mt-2 text-sm text-muted-foreground">Werden in JEDEN Persona-Prompt injiziert. Kurze, klare Regeln (ein Satz je Zeile).</p>
      <ul className="mt-4 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center border-[1.5px] border-foreground text-[0.6rem] tabular-nums">{i + 1}</span>
            <textarea rows={2} value={it} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1 border-[1.5px] border-border bg-background p-2 text-sm" />
            <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="mt-2 text-destructive"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => setItems([...items, ""])} className="border-[1.5px] border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] hover:border-foreground">+ Direktive</button>
        <button type="button" onClick={() => onSave(items)} disabled={busy}
          className="border-[1.5px] border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
          {busy ? "…" : "Direktiven speichern"}
        </button>
      </div>
    </section>
  );
}

function CreditsEditor({ planCredits, onSavePlanCredits, creditCosts, onSaveCreditCosts, creditPacks, onSaveCreditPacks, modelCatalog, onSaveModelCatalog, busy }: {
  planCredits: Record<string, number>; onSavePlanCredits: (v: Record<string, number>) => void;
  creditCosts: Record<string, number>; onSaveCreditCosts: (v: Record<string, number>) => void;
  creditPacks: CreditPackRow[]; onSaveCreditPacks: (v: CreditPackRow[]) => void;
  modelCatalog: ModelCatalogRow[]; onSaveModelCatalog: (v: ModelCatalogRow[]) => void;
  busy: boolean;
}) {
  const [pc, setPc] = useState(planCredits);
  const [cc, setCc] = useState(creditCosts);
  const [packs, setPacks] = useState<CreditPackRow[]>(creditPacks);
  const [models, setModels] = useState<ModelCatalogRow[]>(modelCatalog);
  useEffect(() => setPc(planCredits), [planCredits]);
  useEffect(() => setCc(creditCosts), [creditCosts]);
  useEffect(() => setPacks(creditPacks), [creditPacks]);
  useEffect(() => setModels(modelCatalog), [modelCatalog]);

  return (
    <div className="space-y-8">
      <section className="border-[1.5px] border-foreground bg-card p-8">
        <p className="editorial-eyebrow">Guthaben je Plan · monatlich</p>
        <p className="mt-2 text-sm text-muted-foreground">Credits, die jedes Haus pro Monat bekommt. Verfällt zum Monatsende.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(["haus", "atelier", "maison"] as const).map((p) => (
            <label key={p} className="block">
              <span className="editorial-eyebrow capitalize">{p}</span>
              <input type="number" min={0} value={pc[p] ?? 0} onChange={(e) => setPc({ ...pc, [p]: Number(e.target.value) })}
                className="mt-2 w-full border-[1.5px] border-border bg-background p-2 text-sm tabular-nums" />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => onSavePlanCredits(pc)} disabled={busy}
          className="mt-4 border-[1.5px] border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
          {busy ? "…" : "Guthaben speichern"}
        </button>
      </section>

      <section className="border-[1.5px] border-foreground bg-card p-8">
        <p className="editorial-eyebrow">Was jede Handlung kostet</p>
        <p className="mt-2 text-sm text-muted-foreground">Credits pro Handlung — je nach Modell unterschiedlich teuer.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(cc).map(([key, val]) => (
            <label key={key} className="block">
              <span className="editorial-eyebrow">{key}</span>
              <input type="number" min={0} value={val} onChange={(e) => setCc({ ...cc, [key]: Number(e.target.value) })}
                className="mt-2 w-full border-[1.5px] border-border bg-background p-2 text-sm tabular-nums" />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => onSaveCreditCosts(cc)} disabled={busy}
          className="mt-4 border-[1.5px] border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
          {busy ? "…" : "Kosten speichern"}
        </button>
      </section>

      <section className="border-[1.5px] border-foreground bg-card p-8">
        <p className="editorial-eyebrow">Nachkaufbare Pakete</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Stripe-Preis-ID leer lassen, bis sie in Stripe angelegt und hier eingetragen wurde — bis dahin zeigt der Kauf-Knopf im Studio „bald verfügbar".
        </p>
        <div className="mt-4 space-y-3">
          {packs.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_2fr_auto] sm:items-end">
              <label className="block">
                <span className="editorial-eyebrow">ID</span>
                <input value={p.id} onChange={(e) => setPacks(packs.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Credits</span>
                <input type="number" min={0} value={p.credits} onChange={(e) => setPacks(packs.map((x, j) => j === i ? { ...x, credits: Number(e.target.value) } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm tabular-nums" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">EUR</span>
                <input type="number" min={0} value={p.eur} onChange={(e) => setPacks(packs.map((x, j) => j === i ? { ...x, eur: Number(e.target.value) } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm tabular-nums" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Stripe-Preis-ID</span>
                <input value={p.stripe_price_id ?? ""} placeholder="price_… (leer = bald verfügbar)"
                  onChange={(e) => setPacks(packs.map((x, j) => j === i ? { ...x, stripe_price_id: e.target.value || null } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm" />
              </label>
              <button type="button" onClick={() => setPacks(packs.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => setPacks([...packs, { id: `pack_${Date.now()}`, credits: 100, eur: 9, stripe_price_id: null }])}
            className="border-[1.5px] border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] hover:border-foreground">+ Paket</button>
          <button type="button" onClick={() => onSaveCreditPacks(packs)} disabled={busy}
            className="border-[1.5px] border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
            {busy ? "…" : "Pakete speichern"}
          </button>
        </div>
      </section>

      <section className="border-[1.5px] border-foreground bg-card p-8">
        <p className="editorial-eyebrow">Modell-Katalog</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Modelle für die kinematische Erzeugung, die Designer im Kampagnen-Studio selbst wählen können. Neue Modelle kommen hier dazu, ohne Deploy.
        </p>
        <div className="mt-4 space-y-3">
          {models.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1.4fr_1fr_1fr_auto_auto_auto] lg:items-end">
              <label className="block">
                <span className="editorial-eyebrow">ID</span>
                <input value={m.id} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, id: e.target.value } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Anzeigename</span>
                <input value={m.label} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Art</span>
                <select value={m.kind} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, kind: e.target.value as "image" | "video" } : x))}
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm">
                  <option value="video">Video</option>
                  <option value="image">Bild</option>
                </select>
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Stufe (Klartext)</span>
                <input value={m.strength} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, strength: e.target.value } : x))}
                  placeholder="z. B. schnell"
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm" />
              </label>
              <label className="block">
                <span className="editorial-eyebrow">Credits</span>
                <input type="number" min={0} value={m.credits} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, credits: Number(e.target.value) } : x))}
                  className="mt-1 w-20 border-[1.5px] border-border bg-background p-2 text-sm tabular-nums" />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={m.active} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, active: e.target.checked } : x))} />
                Aktiv
              </label>
              <button type="button" onClick={() => setModels(models.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              <label className="col-span-2 block lg:col-span-7">
                <span className="editorial-eyebrow">fal.ai-Modell-Kennung</span>
                <input value={m.fal_model} onChange={(e) => setModels(models.map((x, j) => j === i ? { ...x, fal_model: e.target.value } : x))}
                  placeholder="fal-ai/…"
                  className="mt-1 w-full border-[1.5px] border-border bg-background p-2 text-sm font-mono" />
              </label>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={() => setModels([...models, { id: `model_${Date.now()}`, label: "Neues Modell", kind: "video", strength: "schnell", credits: 5, active: true, fal_model: "" }])}
            className="border-[1.5px] border-border px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] hover:border-foreground">+ Modell</button>
          <button type="button" onClick={() => onSaveModelCatalog(models)} disabled={busy}
            className="border-[1.5px] border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
            {busy ? "…" : "Katalog speichern"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PersonaWithSuggestion(props: {
  keyName: string; label: string; description: string;
  value: string; setValue: (v: string) => void;
  onSave: () => void; onSuggest: (instruction: string) => void;
  busy: boolean; suggestBusy: boolean;
}) {
  const [instruction, setInstruction] = useState("");
  return (
    <section className="border-[1.5px] border-foreground bg-card p-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-eyebrow">{props.label}</p>
          <p className="mt-2 text-sm text-muted-foreground">{props.description}</p>
        </div>
        <code className="text-[0.55rem] uppercase tracking-[0.28em] text-muted-foreground">{props.keyName}</code>
      </div>
      <textarea value={props.value} onChange={(e) => props.setValue(e.target.value)} rows={10}
        className="mt-6 w-full border-[1.5px] border-border bg-background p-4 font-mono text-[0.85rem] leading-relaxed focus:outline-none focus:border-foreground" />
      <div className="mt-4 flex items-center justify-end">
        <button onClick={props.onSave} disabled={props.busy}
          className="border-[1.5px] border-foreground bg-foreground px-5 py-2 text-[0.65rem] uppercase tracking-[0.28em] text-background disabled:opacity-50">
          {props.busy ? "…" : "Speichern"}
        </button>
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <p className="editorial-eyebrow">Vorschlag von PAWN</p>
        <p className="mt-1 text-xs text-muted-foreground">Beschreibe, was verbessert werden soll — PAWN entwirft eine neue Version zum Prüfen.</p>
        <div className="mt-3 flex gap-2">
          <input value={instruction} onChange={(e) => setInstruction(e.target.value)}
            placeholder={"z. B. mach die Persona neugieriger"}
            className="flex-1 border-[1.5px] border-border bg-background p-2 text-sm" />
          <button onClick={() => props.onSuggest(instruction)} disabled={props.suggestBusy}
            className="border-[1.5px] border-foreground px-4 py-2 text-[0.62rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background disabled:opacity-50">
            {props.suggestBusy ? "…" : "Vorschlag anfragen"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SuggestionDiff({ sugg, onAccept, onDismiss }: { sugg: { key: string; oldText: string; newText: string }; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-5xl border-[1.5px] border-foreground bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-[0.62rem] uppercase tracking-[0.28em]">Vorschlag · {sugg.key}</p>
        <div className="flex gap-2">
          <button onClick={onDismiss} className="px-3 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">Verwerfen</button>
          <button onClick={onAccept} className="border-[1.5px] border-foreground bg-foreground px-4 py-1.5 text-[0.62rem] uppercase tracking-[0.28em] text-background">Übernehmen</button>
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-r border-border p-4">
          <p className="text-[0.58rem] uppercase tracking-[0.28em] text-muted-foreground">Alt</p>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{sugg.oldText || "—"}</pre>
        </div>
        <div className="p-4">
          <p className="text-[0.58rem] uppercase tracking-[0.28em] text-foreground">Neu</p>
          <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs">{sugg.newText}</pre>
        </div>
      </div>
    </div>
  );
}

function ProviderStatusCards() {
  const [falCost, setFalCost] = useState<number | null>(null);
  const [falCount, setFalCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("generation_requests")
        .select("cost_estimate, status")
        .eq("provider", "fal")
        .gte("created_at", since.toISOString());
      const rows = (data ?? []) as Array<{ cost_estimate: number | null; status: string }>;
      setFalCount(rows.length);
      setFalCost(rows.reduce((sum, r) => sum + Number(r.cost_estimate ?? 0), 0));
    })();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="border-[1.5px] border-foreground bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg">fal.ai · Kinematischer Modus</p>
          <span className="border border-foreground px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em]">Bild→Video</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Modell: <span className="tabular-nums">fal-ai/kling-video/v2.1/standard/image-to-video</span>
        </p>
        <p className="mt-2 text-sm">
          Letzte 30 Tage: <span className="tabular-nums font-medium">{falCount}</span> Aufträge · Kosten-Einheiten <span className="tabular-nums font-medium">{falCost ?? "—"}</span>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Aktivieren: fal.ai-Konto anlegen → API-Key erzeugen → als <code>FAL_KEY</code> in Project Settings → Secrets speichern. Ohne Key ist die Option im Funnel deaktiviert.
        </p>
      </div>

      <div className="border-[1.5px] border-border bg-white p-5 opacity-90">
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg">Pinterest</p>
          <span className="border border-border px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.28em]">Bald</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Board-Direktposts kommen im nächsten Zyklus. Felder werden dann hier freigeschaltet.
        </p>
        <div className="mt-3 grid gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">Board-ID</span>
            <input disabled className="border border-border bg-muted p-2 text-sm" placeholder="wird noch nicht ausgelesen" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6rem] uppercase tracking-[0.24em] text-muted-foreground">API-Token</span>
            <input disabled type="password" className="border border-border bg-muted p-2 text-sm" placeholder="folgt" />
          </label>
        </div>
      </div>
    </div>
  );
}


const SECRET_INFO: { key: string; unlocks: string; where: string }[] = [
  { key: "OPENAI_API_KEY", unlocks: "PAWN Chat & Copilot mit GPT-4o.", where: "OpenAI Dashboard → API Keys → als OPENAI_API_KEY in Projekt-Einstellungen → Secrets." },
  { key: "ANTHROPIC_API_KEY", unlocks: "Claude als Fallback / Premium-Modell.", where: "console.anthropic.com → API Keys → als ANTHROPIC_API_KEY hinterlegen." },
  { key: "STRIPE_SECRET_KEY", unlocks: "Zahlungen & Checkout.", where: "Stripe Dashboard → Entwickler → API-Keys → sk_live_… als STRIPE_SECRET_KEY hinterlegen." },
  { key: "FAL_KEY", unlocks: "Kinematischer Kampagnen-Modus & Studio-Foto.", where: "fal.ai → API Keys → als FAL_KEY hinterlegen." },
  { key: "META_ACCESS_TOKEN", unlocks: "Instagram-Posts aus der Queue.", where: "Meta for Developers → Graph API Token → als META_ACCESS_TOKEN hinterlegen." },
  { key: "TIKTOK_CLIENT_KEY", unlocks: "TikTok-Publishing (folgt).", where: "developers.tiktok.com → App anlegen → Client Key als TIKTOK_CLIENT_KEY hinterlegen." },
];

function SecretsPanel() {
  const [present, setPresent] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("check-secrets", { body: {} });
        const d = (data ?? {}) as { present?: Record<string, boolean> };
        setPresent(d.present ?? {});
      } catch { setPresent({}); }
      setLoading(false);
    })();
  }, []);
  return (
    <section className="mb-6 border-[1.5px] border-foreground bg-card p-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="editorial-eyebrow">Schlüssel & Verbindungen</p>
          <p className="mt-1 text-sm text-muted-foreground">Existenz-Check — Werte werden nie angezeigt.</p>
        </div>
        {loading && <span className="text-xs text-muted-foreground">prüfe…</span>}
      </div>
      <ul className="mt-5 divide-y divide-border border border-border bg-background">
        {SECRET_INFO.map((s) => {
          const ok = !!present?.[s.key];
          return (
            <li key={s.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
              <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} title={ok ? "vorhanden" : "fehlt"} />
              <div className="min-w-0">
                <p className="font-mono text-[0.78rem] text-foreground">{s.key}</p>
                <p className="text-xs text-muted-foreground">{s.unlocks}</p>
                {!ok && !loading && <p className="mt-1 text-[0.7rem] text-amber-700">So einrichten: {s.where}</p>}
              </div>
              <span className={`text-[0.6rem] uppercase tracking-[0.28em] ${ok ? "text-emerald-600" : "text-amber-600"}`}>
                {ok ? "Vorhanden" : "Fehlt"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
