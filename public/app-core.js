/** Core UI state + render helpers */

let hub = null;
let view = "hub";
let lastMatch = null;
window.lastComparison = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 180) || res.statusText);
  }
  if (!res.ok || data.error) {
    throw new Error(data.error || data.message || text.slice(0, 180) || res.statusText);
  }
  return data;
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = String(msg).slice(0, 200);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function setView(v) {
  view = v || "hub";
  document.querySelectorAll("#bottomNav button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-view") === view);
  });
  render();
}

function money(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1e6) return `€${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `€${Math.round(n / 1e3)}K`;
  return `€${n}`;
}

function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function formDots(form) {
  const f = Math.max(0, Math.min(100, Number(form) || 50));
  const filled = Math.round(f / 20);
  return `<span class="form-dots">${"●".repeat(filled)}${"○".repeat(5 - filled)}</span>`;
}

function clubCrest(name, size, cls) {
  if (typeof Crests !== "undefined" && Crests.crestImgHtml) {
    return Crests.crestImgHtml(name || "FC", size || 24, cls || "crest-img");
  }
  return "";
}

async function refresh() {
  try {
    hub = await api("/api/hub");
    render();
  } catch (e) {
    console.error(e);
    toast(String(e.message || e).slice(0, 120));
  }
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
        possHome: hs.possession ?? 50,
        xgHome: hs.xG ?? 0,
        xgAway: as_.xG ?? 0,
        shotsHome: hs.shots ?? 0,
        shotsAway: as_.shots ?? 0,
        youRating: user?.rating,
        youLine: user
          ? `You: ${user.rating}${user.goals ? ` · ${user.goals}G` : ""}${user.assists ? ` · ${user.assists}A` : ""}`
          : "Full time",
        venue: data.venue || "Stadium",
      };
      if (view === "match") render();
    }
  } catch (_) {}
}

function buildStorylines(p) {
  const apps = p.apps ?? 0;
  const goals = p.goals ?? 0;
  const trust = Math.round(p.trust ?? p.managerTrust ?? 50);
  const form = Math.round(p.form ?? 50);
  const items = [];

  if (apps === 0) {
    items.push({
      title: "Waiting for a chance",
      body: "No league appearances yet. Train, then play your next fixture.",
      icon: "⏳",
    });
  } else if (apps < 5) {
    items.push({
      title: "Breaking into the side",
      body: `${apps} app${apps === 1 ? "" : "s"} so far. Keep ratings high to lock a start.`,
      icon: "⚡",
    });
  } else {
    items.push({
      title: "Established minutes",
      body: `${apps} appearances · ${goals} goals · ${p.assists ?? 0} assists this career.`,
      icon: "📊",
    });
  }

  if (goals >= 1) {
    items.push({
      title: "On the scoresheet",
      body: `${goals} career goal${goals === 1 ? "" : "s"}. Strikers notice — so do scouts.`,
      icon: "⚽",
    });
  } else if (apps > 0) {
    items.push({
      title: "Still hunting a goal",
      body: "In the side but no goal yet. Take the next chance when it comes.",
      icon: "🎯",
    });
  }

  if (trust >= 70) {
    items.push({
      title: "Manager's trust",
      body: `Trust ${trust}%. You're in the plans — don't waste it.`,
      icon: "🛡️",
    });
  } else if (trust < 40) {
    items.push({
      title: "Under pressure",
      body: `Trust only ${trust}%. Need a strong rating soon.`,
      icon: "⚠️",
    });
  } else {
    items.push({
      title: "Building trust",
      body: `Manager trust ${trust}%. Solid performances move the needle.`,
      icon: "📈",
    });
  }

  if (form >= 75) {
    items.push({
      title: "In form",
      body: `Form ${form}. Good time to demand starts and push PlayStyles.`,
      icon: "🔥",
    });
  }

  return items.slice(0, 4);
}

function renderHub() {
  const p = hub?.player || {};
  const clubName = p.club || p.clubName || "Free agent";
  const trust = p.trust ?? p.managerTrust ?? 50;
  const sp = p.skillPoints ?? 0;
  const unlocked = (p.playStyles && p.playStyles.unlocked) || [];
  const chips = unlocked.length
    ? unlocked.map((x) => `<span class="chip">${x.name || x.id || x}</span>`).join("")
    : `<span class="muted">Train to unlock PlayStyles</span>`;
  const near = (p.playStyles && p.playStyles.near) || [];
  const nearHtml = near.length
    ? near
        .map(
          (x) =>
            `<div class="unlock-row"><div class="unlock-title">${x.name || x.id}</div><div class="muted">Close — keep training</div></div>`
        )
        .join("")
    : `<p class="muted" style="margin:0">No near unlocks — keep training attributes.</p>`;

  const stories = buildStorylines(p)
    .map(
      (t) => `<div class="story">
      <div class="story-thumb">${t.icon || "•"}</div>
      <div><div class="story-title">${t.title}<span class="dot-live"></span></div>
      <div class="story-meta">${t.body}</div></div></div>`
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
        <div class="club-row">${clubCrest(clubName, 22, "crest-img sm")} ${clubName}</div>
      </div>
      <div class="muted" style="text-align:right;font-size:11px">${p.position || ""}<br>Age ${p.age ?? "—"}</div>
    </div>
    <div class="meta-row">
      <div><div class="meta-label">Form</div>${formDots(p.form)}</div>
      <div><div class="meta-label">Trust</div><div class="trust-bar"><span data-w="${Math.max(4, Math.min(100, trust))}"></span></div><div class="trust-pct">${Math.round(trust)}%</div></div>
      <div><div class="meta-label">Foot</div><div style="font-weight:700;font-size:13px">${p.preferredFoot || "Right"}</div></div>
    </div>
  </div>
  <div class="stat-strip">
    <div class="stat-cell"><div class="ico">⚽</div><div class="lab">Apps</div><div class="val">${p.apps ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">🥅</div><div class="lab">Goals</div><div class="val">${p.goals ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">👟</div><div class="lab">Assists</div><div class="val">${p.assists ?? 0}</div></div>
    <div class="stat-cell"><div class="ico">$</div><div class="lab">Value</div><div class="val" style="font-size:13px">${p.marketValueLabel || money(p.marketValue)}</div></div>
  </div>
  <div class="card" style="margin-top:11px"><div class="ps-head"><h3>PlayStyles</h3><div class="sp-hex">SP<br>${sp}</div></div><div class="chips">${chips}</div></div>
  <div class="card"><h3 style="margin-bottom:8px">Near unlocks</h3>${nearHtml}</div>
  <div class="card">
    <h3 style="margin-bottom:8px">Season Snapshot</h3>
    <div class="meta-row" style="grid-template-columns:repeat(4,1fr)">
      <div><div class="meta-label">COMP</div><div style="font-weight:700">League</div></div>
      <div><div class="meta-label">APPS</div><div style="font-weight:700">${p.apps ?? 0}</div></div>
      <div><div class="meta-label">G-A</div><div style="font-weight:700">${(p.goals ?? 0)}-${(p.assists ?? 0)}</div></div>
      <div><div class="meta-label">WAGE</div><div style="font-weight:700">${money(p.wage)}</div></div>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h3 style="margin:0">Storylines</h3>
    </div>
    ${stories || `<p class="muted">Play matches to generate real storylines.</p>`}
  </div>
  <div class="card">
    <h3 style="margin-bottom:8px">Quick Actions</h3>
    <div class="actions">
      <button class="qa" data-action="train" data-focus="Tactical"><div class="ico">📈</div><div class="lab">Training</div></button>
      <button class="qa" data-action="set-view" data-view="match"><div class="ico">▦</div><div class="lab">Match</div></button>
      <button class="qa" data-action="advance"><div class="ico">📅</div><div class="lab">Advance</div></button>
      <button class="qa" data-action="set-view" data-view="career"><div class="ico">💬</div><div class="lab">Career</div></button>
    </div>
  </div>
  </div>`;
}

