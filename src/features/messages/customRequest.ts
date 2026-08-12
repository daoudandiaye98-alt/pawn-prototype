import { supabase } from "@/integrations/supabase/client";

export async function createCustomRequestThread(params: {
  userId: string;
  designerId: string;
  productId: string;
  productName: string;
  body: string;
  budget?: string;
  name?: string;
}) {
  const subject = `Individuelle Anfrage · ${params.productName}`;
  const { data: thread, error: threadErr } = await supabase
    .from("message_threads")
    .insert({
      designer_id: params.designerId,
      created_by: params.userId,
      subject,
      category: "produkt",
      product_id: params.productId,
    })
    .select("id")
    .single();
  if (threadErr || !thread) throw threadErr ?? new Error("thread_create_failed");

  const lines = [params.body];
  if (params.name?.trim()) lines.push(`Name: ${params.name.trim()}`);
  if (params.budget) lines.push(`Budget-Vorstellung: ${params.budget}`);
  const body = lines.join("\n\n");

  const { error: msgErr } = await supabase.from("messages").insert({
    thread_id: thread.id,
    sender_id: params.userId,
    body,
  });
  if (msgErr) throw msgErr;

  // Zusätzliche E-Mail-Benachrichtigung an das Haus, best effort — schlägt sie fehl
  // (z. B. unverifizierte Subdomain), bleibt die In-App-Benachrichtigung trotzdem geschrieben.
  void supabase.functions.invoke("notify-designer-inquiry", { body: { thread_id: thread.id } }).catch(() => {});

  return thread.id;
}
