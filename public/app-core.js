/** Core UI */
let hub = null, view = "hub", lastMatch = null;
window.lastComparison = null;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json", ...(opts.headers || {}) }, ...opts });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(text.slice(0, 180) || res.statusText); }
  if (!res.ok || data.error) throw new Error(data.error || data.message || text.slice(0, 180) || res.statusText);
  return data;
}
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = String(msg).slice(0, 200); el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}
function setView(v) {
  view = v || "hub";
  document.querySelectorAll("#bottomNav button").forEach((b) => b.classList.toggle("active", b.getAttribute("data-view") === view));
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
  const p = String(name).trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
function formDots(form) {
  const f = Math.max(0, Math.min(100, Number(form) || 50));
  const filled = Math.round(f / 20);
  return `<span class="form-dots">${"●".repeat(filled)}${"○".repeat(5 - filled)}</span>`;
}
function clubCrest(name, size, cls) {
  return typeof Crests !== "undefined" && Crests.crestImgHtml ? Crests.crestImgHtml(name || "FC", size || 24, cls || "crest-img") : "";
}
async function refresh() {
  try { hub = await api("/api/hub"); render(); } catch (e) { toast(String(e.message || e).slice(0, 120)); }
}
async function loadMatchStats() {
  try {
    const data = await api("/api/match/stats");
    if (!data || !(data.home || data.score)) return;
    const home = data.home || {}, away = data.away || {}, hs = home.stats || {}, as_ = away.stats || {};
    const user = (data.ratings || []).find((r) => r.id && hub?.player?.id && r.id === hub.player.id)
      || (data.ratings || []).find((r) => r.name === hub?.player?.name) || null;
    lastMatch = {
      status: "Full Time", homeName: home.name || "Home", awayName: away.name || "Away",
      homeScore: data.score ? Number(String(data.score).split(/[–-]/)[0]) : 0,
      awayScore: data.score ? Number(String(data.score).split(/[–-]/)[1]) : 0,
      possHome: hs.possession ?? 50, xgHome: hs.xG ?? 0, xgAway: as_.xG ?? 0,
      shotsHome: hs.shots ?? 0, shotsAway: as_.shots ?? 0, youRating: user?.rating,
      youLine: user ? `You: ${user.rating}${user.goals ? ` · ${user.goals}G` : ""}${user.assists ? ` · ${user.assists}A` : ""}` : "Full time",
      venue: data.venue || "Stadium",
    };
    if (view === "match") render();
  } catch (_) {}
}
function buildStorylines(p) {
  const apps = p.apps ?? 0, goals = p.goals ?? 0, trust = Math.round(p.trust ?? p.managerTrust ?? 50);
  const items = [];
  if (apps === 0) items.push({ title: "Waiting for a chance", body: "Train, then play your next fixture.", icon: "⏳" });
  else items.push({ title: "Season running", body: `${apps} apps · ${goals}G · ${p.assists ?? 0}A`, icon: "📊" });
  if (goals >= 1) items.push({ title: "On the scoresheet", body: `${goals} career goals. Scouts are watching.`, icon: "⚽" });
  items.push({ title: trust >= 70 ? "Manager's trust" : "Building trust", body: `Trust ${trust}%.`, icon: "🛡️" });
  return items.slice(0, 4);
}
function renderHub() {
  const p = hub?.player || {}, clubName = p.club || p.clubName || "Free agent", trust = p.trust ?? p.managerTrust ?? 50, sp = p.skillPoints ?? 0;
  const unlocked = (p.playStyles && p.playStyles.unlocked) || [];
  const chips = unlocked.length ? unlocked.map((x) => `<span class="chip">${x.name || x.id || x}</span>`).join("") : `<span class="muted">Train for PlayStyles</span>`;
  const stories = buildStorylines(p).map((t) => `<div class="story"><div class="story-thumb">${t.icon}</div><div><div class="story-title">${t.title}</div><div class="story-meta">${t.body}</div></div></div>`).join("");
  return `<div class="anim-stagger"><div class="card"><div class="hero"><div class="face">${initials(p.name || p.displayName)}</div><div><div class="ovr-badge">◆ ${p.ovr ?? "—"} OVR</div><div class="player-name">${p.name || p.displayName || "Player"}</div><div class="club-row">${clubCrest(clubName, 22, "crest-img sm")} ${clubName}</div></div><div class="muted" style="text-align:right;font-size:11px">${p.position || ""}<br>Age ${p.age ?? "—"}</div></div>
  <div class="meta-row"><div><div class="meta-label">Form</div>${formDots(p.form)}</div><div><div class="meta-label">Trust</div><div class="trust-bar"><span data-w="${Math.max(4, Math.min(100, trust))}"></span></div><div class="trust-pct">${Math.round(trust)}%</div></div><div><div class="meta-label">Foot</div><div style="font-weight:700">${p.preferredFoot || "Right"}</div></div></div></div>
  <div class="stat-strip"><div class="stat-cell"><div class="lab">Apps</div><div class="val">${p.apps ?? 0}</div></div><div class="stat-cell"><div class="lab">Goals</div><div class="val">${p.goals ?? 0}</div></div><div class="stat-cell"><div class="lab">Assists</div><div class="val">${p.assists ?? 0}</div></div><div class="stat-cell"><div class="lab">Value</div><div class="val" style="font-size:13px">${p.marketValueLabel || money(p.marketValue)}</div></div></div>
  <div class="card" style="margin-top:11px"><div class="ps-head"><h3>PlayStyles</h3><div class="sp-hex">SP<br>${sp}</div></div><div class="chips">${chips}</div></div>
  <div class="card"><h3>Storylines</h3>${stories}</div>
  <div class="card"><h3>Quick Actions</h3><div class="actions">
    <button class="qa" data-action="train" data-focus="Tactical"><div class="lab">Training</div></button>
    <button class="qa" data-action="set-view" data-view="match"><div class="lab">Match</div></button>
    <button class="qa" data-action="advance"><div class="lab">Advance</div></button>
    <button class="qa" data-action="set-view" data-view="career"><div class="lab">Career</div></button>
  </div></div></div>`;
}
function renderMatch() {
  const m = lastMatch || { status: "Ready", homeName: "Home", awayName: "Away", homeScore: 0, awayScore: 0, possHome: 50, xgHome: 0, xgAway: 0, shotsHome: 0, shotsAway: 0, youLine: "Play match — 3 decisions", venue: "Stadium" };
  const possAway = 100 - (m.possHome ?? 50);
  return `<div class="anim-stagger"><div class="card scoreboard"><div class="teams"><div class="team">${clubCrest(m.homeName, 40)} <div class="tn">${m.homeName}</div></div>
  <div class="score-mid"><div class="score-line">${m.homeScore ?? 0} – ${m.awayScore ?? 0}</div><div class="muted">${m.status || ""}</div><div class="muted" style="font-size:11px">${m.venue || ""}</div></div>
  <div class="team">${clubCrest(m.awayName, 40)} <div class="tn">${m.awayName}</div></div></div><div class="pill">${m.youLine || ""}</div></div>
  <div class="card"><h3>MATCH STATS</h3>
  <div class="stat-row"><span>POSSESSION</span><span>${m.possHome}% · ${possAway}%</span></div>
  <div class="stat-row"><span>xG</span><span>${Number(m.xgHome || 0).toFixed(2)} · ${Number(m.xgAway || 0).toFixed(2)}</span></div>
  <div class="stat-row"><span>SHOTS</span><span>${m.shotsHome || 0} · ${m.shotsAway || 0}</span></div></div>
  <div class="card"><div style="display:flex;justify-content:space-between"><div><strong>${hub?.player?.position || "RW"}</strong> · rating</div><div>⭐ ${m.youRating != null ? m.youRating : "—"}</div></div></div>
  <div class="actions" style="margin-top:12px"><button class="btn" data-action="match-start">Play match</button>
  <button class="ghost" data-action="match-finish">Skip to FT</button><button class="ghost" data-action="advance">Advance day</button></div></div>`;
}
function renderSocial() {
  const posts = [...(hub?.news || []), ...(hub?.social || [])].slice(0, 20);
  if (!posts.length) return `<div class="anim-stagger"><div class="card"><h3>Social & News</h3><p class="muted">Play a match or advance — headlines appear here.</p>
  <div class="actions"><button class="btn" data-action="match-start">Play match</button><button class="ghost" data-action="advance">Advance day</button></div></div></div>`;
  return `<div class="anim-stagger"><div class="card"><h3>Social & News</h3>${posts.map((p) => `<div class="story"><div class="story-thumb">📰</div><div><div class="story-title">${p.headline || p.title || "Update"}</div><div class="story-meta">${p.body || p.text || ""}</div></div></div>`).join("")}</div></div>`;
}
function renderCareer() {
  const neg = hub?.negotiation || {}, jobs = hub?.jobOffers || [], offers = hub?.transferOffers || [], p = hub?.player || {};
  return `<div class="anim-stagger"><div class="card"><div class="player-name">${p.name || "Player"}</div><div class="muted">${p.ovr ?? "—"} OVR · ${p.position || ""} · ${p.club || ""}</div></div>
  <div class="card"><h3>Contracts</h3>
  <p class="muted">Current ${neg.currentWageWeekly || money(p.wage)} · ends ${neg.endDate || "—"}</p>
  <p class="muted">Offer ${neg.offeredLabel || "—"} · Ask ${neg.demandedLabel || "—"} · Round ${neg.round || 0}/${neg.maxRounds || 3}</p>
  <div class="actions">
    <button class="btn" data-action="neg-open">Open talks</button>
    <button class="ghost" data-action="neg-respond" data-neg="mediate">Mediate</button>
    <button class="ghost" data-action="neg-respond" data-neg="counter">Counter</button>
    <button class="btn" data-action="neg-respond" data-neg="accept">Accept deal</button>
    <button class="ghost" data-action="neg-respond" data-neg="reject">Walk away</button>
  </div>
  <p class="muted" style="margin-top:8px">${neg.lastMessage || "Wages only change when you Accept deal."}</p></div>
  <div class="card"><h3>Transfer interest</h3>
  <p class="muted">${offers.length ? "Clubs watching" : "Play well to get scouted from all leagues"}</p>
  <button class="ghost" data-action="scout-refresh">Scan scouting interest</button>
  ${offers.map((o) => `<div class="unlock-row"><div style="flex:1"><div class="unlock-title">${o.fromClubName}</div><div class="muted">${o.leagueLabel} · ${o.wageLabel} · ${o.feeLabel}</div></div>
  <button class="sp-btn" data-action="transfer-accept" data-id="${o.id}">Join</button>
  <button class="ghost" data-action="transfer-decline" data-id="${o.id}">No</button></div>`).join("")}</div>
  <div class="card"><h3>Job Centre</h3><p class="muted">${jobs.length} managerial offers</p>
  <button class="ghost" data-action="jobs-refresh">Scan market</button></div></div>`;
}
function renderMore() {
  return `<div class="anim-stagger"><div class="card"><h3>More</h3><div class="actions">
  <button class="btn" data-action="advance">Advance matchday</button>
  <button class="ghost" data-action="train" data-focus="Tactical">Train</button>
  <button class="ghost" data-action="save">Save</button></div>
  <p class="muted" style="margin-top:12px">${hub?.date || ""} · Season ${hub?.season || ""}</p></div></div>`;
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
  content.querySelectorAll(".trust-bar > span[data-w]").forEach((el) => { el.style.width = `${el.getAttribute("data-w")}%`; });
}
window.api = api; window.toast = toast; window.setView = setView; window.refresh = refresh;
window.render = render; window.loadMatchStats = loadMatchStats; window.hub = () => hub;
