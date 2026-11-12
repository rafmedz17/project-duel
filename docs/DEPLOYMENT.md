# Public deployment

The root Dockerfile packages the Vite client and Colyseus server into one persistent Node 24 service. It serves the compiled game, `/health`, matchmaking and WebSockets on the same port. Production clients use the page origin; an HTTPS host supplies secure WebSockets. Development retains Vite plus port 2567.

## Railway

Connect Railway, then create one service from the repository root using `Dockerfile`. Keep one replica, disable sleeping/serverless mode, enable restart on failure, and set `/health` as the health check with a 60-second startup timeout. Generate a public HTTPS domain targeting `PORT` (default 2567).

Attach a persistent volume at `/data`. Pending result uploads use `/data/results`, then are removed after successful delivery. Railway volumes are mounted as root, which this image supports. Live rooms and invite codes belong to one process, so additional replicas need a shared room/presence design first. See [Railway volumes](https://docs.railway.com/volumes).

| Service variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Public project URL, compiled into the browser |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public publishable key, compiled into the browser |
| `SUPABASE_URL` | Project URL for server runtime |
| `SUPABASE_SECRET_KEY` | Privileged key for server runtime only |
| `PUBLIC_ORIGIN` | Exact public origin, such as `https://your-game.up.railway.app` |

`PUBLIC_ORIGIN` falls back to `https://${RAILWAY_PUBLIC_DOMAIN}` when that variable exists. Optional `ALLOWED_ORIGINS` accepts comma-separated exact browser origins. Native clients without an Origin header remain supported. Origin checks supplement account verification, not authentication.

Only the two public Supabase variables are Docker build arguments. Never supply the backend secret as a build argument or use a `VITE_` name for it. `.dockerignore` excludes local environment files, credentials, Git data and queued results. Rebuild after changing public client variables.

Use the connected host's settings. Railway's old `railway.toml` format is deprecated; this new deployment uses the portable Dockerfile instead of a legacy service manifest. See the [current configuration reference](https://docs.railway.com/config-as-code/reference).

## Accounts and launch

After assigning the public domain, set Supabase Auth's Site URL and allowed redirect URL to the exact HTTPS origin. Preserve development redirects as needed. The game uses `location.origin` for confirmation/password-reset links. Keep confirmation enabled and configure custom SMTP for users outside the Supabase team. See [Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls) and [accounts](ACCOUNTS_AND_RANKINGS.md). These gameplay features need no database migration.

Verify `/health`, training, two-browser room creation/join, movement and firing, page-refresh recovery within 15 seconds, and a completed signed-in match saving to history. Verify confirmation/reset delivery through a real mailbox after SMTP setup.

Hosting/storage may incur charges; select a plan and budget before launch. Restarts/deployments discard active rooms, so deploy between matches. Persistent storage preserves queued results; Supabase preserves uploaded history.

## Local production build

From the repository root:

```powershell
npm.cmd --prefix client run build
node scripts/compress-client.mjs
```

In a separate terminal:

```powershell
Set-Location server
$env:NODE_ENV='production'
$env:CLIENT_DIRECTORY='../client/dist'
$env:PUBLIC_ORIGIN='http://127.0.0.1:2568'
$env:PORT='2568'
npm.cmd start
```

Open `http://127.0.0.1:2568` to check the compiled game and same-origin multiplayer without Vite. When Docker is available, build from the repository root with the two public build arguments, then run with server variables and a volume at `/data`.

With the local production server running, run `node scripts/production-smoke.mjs` from the root (optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`). It checks the actual compiled engine/training, two-player same-origin arena, refresh recovery, continued firing and Brotli delivery. The server deployment tests also exercise sequential keep-alive downloads after large assets to prevent response-stream stalls.
