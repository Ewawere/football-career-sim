const $ = (id) => document.getElementById(id);
let hub = null;
let view = "hub";
let lastMatch = null;

async function api(path, opts) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

function toast(msg) {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

function setView(v) {
  view = v;
  document.querySelectorAll("#bottomNav button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-view") === v);
  });
  render();
}

async function refresh() {
  hub = await api("/api/hub");
  render();
  return hub;
}

function initials(name) {
  const p = String(name || "P").trim().split(/\s+/);
  return ((p[0]?.[0] || "P") + (p[1]?.[0] || "")).toUpperCase();
}

function formDots(form) {
  const n = Math.max(0, Math.min(6, Math.round((Number(form) || 50) / 16.6)));
  let html = "";
  for (let i = 0; i < 6; i++) html += `<i class="${i < n ? "on" : ""}"></i>`;
  const label = form >= 75 ? "Excellent" : form >= 60 ? "Good" : form >= 45 ? "Average" : "Poor";
  return `<div class="form-dots">${html}<span class="form-label">${label}</span></div>`;
}

function formLabel(form) {
  if (form >= 75) return "Excellent";
  if (form >= 60) return "Good";
  if (form >= 45) return "Average";
  return "Poor";
}

function money(v) {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (v >= 1e6) return `€${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}K`;
  return `€${v}`;
}

function renderHub() {
  if (!hub) return `<div class="card">Loading hub…</div>`;
  const p = hub.player || {};
  const ps = p.playStyles || {};
  const unlocked = ps.unlocked || [];
  const near = ps.near || [];
  const sp = p.skillPoints?.available ?? p.skillPoints?.points ?? p.skillPoints ?? 0;
  const trust = p.managerTrust ?? p.trust ?? 0;
  const threads = hub.threads || [];

  const chips = unlocked.length
    ? unlocked
        .map(
          (s) =>
            `<span class="chip ${s.plus ? "plus" : ""}">${s.name || s.id}${s.plus ? "+" : ""}</span>`
        )
        .join("")
    : `<span class="muted">Train to unlock PlayStyles</span>`;

  const nearRows = near.length
    ? near
        .map((n) => {
          const miss = (n.missing || []).join(", ") || "requirements";
          return `<div class="unlock-row">
          <div>
            <div class="unlock-title">${n.emoji || "◎"} ${n.name || n.id}</div>
            <div class="muted">missing ${miss}</div>
          </div>
          <button class="sp-btn" data-action="ps-spend" data-id="${n.id}">1 SP</button>
        </div>`;
        })
        .join("")
    : `<p class="muted">No near unlocks yet — keep training.</p>`;

  const stories = (threads.length ? threads : [
    { title: "Breakthrough Moment", body: "Scored in consecutive matches.", age: "recent" },
    { title: "Young Lion Rising", body: "Scout interest building.", age: "" },
  ])
    .slice(0, 3)
    .map(
      (t) => `<div class="story">
      <div class="story-thumb">📰</div>
      <div>
        <div class="story-title">${t.title || t.name || "Storyline"}<span class="dot-live"></span></div>
        <div class="story-meta">${t.body || t.summary || ""} ${t.age || ""}</div>
      </div>
    </div>`
    )
    .join("");

  return `
  <div class="card">
    <div class="hero">
      <div class="face">${initials(p.name || p.displayName)}</div>
      <div>
        <div class="ovr-badge">◆ ${p.ovr ?? "—"} OVR</div>
        <div class="player-name">${p.name || p.displayName || "Player"}</div>
        <div class="club-row"><span class="crest">${(p.club || "FC").slice(0, 1)}</span>${p.club || "Free agent"}</div>
      </div>
      <div class="muted" style="text-align:right;font-size:11px">${p.position || ""}<br>Age ${p.age ?? "—"}</div>
    </div>
    <div class="meta-row">
      <div>
        <div class="meta-label">Form</div>
        ${formDots(p.form)}
      </div>
      <div>
        <div class="meta-label">Trust</div>
        <div class="trust-bar"><span style="width:${Math.max(4, Math.min(100, trust))}%"></span></div>
        <div class="trust-pct">${Math.round(trust)}%</div>
      </div>
      <div>
        <div class="meta-label">Preferred Foot</div>
        <div style="font-weight:700;font-size:13px">${p.preferredFoot || "Right"}</div>
      </div>
    </div>
  </div>

  <div class="stat-strip">
    <div class="stat-cell"><div class="ico">⚽</div><div class="lab">Apps</div><div class="val">${p.apps ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">🥅</div><div class="lab">Goals</div><div class="val">${p.goals ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">👟</div><div class="lab">Assists</div><div class="val">${p.assists ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">$</div><div class="lab">Value</div><div class="val" style="font-size:14px">${p.marketValueLabel || money(p.marketValue)}</div></div>
  </div>

  <div class="card" style="margin-top:12px">
    <div class="ps-head">
      <h3>PlayStyles</h3>
      <div class="sp-hex">SP<br>${sp}</div>
    </div>
    <div class="chips">${chips}</div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:8px">Near unlocks</h3>
    ${nearRows}
  </div>

  <div class="split">
    <div class="card">
      <h3 style="margin-bottom:8px">Season Snapshot</h3>
      <div class="table-row hdr"><span>League</span><span>Apps</span><span>G-A</span><span>Wage</span></div>
      <div class="table-row">
        <strong>League</strong>
        <span>${p.apps ?? 0}</span>
        <span>${(p.goals ?? 0) + (p.assists ?? 0)}</span>
        <span>${money(p.wage)}</span>
      </div>
      <button class="linkish" data-action="view-career" style="margin-top:8px">View full season stats →</button>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h3>Storylines <span class="dot-live"></span></h3>
        <button class="linkish" data-action="view-news">View all</button>
      </div>
      ${stories}
    </div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:10px">Quick Actions</h3>
    <div class="qa-grid">
      <button class="qa" data-action="train" data-focus="Tactical"><div class="ico">📈</div><div class="lab">Training</div></button>
      <button class="qa" data-action="set-view" data-view="match"><div class="ico">▦</div><div class="lab">Tactics</div></button>
      <button class="qa" data-action="advance"><div class="ico">📅</div><div class="lab">Calendar</div></button>
      <button class="qa" data-action="neg-open"><div class="ico">💬</div><div class="lab">Contracts</div></button>
    </div>
  </div>
  `;
}

