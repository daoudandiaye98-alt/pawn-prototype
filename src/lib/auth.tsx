import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export type Role = "customer" | "designer" | "admin";

export interface AuthProfile {
  id: string;
  displayName: string;
  locale: string;
  consent: { personalization: boolean; memory: boolean; analytics: boolean };
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: Role[];
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasRole: (role: Role) => boolean;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string): Promise<AuthProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, locale, consent_personalization, consent_memory, consent_analytics")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name ?? "",
    locale: data.locale ?? "en-US",
    consent: {
      personalization: !!data.consent_personalization,
      memory: !!data.consent_memory,
      analytics: !!data.consent_analytics,
    },
  };
}

async function loadRoles(userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []).map((r) => r.role) as Role[]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Defer to avoid deadlocks per Supabase guidance
        setTimeout(async () => {
          const [p, r] = await Promise.all([loadProfile(s.user.id), loadRoles(s.user.id)]);
          setProfile(p);
          setRoles(r);
          // Attach anonymous chat/taste session to this user on sign-in.
          if (event === "SIGNED_IN") {
            try {
              const sid = typeof window !== "undefined" ? window.localStorage.getItem("palace.chat.session_id") : null;
              if (sid) await supabase.functions.invoke("merge-session", { body: { session_id: sid } });
            } catch { /* best-effort */ }
          }
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });


    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const [p, r] = await Promise.all([loadProfile(s.user.id), loadRoles(s.user.id)]);
        setProfile(p);
        setRoles(r);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName },
      },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { error: result.error.message ?? "Google sign-in failed" };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const hasRole = useCallback((role: Role) => roles.includes(role), [roles]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, profile, roles, loading, signInWithPassword, signUp, signInWithGoogle, signOut, hasRole }),
    [user, session, profile, roles, loading, signInWithPassword, signUp, signInWithGoogle, signOut, hasRole],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
