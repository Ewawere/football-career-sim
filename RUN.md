# Football Career Sim — Runbook

How to open the **Career Hub**, train, and spend **1 SP** on a near PlayStyle unlock.

## Requirements

- Node.js **18+** (20+ recommended)
- npm 9+

## 1. Install

```bash
cd football-career-sim
npm install
```

If `tsx` fails with `EACCES` on esbuild:

```bash
chmod +x node_modules/@esbuild/*/bin/esbuild
# or
chmod +x node_modules/tsx/node_modules/@esbuild/*/bin/esbuild
```

## 2. Start the web UI

```bash
npm run play:web
```

You should see something like:

```
Football Career Sim UI
  http://localhost:3847
```

Open **http://localhost:3847** in a browser (phone width or DevTools mobile view is ideal).

Optional port:

```bash
PORT=4000 npm run play:web
```

## 3. Start a career

1. On the start screen, create a player (e.g. **RW**, age 17, preferred foot).
2. Confirm placement → you land on the **Career Hub**.

## 4. Hub → train → spend SP

### Hub
- **Hero card**: face slot, OVR, club, form / trust.
- **PlayStyles** panel: unlocked chips, **SP** counter, **Near unlocks**.
- Storylines / season snapshot on the side (desktop) or below (mobile).

### Train
1. Tap **Train** (or Training session on the Training view).
2. Attributes nudge → development may grant **skill points** and unlock styles.
3. Toast: training completed.

### Spend 1 SP on a near PlayStyle
1. On Hub, under **Near unlocks**, find a row (e.g. *Finesse Shot — missing finishing 78+*).
2. Tap **1 SP** (disabled if SP is 0).
3. Toast shows attribute nudge or `Unlocked …!`.
4. Hub refreshes — chips / SP update.

API used under the hood:

```http
POST /api/train          { "focus": "Technical" }
POST /api/playstyle/spend { "playStyleId": "FinesseShot" }
GET  /api/hub
```

## 5. Play a matchday (optional)

- **Play Matchday** advances the league sim.
- Strong ratings (≥80, 30'+ mins) can grant more SP.
- **Match** tab: score, xG / possession bars, your rating.
- **Social** tab: club / rival / media posts.

## 6. CLI alternative (no browser)

```bash
npm run play
```

Text career loop if you prefer terminal-only.

## Troubleshooting

| Issue | Fix |
|--------|-----|
| `tsx: not found` | `npm install` then use `npx tsx src/ui/server.ts` |
| esbuild `EACCES` | `chmod +x` on the esbuild binary (see above) |
| Blank Hub | Career not started — use start form / `POST /api/start` |
| SP button disabled | Need points from training growth or good match ratings |
| Styles never unlock | Check position / height / physical profile gates in `src/players/playstyles.ts` |

## Simulation-first reminder

PlayStyles are **data on the player**. Match engine already applies equipped-style modifiers (shot weight, chance weight, rating, fatigue). The Hub is a window into that simulation — not a separate progression system.
