-- Keep existing results valid while allowing the new arena. One atomic ALTER
-- preserves the whitelist without changing result permissions or RLS policies.
alter table public.duel_matches
  drop constraint duel_matches_map_id_check,
  add constraint duel_matches_map_id_check
    check (map_id in ('facility','neon','orbital','spire'));
