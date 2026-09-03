# Football Career Sim

Hybrid **Football Manager + EA FC** career simulator.

## Play on phone (Railway)

1. Deploy this repo on [Railway](https://railway.app) (Dockerfile builder).
2. Open the public HTTPS URL in your phone browser.
3. Start career → use **Hub** (objectives, inbox, squad, roles, medical, contract).

```bash
npm install
npm start
# http://localhost:3847
```

## Stack
- TypeScript + `tsx` HTTP server (`src/ui/server.ts`)
- Hybrid API layer (`src/ui/hybrid.ts`)
- Deterministic match + continuous pitch modules
- PlayStyles / skill points, season objectives, inbox, negotiation

See `RUN.md` for API smoke tests.