function renderMatch() {
  const m = lastMatch || {
    status: "Ready",
    homeName: "Home",
    awayName: "Away",
    homeScore: 0,
    awayScore: 0,
    possHome: 50,
    xgHome: 0,
    xgAway: 0,
    shotsHome: 0,
    shotsAway: 0,
    youLine: "Play your next fixture",
    venue: "Stadium",
  };
  const possAway = 100 - (m.possHome ?? 50);
  const cmp = window.lastComparison || hub?.teamComparison;
  const cmpHtml = cmp
    ? `<div class="card"><h3>Pre-match</h3><p class="muted">${cmp.headline || cmp.summary || "Next fixture ready."}</p></div>`
    : "";

  return `
  <div class="anim-stagger">
  <div class="card scoreboard">
    <div class="teams">
      <div class="team">${clubCrest(m.homeName, 40, "crest-img")} <div class="tn">${m.homeName}</div></div>
      <div class="score-mid">
        <div class="score-line">${m.homeScore ?? 0} – ${m.awayScore ?? 0}</div>
        <div class="muted">${m.status || ""}</div>
        <div class="muted" style="font-size:11px">${m.venue || ""}</div>
      </div>
      <div class="team">${clubCrest(m.awayName, 40, "crest-img")} <div class="tn">${m.awayName}</div></div>
    </div>
    <div class="pill">${m.youLine || "Advance or play a match"}</div>
  </div>
  ${cmpHtml}
  <div class="card">
    <h3 style="margin-bottom:10px">📊 MATCH STATS</h3>
    <div class="stat-row"><span>POSSESSION</span><div class="bar"><i style="width:${m.possHome}%"></i></div><span>${m.possHome}% · ${possAway}%</span></div>
    <div class="stat-row"><span>xG</span><div class="bar"><i style="width:${Math.min(100, (m.xgHome || 0) * 25)}%"></i></div><span>${(m.xgHome || 0).toFixed?.(2) ?? m.xgHome} · ${(m.xgAway || 0).toFixed?.(2) ?? m.xgAway}</span></div>
    <div class="stat-row"><span>SHOTS</span><div class="bar"><i style="width:${Math.min(100, (m.shotsHome || 0) * 8)}%"></i></div><span>${m.shotsHome || 0} · ${m.shotsAway || 0}</span></div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${hub?.player?.position || "RW"}</strong> · your rating</div>
      <div>⭐ ${m.youRating != null ? m.youRating : "—"}</div>
    </div>
  </div>
  <div class="actions" style="margin-top:12px">
    <button class="btn" data-action="match-start">Play match</button>
    <button class="ghost" data-action="match-finish">Skip to FT</button>
    <button class="ghost" data-action="advance">Advance day</button>
  </div>
  </div>`;
}

