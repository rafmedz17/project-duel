-- Preserve saved equipment while moving from free-pick gear to fixed slots.
alter table public.loadouts
  add column character_id text not null default 'vex',
  add column primary_weapon text not null default 'rifle',
  add column unique_skill text not null default 'flashbang';

do $$
declare item record;
begin
  for item in select conname from pg_catalog.pg_constraint
    where conrelid='public.loadouts'::regclass and contype='c'
  loop
    execute format('alter table public.loadouts drop constraint %I',item.conname);
  end loop;
end $$;

update public.loadouts set
  primary_weapon = case when starting_weapon in ('rifle','shotgun') then starting_weapon
    when 'rifle'=any(weapons) then 'rifle' when 'shotgun'=any(weapons) then 'shotgun' else 'rifle' end,
  unique_skill = case when 'scanner'=any(abilities) then 'scanner' else 'flashbang' end;
update public.loadouts set
  weapons = array['pistol','blade',primary_weapon],
  abilities = array['dash','shield',unique_skill,'ultimate'];

alter table public.loadouts
  alter column weapons set default array['pistol','blade','rifle'],
  alter column abilities set default array['dash','shield','flashbang','ultimate'],
  add constraint loadouts_character_valid check (character_id in ('vex','aegis','ion','raze')),
  add constraint loadouts_primary_valid check (primary_weapon in ('rifle','shotgun')),
  add constraint loadouts_unique_valid check (unique_skill in ('flashbang','smoke','stun','scanner')),
  add constraint loadouts_weapon_slots check (weapons=array['pistol','blade',primary_weapon] and starting_weapon=any(weapons)),
  add constraint loadouts_ability_slots check (abilities=array['dash','shield',unique_skill,'ultimate']);

-- Existing owner-only RLS policies and table grants remain in force.
