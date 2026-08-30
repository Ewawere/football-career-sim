/**
 * Career Mode UI — FM density + EA FC presentation
 */
const $ = (id) => document.getElementById(id);

let hub = null;
let press = null;
let squad = null;
let market = null;
let matchStats = null;
let clubSocial = null;
let view = "overview";

async function api(path, opts) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function setView(v) {
  view = v;
  document.querySelectorAll("#sideNav button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-view") === v);
  });
  render();
}

function fmtVal(n) {
  if (n == null) return "—";
  if (typeof n === "string") return n;
  if (n >= 1e6) return "€" + (n / 1e6).toFixed(1) + "m";
  if (n >= 1e3) return "€" + Math.round(n / 1e3) + "k";
  return "€" + n;
}

function newsBadgeClass(n) {
  const imp = (n.importance || "").toLowerCase();
  const cat = (n.category || "").toLowerCase();
  if (imp === "breaking") return "breaking";
  if (cat.includes("transfer") || cat.includes("rumour")) return "transfer";
  if (cat.includes("award") || (n.headline || "").toLowerCase().includes("team of the")) return "award";
  if (cat.includes("injury")) return "injury";
  if (cat.includes("club") || cat.includes("manager")) return "club";
  if (cat.includes("player")) return "player";
  return "";
}

function formPills(formStr) {
  if (!formStr || formStr === "—") return "";
  return `<div class="form-pills">${[...String(formStr)].map((c) => `<span class="${c}">${c}</span>`).join("")}</div>`;
}

function ratingClass(r) {
  if (r >= 7.5) return "high";
  if (r >= 6.0) return "mid";
  return "low";
}

function ord(n) {
  if (!n) return "—";
  return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
}

async function refresh() {
  hub = await api("/api/hub");
  try { press = await api("/api/press"); } catch { press = { questions: [] }; }
  try { squad = await api("/api/squad"); } catch { squad = { players: [] }; }
  try { market = await api("/api/market?limit=200"); } catch { market = { players: [] }; }
  try { matchStats = await api("/api/match/stats"); } catch { matchStats = null; }
  try { clubSocial = await api("/api/club/social"); } catch { clubSocial = null; }
  render();
}

function render() {
  if (!hub) return;
  const p = hub.player;
  $("sideSeason").textContent = (hub.season || "—") + "  ·  " + (hub.date || "");
  $("sideName").textContent = p ? p.name : "—";
  $("sideMeta").textContent = p ? `${p.position} · ${p.club || "Free Agent"}` : "—";
  $("sideOvr").textContent = p ? `${p.ovr} OVR` : "— OVR";

  const titles = {
    overview: ["OVERVIEW", p?.name || "Career", p ? `${p.club} · ${p.position} · Age ${p.age}` : ""],
    league: ["COMPETITION", "League Table", `${hub.season || ""} · ${hub.date || ""}`],
    stats: ["MATCH CENTRE", "Match Statistics", "xG · shots · possession · ratings"],
    clubSocial: ["CLUB MEDIA", "Official Club Feed", "Fixtures · results · club posts"],
    transfers: ["TRANSFER CENTRE", "Transfer Network", "Window activity · targets"],
    development: ["DEVELOPMENT", "Training & Growth", p ? `${p.name} · ${p.position}` : ""],
    press: ["MEDIA", "Press Conference", "Answer questions after matches"],
    news: ["WORLD FEED", "News & Social", "Event-driven stories only"],
    inbox: ["INBOX", "Messages", "Manager · Agent · Media"],
    squad: ["SQUAD", "First-Team Squad", "Values · wages · roles"],
    market: ["MARKET", "Player Valuations", "Ranked by estimated market value"],
  };
  const t = titles[view] || titles.overview;
  $("pageEyebrow").textContent = t[0];
  $("pageTitle").textContent = t[1];
  $("pageSub").textContent = t[2];

  const el = $("content");
  if (view === "overview") el.innerHTML = renderOverview();
  else if (view === "league") el.innerHTML = renderLeague();
  else if (view === "stats") el.innerHTML = renderMatchStats();
  else if (view === "clubSocial") el.innerHTML = renderClubSocial();
  else if (view === "transfers") el.innerHTML = renderTransfers();
  else if (view === "development") el.innerHTML = renderDev();
  else if (view === "press") el.innerHTML = renderPress();
  else if (view === "news") el.innerHTML = renderNews();
  else if (view === "inbox") el.innerHTML = renderInbox();
  else if (view === "squad") el.innerHTML = renderSquad();
  else if (view === "market") el.innerHTML = renderMarket();
  bindActions();
}

