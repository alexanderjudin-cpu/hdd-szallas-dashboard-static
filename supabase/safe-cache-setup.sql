-- ============================================================
-- HDD Szállás dashboard: SAFE cache setup
-- Nem töröl táblát, nem dropol view-t, nem truncate-ol.
-- Létrehoz / frissít egy külön cache táblát:
--   public.housing_city_pin_feed_cache_v2
-- A GitHub Actions ebből olvas napi egyszer, és statikus HTML-t generál.
-- ============================================================

create or replace function public.hdd_norm_text(p_text text)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(p_text, '')), 'áéíóöőúüűÁÉÍÓÖŐÚÜŰ', 'aeiooouuuAEIOOOUUU')
$$;

create or replace function public.hdd_num(p_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  cleaned text;
begin
  cleaned := regexp_replace(coalesce(p_value, ''), '[^0-9,.-]', '', 'g');
  cleaned := replace(cleaned, ',', '.');

  if cleaned is null or cleaned = '' or cleaned = '-' or cleaned = '.' or cleaned = '-.' then
    return 0;
  end if;

  return cleaned::numeric;
exception when others then
  return 0;
end;
$$;

create or replace function public.hdd_city_from_text(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  t text := public.hdd_norm_text(p_text);
begin
  if t like '%hodmezovasarhely%' then return 'Hódmezővásárhely'; end if;
  if t like '%szekesfehervar%' then return 'Székesfehérvár'; end if;
  if t like '%nyiregyhaza%' then return 'Nyíregyháza'; end if;
  if t like '%zalaegerszeg%' then return 'Zalaegerszeg'; end if;
  if t like '%bekescsaba%' then return 'Békéscsaba'; end if;
  if t like '%nagykoros%' then return 'Nagykőrös'; end if;
  if t like '%nagykata%' then return 'Nagykáta'; end if;
  if t like '%nagykanizsa%' then return 'Nagykanizsa'; end if;
  if t like '%szentendre%' then return 'Szentendre'; end if;
  if t like '%szigetszentmiklos%' then return 'Szigetszentmiklós'; end if;
  if t like '%dunaujvaros%' then return 'Dunaújváros'; end if;
  if t like '%dunakeszi%' then return 'Dunakeszi'; end if;
  if t like '%tatabanya%' then return 'Tatabánya'; end if;
  if t like '%salgotarjan%' then return 'Salgótarján'; end if;
  if t like '%szekszard%' then return 'Szekszárd'; end if;
  if t like '%veszprem%' then return 'Veszprém'; end if;
  if t like '%szombathely%' then return 'Szombathely'; end if;
  if t like '%kecskemet%' then return 'Kecskemét'; end if;
  if t like '%debrecen%' then return 'Debrecen'; end if;
  if t like '%budapest%' then return 'Budapest'; end if;
  if t like '%miskolc%' then return 'Miskolc'; end if;
  if t like '%szeged%' then return 'Szeged'; end if;
  if t ~ '(^|[^a-z])gyor([^a-z]|$)' then return 'Győr'; end if;
  if t ~ '(^|[^a-z])pecs([^a-z]|$)' then return 'Pécs'; end if;
  if t like '%szolnok%' then return 'Szolnok'; end if;
  if t like '%kaposvar%' then return 'Kaposvár'; end if;
  if t ~ '(^|[^a-z])eger([^a-z]|$)' then return 'Eger'; end if;
  if t like '%sopron%' then return 'Sopron'; end if;
  if t ~ '(^|[^a-z])baja([^a-z]|$)' then return 'Baja'; end if;
  if t ~ '(^|[^a-z])ozd([^a-z]|$)' then return 'Ózd'; end if;
  if t ~ '(^|[^a-z])vac([^a-z]|$)' then return 'Vác'; end if;
  if t like '%cegled%' then return 'Cegléd'; end if;
  if t like '%godollo%' then return 'Gödöllő'; end if;
  if t like '%gyongyos%' then return 'Gyöngyös'; end if;
  if t like '%mosonmagyarovar%' then return 'Mosonmagyaróvár'; end if;
  if t ~ '(^|[^a-z])papa([^a-z]|$)' then return 'Pápa'; end if;
  if t like '%hajduboszormeny%' then return 'Hajdúböszörmény'; end if;
  if t like '%kiskunfelegyhaza%' then return 'Kiskunfélegyháza'; end if;
  if t ~ '(^|[^a-z])ajka([^a-z]|$)' then return 'Ajka'; end if;
  if t like '%esztergom%' then return 'Esztergom'; end if;
  if t like '%oroshaza%' then return 'Orosháza'; end if;
  if t like '%kazincbarcika%' then return 'Kazincbarcika'; end if;
  if t like '%siofok%' then return 'Siófok'; end if;
  if t like '%komarom%' then return 'Komárom'; end if;
  if t like '%jaszbereny%' then return 'Jászberény'; end if;
  if t like '%oroszlany%' then return 'Oroszlány'; end if;
  if t like '%kisvarda%' then return 'Kisvárda'; end if;
  if t like '%hatvan%' then return 'Hatvan'; end if;
  if t like '%gyal%' then return 'Gyál'; end if;
  if t like '%monor%' then return 'Monor'; end if;
  if t like '%budaors%' then return 'Budaörs'; end if;
  if t ~ '(^|[^a-z])erd([^a-z]|$)' then return 'Érd'; end if;
  if t like '%torokbalint%' then return 'Törökbálint'; end if;
  if t ~ '(^|[^a-z])mor([^a-z]|$)' then return 'Mór'; end if;
  return null;
end;
$$;

create table if not exists public.housing_city_pin_feed_cache_v2 (
  city text primary key,
  ceg text,
  partner text,
  szallasado text,
  address_count integer default 0,
  employees integer default 0,
  capacity integer default 0,
  free integer default 0,
  nights integer default 0,
  cost numeric default 0,
  refreshed_at timestamptz default now()
);

create or replace function public.refresh_housing_city_pin_feed_cache_v2()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.housing_city_pin_feed_cache_v2 (
    city,
    ceg,
    partner,
    szallasado,
    address_count,
    employees,
    capacity,
    free,
    nights,
    cost,
    refreshed_at
  )
  with src as (
    select
      coalesce(
        public.hdd_city_from_text(szallas_cim::text),
        public.hdd_city_from_text(szallasado::text),
        public.hdd_city_from_text(partner_nev::text)
      ) as city,
      ceg::text as ceg,
      partner_nev::text as partner,
      szallasado::text as szallasado,
      szallas_cim::text as szallas_cim,
      coalesce(public.hdd_num(ferohely::text), 0) as capacity,
      coalesce(public.hdd_num(aktiv_munkavallalo_db::text), 0) as employees,
      coalesce(public.hdd_num(becsult_havi_netto_koltseg::text), 0) as cost
    from public.v_retool_partner_address_provider
    where coalesce(szallas_cim::text, '') <> ''
  ),
  agg as (
    select
      city,
      min(ceg) as ceg,
      string_agg(distinct nullif(partner, ''), ', ')
        filter (where nullif(partner, '') is not null) as partner,
      string_agg(distinct nullif(szallasado, ''), ', ')
        filter (where nullif(szallasado, '') is not null) as szallasado,
      count(*)::integer as address_count,
      sum(employees)::integer as employees,
      sum(capacity)::integer as capacity,
      greatest(sum(capacity) - sum(employees), 0)::integer as free,
      sum(employees * 30)::integer as nights,
      sum(cost)::numeric as cost,
      now() as refreshed_at
    from src
    where city is not null
    group by city
  )
  select
    city,
    ceg,
    partner,
    szallasado,
    address_count,
    employees,
    capacity,
    free,
    nights,
    cost,
    refreshed_at
  from agg
  on conflict (city) do update set
    ceg = excluded.ceg,
    partner = excluded.partner,
    szallasado = excluded.szallasado,
    address_count = excluded.address_count,
    employees = excluded.employees,
    capacity = excluded.capacity,
    free = excluded.free,
    nights = excluded.nights,
    cost = excluded.cost,
    refreshed_at = excluded.refreshed_at;
end;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.hdd_norm_text(text) to anon, authenticated;
grant execute on function public.hdd_num(text) to anon, authenticated;
grant execute on function public.hdd_city_from_text(text) to anon, authenticated;
grant execute on function public.refresh_housing_city_pin_feed_cache_v2() to authenticated;
grant select on public.housing_city_pin_feed_cache_v2 to anon, authenticated;

-- Első feltöltés / teszt
select public.refresh_housing_city_pin_feed_cache_v2();

select
  city,
  employees,
  address_count,
  capacity,
  free,
  cost,
  refreshed_at
from public.housing_city_pin_feed_cache_v2
order by employees desc, cost desc
limit 50;
