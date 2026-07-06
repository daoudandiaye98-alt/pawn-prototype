
-- 1) Extend products
DO $$ BEGIN CREATE TYPE public.inventory_mode AS ENUM ('stock','made_to_order'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_mode public.inventory_mode NOT NULL DEFAULT 'stock',
  ADD COLUMN IF NOT EXISTS stock_quantity int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_custom_requests boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS weight_grams int,
  ADD COLUMN IF NOT EXISTS lead_time_days int;

CREATE INDEX IF NOT EXISTS products_status_world_idx ON public.products (status, world);
CREATE INDEX IF NOT EXISTS products_designer_status_idx ON public.products (designer_id, status);
CREATE INDEX IF NOT EXISTS products_slug_idx ON public.products (slug);
CREATE INDEX IF NOT EXISTS products_tags_gin ON public.products USING gin (tags);
CREATE INDEX IF NOT EXISTS products_created_at_desc ON public.products (created_at DESC);

-- 2) Extend message_threads with product_id + participant-based access
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TYPE public.message_category ADD VALUE IF NOT EXISTS 'produkt';
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS message_threads_created_by_idx ON public.message_threads (created_by);
CREATE INDEX IF NOT EXISTS message_threads_product_idx ON public.message_threads (product_id);

-- Extend RLS: creator can also read/insert (customer-initiated threads)
DROP POLICY IF EXISTS "designer sees own threads" ON public.message_threads;
CREATE POLICY "participants see threads" ON public.message_threads FOR SELECT
USING (
  public.has_role(auth.uid(),'admin')
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = message_threads.designer_id AND d.user_id = auth.uid())
);

DROP POLICY IF EXISTS "designer creates own thread" ON public.message_threads;
CREATE POLICY "participants create threads" ON public.message_threads FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.designers d WHERE d.id = message_threads.designer_id AND d.user_id = auth.uid())
    OR auth.uid() IS NOT NULL  -- any authenticated user can start a thread with a designer
  )
);

DROP POLICY IF EXISTS "participants read messages" ON public.messages;
CREATE POLICY "participants read messages" ON public.messages FOR SELECT
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (
    SELECT 1 FROM public.message_threads t
    LEFT JOIN public.designers d ON d.id = t.designer_id
    WHERE t.id = messages.thread_id
      AND (t.created_by = auth.uid() OR d.user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "participants write messages" ON public.messages;
CREATE POLICY "participants write messages" ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      LEFT JOIN public.designers d ON d.id = t.designer_id
      WHERE t.id = messages.thread_id
        AND (t.created_by = auth.uid() OR d.user_id = auth.uid())
    )
  )
);

-- 3) Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wishlist read"   ON public.wishlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own wishlist insert" ON public.wishlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own wishlist delete" ON public.wishlists FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS wishlists_user_idx ON public.wishlists (user_id, created_at DESC);

-- 4) Stock decrement function (SECURITY DEFINER, service_role only)
CREATE OR REPLACE FUNCTION public.decrement_stock_for_order(_product_id uuid, _qty int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  new_stock int;
  mode public.inventory_mode;
  designer_user uuid;
  product_name text;
BEGIN
  SELECT inventory_mode, stock_quantity, name INTO mode, new_stock, product_name
    FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND OR mode <> 'stock' THEN RETURN; END IF;

  new_stock := GREATEST(0, new_stock - GREATEST(1, _qty));
  UPDATE public.products SET stock_quantity = new_stock WHERE id = _product_id;

  IF new_stock = 0 THEN
    SELECT d.user_id INTO designer_user
      FROM public.products p JOIN public.designers d ON d.id = p.designer_id
      WHERE p.id = _product_id;
    IF designer_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (designer_user, 'product.sold_out',
              'Ausverkauft: ' || product_name,
              'Dein Stück ist ausverkauft. Aktualisiere den Bestand oder biete es als Anfertigung an.',
              '/studio/produkte');
    END IF;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.decrement_stock_for_order(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_stock_for_order(uuid, int) TO service_role;
