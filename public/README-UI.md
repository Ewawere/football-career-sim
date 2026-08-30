# Web UI layout

Load order (see `app.html`):

1. `polish.css` — Career Hub / match / social styles
2. `app-core.js` — state, API, helpers, router
3. `app-views-a.js` — overview, league, match stats, social, transfers, development
4. `app-views-b.js` — press, news, inbox, squad, market
5. `app-boot.js` — actions, create career, header buttons

`app.js` is a legacy stub only.

Simulation facade: `src/ui/api.ts` (hub includes narrative `threads`).