function renderSocial() {
  const news = hub?.news || [];
  const social = hub?.social || [];
  const posts = [...news, ...social].slice(0, 20);
  if (!posts.length) {
    return `<div class="anim-stagger"><div class="card">
      <h3>Social & News</h3>
      <p class="muted">No posts yet. Play a match or advance a day — headlines and club posts will show up here.</p>
      <div class="actions" style="margin-top:12px">
        <button class="btn" data-action="match-start">Play match</button>
        <button class="ghost" data-action="advance">Advance day</button>
      </div>
    </div></div>`;
  }
  const items = posts
    .map((p) => {
      const title = p.headline || p.title || p.author || p.club || "Update";
      const body = p.body || p.text || p.summary || "";
      const likes = p.likes ?? p.reactions ?? "";
      return `<div class="story">
        <div class="story-thumb">📰</div>
        <div>
          <div class="story-title">${title}</div>
          <div class="story-meta">${body}${likes !== "" ? ` · ❤️ ${likes}` : ""}</div>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="anim-stagger"><div class="card"><h3 style="margin-bottom:8px">Social & News</h3>${items}</div></div>`;
}

function renderCareer() {
  const obj = hub?.objectives;
  const med = hub?.medical;
  const neg = hub?.negotiation || {};
  const jobs = hub?.jobOffers || [];
  const p = hub?.player || {};
  return `<div class="anim-stagger">
  <div class="card"><div class="hero" style="grid-template-columns:56px 1fr"><div class="face" style="width:52px;height:52px;font-size:16px">${initials(p.name)}</div><div><div class="player-name" style="font-size:18px">${p.name || "Player"}</div><div class="muted">${p.ovr ?? "—"} OVR · ${p.position || ""} · ${clubCrest(p.club || "FC", 18, "crest-img sm")} ${p.club || ""}</div></div></div></div>
  <div class="card"><h3 style="margin-bottom:6px">Season objectives</h3>${obj?.objectives?.length ? obj.objectives.map((o) => `<div class="unlock-row"><div style="flex:1"><div class="unlock-title">${o.label}</div><div class="muted">${o.current}/${o.target} ${o.unit || ""} · +${o.rewardSp || 0} SP</div><div class="trust-bar" style="margin-top:6px"><span data-w="${o.pct || 0}"></span></div></div><button class="sp-btn" data-action="claim-obj" data-id="${o.id}" ${!o.completed || o.claimed ? "disabled" : ""}>${o.claimed ? "✓" : o.completed ? "Claim" : (o.pct || 0) + "%"}</button></div>`).join("") : `<p class="muted">Objectives appear as the season runs.</p>`}</div>
  <div class="card"><h3>Medical Centre</h3><p class="muted">${med?.statusLabel || "Available"} · Fitness ${med?.fitness ?? p.fitness ?? "—"}</p></div>
  <div class="card"><h3>Contracts</h3><p class="muted">${neg.currentWageWeekly || money(p.wage)} · ends ${neg.endDate || "—"}</p><div class="actions"><button class="btn" data-action="neg-open">Open talks</button><button class="ghost" data-action="neg-respond" data-neg="mediate">Mediate</button><button class="ghost" data-action="neg-respond" data-neg="accept">Accept</button></div>${neg.lastMessage ? `<p class="muted" style="margin-top:8px">${neg.lastMessage}</p>` : ""}</div>
  <div class="card"><h3>Job Centre</h3><p class="muted">${jobs.length} open managerial offers</p><button class="ghost" data-action="jobs-refresh">Scan market</button>${jobs.map((j) => `<div class="unlock-row"><div style="flex:1;display:flex;gap:8px;align-items:center">${clubCrest(j.clubName, 28, "crest-img md")}<div><div class="unlock-title">${j.clubName}</div><div class="muted">${j.leagueLabel || ""} · ${j.wageLabel || ""}</div></div></div><button class="sp-btn" data-action="job-accept" data-id="${j.id}">Take</button></div>`).join("")}</div></div>`;
}

function renderMore() {
  return `<div class="anim-stagger"><div class="card"><h3>More</h3><div class="actions"><button class="btn" data-action="advance">Advance matchday</button><button class="ghost" data-action="train" data-focus="Tactical">Train</button><button class="ghost" data-action="train" data-focus="Physical">Gym</button><button class="ghost" data-action="save">Save</button></div><p class="muted" style="margin-top:12px">${hub?.date || ""} · Season ${hub?.season || ""}</p></div></div>`;
}

function render() {
  const content = document.getElementById("content");
  if (!content) return;
  if (view === "hub") content.innerHTML = renderHub();
  else if (view === "match") content.innerHTML = renderMatch();
  else if (view === "social") content.innerHTML = renderSocial();
  else if (view === "career") content.innerHTML = renderCareer();
  else if (view === "more") content.innerHTML = renderMore();
  else content.innerHTML = renderHub();

  // fill trust bars
  content.querySelectorAll(".trust-bar > span[data-w]").forEach((el) => {
    el.style.width = `${el.getAttribute("data-w")}%`;
  });
}

window.api = api;
window.toast = toast;
window.setView = setView;
window.refresh = refresh;
window.render = render;
window.loadMatchStats = loadMatchStats;
window.hub = () => hub;
