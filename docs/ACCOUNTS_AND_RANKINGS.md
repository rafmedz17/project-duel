# Accounts, saved loadouts and rankings

The game supports guest play without cloud configuration. **Loadout** saves guest equipment on this device and applies it to training and the next multiplayer room. **Player Profile** provides email/password registration, sign-in, confirmation notices, password recovery, callsign editing, match history, win rate and statistics. Signed-in loadouts sync across devices. **Leaderboard** lists the top 50 players with at least one rated match, ordered by Elo, wins, then account ID.

## Connect Supabase

Use an existing Supabase project dedicated to this game. No hosted project is created automatically. The included migration has been tested in embedded PostgreSQL; a live Auth/email integration still needs project configuration.

1. Connect Supabase to this Codex session and identify the intended project, or use its Dashboard SQL Editor to apply [the migration](../supabase/migrations/20261112182313_accounts_loadouts_rankings.sql). Apply it once to a fresh game schema; existing tables with these names need review before deployment. This creates `profiles`, `loadouts`, `profile_stats`, `duel_matches` and a server-only result function. RLS and explicit grants are included.
2. Copy `client/.env.example` to `client/.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the project's URL and **publishable** API key.
3. Copy `server/.env.example` to `server/.env`. Set `SUPABASE_URL` to the same project and `SUPABASE_SECRET_KEY` to its backend **secret** API key. Keep the secret in the server file; do not send it in chat or put it in a `VITE_` variable. The Node server loads `.env` from its working directory; run it through the supplied npm scripts.
4. In Supabase Auth, enable email/password, email confirmation, and a minimum password length of eight. Set Site URL and allowed redirect URLs to the actual frontend origin, including `http://127.0.0.1:5173` / `http://localhost:5173` for development and the HTTPS origin when hosted. Registration and recovery return to that origin. Configure the project's email delivery for actual users.
5. Restart the frontend and backend. Register, confirm the email, sign in, save a callsign/loadout, then sign in from another browser to check restoration. Use two different accounts for a ranked room. Finish a match and verify its save notice, history and updated profile.

The CLI is pinned at version 3.1.0. For a CLI deployment, authenticate and select the intended project first, then inspect a dry run before pushing:

```powershell
npx.cmd --no-install supabase db push --remote=YOUR_PROJECT_REF --dry-run
npx.cmd --no-install supabase db push --remote=YOUR_PROJECT_REF --yes
```

These are **hosted** operations. The implementation does not run them without an identified project. A local Supabase stack additionally requires Docker, which is not installed in this workspace. Local config uses port 5173 for Auth redirects and requires confirmation; its email inbox is available through the local stack when running.

## Equipment and maps

Choose one to four weapons, zero to four abilities, and a starting weapon from the equipped list. Weapon number keys retain their usual slots; Q cycles only equipped weapons. Unequipped actions are blocked in training and on the server, and the HUD dims their slots. Each round restores the selected starting weapon. Selections lock on room join; leave the room to change them.

The host selects **Training Facility**, **Neon District**, or **Orbital Station**. Neon District has tall street kiosks and offset cover; Orbital Station has reactor cover and cargo lanes. The server and renderer consume the same static solids, including hitscan occlusion. Both spawn points remain clear. Map/format changes clear readiness, and map changes are blocked after launch. Training remains in the Facility.

## Results and ranking rules

- Best of Three results for signed-in participants update their account record, including casual matches against guests. Guest-only matches and Free Play/training do not save cloud statistics. Wins/losses/kills/deaths and win rate cover saved Best of Three matches; the Elo rating changes only for eligible ranked results.
- The host can enable Ranked only in Best of Three with two distinct verified accounts. Tokens are checked with Supabase Auth on room entry. The server loads the stored callsign and loadout; it never accepts client-provided account IDs, statistics or results. A reconnect retains the verified seat. Expired/invalid supplied tokens fail rather than falling back to a guest.
- Elo starts at **1000**, with **K=32**. Equal-rated players gain/lose 16 points for a win/loss. Rating never falls below zero. Ties in individual rounds replay and do not finish the match.
- A rated game needs at least **30 seconds** elapsed time and at least one scored round. At most **three ranked matches per pair per rolling 24 hours** change Elo. Other completed results still save to casual history/statistics. Unscored quick forfeits do not change rating.
- Forfeits use the actual scoreboard; there are no invented round wins. The result snapshot is taken before a departing player is removed.
- The server queues completed signed-in results as atomic JSON files in `server/data/results/` before uploading. An upload failure shows **queued**, retries each minute and on server restart, and uses the match UUID as an idempotency key. Keep this directory on persistent storage in deployment. An unsuccessful disk write shows a save failure. Do not delete queued results while they are pending.
- Database transactions lock both stats rows in account-ID order. Duplicate match IDs cannot double-count wins or Elo. Clients have no write/execute permission for stats, history or the result function. Each player's history is visible only to its participants. Public leaderboard/profile reads expose callsigns, account IDs and competitive statistics, not emails or loadouts.

This is private-room ranking, without public matchmaking, seasonal ranks or comprehensive anti-collusion controls. Short-game and repeat-pair limits reduce simple farming; a production competitive ladder needs further abuse controls and operational monitoring. Rating is not evidence of tournament integrity.

## Verification

`npm.cmd run test:server` runs 54 cases, including actual PostgreSQL grants/RLS/result transactions, token verification behavior, durable retries, new map physics, loadout enforcement and real WebSocket rooms. PostgreSQL tests bootstrap Auth roles and UID claims locally; they do not replace a live Supabase Auth test.

The browser suite includes account forms, confirmation/errors/recovery, restored sessions, cross-browser loadout restoration, history/leaderboard, guest equipment and both new maps. Account HTTP responses in those tests are fixtures on a separate Vite instance at port 5174, keeping real credentials out of tests. Normal gameplay tests use port 5173 with cloud accounts disabled. The hosted smoke check in step 5 is required after connecting a real project.

Implementation references: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [Auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [CLI v3](https://supabase.com/changelog/supabase-cli-v3).
