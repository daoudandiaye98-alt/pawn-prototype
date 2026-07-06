import { supabase } from "@/integrations/supabase/client";

export async function createCustomRequestThread(params: {
  userId: string;
  designerId: string;
  productId: string;
  productName: string;
  body: string;
  budget?: string;
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

  const body = params.budget
    ? `${params.body}\n\nBudget-Vorstellung: ${params.budget}`
    : params.body;

  const { error: msgErr } = await supabase.from("messages").insert({
    thread_id: thread.id,
    sender_id: params.userId,
    body,
  });
  if (msgErr) throw msgErr;

  return thread.id;
}
