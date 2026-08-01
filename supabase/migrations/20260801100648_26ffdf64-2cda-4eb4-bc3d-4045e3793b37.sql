CREATE OR REPLACE FUNCTION public.order_has_my_house_items(_items jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) AS it
    JOIN public.products p ON p.slug = it->>'slug'
    JOIN public.designers d ON d.id = p.designer_id
    WHERE d.user_id = auth.uid()
  )
$$;

CREATE POLICY "designer sees orders containing own products"
ON public.orders
FOR SELECT
TO authenticated
USING (public.order_has_my_house_items(items));