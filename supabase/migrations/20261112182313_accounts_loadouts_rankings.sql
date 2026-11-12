-- Client-owned profile data is separate from server-owned competitive results.
create function public.unique_equipment(items text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select cardinality(items) = count(distinct item) from unnest(items) item;
$$;
revoke all on function public.unique_equipment(text[]) from public;
grant execute on function public.unique_equipment(text[]) to authenticated, service_role;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  callsign text not null check (char_length(callsign) between 2 and 18 and callsign = btrim(callsign) and callsign !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);
create table public.loadouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_weapon text not null default 'pistol',
  weapons text[] not null default array['pistol','blade','rifle','shotgun'],
  abilities text[] not null default array['dash','shield','scanner','emp'],
  check (cardinality(weapons) between 1 and 4 and weapons <@ array['pistol','blade','rifle','shotgun'] and starting_weapon = any(weapons)),
  check (cardinality(abilities) between 0 and 4 and abilities <@ array['dash','shield','scanner','emp']),
  check (public.unique_equipment(weapons) and public.unique_equipment(abilities))
);
create table public.profile_stats (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  kills integer not null default 0 check (kills >= 0),
  deaths integer not null default 0 check (deaths >= 0),
  ranked_games integer not null default 0 check (ranked_games >= 0),
  rating integer not null default 1000 check (rating >= 0)
);
create table public.duel_matches (
  id uuid primary key,
  player_one uuid references public.profiles(user_id) on delete set null,
  player_two uuid references public.profiles(user_id) on delete set null,
  name_one text not null, name_two text not null,
  score_one integer not null check (score_one between 0 and 2),
  score_two integer not null check (score_two between 0 and 2),
  kills_one integer not null check (kills_one >= 0), kills_two integer not null check (kills_two >= 0),
  deaths_one integer not null check (deaths_one >= 0), deaths_two integer not null check (deaths_two >= 0),
  winner_slot smallint not null check (winner_slot in (0,1)),
  map_id text not null check (map_id in ('facility','neon','orbital')),
  reason text not null check (reason in ('elimination','time','forfeit')),
  started_at timestamptz not null, ended_at timestamptz not null,
  ranked boolean not null default false,
  rating_delta_one integer not null default 0, rating_delta_two integer not null default 0,
  rounds jsonb not null default '[]'::jsonb,
  check (ended_at >= started_at),
  check (player_one is null or player_two is null or player_one <> player_two)
);
create index duel_matches_one_history on public.duel_matches(player_one, ended_at desc);
create index duel_matches_two_history on public.duel_matches(player_two, ended_at desc);
create index duel_matches_rated_pair on public.duel_matches(player_one, player_two, ended_at desc) where ranked;
create index profile_stats_leaderboard on public.profile_stats(rating desc, wins desc, user_id) where ranked_games > 0;

alter table public.profiles enable row level security;
alter table public.loadouts enable row level security;
alter table public.profile_stats enable row level security;
alter table public.duel_matches enable row level security;
revoke all on public.profiles, public.loadouts, public.profile_stats, public.duel_matches from anon, authenticated;
grant select on public.profiles, public.profile_stats to anon, authenticated;
grant insert (user_id,callsign), update (callsign) on public.profiles to authenticated;
grant select, insert, update on public.loadouts to authenticated;
grant select on public.duel_matches to authenticated;
grant all on public.profiles, public.loadouts, public.profile_stats, public.duel_matches to service_role;
create policy profiles_read on public.profiles for select to anon, authenticated using (true);
create policy profiles_create on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_edit on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy loadouts_read on public.loadouts for select to authenticated using (user_id = (select auth.uid()));
create policy loadouts_create on public.loadouts for insert to authenticated with check (user_id = (select auth.uid()));
create policy loadouts_edit on public.loadouts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy stats_read on public.profile_stats for select to anon, authenticated using (true);
create policy history_read on public.duel_matches for select to authenticated using ((select auth.uid()) = player_one or (select auth.uid()) = player_two);

