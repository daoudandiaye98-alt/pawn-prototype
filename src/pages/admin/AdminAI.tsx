import { useState } from "react";
import {
  Send, MessageSquare, SlidersHorizontal, FileText, Sparkles, Database,
  Plug, ShieldAlert, Type, Brain, History, ScrollText,
} from "lucide-react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * Admin AI — Control Panel
 *
 * Mock-only UI today; architected for the real backend in src/docs/BACKEND.md.
 * Future Supabase tables:
 *   ai_settings · ai_prompts · ai_knowledge_sources · ai_tools
 *   plugin_connections · ai_logs · admin_audit_logs
 */

type PanelKey =
  | "playground" | "model" | "prompt" | "personality" | "knowledge"
  | "tools" | "safety" | "style" | "memory" | "versions" | "logs";

const PANELS: { key: PanelKey; label: string; icon: typeof Send }[] = [
  { key: "playground",  label: "Playground",       icon: MessageSquare },
  { key: "model",       label: "Model Settings",   icon: SlidersHorizontal },
  { key: "prompt",      label: "System Prompt",    icon: FileText },
  { key: "personality", label: "Personality",      icon: Sparkles },
  { key: "knowledge",   label: "Knowledge",        icon: Database },
  { key: "tools",       label: "Tools / Plugins",  icon: Plug },
  { key: "safety",      label: "Safety Rules",     icon: ShieldAlert },
  { key: "style",       label: "Response Style",   icon: Type },
  { key: "memory",      label: "Memory Rules",     icon: Brain },
  { key: "versions",    label: "Version History",  icon: History },
  { key: "logs",        label: "Logs",             icon: ScrollText },
];

