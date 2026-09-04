const $ = (id) => document.getElementById(id);
let hub = null;
let view = "hub";
let lastMatch = null;

const CREST_PALETTES = [
  ["#b91c1c", "#7f1d1d"],
  ["#1d4ed8", "#1e3a8a"],
  ["#047857", "#064e3b"],
  ["#a16207", "#713f12"],
  ["#6d28d9", "#4c1d95"],
  ["#0e7490", "#155e75"],
  ["#be123c", "#9f1239"],
  ["#1e293b", "#0f172a"],
];

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
  if (view === "match") await loadMatchStats();
  else render();
  return hub;
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < String(s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function crestStyle(name) {
  const [a, b] = CREST_PALETTES[hashStr(name) % CREST_PALETTES.length];
  return `background:linear-gradient(145deg,${a},${b})`;
}

function initials(name) {
  const p = String(name || "P").trim().split(/\s+/);
  return ((p[0]?.[0] || "P") + (p[1]?.[0] || "")).toUpperCase();
}

function formDots(form) {
  const n = Math.max(0, Math.min(6, Math.round((Number(form) || 50) / 16.6)));
  let html = "";
  for (let i = 0; i < 6; i++) {
    html += `<i data-on="${i < n ? "1" : "0"}"></i>`;
  }
  const label = form >= 75 ? "Excellent" : form >= 60 ? "Good" : form >= 45 ? "Average" : "Poor";
  return `<div class="form-dots">${html}<span class="form-label">${label}</span></div>`;
}

function money(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v;
  if (v >= 1e6) return `€${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}K`;
  return `€${v}`;
}

function spValue(p) {
  const s = p?.skillPoints;
  if (s == null) return 0;
  if (typeof s === "number") return s;
  return s.available ?? s.points ?? s.unspent ?? 0;
}

function runEnterAnimations(root) {
  if (!root) return;
  // Trust / objective bars: width 0 -> target
  root.querySelectorAll("[data-w]").forEach((el, i) => {
    const w = el.getAttribute("data-w");
    el.style.width = "0%";
    requestAnimationFrame(() => {
      setTimeout(() => {
        el.style.width = w + "%";
      }, 40 + i * 40);
    });
  });
  // Form dots sequential
  root.querySelectorAll(".form-dots i[data-on='1']").forEach((dot, i) => {
    setTimeout(() => dot.classList.add("on"), 120 + i * 70);
  });
  // Score flash on match view
  const sc = root.querySelector(".score-card");
  if (sc && view === "match") {
    sc.classList.add("ft-flash");
    setTimeout(() => sc.classList.remove("ft-flash"), 1000);
  }
  // Count-up score numbers
  root.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.getAttribute("data-count"));
    if (Number.isNaN(target)) return;
    const isFloat = String(el.getAttribute("data-count")).includes(".");
    const start = performance.now();
    const dur = 650;
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = target * eased;
      el.textContent = isFloat ? val.toFixed(1) : String(Math.round(val));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

async function loadMatchStats() {
  try {
    const data = await api("/api/match/stats");
    if (data && (data.home || data.score)) {
      const home = data.home || {};
      const away = data.away || {};
      const hs = home.stats || {};
      const as_ = away.stats || {};
      const user =
        (data.ratings || []).find((r) => r.id && hub?.player?.id && r.id === hub.player.id) ||
        (data.ratings || []).find((r) => r.name === hub?.player?.name) ||
        null;
      lastMatch = {
        status: "Full Time",
        homeName: home.name || home.short || "Home",
        awayName: away.name || away.short || "Away",
        homeScore: data.score ? Number(String(data.score).split(/[–-]/)[0]) : 0,
        awayScore: data.score ? Number(String(data.score).split(/[–-]/)[1]) : 0,
        scoreRaw: data.score,
        possHome: hs.possession ?? 50,
        xgHome: hs.xG ?? 0,
        xgAway: as_.xG ?? 0,
        shotsHome: hs.shots ?? 0,
        shotsAway: as_.shots ?? 0,
        youRating: user?.rating,
        youLine: user
          ? `You: ${user.rating}${user.assists ? ` · ${user.assists} assist` : ""}${user.goals ? ` · ${user.goals} goal` : ""}`
          : undefined,
        minutes: user?.minutes || 90,
        keyPasses: user?.keyPasses ?? 0,
        shots: user?.shots ?? 0,
        assists: user?.assists ?? 0,
        goals: user?.goals ?? 0,
        venue: data.venue || "Stadium",
        mentality: data.mentality || "Home Attacking · Away Balanced",
      };
    }
  } catch (_) {
    /* keep lastMatch */
  }
  render();
}

function renderHub() {
  if (!hub) return `<div class="card">Loading hub…</div>`;
  const p = hub.player || {};
  const ps = p.playStyles || {};
  const unlocked = ps.unlocked || [];
  const near = ps.near || [];
  const sp = spValue(p);
  const trust = p.managerTrust ?? p.trust ?? 0;
  const threads = hub.threads || [];
  const clubName = p.club || "Free agent";

  const chips = unlocked.length
    ? unlocked
        .map((s) => `<span class="chip ${s.plus ? "plus" : ""}">${s.name || s.id}${s.plus ? "+" : ""}</span>`)
        .join("")
    : `<span class="muted">Train & play to unlock PlayStyles</span>`;

  const nearRows = near.length
    ? near
        .map((n) => {
          const miss = Array.isArray(n.missing) ? n.missing.join(", ") : n.missing || "requirements";
          return `<div class="unlock-row">
          <div class="unlock-ico">${n.emoji || "◎"}</div>
          <div style="flex:1">
            <div class="unlock-title">${n.name || n.id}</div>
            <div class="muted">missing ${miss}</div>
          </div>
          <button class="sp-btn" data-action="ps-spend" data-id="${n.id}">1 SP</button>
        </div>`;
        })
        .join("")
    : `<p class="muted">No near unlocks — keep training attributes.</p>`;

  const defaultStories = [
    { title: "Breakthrough Moment", body: "Building match rhythm.", icon: "⚡" },
    { title: "Young Lion Rising", body: "Scout attention rising.", icon: "🛡" },
    { title: "Fan Favorite", body: "Trust growing at the club.", icon: "🏟" },
  ];
  const stories = (threads.length ? threads : defaultStories)
    .slice(0, 3)
    .map(
      (t, i) => `<div class="story">
      <div class="story-thumb">${t.icon || ["⚡", "🛡", "🏟"][i] || "📰"}</div>
      <div>
        <div class="story-title">${t.title || t.name || "Storyline"}<span class="dot-live"></span></div>
        <div class="story-meta">${t.body || t.summary || t.description || ""}</div>
      </div>
    </div>`
    )
    .join("");

  return `
  <div class="anim-stagger">
  <div class="card">
    <div class="hero">
      <div class="face">${initials(p.name || p.displayName)}</div>
      <div>
        <div class="ovr-badge">◆ ${p.ovr ?? "—"} OVR</div>
        <div class="player-name">${p.name || p.displayName || "Player"}</div>
        <div class="club-row">
          <span class="crest" style="${crestStyle(clubName)}">${String(clubName).slice(0, 1)}</span>
          ${clubName}
        </div>
      </div>
      <div class="muted" style="text-align:right;font-size:11px;line-height:1.4">
        ${p.position || ""}<br>Age ${p.age ?? "—"}
      </div>
    </div>
    <div class="meta-row">
      <div>
        <div class="meta-label">Form</div>
        ${formDots(p.form)}
      </div>
      <div>
        <div class="meta-label">Trust</div>
        <div class="trust-bar"><span data-w="${Math.max(4, Math.min(100, trust))}"></span></div>
        <div class="trust-pct">${Math.round(trust)}%</div>
      </div>
      <div>
        <div class="meta-label">Foot</div>
        <div style="font-weight:700;font-size:13px">${p.preferredFoot || "Right"}</div>
      </div>
    </div>
  </div>

  <div class="stat-strip">
    <div class="stat-cell"><div class="ico">⚽</div><div class="lab">Apps</div><div class="val">${p.apps ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">🥅</div><div class="lab">Goals</div><div class="val">${p.goals ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">👟</div><div class="lab">Assists</div><div class="val">${p.assists ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">$</div><div class="lab">Value</div><div class="val" style="font-size:13px">${p.marketValueLabel || money(p.marketValue)}</div></div>
  </div>

  <div class="card" style="margin-top:11px">
    <div class="ps-head">
      <h3>PlayStyles</h3>
      <div class="sp-hex">SP<br>${sp}</div>
    </div>
    <div class="chips">${chips}</div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:4px">Near unlocks</h3>
    ${nearRows}
  </div>

  <div class="split">
    <div class="card">
      <h3 style="margin-bottom:8px">Season Snapshot</h3>
      <div class="table-row hdr"><span>Comp</span><span>Apps</span><span>G-A</span><span>Wage</span></div>
      <div class="table-row">
        <strong>League</strong>
        <span>${p.apps ?? 0}</span>
        <span>${(p.goals ?? 0) + (p.assists ?? 0)}</span>
        <span>${money(p.wage)}</span>
      </div>
      <button class="linkish" data-action="set-view" data-view="career" style="margin-top:8px">Full season stats →</button>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h3>Storylines <span class="dot-live"></span></h3>
        <button class="linkish" data-action="set-view" data-view="social">View all</button>
      </div>
      ${stories}
    </div>
  </div>

  <div class="card">
    <h3 style="margin-bottom:10px">Quick Actions</h3>
    <div class="qa-grid">
      <button class="qa" data-action="train" data-focus="Tactical"><div class="ico">📈</div><div class="lab">Training</div></button>
      <button class="qa" data-action="set-view" data-view="match"><div class="ico">▦</div><div class="lab">Match</div></button>
      <button class="qa" data-action="advance"><div class="ico">📅</div><div class="lab">Calendar</div></button>
      <button class="qa" data-action="neg-open"><div class="ico">💬</div><div class="lab">Contracts</div></button>
    </div>
  </div>
  </div>`;
}

function renderMatch() {
  const m = lastMatch || {};
  const home = m.homeName || "Home";
  const away = m.awayName || "Away";
  const hs = m.homeScore ?? 0;
  const as_ = m.awayScore ?? 0;
  const you = m.youRating ?? "—";
  const youLine = m.youLine || (you !== "—" ? `You: ${you}` : "Advance or play a match");
  const possH = Math.round(m.possHome ?? 50);
  const possA = 100 - possH;
  const xgH = Number(m.xgHome ?? 0);
  const xgA = Number(m.xgAway ?? 0);
  const shH = m.shotsHome ?? 0;
  const shA = m.shotsAway ?? 0;
  const xgSum = xgH + xgA || 1;
  const shSum = shH + shA || 1;

  return `
  <div class="anim-stagger">
  <div class="match-header">
    <h1>Match Center</h1>
    <div class="muted">${m.status || "Ready"}</div>
  </div>

  <div class="score-card">
    <div class="score-row">
      <div class="team-block">
        <div class="team-crest" style="${crestStyle(home)}">${String(home).slice(0, 3).toUpperCase()}</div>
        <strong style="font-size:13px">${String(home).slice(0, 3).toUpperCase()}</strong>
      </div>
      <div>
        <div class="ft-label">${(m.status || "FULL TIME").toUpperCase()}</div>
        <div class="score-num"><span data-count="${hs}">0</span> – <span data-count="${as_}">0</span></div>
        <div class="muted" style="font-size:12px">${m.venue || "Stadium"}</div>
      </div>
      <div class="team-block">
        <div class="team-crest" style="${crestStyle(away)}">${String(away).slice(0, 3).toUpperCase()}</div>
        <strong style="font-size:13px">${String(away).slice(0, 3).toUpperCase()}</strong>
      </div>
    </div>
    <div class="you-line">✓ ${youLine}</div>
  </div>

  <div class="card">
    <div class="section-label">📊 Match stats</div>
    <div class="bar-row">
      <div class="bar-name">Possession</div>
      <div class="bar-labels"><span>${possH}%</span><span>${possA}%</span></div>
      <div class="bar-track"><div class="h" data-w="${possH}"></div><div class="a" data-w="${possA}"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-name">xG</div>
      <div class="bar-labels"><span>${xgH.toFixed(2)}</span><span>${xgA.toFixed(2)}</span></div>
      <div class="bar-track"><div class="h" data-w="${(xgH / xgSum) * 100}"></div><div class="a" data-w="${(xgA / xgSum) * 100}"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-name">Shots</div>
      <div class="bar-labels"><span>${shH}</span><span>${shA}</span></div>
      <div class="bar-track"><div class="h" data-w="${(shH / shSum) * 100}"></div><div class="a" data-w="${(shA / shSum) * 100}"></div></div>
    </div>
  </div>

  <div class="card">
    <div class="rating-card">
      <div class="rating-hex">${(hub?.player?.position || "CM").slice(0, 3)}</div>
      <div>
        <div class="muted">${hub?.player?.position || "—"} · ${m.minutes || 90}'</div>
        <div class="rating-big">${typeof you === "number" ? `<span data-count="${you}">0</span>` : you}</div>
      </div>
      <div class="rating-stats">
        <div>Goals <strong>${m.goals ?? 0}</strong></div>
        <div>Assists <strong>${m.assists ?? 0}</strong></div>
        <div style="color:var(--teal)">★ Rating ${you}</div>
      </div>
    </div>
  </div>

  <div class="mentality">
    <div style="font-size:18px">🧠</div>
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
  </div>`;
}

function renderSocial() {
  const posts = hub?.social || [];
  const news = hub?.news || [];
  const items = posts.length
    ? posts
    : news.map((n) => ({
        author: n.outlet || "Press",
        text: n.headline + (n.body ? " — " + n.body.slice(0, 120) : ""),
      }));
  return `<div class="anim-stagger"><div class="card">
    <h3 style="margin-bottom:8px">Club Social</h3>
    ${items.length
      ? items
          .slice(0, 12)
          .map(
            (p) => `<div class="story">
      <div class="story-thumb">💬</div>
      <div>
        <div class="story-title">${p.author || p.club || "Club"}</div>
        <div class="story-meta">${p.text || p.body || p.headline || ""}</div>
      </div>
    </div>`
          )
          .join("")
      : `<p class="muted">Advance matchdays to fill the feed.</p>`}
  </div></div>`;
}

function renderCareer() {
  const obj = hub?.objectives;
  const med = hub?.medical;
  const neg = hub?.negotiation || {};
  const jobs = hub?.jobOffers || [];
  const p = hub?.player || {};
  return `
  <div class="anim-stagger">
  <div class="card">
    <div class="hero" style="grid-template-columns:56px 1fr">
      <div class="face" style="width:52px;height:52px;font-size:16px">${initials(p.name)}</div>
      <div>
        <div class="player-name" style="font-size:18px">${p.name || "Player"}</div>
        <div class="muted">${p.ovr ?? "—"} OVR · ${p.position || ""} · ${p.club || ""}</div>
      </div>
    </div>
  </div>
  <div class="card">
    <h3 style="margin-bottom:6px">Season objectives</h3>
    ${
      obj?.objectives?.length
        ? obj.objectives
            .map(
              (o) => `<div class="unlock-row">
          <div style="flex:1"><div class="unlock-title">${o.label}</div>
          <div class="muted">${o.current}/${o.target} ${o.unit || ""} · +${o.rewardSp || 0} SP</div>
          <div class="trust-bar" style="margin-top:6px"><span data-w="${o.pct || 0}"></span></div></div>
          <button class="sp-btn" data-action="claim-obj" data-id="${o.id}" ${!o.completed || o.claimed ? "disabled" : ""}>
            ${o.claimed ? "✓" : o.completed ? "Claim" : (o.pct || 0) + "%"}
          </button></div>`
            )
            .join("")
        : `<p class="muted">Objectives appear as the season runs.</p>`
    }
  </div>
  <div class="card">
    <h3>Medical Centre</h3>
    <p class="muted">${med?.statusLabel || "Available"} · Fitness ${med?.fitness ?? p.fitness ?? "—"}</p>
  </div>
  <div class="card">
    <h3>Contracts</h3>
    <p class="muted">${neg.currentWageWeekly || money(p.wage)} · ends ${neg.endDate || "—"}</p>
    <div class="actions">
      <button class="btn" data-action="neg-open">Open talks</button>
      <button class="ghost" data-action="neg-respond" data-neg="mediate">Mediate</button>
      <button class="ghost" data-action="neg-respond" data-neg="accept">Accept</button>
    </div>
    ${neg.lastMessage ? `<p class="muted" style="margin-top:8px">${neg.lastMessage}</p>` : ""}
  </div>
  <div class="card">
    <h3>Job Centre</h3>
    <p class="muted">${jobs.length} open managerial offers</p>
    <button class="ghost" data-action="jobs-refresh">Scan market</button>
    ${jobs
      .map(
        (j) => `<div class="unlock-row">
        <div style="flex:1"><div class="unlock-title">${j.clubName}</div>
        <div class="muted">${j.leagueLabel || ""} · ${j.wageLabel || ""}</div></div>
        <button class="sp-btn" data-action="job-accept" data-id="${j.id}">Take</button>
      </div>`
      )
      .join("")}
  </div>
  </div>`;
}

function renderMore() {
  return `
  <div class="anim-stagger">
  <div class="card">
    <h3>More</h3>
    <div class="actions">
      <button class="btn" data-action="advance">Advance matchday</button>
      <button class="ghost" data-action="train" data-focus="Tactical">Train</button>
      <button class="ghost" data-action="train" data-focus="Physical">Gym</button>
      <button class="ghost" data-action="save">Save</button>
    </div>
    <p class="muted" style="margin-top:12px">${hub?.date || ""} · Season ${hub?.season || ""}</p>
  </div>
  <div class="card">
    <h3>Inbox ${hub?.inbox?.unread ? `(${hub.inbox.unread})` : ""}</h3>
    ${(hub?.inbox?.messages || [])
      .slice(0, 6)
      .map(
        (m) => `<div class="story">
      <div class="story-thumb">✉</div>
      <div><div class="story-title">${m.from}</div><div class="story-meta">${m.subject}<br>${m.body || ""}</div></div>
    </div>`
      )
      .join("") || `<p class="muted">No messages</p>`}
  </div>
  </div>`;
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
  requestAnimationFrame(() => runEnterAnimations(content));
}

window.api = api;
window.refresh = refresh;
window.setView = setView;
window.toast = toast;
window.$ = $;
window.setLastMatch = (m) => {
  lastMatch = m;
};
window.loadMatchStats = loadMatchStats;
