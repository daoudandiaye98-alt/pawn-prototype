-- Teil 15c: Die Verwandlung sichtbar machen. Das Schachmotiv als Struktur, nicht Dekoration —
-- jedes Haus beginnt als Bauer. Fünf Stufen aus echtem Tun (nie käuflich, nie durch einen Plan
-- erreichbar — Pläne kaufen Werkzeuge, keine Ränge): erstes Stück, erste Kampagne, erster
-- Verkauf, erste Première, eigene Welt gestaltet. Sind alle fünf erreicht: die Verwandlung.
-- Ratchet-Prinzip: einmal erreicht, bleibt erreicht, auch wenn die auslösende Zeile später
-- gelöscht wird (z. B. das allererste Produkt wieder entfernt wird).
create table public.house_milestones (
  designer_id uuid primary key references public.designers(id) on delete cascade,
  erstes_stueck_at timestamptz,
  erste_kampagne_at timestamptz,
  erster_verkauf_at timestamptz,
  erste_premiere_at timestamptz,
  eigene_welt_at timestamptz,
  verwandlung_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.house_milestones enable row level security;

create policy "designer manages own house_milestones" on public.house_milestones
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_milestones.designer_id and d.user_id = auth.uid()
  ))
  with check (has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = house_milestones.designer_id and d.user_id = auth.uid()
  ));

-- Öffentlich lesbar: das dezente Zeichen auf der Hausseite braucht das für jedes veröffentlichte Haus.
create policy "public reads milestones of published houses" on public.house_milestones
  for select
  using (exists (
    select 1 from public.designers d where d.id = house_milestones.designer_id and d.status = 'active'
  ));

create trigger trg_house_milestones_updated before update on public.house_milestones
  for each row execute function set_updated_at();

-- Berechnet die Stufen neu aus dem tatsächlichen Stand (Produkte, Kampagnen, bezahlte
-- Bestellungen mit einem Stück dieses Hauses, Première-Video, eigenes Haus-Thema) und schreibt
-- sie fort (COALESCE = Ratchet, nie zurückgesetzt). SECURITY DEFINER, da RLS von orders/products
-- Kunden- bzw. andere Sichten hat; prüft Eigentümerschaft/Admin selbst.
create or replace function public.recompute_house_milestones(p_designer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
  v_erstes_stueck timestamptz;
  v_erste_kampagne timestamptz;
  v_erster_verkauf timestamptz;
  v_erste_premiere timestamptz;
  v_eigene_welt timestamptz;
  v_all_done boolean;
begin
  select has_role(auth.uid(), 'admin'::app_role) or exists (
    select 1 from public.designers d where d.id = p_designer_id and d.user_id = auth.uid()
  ) into v_ok;
  if not coalesce(v_ok, false) then
    raise exception 'not_authorized';
  end if;

  select min(created_at) into v_erstes_stueck from public.products where designer_id = p_designer_id;
  select min(created_at) into v_erste_kampagne from public.campaigns
    where designer_id = p_designer_id and status in ('approved', 'published');
  select min(o.created_at) into v_erster_verkauf
    from public.orders o
    where o.status = 'paid'
      and exists (
        select 1 from jsonb_array_elements(o.items) as item
        join public.products p on p.slug = (item->>'slug') and p.designer_id = p_designer_id
      );
  select min(created_at) into v_erste_premiere from public.video_assets
    where designer_id = p_designer_id and premiere = true;
  select min(created_at) into v_eigene_welt from public.house_themes
    where designer_id = p_designer_id;

  insert into public.house_milestones (designer_id, erstes_stueck_at, erste_kampagne_at, erster_verkauf_at, erste_premiere_at, eigene_welt_at)
  values (p_designer_id, v_erstes_stueck, v_erste_kampagne, v_erster_verkauf, v_erste_premiere, v_eigene_welt)
  on conflict (designer_id) do update set
    erstes_stueck_at = coalesce(house_milestones.erstes_stueck_at, excluded.erstes_stueck_at),
    erste_kampagne_at = coalesce(house_milestones.erste_kampagne_at, excluded.erste_kampagne_at),
    erster_verkauf_at = coalesce(house_milestones.erster_verkauf_at, excluded.erster_verkauf_at),
    erste_premiere_at = coalesce(house_milestones.erste_premiere_at, excluded.erste_premiere_at),
    eigene_welt_at = coalesce(house_milestones.eigene_welt_at, excluded.eigene_welt_at);

  select
    (erstes_stueck_at is not null and erste_kampagne_at is not null and erster_verkauf_at is not null
     and erste_premiere_at is not null and eigene_welt_at is not null and verwandlung_at is null)
  into v_all_done
  from public.house_milestones where designer_id = p_designer_id;

  if v_all_done then
    update public.house_milestones set verwandlung_at = now() where designer_id = p_designer_id;
  end if;
end;
$$;

grant execute on function public.recompute_house_milestones(uuid) to authenticated;
