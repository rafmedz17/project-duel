-- Expand the existing owner-private loadout; preserve all current selections.
alter table public.loadouts
  add column secondary_weapon text not null default 'pistol',
  add column melee_weapon text not null default 'blade';
alter table public.loadouts
  drop constraint loadouts_primary_valid,
  drop constraint loadouts_weapon_slots,
  add constraint loadouts_primary_valid check (primary_weapon in ('rifle','astral','hyperion','railbreaker','nova','striker','titan','omega','shotgun','executor','ravager')),
  add constraint loadouts_secondary_valid check (secondary_weapon in ('pistol','magnus','volt')),
  add constraint loadouts_melee_valid check (melee_weapon in ('blade','gravity','fangs')),
  add constraint loadouts_weapon_slots check (weapons=array[secondary_weapon,melee_weapon,primary_weapon] and starting_weapon=any(weapons));
-- Existing RLS policies, grants, and character/ability checks remain in force.
