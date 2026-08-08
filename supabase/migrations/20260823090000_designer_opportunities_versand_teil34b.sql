-- Teil 34b — Offene Türen: Versand. Ergänzt designer_opportunities um alles, was der
-- manuelle "Absenden"-Knopf im Studio braucht: eine gefundene Kontakt-Adresse, wann gesendet
-- wurde, ob schon einmal nachgefasst wurde (max_touches-Prinzip: höchstens 1x, danach nie
-- wieder), und den Zustellungs-Status samt Resend-Nachrichten-ID für den Webhook-Rückkanal.
alter table public.designer_opportunities
  add column if not exists contact_email text,
  add column if not exists sent_at timestamptz,
  add column if not exists followup_sent_at timestamptz,
  add column if not exists delivery_status text check (delivery_status in ('versendet', 'zugestellt', 'fehler')),
  add column if not exists delivery_error text,
  add column if not exists resend_message_id text;

create index if not exists designer_opportunities_resend_msg_idx on public.designer_opportunities (resend_message_id) where resend_message_id is not null;
