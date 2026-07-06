import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type MessageCategory = "allgemein" | "auszahlung" | "kampagne" | "produkt" | "technik";
export type MessageStatus = "open" | "closed";

export interface Thread {
  id: string;
  designer_id: string;
  created_by: string;
  subject: string;
  category: MessageCategory;
  status: MessageStatus;
  last_message_at: string;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export function useThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("message_threads")
      .select("*")
      .order("last_message_at", { ascending: false });
    setThreads((data ?? []) as Thread[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setThreads([]); return; }
    void load();
    const ch = supabase
      .channel(`threads-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_threads" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, load]);

  return { threads, loading, refresh: load };
}

export function useThreadMessages(threadId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!threadId) { setMessages([]); return; }
    const { data } = await supabase
      .from("messages").select("*").eq("thread_id", threadId).order("created_at");
    setMessages((data ?? []) as ChatMessage[]);
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    void load();
    const ch = supabase
      .channel(`msgs-${threadId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (p) => setMessages((m) => [...m, p.new as ChatMessage]))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [threadId, load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return { messages, listRef, refresh: load };
}

export async function sendMessage(threadId: string, senderId: string, body: string) {
  return supabase.from("messages").insert({ thread_id: threadId, sender_id: senderId, body });
}

export async function createThread(input: {
  designer_id: string; subject: string; category: MessageCategory; body: string; created_by: string;
}) {
  const { data: thread, error } = await supabase
    .from("message_threads")
    .insert({ designer_id: input.designer_id, subject: input.subject, category: input.category, created_by: input.created_by })
    .select().single();
  if (error || !thread) return { error };
  const { error: mErr } = await supabase.from("messages").insert({
    thread_id: thread.id, sender_id: input.created_by, body: input.body,
  });
  return { thread, error: mErr };
}