function renderMatch() {
  const m = lastMatch || {};
  const home = m.homeName || m.home || "Home";
  const away = m.awayName || m.away || "Away";
  const hs = m.homeScore ?? m.scoreHome ?? 0;
  const as_ = m.awayScore ?? m.scoreAway ?? 0;
  const you = m.youRating ?? m.rating ?? "—";
  const youLine = m.youLine || (you !== "—" ? `You: ${you}` : "Play a match to fill this");
  const possH = m.possHome ?? 55;
  const possA = 100 - possH;
  const xgH = m.xgHome ?? 1.4;
  const xgA = m.xgAway ?? 1.0;
  const shH = m.shotsHome ?? 12;
  const shA = m.shotsAway ?? 8;

  return `
  <div class="match-header">
    <h1>Match Center</h1>
    <div class="muted">${m.status || "Full Time"}</div>
  </div>

  <div class="score-card">
    <div class="score-row">
      <div class="team-block">
        <div class="team-crest home">${String(home).slice(0, 3).toUpperCase()}</div>
        <strong>${String(home).slice(0, 3).toUpperCase()}</strong>
      </div>
      <div>
        <div class="ft-label">FULL TIME</div>
        <div class="score-num">${hs} – ${as_}</div>
        <div class="muted" style="font-size:12px">${m.venue || "Stadium"}</div>
      </div>
      <div class="team-block">
        <div class="team-crest away">${String(away).slice(0, 3).toUpperCase()}</div>
        <strong>${String(away).slice(0, 3).toUpperCase()}</strong>
      </div>
    </div>
    <div class="you-line">✓ ${youLine}</div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:10px">📊 MATCH STATS</h3>
    <div class="bar-row">
      <div class="bar-name">Possession</div>
      <div class="bar-labels"><span>${possH}%</span><span>${possA}%</span></div>
      <div class="bar-track"><div class="h" style="width:${possH}%"></div><div class="a" style="width:${possA}%"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-name">xG</div>
      <div class="bar-labels"><span>${Number(xgH).toFixed(2)}</span><span>${Number(xgA).toFixed(2)}</span></div>
      <div class="bar-track"><div class="h" style="width:${(xgH / (xgH + xgA || 1)) * 100}%"></div><div class="a" style="width:${(xgA / (xgH + xgA || 1)) * 100}%"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-name">Shots</div>
      <div class="bar-labels"><span>${shH}</span><span>${shA}</span></div>
      <div class="bar-track"><div class="h" style="width:${(shH / (shH + shA || 1)) * 100}%"></div><div class="a" style="width:${(shA / (shH + shA || 1)) * 100}%"></div></div>
    </div>
  </div>

  <div class="card">
    <div class="rating-card">
      <div class="rating-hex">${(hub?.player?.position || "CM").slice(0, 3)}</div>
      <div>
        <div class="muted">${hub?.player?.position || "—"} · ${m.minutes || 90}'</div>
        <div class="rating-big">${you}</div>
      </div>
      <div class="rating-stats">
        <div>Key pass <strong>${m.keyPasses ?? 0}</strong></div>
        <div>Shot <strong>${m.shots ?? 0}</strong></div>
        <div style="color:var(--teal)">★ ${m.assists ?? 0} assist</div>
      </div>
    </div>
  </div>

  <div class="mentality">
    <div>🧠</div>
    <div style="flex:1">
      <div style="font-weight:700;font-size:13px">AI Mentality</div>
      <div class="muted">${m.mentality || "Home Attacking · Away Balanced"}</div>
    </div>
    <div class="muted">›</div>
  </div>

  <div class="actions" style="margin-top:14px">
    <button class="btn" data-action="match-start">Play match</button>
    <button class="ghost" data-action="match-finish">Skip to FT</button>
    <button class="ghost" data-action="advance">Advance day</button>
  </div>
  `;
}

