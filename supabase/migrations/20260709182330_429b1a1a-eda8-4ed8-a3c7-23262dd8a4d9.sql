
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ontology_kind' AND e.enumlabel='color') THEN
    ALTER TYPE public.ontology_kind ADD VALUE 'color';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='ontology_kind' AND e.enumlabel='mood') THEN
    ALTER TYPE public.ontology_kind ADD VALUE 'mood';
  END IF;
END $$;
