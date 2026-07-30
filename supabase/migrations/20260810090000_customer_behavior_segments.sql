-- Teil 20c: Verhaltensprofile der Kunden — abgeleitet aus tatsächlichem Kaufverhalten
-- (orders) und Aufrufen (page_visits, Teil 20a). Vier Segmente, jedes mit dokumentierter
-- Ableitung direkt im Code (keine Blackbox):
--   Beobachter — hat sich umgesehen, aber noch nichts gekauft.
--   Gezielt    — genau ein Stück gekauft.
--   Sammler    — mehrfach gekauft, bei höchstens zwei verschiedenen Häusern.
--   Streuner   — mehrfach gekauft, über drei oder mehr Häuser verteilt.
-- Admin-only: liest weder einzelne Kundennamen noch E-Mails, nur aggregierte Zahlen.
create or replace function public.customer_behavior_segments()
returns table (segment text, kunden bigint, anteil numeric, merkmal text, avg_bestellungen numeric)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'not_authorized';
  end if;

  return query
  with per_user as (
    select o.user_id,
      count(distinct o.id) as orders_count,
      count(distinct p.designer_id) as designers_bought
    from public.orders o
    cross join lateral jsonb_array_elements(o.items) as item
    join public.products p on p.slug = (item->>'slug')
    where o.status = 'paid' and o.user_id is not null
    group by o.user_id
  ),
  visitors as (
    select distinct user_id from public.page_visits
  ),
  base as (
    select coalesce(pu.user_id, v.user_id) as uid,
      coalesce(pu.orders_count, 0) as orders_count,
      coalesce(pu.designers_bought, 0) as designers_bought
    from per_user pu
    full outer join visitors v on v.user_id = pu.user_id
    where coalesce(pu.user_id, v.user_id) is not null
  ),
  segmented as (
    select
      case
        when orders_count = 0 then 'Beobachter'
        when orders_count = 1 then 'Gezielt'
        when designers_bought <= 2 then 'Sammler'
        else 'Streuner'
      end as seg,
      orders_count as oc
    from base
  )
  select
    seg,
    count(*)::bigint,
    round(count(*) * 100.0 / nullif(sum(count(*)) over (), 0), 1),
    case seg
      when 'Beobachter' then 'Hat sich umgesehen, aber noch nichts gekauft'
      when 'Gezielt' then 'Genau ein Stück gekauft'
      when 'Sammler' then 'Mehrfach gekauft, meist beim selben Haus'
      else 'Mehrfach gekauft, über mehrere Häuser verteilt'
    end,
    round(avg(oc), 2)
  from segmented
  group by seg
  order by count(*) desc;
end;
$$;

revoke all on function public.customer_behavior_segments() from public;
grant execute on function public.customer_behavior_segments() to authenticated;