const AdminAI = () => {
  const [active, setActive] = useState<PanelKey>("playground");

  return (
    <AdminShell eyebrow="AI Control Panel" title="PAWN AI">
      <div className="grid gap-px bg-border lg:grid-cols-[240px_1fr] min-h-[720px]">
        {/* Left rail */}
        <aside className="bg-card">
          <p className="border-b border-border px-5 py-4 editorial-eyebrow">Control surface</p>
          <nav className="py-2">
            {PANELS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActive(key)}
                className={cn(
                  "flex w-full items-center gap-3 border-l-2 px-5 py-2.5 text-left text-[0.72rem] uppercase tracking-[0.2em] transition-colors",
                  active === key
                    ? "border-accent bg-background text-foreground"
                    : "border-transparent text-foreground/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
          <div className="border-t border-border px-5 py-4 text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
            v0.3 · Prototype
          </div>
        </aside>

        {/* Panel content */}
        <section className="bg-background p-8 md:p-10">
          {active === "playground"  && <Playground />}
          {active === "model"       && <ModelSettings />}
          {active === "prompt"      && <SystemPrompt />}
          {active === "personality" && <Personality />}
          {active === "knowledge"   && <Knowledge />}
          {active === "tools"       && <ToolsPlugins />}
          {active === "safety"      && <Safety />}
          {active === "style"       && <ResponseStyle />}
          {active === "memory"      && <MemoryRules />}
          {active === "versions"    && <Versions />}
          {active === "logs"        && <Logs />}
        </section>
      </div>
    </AdminShell>
  );
};

/* ───────── Sub-panels ───────── */

function PanelHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <header className="mb-10">
      <p className="editorial-eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl md:text-4xl">{title}</h2>
      {desc && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
    </header>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-start py-5 border-b border-border">
      <div>
        <p className="text-[0.7rem] uppercase tracking-[0.22em]">{label}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* Playground — existing chat */
function Playground() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "PAWN AI is online. Ask anything about your platform, designers, or customers." },
  ]);
  const [input, setInput] = useState("");
  function send(prompt: string) {
    const text = prompt.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: mockAnswer(text) }]);
    setInput("");
  }
  return (
    <>
      <PanelHeader eyebrow="01 · Live test" title="Playground" desc="Test the current AI configuration against real prompts before deploying." />
      <div className="flex h-[520px] flex-col border border-border">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((m, i) => (
            <div key={i} className={cn("max-w-[80%]", m.role === "user" ? "ml-auto" : "")}>
              <p className="editorial-eyebrow">{m.role === "user" ? "You" : "PAWN AI"}</p>
              <div className={cn(
                "mt-1 border p-4 text-sm",
                m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border bg-card",
              )}>
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-border p-4">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask PAWN AI anything…" className="rounded-none" />
          <Button type="submit" className="rounded-none"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </>
  );
}

function ModelSettings() {
  return (
    <>
      <PanelHeader eyebrow="02 · Engine" title="Model Settings" desc="Provider, model, and decoding parameters governing every PAWN AI call." />
      <Field label="Provider" hint="Future: ai_settings.provider">
        <select className="h-10 w-full max-w-md border border-border bg-card px-3 text-sm">
          <option>Lovable AI Gateway</option><option>OpenAI</option><option>Anthropic</option><option>Google</option>
        </select>
      </Field>
      <Field label="Model">
        <select className="h-10 w-full max-w-md border border-border bg-card px-3 text-sm">
          <option>google/gemini-2.5-flash</option><option>openai/gpt-5</option><option>anthropic/claude-sonnet-4.5</option>
        </select>
      </Field>
      <Field label="Temperature" hint="0 = deterministic · 1 = creative">
        <div className="max-w-md"><Slider defaultValue={[35]} max={100} step={1} /></div>
        <p className="mt-2 pawn-numeral text-xl">0.35</p>
      </Field>
      <Field label="Max tokens"><Input type="number" defaultValue={1024} className="max-w-xs rounded-none" /></Field>
      <Field label="Top P"><Input type="number" step="0.05" defaultValue={0.9} className="max-w-xs rounded-none" /></Field>
      <div className="mt-8 flex justify-end gap-3">
        <Button variant="outline" className="rounded-none">Reset</Button>
        <Button className="rounded-none decision-pill px-8">Save configuration</Button>
      </div>
    </>
  );
}

function SystemPrompt() {
  return (
    <>
      <PanelHeader eyebrow="03 · Master prompt" title="System Prompt" desc="The constitutional brief PAWN AI obeys at every turn. Versioned automatically." />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Current version: <span className="pawn-numeral text-foreground">v0.3.2</span> · edited 2 days ago</span>
        <Button size="sm" variant="outline" className="rounded-none">View history</Button>
      </div>
      <Textarea
        defaultValue={`You are PAWN AI — the intelligence layer of an editorial fashion marketplace.

Speak with restraint and conviction. Reference designer houses by name. Decode style as identity, not as trend. Avoid casual filler. Cite reasoning when relevant. Never invent products that do not exist in the catalog.`}
        className="mt-4 min-h-[280px] rounded-none font-mono text-sm"
      />
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" className="rounded-none">Discard</Button>
        <Button className="rounded-none decision-pill px-8">Publish new version</Button>
      </div>
    </>
  );
}

function Personality() {
  const ROLES = ["Stylist", "Analyst", "Curator", "Support", "Admin Assistant"] as const;
  const [role, setRole] = useState<typeof ROLES[number]>("Curator");
  return (
    <>
      <PanelHeader eyebrow="04 · Voice" title="Personality & Tone" desc="The role PAWN AI plays, and the register it speaks in." />
      <Field label="Active role">
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button key={r} onClick={() => setRole(r)}
              className={cn(
                "border px-4 py-2 text-[0.7rem] uppercase tracking-[0.22em] transition",
                role === r ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground"
              )}>
              {r}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Formality" hint="Casual ←→ Editorial"><div className="max-w-md"><Slider defaultValue={[80]} max={100} /></div></Field>
      <Field label="Verbosity" hint="Terse ←→ Expansive"><div className="max-w-md"><Slider defaultValue={[45]} max={100} /></div></Field>
      <Field label="Confidence" hint="Suggestive ←→ Assertive"><div className="max-w-md"><Slider defaultValue={[70]} max={100} /></div></Field>
    </>
  );
}

function Knowledge() {
  const SOURCES = [
    { name: "PAWN Designer Catalog",  type: "Database",  status: true,  size: "1,284 docs" },
    { name: "Editorial Voice Guide",  type: "Markdown",  status: true,  size: "42 pages" },
    { name: "Vogue Archive 2018-2025", type: "URL",       status: false, size: "—" },
    { name: "Internal Style DNA Methodology", type: "PDF", status: true, size: "18 pages" },
  ];
  return (
    <>
      <PanelHeader eyebrow="05 · Memory of the house" title="Knowledge Sources" desc="The documents and corpora PAWN AI may draw from when answering." />
      <div className="border border-border">
        <div className="grid grid-cols-[1fr_140px_120px_80px] gap-px bg-border text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
          {["Source", "Type", "Size", "Active"].map((h) => <div key={h} className="bg-card px-5 py-3">{h}</div>)}
        </div>
        {SOURCES.map((s) => (
          <div key={s.name} className="grid grid-cols-[1fr_140px_120px_80px] items-center border-t border-border px-5 py-4 text-sm">
            <div className="font-serif text-base">{s.name}</div>
            <div className="text-muted-foreground">{s.type}</div>
            <div className="pawn-numeral">{s.size}</div>
            <Switch defaultChecked={s.status} />
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end"><Button className="rounded-none">+ Attach source</Button></div>
    </>
  );
}

function ToolsPlugins() {
  const PLUGINS = [
    { name: "OpenAI / Anthropic Models", desc: "Swap or chain reasoning models." },
    { name: "Image Generation",           desc: "On-brand visual generation for editorial content." },
    { name: "Email",                      desc: "Send transactional and editorial emails on behalf of PAWN." },
    { name: "Analytics",                  desc: "Read platform metrics into AI context." },
    { name: "Stripe",                     desc: "Read order and payout state." },
    { name: "Shipping",                   desc: "Quote and track shipments." },
    { name: "CMS / Content Sources",      desc: "Pull editorial copy from the house CMS." },
    { name: "Fashion Trend APIs",         desc: "External trend feeds, runway data, retail signals." },
    { name: "Social Media Imports",       desc: "Designer feeds, lookbooks, and tagged content." },
  ];
  return (
    <>
      <PanelHeader eyebrow="06 · Capabilities" title="Tools / Plugins" desc="Connectors PAWN AI may call. All connectors require the backend; visible here as architecture." />
      <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-3">
        {PLUGINS.map((p) => (
          <div key={p.name} className="bg-card p-6">
            <div className="flex items-start justify-between">
              <h3 className="font-serif text-xl">{p.name}</h3>
              <span className="text-[0.55rem] uppercase tracking-[0.28em] text-muted-foreground">Not connected</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{p.desc}</p>
            <button
              disabled
              title="Available with backend"
              className="mt-6 w-full cursor-not-allowed border border-border bg-background px-4 py-2 text-[0.65rem] uppercase tracking-[0.24em] text-muted-foreground"
            >
              Connect
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Safety() {
  return (
    <>
      <PanelHeader eyebrow="07 · Guardrails" title="Safety Rules" desc="Content limits, forbidden topics, and escalation behavior." />
      <Field label="Forbidden topics" hint="Comma separated">
        <Input defaultValue="politics, religion, medical advice, legal advice" className="rounded-none" />
      </Field>
      <Field label="Refuse pricing negotiation"><Switch defaultChecked /></Field>
      <Field label="Refuse competitor recommendations"><Switch defaultChecked /></Field>
      <Field label="Auto-escalate to human" hint="Threshold for handoff (1–10)">
        <div className="max-w-md"><Slider defaultValue={[7]} max={10} step={1} /></div>
      </Field>
    </>
  );
}

function ResponseStyle() {
  return (
    <>
      <PanelHeader eyebrow="08 · Output" title="Response Style" desc="How replies are shaped — length, formatting, citation behavior." />
      <Field label="Default length">
        <select className="h-10 w-full max-w-md border border-border bg-card px-3 text-sm">
          <option>Brief (1–2 sentences)</option><option>Editorial (1 paragraph)</option><option>Long-form (3+ paragraphs)</option>
        </select>
      </Field>
      <Field label="Cite sources"><Switch defaultChecked /></Field>
      <Field label="Use markdown"><Switch defaultChecked /></Field>
      <Field label="Suggest follow-up questions"><Switch /></Field>
    </>
  );
}

function MemoryRules() {
  return (
    <>
      <PanelHeader eyebrow="09 · Persistence" title="Memory Rules" desc="What PAWN AI may remember across sessions, per user." />
      <Field label="Remember style DNA" hint="Per signed-in user"><Switch defaultChecked /></Field>
      <Field label="Remember saved products"><Switch defaultChecked /></Field>
      <Field label="Remember past orders"><Switch /></Field>
      <Field label="Forget on logout"><Switch /></Field>
      <Field label="Max retention" hint="Days">
        <Input type="number" defaultValue={180} className="max-w-xs rounded-none" />
      </Field>
    </>
  );
}

function Versions() {
  const VERSIONS = [
    { v: "v0.3.2", note: "Tightened editorial tone for product copy.", date: "2 days ago" },
    { v: "v0.3.1", note: "Added Style DNA methodology to knowledge.",  date: "1 week ago" },
    { v: "v0.3.0", note: "New system prompt — chess identity framing.", date: "2 weeks ago" },
    { v: "v0.2.4", note: "Lowered temperature to 0.35.",                date: "1 month ago" },
  ];
  return (
    <>
      <PanelHeader eyebrow="10 · History" title="Version History" desc="Every prompt and configuration change is recorded." />
      <div className="border border-border">
        {VERSIONS.map((v, i) => (
          <div key={v.v} className={cn("grid grid-cols-[120px_1fr_160px_120px] items-center px-5 py-4", i > 0 && "border-t border-border")}>
            <span className="pawn-numeral text-lg">{v.v}</span>
            <span className="font-cormorant italic text-foreground/80">{v.note}</span>
            <span className="text-xs text-muted-foreground">{v.date}</span>
            <Button size="sm" variant="outline" className="rounded-none justify-self-end">Restore</Button>
          </div>
        ))}
      </div>
    </>
  );
}

function Logs() {
  const LOGS = [
    { time: "14:02", who: "user@pawn", q: "Recommend a coat for a Lemaire wardrobe.", ms: 842, tok: 318 },
    { time: "13:55", who: "admin",      q: "Generate weekly platform report.",         ms: 1240, tok: 1102 },
    { time: "13:41", who: "user@pawn", q: "What does my DNA say about my style?",     ms: 612, tok: 244 },
    { time: "13:30", who: "designer:y-project", q: "Draft campaign caption.",          ms: 488, tok: 188 },
  ];
  return (
    <>
      <PanelHeader eyebrow="11 · Observability" title="Logs" desc="Recent AI calls. Backend will persist to ai_logs with full request/response." />
      <div className="border border-border">
        <div className="grid grid-cols-[80px_180px_1fr_80px_80px] gap-px bg-border text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">
          {["Time","Actor","Prompt","Latency","Tokens"].map((h) => <div key={h} className="bg-card px-4 py-3">{h}</div>)}
        </div>
        {LOGS.map((l, i) => (
          <div key={i} className="grid grid-cols-[80px_180px_1fr_80px_80px] border-t border-border px-4 py-3 text-sm">
            <span className="pawn-numeral">{l.time}</span>
            <span className="text-muted-foreground">{l.who}</span>
            <span className="font-cormorant italic truncate pr-4">"{l.q}"</span>
            <span className="pawn-numeral">{l.ms}ms</span>
            <span className="pawn-numeral">{l.tok}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function mockAnswer(q: string): string {
  const k = q.toLowerCase();
  if (k.includes("trend")) return "Architectural Romance is up 24% in user saves, led by Y/PROJECT and Rick Owens. Oxblood is the breakout color.";
  if (k.includes("dna"))   return "Global DNA shifted +3 points on Cohesion this month. Romantic tailoring is consolidating across women's segments.";
  if (k.includes("caption") || k.includes("content")) return "Draft: 'Architecture meets instinct. The new Y/PROJECT silhouette arrives on PAWN.'";
  if (k.includes("report")) return "Weekly report ready: revenue +12.4%, orders +186, top growth in Outerwear.";
  return "Noted. Compiling a recommendation — would you like a written brief or a chart?";
}

export default AdminAI;
