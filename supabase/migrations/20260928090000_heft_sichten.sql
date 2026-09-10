-- Teil H — das Heft. Quelle dieser Datei: src/heft03/sql/01_heft_sichten.sql
-- Dort steht sie als Vertrag des Hefts; hier steht sie als Migration.
-- Wer eine aendert, aendert beide — sonst laeuft der Vertrag von der Datenbank weg.
-- Anwenden NUR ueber den Lovable-Agenten, nie von Hand im Dashboard (CLAUDE.md).

-- Heft-Sichten: Spaltenmasken für das öffentliche Heft.
-- Grund: "designers public read" (USING published = true) exponiert für anon auch stripe_*-Spalten.
-- Die Sichten liefern genau die Spalten aus quelle.mjs › SPALTEN und nichts sonst.
-- Anwenden im Supabase-Projekt rnakubexbqfgfciynqpt über den Lovable-Agenten (Migration), nie von Hand im Dashboard.

create or replace view public.heft_haeuser
with (security_invoker = true) as
select id, slug, brand_name, house_number, status, published, page_published_at, plan, brand_dna,
       story, manifesto, quote, quote_role, collection_title, location, country, website, instagram, tags,
       hero_image_url, avatar_url, banner_url, portrait_url, atelier_image_url, atelier_caption,
       is_featured, verkaufsbereit
from public.designers
where status = 'active' and published = true;

create or replace view public.heft_produkte
with (security_invoker = true) as
select p.id, p.slug, p.name, p.world, p.price, p.image_url, p.description, p.designer_note, p.product_dna,
       p.size_variants, p.measurements, p.material_composition, p.inventory_mode, p.stock_quantity, p.lead_time_days,
       p.tags, p.status, p.height_cm, p.width_cm, p.length_cm, p.made_in, p.care_instructions, p.edition_info,
       p.sustainability_note, p.vat_rate, p.designer_id, p.created_at
from public.products p
join public.designers d on d.id = p.designer_id
where p.status = 'published' and d.status = 'active' and d.published = true;

grant select on public.heft_haeuser, public.heft_produkte to anon, authenticated;

comment on view public.heft_haeuser is 'Öffentliche Hausdaten fürs Heft (Spaltenmaske, keine Stripe-/Kontospalten).';
comment on view public.heft_produkte is 'Öffentliche Werke fürs Heft; nur veröffentlichte Werke aktiver, veröffentlichter Häuser.';

-- Hinweis: security_invoker=true lässt die bestehenden RLS-Policies der Basistabellen gelten.
-- Der eingebettete Join products→designers(id,slug,brand_name,verkaufsbereit) aus quelle.mjs funktioniert
-- über die Sicht nur, wenn PostgREST die FK-Beziehung erkennt; sonst designer-Felder aus heft_haeuser nachschlagen
-- (heftAusZeilen() macht das über haeuserNachId, wenn row.designers fehlt).
