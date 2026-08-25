# Football Career Sim

Original deep football career simulator — simulation-first, mobile UI shell included.

## Requirements

- Node.js 20+

## Setup

```bash
git clone https://github.com/Ewawere/football-career-sim.git
cd football-career-sim
npm install
```

## Play in the browser (mobile-friendly)

```bash
npm run play:web
```

Open **http://localhost:3847**

On your phone (same Wi‑Fi): `http://YOUR-COMPUTER-IP:3847`

### UI actions

1. **Start Career** — creates a 17-year-old RW prospect  
2. **Train** — training session  
3. **Play Matchday** — advances the league one matchday  
4. **Finish Season** — plays remaining fixtures + end-of-season processing  
5. **Next Season + Transfers** — window + new season  

Tabs: **Hub** · **Table** · **Feed**

## CLI demos

```bash
npm run demo:season     # full league season
npm run demo:career     # player career sample
npm run demo:multi      # multi-season
```

## Architecture (high level)

```
Mobile UI (public/index.html)
        ↓
src/ui/server.ts  (HTTP API)
        ↓
World simulation (clubs, players, season, matches, transfers, news/social)
```

## Notes

- Clubs and players are **fictional** (original names).
- Some advanced systems (full playable 22-player pitch, deep news engine, loans AI) are simplified or still being synced from the main development branch.
- Save/load is available via `/api/save` and `/api/load`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run play:web` | Web UI + API |
| `npm run demo:season` | Season simulation |
| `npm run demo:career` | Career placement demo |
| `npm test` | Unit tests (as available) |
