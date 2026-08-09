-- Teil 39 AP5 — Sicherheit: Rate-Limits für pawn-chat (verhindert Missbrauch/Kostenexplosion
-- durch ein einzelnes Konto oder eine IP) und Timing-sicherer Vergleich für JARVIS_CRON_SECRET
-- (Code-Änderung, kein SQL nötig — siehe SECURITY_CHECKS.md).

CREATE TABLE public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rate_limit_hits_bucket_created_idx ON public.rate_limit_hits (bucket, created_at DESC);

-- Nur der Service-Role-Schlüssel (Edge Functions) darf hier lesen/schreiben — kein Client-Zugriff,
-- weder anon noch authenticated. Kein RLS-Policy-Grant nötig, RLS ohne Policy blockt per Default.
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_hits FROM anon, authenticated;
GRANT ALL ON public.rate_limit_hits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE rate_limit_hits_id_seq TO service_role;

-- Konfiguration bewusst NICHT über die ai_config-Allowlist lesbar (Sicherheits-Gesetz: die
-- Allowlist-Policy "authenticated read ai_config allowlist" wird nie erweitert). Edge Functions
-- lesen mit dem Service-Role-Key, der RLS ohnehin umgeht.
INSERT INTO public.ai_config (key, value)
VALUES ('pawn_chat_rate_limits', '{"per_user_per_minute": 20, "per_ip_per_minute": 40}'::jsonb)
ON CONFLICT (key) DO NOTHING;
