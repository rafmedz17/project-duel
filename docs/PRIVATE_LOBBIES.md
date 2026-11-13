# Private multiplayer lobbies

Milestone 3 includes private lobbies and a shared combat arena. Two browsers connect to Node.js/Colyseus, share an invite code, ready up, and enter the same facility after a host-started countdown. See the [online arena guide](ONLINE_ARENA.md) for controls, authority, and connection behavior. Online weapons, regional damage, abilities and Best of Three matches are server validated. The host can choose Free Play instead. Local robot training works without a server.

## Launch on your PC

Dependencies are already installed in this workspace. After cloning elsewhere, run `npm.cmd install` separately inside `client` and `server`. Use Node.js 22 or newer.

From `D:\Personal Projects\project-duel`, open two terminals:

```powershell
# Terminal 1: multiplayer lobby server, port 2567
npm.cmd run dev:server
```

```powershell
# Terminal 2: existing Vite frontend, normally port 5173
npm.cmd run dev:client
```

1. Open the Vite address and choose **Multiplayer / Private Lobbies**.
2. Enter a callsign of 2–18 characters and choose **Create Private Room**.
3. Copy the six-character invite code.
4. Open a second browser window, tab, or browser profile. Choose Multiplayer, enter another callsign and the code, then **Join Room**. Codes accept lowercase and are shown in uppercase.
5. The host selects **Best of Three** or **Free Play**. Changing format resets both ready flags. Select **Ready Up** in each browser. Both see **Both Players Ready**. The host can select **Start Shared Arena**; either can cancel readiness during its three-second countdown.
6. Select **Enter Arena** to capture the mouse and play together. Escape releases controls. In Best of Three, use **Forfeit Match** to concede, then **Return to Lobby** after results to ready up again. In Free Play, Return to Lobby ends practice for both.
7. Choose **Leave Room** to leave. Escape also closes the lobby while outside the arena. Local training is available from the main menu.

The shared arena supports all 17 weapons, server-validated regional damage, all four abilities and kills/deaths. Free Play has five-second respawns with preset selection; Best of Three resets eliminated players for the next round. Best of Three awards the match after two round wins, with a scoreboard, ten-second loadout phases, countdowns, fresh rounds and results. Higher HP wins after 90 seconds; ties replay. Free Play keeps unlimited respawns. Results are held in memory only.

## Two computers on the same network

The server listens only on `127.0.0.1` by default. To opt into LAN access, start it with:

```powershell
$env:HOST='0.0.0.0'
npm.cmd run dev:server
```

Start Vite from `client` with `npm.cmd run dev -- --host 0.0.0.0`. Both computers open `http://YOUR-PC-LAN-IP:5173`, using the same host and port shown by Vite. The browser defaults to that hostname on port 2567 for the lobby connection. Your operating system/network must allow those connections; the application does not change firewall settings. An invite code works only on the server that created it.

For a different server, copy `client/.env.example` to `client/.env.local`, set `VITE_MULTIPLAYER_URL`, and restart Vite. A hosted HTTPS frontend needs an HTTPS/WSS backend. No hosting service, account, database, or credentials are configured here.

## Room behavior

- The server creates unique, readable six-character codes using cryptographic randomness. Rooms are private in Colyseus matchmaking: they cannot be found by ordinary join/auto-match, but someone with the code can join. Codes are invitations, not authentication credentials.
- Each room has at most two occupied/reserved seats. Colyseus enforces reservations before WebSocket connection, so simultaneous joins cannot bypass capacity.
- Callsigns, membership, slots, host identity, and ready phase come from the server. A ready message identifies its sender through the connection; a supplied session ID cannot change another player's readiness. Messages with an invalid ready value are ignored.
- Two connected players must be present to ready up. Arrival, departure, or connection loss clears both ready flags. Cancelling readiness changes only the sender's flag.
- A temporary socket drop reserves the same player's seat for 15 seconds. The browser retries automatically, including after a page refresh using a per-tab session token. In the lobby, reconnection retains its callsign/session and requires another ready check. In the arena, movement, combat, abilities, reload and respawn timers freeze until reconnection. Recapture the mouse to resume from the preserved state. If recovery fails, Best of Three awards the other player a forfeit and keeps the results screen; Free Play ends. Explicit Leave clears recovery. Server restarts discard rooms.
- When the host leaves permanently, the remaining player becomes host. When everyone leaves, the room is disposed and its code stops working. Server restarts discard rooms.
- Leaving/cancelling the UI invalidates pending requests. If a delayed join completes afterward, the browser immediately leaves that room. Closing the panel never starts training or captures the mouse.
- The code registry, room state and active Rapier worlds are in one Node process. Multiple processes/hosts need shared presence and atomic code allocation before scaling. Match-result upload queues need persistent storage; active rooms remain in memory. See [deployment](DEPLOYMENT.md).

## Code and verification

`server/src/rooms/DuelLobbyRoom.js` owns the lifecycle and ready rules; `LobbyState.js` declares the synchronized schema. `createServer.js` configures Colyseus and `/health`. `client/src/multiplayer/` contains the connection lifecycle and menu UI; the browser SDK loads only when a connection is requested.

From the project root:

```powershell
npm.cmd run test:server
npm.cmd run lint:server
```

From `client`:

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd run test:browser
```

Server tests use real HTTP/WebSocket connections and cover capacity, private matchmaking, state synchronization, invalid data, per-sender readiness, host transfer, disposal, reserved seats, reconnect, and expiration. Browser tests use independent contexts for create/join/ready, third-player rejection, tab closure, host migration, error states, cancellation, keyboard focus, and returning to local training. Playwright starts both services if needed.

The implementation uses the current [Colyseus room API](https://docs.colyseus.io/room), [private room semantics](https://docs.colyseus.io/matchmaker/visibility), and [reconnection lifecycle](https://docs.colyseus.io/room/reconnection), checked against installed 0.18 packages. Server dependencies: `@colyseus/core`, `@colyseus/schema`, `@colyseus/ws-transport`; the server test client and browser use `@colyseus/sdk`.