function renderSocial() {
  const posts = hub?.social || [];
  if (!posts.length) {
    return `<div class="card"><h3>Club Social</h3><p class="muted">Advance matchdays to fill the feed.</p></div>`;
  }
  return `<div class="card"><h3>Club Social</h3>${posts
    .map(
      (p) => `<div class="story">
      <div class="story-thumb">💬</div>
      <div><div class="story-title">${p.author || p.club || "Club"}</div>
      <div class="story-meta">${p.text || p.body || ""}</div></div>
    </div>`
    )
    .join("")}</div>`;
}

function renderCareer() {
  const obj = hub?.objectives;
  const med = hub?.medical;
  const neg = hub?.negotiation || {};
  const jobs = hub?.jobOffers || [];
  return `
  <div class="card">
    <h3>Season objectives</h3>
    ${
      obj?.objectives?.length
        ? obj.objectives
            .map(
              (o) => `<div class="unlock-row">
          <div><div class="unlock-title">${o.label}</div>
          <div class="muted">${o.current}/${o.target} ${o.unit || ""} · +${o.rewardSp || 0} SP</div></div>
          <button class="sp-btn" data-action="claim-obj" data-id="${o.id}" ${!o.completed || o.claimed ? "disabled" : ""}>
            ${o.claimed ? "✓" : o.completed ? "Claim" : (o.pct || 0) + "%"}
          </button></div>`
            )
            .join("")
        : `<p class="muted">Objectives appear as the season runs.</p>`
    }
  </div>
  <div class="card">
    <h3>Medical</h3>
    <p class="muted">${med?.statusLabel || "Available"} · Fitness ${med?.fitness ?? hub?.player?.fitness ?? "—"}</p>
  </div>
  <div class="card">
    <h3>Contracts</h3>
    <p class="muted">${neg.currentWageWeekly || money(hub?.player?.wage)} · ends ${neg.endDate || "—"}</p>
    <div class="actions">
      <button class="btn" data-action="neg-open">Open talks</button>
      <button class="ghost" data-action="neg-respond" data-neg="mediate">Mediate</button>
    </div>
  </div>
  <div class="card">
    <h3>Job Centre</h3>
    <p class="muted">${jobs.length} open managerial offers</p>
    <button class="ghost" data-action="jobs-refresh">Scan market</button>
    ${jobs
      .map(
        (j) => `<div class="unlock-row">
        <div><div class="unlock-title">${j.clubName}</div>
        <div class="muted">${j.leagueLabel || ""} · ${j.wageLabel || ""}</div></div>
        <button class="sp-btn" data-action="job-accept" data-id="${j.id}">Take</button>
      </div>`
      )
      .join("")}
  </div>
  `;
}

function renderMore() {
  return `
  <div class="card">
    <h3>More</h3>
    <div class="actions">
      <button class="btn" data-action="advance">Advance matchday</button>
      <button class="ghost" data-action="train" data-focus="Tactical">Train</button>
      <button class="ghost" data-action="save">Save</button>
    </div>
    <p class="muted" style="margin-top:12px">${hub?.date || ""} · Season ${hub?.season || ""}</p>
  </div>
  <div class="card">
    <h3>Inbox</h3>
    ${(hub?.inbox?.messages || [])
      .slice(0, 5)
      .map(
        (m) => `<div class="story">
      <div class="story-thumb">✉</div>
      <div><div class="story-title">${m.from}</div><div class="story-meta">${m.subject}<br>${m.body || ""}</div></div>
    </div>`
      )
      .join("") || `<p class="muted">No messages</p>`}
  </div>
  `;
}

function render() {
  const content = $("content");
  if (!content) return;
  if (view === "hub") content.innerHTML = renderHub();
  else if (view === "match") content.innerHTML = renderMatch();
  else if (view === "social") content.innerHTML = renderSocial();
  else if (view === "career") content.innerHTML = renderCareer();
  else if (view === "more") content.innerHTML = renderMore();
  else content.innerHTML = renderHub();
}

window.api = api;
window.refresh = refresh;
window.setView = setView;
window.toast = toast;
window.$ = $;
window.setLastMatch = (m) => {
  lastMatch = m;
};
