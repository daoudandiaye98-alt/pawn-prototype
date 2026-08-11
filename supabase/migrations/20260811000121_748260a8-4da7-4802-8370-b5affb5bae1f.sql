DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'expired'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'expired';
  END IF;
END $$;