-- Only the trusted game server can execute this invoker function. The transaction
-- locks both stats rows in UUID order and records each match at most once.
create function public.record_duel_result(p_result jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  match_id uuid := (p_result->>'id')::uuid;
  one uuid := (p_result->>'player_one')::uuid;
  two uuid := (p_result->>'player_two')::uuid;
  winner integer := (p_result->>'winner_slot')::integer;
  ended timestamptz := (p_result->>'ended_at')::timestamptz;
  started timestamptz := (p_result->>'started_at')::timestamptz;
  rated boolean := false;
  one_rating integer; two_rating integer; delta integer := 0;
  uid uuid;
begin
  if exists (select 1 from public.duel_matches where id = match_id) then
    return (select jsonb_build_object('saved',true,'ranked',ranked,'duplicate',true) from public.duel_matches where id=match_id);
  end if;
  if one is not null and one = two then raise exception 'Distinct accounts are required'; end if;
  for uid in select id from unnest(array[one,two]) id where id is not null order by id loop
    insert into public.profile_stats(user_id) values(uid) on conflict do nothing;
    perform 1 from public.profile_stats where user_id=uid for update;
  end loop;
  -- Recheck after locks, in case a retry arrived while the first transaction ran.
  if exists (select 1 from public.duel_matches where id = match_id) then
    return (select jsonb_build_object('saved',true,'ranked',ranked,'duplicate',true) from public.duel_matches where id=match_id);
  end if;
  if coalesce((p_result->>'ranked')::boolean,false) and one is not null and two is not null
    and ended-started >= interval '30 seconds'
    and (p_result->>'score_one')::integer + (p_result->>'score_two')::integer > 0 then
    rated := (select count(*) < 3 from public.duel_matches where ranked
      and ((player_one=one and player_two=two) or (player_one=two and player_two=one))
      and ended_at > ended - interval '24 hours' and ended_at <= ended);
  end if;
  if rated then
    select rating into one_rating from public.profile_stats where user_id=one;
    select rating into two_rating from public.profile_stats where user_id=two;
    delta := round(32 * ((case when winner=0 then 1 else 0 end) - 1.0/(1+power(10.0,(two_rating-one_rating)/400.0))))::integer;
    delta := greatest(-one_rating,least(two_rating,delta));
  end if;
  insert into public.duel_matches(id,player_one,player_two,name_one,name_two,score_one,score_two,kills_one,kills_two,deaths_one,deaths_two,winner_slot,map_id,reason,started_at,ended_at,ranked,rating_delta_one,rating_delta_two,rounds)
  values(match_id,one,two,p_result->>'name_one',p_result->>'name_two',(p_result->>'score_one')::integer,(p_result->>'score_two')::integer,
    (p_result->>'kills_one')::integer,(p_result->>'kills_two')::integer,(p_result->>'deaths_one')::integer,(p_result->>'deaths_two')::integer,
    winner,p_result->>'map_id',p_result->>'reason',started,ended,rated,delta,-delta,coalesce(p_result->'rounds','[]'::jsonb));
  update public.profile_stats set games=games+1,wins=wins+(winner=0)::integer,losses=losses+(winner=1)::integer,
    kills=kills+(p_result->>'kills_one')::integer,deaths=deaths+(p_result->>'deaths_one')::integer,
    ranked_games=ranked_games+rated::integer,rating=rating+delta where user_id=one;
  update public.profile_stats set games=games+1,wins=wins+(winner=1)::integer,losses=losses+(winner=0)::integer,
    kills=kills+(p_result->>'kills_two')::integer,deaths=deaths+(p_result->>'deaths_two')::integer,
    ranked_games=ranked_games+rated::integer,rating=rating-delta where user_id=two;
  return jsonb_build_object('saved',true,'ranked',rated,'duplicate',false);
end;
$$;
revoke all on function public.record_duel_result(jsonb) from public, anon, authenticated;
grant execute on function public.record_duel_result(jsonb) to service_role;
