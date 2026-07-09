
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any prior job with same name
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-trends-daily';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'compute-trends-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://rnakubexbqfgfciynqpt.supabase.co/functions/v1/compute-trends',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYWt1YmV4YnFmZ2ZjaXlucXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODY5MTIsImV4cCI6MjA5ODQ2MjkxMn0.6RRjEiA5ua8SfHjbblYH4NtESPaYRccKGA_MjEYBbqE"}'::jsonb,
    body:='{"scheduled":true}'::jsonb
  ) AS request_id;
  $$
);
