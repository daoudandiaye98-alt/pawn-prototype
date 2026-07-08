import { useState } from "react";
import { PalaceLayout } from "@/components/palace/PalaceLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";

export default function Kontakt() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [subject, setSubject] = useState("Allgemeine Anfrage");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !body.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("submit-contact", {
        body: { name, email, subject, body, user_id: user?.id ?? null },
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Nachricht gesendet", description: "Wir melden uns per E-Mail." });
    } catch (err) {
      toast({ title: "Konnte nicht senden", description: String((err as Error).message ?? err), variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <PalaceLayout>
      <section className="mx-auto max-w-[900px] px-6 py-16 md:px-14 md:py-24">
        <p className="text-[0.6rem] uppercase tracking-[0.42em] text-black">Haus · Kontakt</p>
        <h1 className="mt-6 font-serif text-4xl leading-[1.05] md:text-6xl" style={{ fontWeight: 600 }}>
          Sprich mit dem Haus.
        </h1>
        <p className="mt-6 max-w-xl text-[1rem] leading-relaxed text-black">
          Fragen zu Bestellungen, Bewerbungen, Presse oder Zusammenarbeit — schreib direkt. Wir antworten innerhalb von zwei Werktagen.
        </p>

        {sent ? (
          <div className="mt-12 border-[1.5px] border-black bg-white p-8 shadow-hard">
            <p className="font-serif text-2xl" style={{ fontWeight: 600 }}>Danke — deine Nachricht ist bei uns.</p>
            <p className="mt-3 text-[0.9rem]">Wir melden uns per E-Mail an <b>{email}</b>.</p>
            <div className="mt-6 flex gap-3">
              <a href="/" className="palace-btn">Zur Ausstellung</a>
              <a href="/neu" className="palace-btn">Neuheiten sehen</a>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-12 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Dein Name">
                <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full border-[1.5px] border-black bg-white px-3 py-3 text-[0.9rem] outline-none focus:shadow-hard-sm" />
              </Field>
              <Field label="E-Mail">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border-[1.5px] border-black bg-white px-3 py-3 text-[0.9rem] outline-none focus:shadow-hard-sm" />
              </Field>
            </div>
            <Field label="Betreff">
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full border-[1.5px] border-black bg-white px-3 py-3 text-[0.9rem] outline-none">
                <option>Allgemeine Anfrage</option>
                <option>Bestellung / Versand</option>
                <option>Designer-Bewerbung</option>
                <option>Presse</option>
                <option>Kooperation</option>
              </select>
            </Field>
            <Field label="Nachricht">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} required className="w-full border-[1.5px] border-black bg-white px-3 py-3 text-[0.9rem] outline-none focus:shadow-hard-sm" />
            </Field>
            <div>
              <button type="submit" disabled={sending} className="border-[1.5px] border-black bg-black px-6 py-3 text-[0.7rem] uppercase tracking-[0.3em] text-white transition-colors hover:bg-white hover:text-black disabled:opacity-50">
                {sending ? "Senden…" : "Nachricht senden →"}
              </button>
            </div>
          </form>
        )}
      </section>
    </PalaceLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.6rem] uppercase tracking-[0.32em] text-black">{label}</span>
      {children}
    </label>
  );
}
