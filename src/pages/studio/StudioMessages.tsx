import { useMemo, useState } from "react";
import { StudioShell } from "@/components/pawn/StudioShell";
import { PawnEmptyState } from "@/components/pawn/PawnEmptyState";
import { useMyDesigner } from "@/features/studio/useMyDesigner";
import { useThreads, useThreadMessages, sendMessage, createThread, type MessageCategory } from "@/features/messages/useMessages";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useInternalHandles } from "@/lib/handles";
import { useI18n } from "@/lib/i18n";

export default function StudioMessages() {
  const { t } = useI18n();
  const CATEGORIES: { value: MessageCategory; label: string }[] = [
    { value: "allgemein", label: t("studio.messages.category.allgemein") },
    { value: "auszahlung", label: t("studio.messages.category.auszahlung") },
    { value: "kampagne", label: t("studio.messages.category.kampagne") },
    { value: "produkt", label: t("studio.messages.category.produkt") },
    { value: "technik", label: t("studio.messages.category.technik") },
  ];
  const { user } = useAuth();
  const { designer } = useMyDesigner();
  const { threads } = useThreads();
  const [active, setActive] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<MessageCategory>("allgemein");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const { messages, listRef } = useThreadMessages(active);
  const activeThread = useMemo(() => threads.find((th) => th.id === active), [threads, active]);
  const customerIds = useMemo(() => Array.from(new Set(threads.map((th) => th.created_by).filter(Boolean))), [threads]);
  const handles = useInternalHandles(customerIds);

  const startThread = async () => {
    if (!designer || !user || !subject.trim() || !body.trim()) return;
    const { thread, error } = await createThread({
      designer_id: designer.id, subject: subject.trim(), category, body: body.trim(), created_by: user.id,
    });
    if (error) return toast.error(error.message);
    setSubject(""); setBody(""); setComposeOpen(false);
    if (thread) setActive(thread.id);
    toast.success(t("studio.messages.toast.sent"));
  };

  const send = async () => {
    if (!active || !user || !reply.trim()) return;
    const { error } = await sendMessage(active, user.id, reply.trim());
    if (error) return toast.error(error.message);
    setReply("");
  };

  return (
    <StudioShell title={t("studio.messages.title")} eyebrow={t("studio.messages.eyebrow")}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
        <aside className="border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-muted-foreground">{t("studio.messages.history")}</p>
            <button onClick={() => setComposeOpen(true)} className="text-[0.68rem] uppercase tracking-[0.28em] text-foreground underline">{t("studio.messages.new")}</button>
          </div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {threads.length === 0 && <li className="px-4 py-6 text-xs text-muted-foreground">{t("studio.messages.emptyThreads")}</li>}
            {threads.map((th) => {
              const kunde = handles.get(th.created_by) ?? t("studio.messages.unknownUser");
              return (
                <li key={th.id}>
                  <button
                    onClick={() => setActive(th.id)}
                    className={`w-full border-b border-border px-4 py-3 text-left hover:bg-secondary ${active === th.id ? "bg-secondary" : ""}`}
                  >
                    <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">
                      {kunde} · {th.category}
                    </p>
                    <p className="mt-1 font-serif text-sm">{th.subject}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-h-[60vh] border border-border">
          {composeOpen ? (
            <div className="p-6 space-y-4">
              <p className="editorial-eyebrow">{t("studio.messages.newThread")}</p>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("studio.messages.subjectPlaceholder")}
                className="w-full border-b border-border bg-transparent py-2 " />
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button key={c.value} onClick={() => setCategory(c.value)}
                    className={`px-3 py-1 text-[0.68rem] uppercase tracking-[0.28em] border ${category === c.value ? "bg-foreground text-background" : "border-border text-muted-foreground"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={t("studio.messages.bodyPlaceholder")}
                className="w-full border border-border bg-transparent p-3 " />
              <div className="flex gap-3">
                <button onClick={startThread} disabled={!subject.trim() || !body.trim()}
                  className="px-4 py-2 bg-foreground text-background text-[0.72rem] uppercase tracking-[0.24em] disabled:opacity-40">{t("chat.send")}</button>
                <button onClick={() => setComposeOpen(false)} className="text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground">{t("common.cancel")}</button>
              </div>
            </div>
          ) : activeThread ? (
            <div className="flex h-[70vh] flex-col">
              <header className="border-b border-border px-6 py-4">
                <p className="editorial-eyebrow">{activeThread.category} · {activeThread.status}</p>
                <h2 className="font-serif text-xl mt-1">{activeThread.subject}</h2>
              </header>
              <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-6">
                {messages.map((m) => (
                  <div key={m.id} className={m.sender_id === user?.id ? "text-right" : ""}>
                    <p className="text-[0.6rem] uppercase tracking-[0.28em] text-muted-foreground">{m.sender_id === user?.id ? t("studio.messages.you") : "PAWN"}</p>
                    <p className="mt-1 text-sm">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-border p-4">
                <div className="flex gap-3">
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    className="flex-1 border border-border bg-transparent p-2 " placeholder={t("studio.messages.replyPlaceholder")} />
                  <button onClick={send} disabled={!reply.trim()} className="px-4 py-2 bg-foreground text-background text-[0.72rem] uppercase tracking-[0.24em] disabled:opacity-40">{t("chat.send")}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[60vh] items-center justify-center p-8">
              <PawnEmptyState
                title={t("studio.messages.selectOrStart")}
                action={
                  <button onClick={() => setComposeOpen(true)} className="inline-flex items-center border border-foreground px-5 py-2.5 text-[0.65rem] uppercase tracking-[0.28em] hover:bg-foreground hover:text-background">
                    {t("studio.messages.new")}
                  </button>
                }
              />
            </div>
          )}
        </section>
      </div>
    </StudioShell>
  );
}
