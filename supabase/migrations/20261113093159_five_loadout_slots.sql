-- Five owner-private, independently validated equipment presets. LIKE copies
-- equipment checks/defaults, but not indexes, foreign keys, grants or RLS.
create table public.loadout_slots (
  like public.loadouts including defaults including constraints,
  slot_id smallint not null check (slot_id between 0 and 4),
  primary key (user_id,slot_id),
  foreign key (user_id) references auth.users(id) on delete cascade
);
alter table public.loadout_slots enable row level security;
revoke all on public.loadout_slots from public, anon, authenticated;
grant select,insert,update on public.loadout_slots to authenticated;
grant all on public.loadout_slots to service_role;
create policy slots_read on public.loadout_slots for select to authenticated using (user_id=(select auth.uid()));
create policy slots_create on public.loadout_slots for insert to authenticated with check (user_id=(select auth.uid()));
create policy slots_edit on public.loadout_slots for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
insert into public.loadout_slots(user_id,slot_id,character_id,primary_weapon,secondary_weapon,melee_weapon,unique_skill,starting_weapon,weapons,abilities)
select l.user_id,s.slot_id,l.character_id,l.primary_weapon,l.secondary_weapon,l.melee_weapon,l.unique_skill,l.starting_weapon,l.weapons,l.abilities
from public.loadouts l cross join generate_series(0,4) as s(slot_id);
alter table public.loadouts add column active_slot smallint not null default 0 check (active_slot between 0 and 4);

-- Save all five slots and the existing active equipment atomically, with the
-- caller's RLS permissions. A malformed slot rolls back the entire bank.
create function public.save_loadout_bank(p_slots jsonb,p_active_slot integer) returns void
language plpgsql security invoker set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  gear jsonb;
  i integer;
begin
  if owner_id is null then raise exception 'Sign in before saving loadouts.'; end if;
  if jsonb_typeof(p_slots) is distinct from 'array' or jsonb_array_length(p_slots)<>5 or p_active_slot is null or p_active_slot not between 0 and 4 then
    raise exception 'Exactly five loadout slots and a valid active slot are required.';
  end if;
  for i in 0..4 loop
    gear := p_slots->i;
    if jsonb_typeof(gear) is distinct from 'object' or (gear-array['character','primary','secondary','melee','unique','startingWeapon','weapons','abilities'])<>'{}'::jsonb then
      raise exception 'Invalid loadout slot.';
    end if;
    insert into public.loadout_slots(user_id,slot_id,character_id,primary_weapon,secondary_weapon,melee_weapon,unique_skill,starting_weapon,weapons,abilities)
    values(owner_id,i,gear->>'character',gear->>'primary',gear->>'secondary',gear->>'melee',gear->>'unique',gear->>'startingWeapon',
      array(select jsonb_array_elements_text(gear->'weapons')),array(select jsonb_array_elements_text(gear->'abilities')))
    on conflict(user_id,slot_id) do update set character_id=excluded.character_id,primary_weapon=excluded.primary_weapon,secondary_weapon=excluded.secondary_weapon,melee_weapon=excluded.melee_weapon,unique_skill=excluded.unique_skill,starting_weapon=excluded.starting_weapon,weapons=excluded.weapons,abilities=excluded.abilities;
  end loop;
  insert into public.loadouts(user_id,active_slot,character_id,primary_weapon,secondary_weapon,melee_weapon,unique_skill,starting_weapon,weapons,abilities)
  select owner_id,p_active_slot,character_id,primary_weapon,secondary_weapon,melee_weapon,unique_skill,starting_weapon,weapons,abilities
  from public.loadout_slots where user_id=owner_id and slot_id=p_active_slot
  on conflict(user_id) do update set active_slot=excluded.active_slot,character_id=excluded.character_id,primary_weapon=excluded.primary_weapon,secondary_weapon=excluded.secondary_weapon,melee_weapon=excluded.melee_weapon,unique_skill=excluded.unique_skill,starting_weapon=excluded.starting_weapon,weapons=excluded.weapons,abilities=excluded.abilities;
end;
$$;
revoke all on function public.save_loadout_bank(jsonb,integer) from public,anon;
grant execute on function public.save_loadout_bank(jsonb,integer) to authenticated;