function renderOverview() {
  const p = hub.player || {};
  const pos = hub.table?.find((r) => r.clubId === p.clubId);
  const clubForm = pos?.form || "";
  const news = (hub.news || []).slice(0, 6);
  const trust = Math.max(0, Math.min(100, p.managerTrust ?? 50));
  return `
  <div class="hub-grid">
    <div class="hero-card">
      <div class="hero-top">
        <div class="ovr-box">
          <div class="num">${p.ovr ?? "—"}</div>
          <div class="pos">${p.position || ""}</div>
        </div>
        <div class="hero-info">
          <h2>${p.name || "—"}</h2>
          <div class="club">${p.club || "Free agent"} · Age ${p.age ?? "—"}</div>
          <div class="foot-pill">${p.preferredFoot || "—"} foot · ${p.nationality || ""} · ${p.heightCm ? p.heightCm + "cm" : ""}</div>
        </div>
      </div>
      <div class="value-line">${p.marketValueLabel || fmtVal(p.marketValue) || "—"} market value</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${p.form ?? "—"}</div><div class="l">Form</div></div>
        <div class="hero-stat"><div class="v">${p.fitness ?? "—"}</div><div class="l">Fitness</div></div>
        <div class="hero-stat"><div class="v">${p.morale ?? "—"}</div><div class="l">Morale</div></div>
        <div class="hero-stat"><div class="v">${p.potential ?? "—"}</div><div class="l">Potential</div></div>
      </div>
      <div style="margin-top:14px;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Manager trust · ${trust}</div>
      <div class="trust-bar"><span style="width:${trust}%"></span></div>
      <div class="hero-stats" style="margin-top:14px">
        <div class="hero-stat"><div class="v">${p.apps ?? 0}</div><div class="l">Apps</div></div>
        <div class="hero-stat"><div class="v">${p.goals ?? 0}</div><div class="l">Goals</div></div>
        <div class="hero-stat"><div class="v">${p.assists ?? 0}</div><div class="l">Assists</div></div>
        <div class="hero-stat"><div class="v">${p.reputation ?? "—"}</div><div class="l">Rep</div></div>
      </div>
    </div>

    <div>
      <div class="next-match-card">
        <div class="nm-label">Club status</div>
        <div class="nm-teams">${p.club || "—"} · ${ord(pos?.pos)} place</div>
        <div class="nm-meta">${pos ? `${pos.pts} pts · ${pos.played} played · GD ${pos.gd > 0 ? "+" + pos.gd : pos.gd}` : "Play matchdays to fill the table"}</div>
        ${formPills(clubForm)}
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-act="advance">Play Matchday</button>
          <button class="btn secondary" data-act="train">Train</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Season snapshot</h3></div>
        <div class="grid-4">
          <div class="stat-tile"><div class="label">League</div><div class="value">${ord(pos?.pos)}</div><div class="hint">${pos?.pts ?? "—"} pts</div></div>
          <div class="stat-tile"><div class="label">Apps</div><div class="value">${p.apps ?? 0}</div><div class="hint">This season</div></div>
          <div class="stat-tile"><div class="label">G / A</div><div class="value">${p.goals ?? 0}/${p.assists ?? 0}</div><div class="hint">Goals · Assists</div></div>
          <div class="stat-tile"><div class="label">Wage</div><div class="value" style="font-size:16px">${p.wage ? "€" + Math.round(p.wage / 1000) + "k" : "—"}</div><div class="hint">Weekly</div></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Quick actions</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn secondary sm" data-act="endSeason">End Season</button>
          <button class="btn secondary sm" data-act="nextSeason">Next Season</button>
          <button class="btn secondary sm" data-act="save">Save</button>
          <button class="btn secondary sm" data-act="agent">Agent Advice</button>
        </div>
      </div>
    </div>

    <div class="hub-news news-stack">
      <div class="panel" style="margin-bottom:10px">
        <div class="panel-head" style="margin-bottom:8px;padding-bottom:8px"><h3>News & media</h3></div>
        ${news.map((n) => `
          <div class="feed-card" style="padding:12px 14px">
            <div class="badge ${newsBadgeClass(n)}">${n.importance || "News"}${n.category ? " · " + n.category : ""}</div>
            <div class="headline" style="font-size:13px">${n.headline || "—"}</div>
            <div class="meta">${n.date || ""}</div>
          </div>`).join("") || '<div class="muted" style="padding:8px 0">No stories yet — play matchdays. News only fires from real events.</div>'}
      </div>
    </div>
  </div>`;
}

function renderLeague() {
  const rows = (hub.table || []).map((r, i) => `
    <tr class="${hub.player && r.clubId === hub.player.clubId ? "me" : ""}">
      <td><b>${r.pos ?? i + 1}</b></td>
      <td>${r.club || r.name || r.clubName || "—"}</td>
      <td>${r.played ?? r.pl ?? 0}</td>
      <td>${r.won ?? r.w ?? 0}</td>
      <td>${r.drawn ?? r.d ?? 0}</td>
      <td>${r.lost ?? r.l ?? 0}</td>
      <td>${r.gf ?? 0}</td>
      <td>${r.ga ?? 0}</td>
      <td>${(r.gd ?? 0) > 0 ? "+" + r.gd : (r.gd ?? 0)}</td>
      <td><b>${r.pts ?? r.points ?? 0}</b></td>
    </tr>`).join("");
  return `
  <div class="panel" style="padding:0;overflow:hidden">
    <table class="data">
      <thead><tr>
        <th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="10" class="muted">No table data</td></tr>'}</tbody>
    </table>
  </div>`;
}
