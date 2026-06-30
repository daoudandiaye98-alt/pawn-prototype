import { useState } from "react";
import { Send, TrendingUp, Brain, Sparkles, Wand2, Settings2, FileText } from "lucide-react";
import { AdminShell } from "@/components/pawn/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "ai"; text: string; }

const TOOLS = [
  { icon: TrendingUp, label: "Trend Predictor", prompt: "What's the strongest trend right now?" },
  { icon: Brain, label: "Ask DNA", prompt: "Summarize the global DNA shifts this month." },
  { icon: Sparkles, label: "Content Generator", prompt: "Draft a launch caption for Y/PROJECT." },
  { icon: Wand2, label: "Prompt Studio", prompt: "Build a styling prompt template." },
  { icon: Settings2, label: "Model Settings", prompt: "Show current model parameters." },
  { icon: FileText, label: "Report Builder", prompt: "Build me the weekly platform report." },
];

const AdminAI = () => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "PAWN AI is online. Ask anything about your platform, your designers, or your customers." },
  ]);
  const [input, setInput] = useState("");

  function send(prompt: string) {
    const text = prompt.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: mockAnswer(text) }]);
    setInput("");
  }

  return (
    <AdminShell eyebrow="AI Command Center" title="PAWN AI">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="flex h-[640px] flex-col border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <p className="editorial-eyebrow">Chat · PAWN AI</p>
            <p className="mt-1 font-serif text-2xl">Strategic conversation</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {messages.map((m, i) => (
              <div key={i} className={cn("max-w-[80%]", m.role === "user" ? "ml-auto" : "")}>
                <p className="editorial-eyebrow">{m.role === "user" ? "You" : "PAWN AI"}</p>
                <div className={cn(
                  "mt-1 border p-4 text-sm",
                  m.role === "user" ? "border-foreground bg-foreground text-background" : "border-border bg-background",
                )}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 border-t border-border p-4"
          >
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask PAWN AI anything…" className="rounded-none" />
            <Button type="submit" className="rounded-none"><Send className="h-4 w-4" /></Button>
          </form>
        </section>

        <aside className="space-y-6">
          <div className="border border-border bg-card p-6">
            <p className="editorial-eyebrow">Quick tools</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {TOOLS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => send(prompt)}
                  className="flex flex-col items-start gap-2 border border-border bg-background p-3 text-left hover:border-foreground"
                >
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="text-xs uppercase tracking-[0.18em]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {[
              ["Strongest trend", "Architectural Romance · +24%"],
              ["Color trend", "Oxblood · rising"],
              ["Most searched material", "Heavyweight wool"],
              ["Top designer", "Y/PROJECT"],
            ].map(([l, v]) => (
              <div key={l} className="border border-border bg-card p-5">
                <p className="editorial-eyebrow">{l}</p>
                <p className="mt-2 font-serif text-xl">{v}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </AdminShell>
  );
};

function mockAnswer(q: string): string {
  const k = q.toLowerCase();
  if (k.includes("trend")) return "Architectural Romance is up 24% in user saves, led by Y/PROJECT and Rick Owens. Oxblood is the breakout color.";
  if (k.includes("dna")) return "Global DNA shifted +3 points on Cohesion this month. Romantic tailoring is consolidating across women's segments.";
  if (k.includes("caption") || k.includes("content")) return "Draft: 'Architecture meets instinct. The new Y/PROJECT silhouette arrives on PAWN.' — ready to publish.";
  if (k.includes("report")) return "Weekly report generated: revenue +12.4%, orders +186, top growth in Outerwear. Open the Report Builder for PDF.";
  return "Noted. Compiling a recommendation now — would you like a written brief or a chart?";
}

export default AdminAI;
