/**
 * Legacy entry point — the real UI loads as:
 *   app-core.js → app-views-a1.js → app-views-a2.js → app-views-a3.js → app-views-b.js → app-boot.js
 * See public/app.html script tags (+ polish.css).
 * This file is intentionally minimal so GitHub always has a valid entry.
 * Do not re-expand this into a monolithic app.js; keep the modular split.
 */
console.info("[Football Career Sim] Prefer split scripts in app.html (core / views-a1-a3 / views-b / boot).");
