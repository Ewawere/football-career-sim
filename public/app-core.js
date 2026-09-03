const $ = (id) => document.getElementById(id);
let hub = null;
let view = "hub";

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
  setTimeout(() => el.classList.remove("show"), 3200);
}

function setView(v) {
  view = v;
  document.querySelectorAll("#sideNav button, #bottomNav button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-view") === v);
  });
  render();
}

async function refresh() {
  hub = await api("/api/hub");
  render();
  return hub;
}

function renderJobs(offers) {
  const list = offers || [];
  return `<div class="card"><h3>Job offers ${list.length ? "(" + list.length + ")" : ""}</h3>
    <div class="muted">Up to 5 clubs at once, including different leagues, when unemployed as a manager.</div>
    <div style="margin:8px 0"><button data-action="jobs-refresh">Refresh offers</button></div>
    ${list.length
      ? list
          .map(
            (o) => `<div class="panel" style="margin:8px 0">
        <strong>${o.clubName}</strong>
        <span class="pill">${o.leagueLabel || "League"}</span>
        <div class="muted">Rep ${o.reputation} · ${o.wageLabel || ""} · ${o.contractYears}y</div>
        <div class="muted">Board target ~${o.expectations?.leaguePositionMin ?? "-"} · ${o.expectations?.style || ""}</div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-action="job-accept" data-id="${o.id}">Accept</button>
          <button data-action="job-decline" data-id="${o.id}">Decline</button>
        </div>
      </div>`
          )
          .join("")
      : '<p class="muted">No open offers. Refresh after sackings / season review (manager must be unemployed).</p>'}</div>`;
}

function renderObjectives(obj) {
  if (!obj?.objectives?.length)
    return `<div class="card"><h3>Season objectives</h3><p class="muted">Appear once the season is active.</p></div>`;
  return `<div class="card"><h3>Objectives · ${obj.completed || 0}/${obj.total || 0}</h3>
    ${(obj.objectives || [])
      .map(
        (o) => `<div class="panel" style="margin:8px 0">
      <strong>${o.label}</strong><div class="muted">${o.description || ""}</div>
      <div>${o.current}/${o.target} ${o.unit || ""} · +${o.rewardSp || 0} SP</div>
      <button class="btn" data-action="claim-obj" data-id="${o.id}" ${!o.completed || o.claimed ? "disabled" : ""}>
        ${o.claimed ? "Claimed" : o.completed ? "Claim" : (o.pct || 0) + "%"}
      </button></div>`
      )
      .join("")}</div>`;
}

function renderInbox(inbox) {
  const msgs = inbox?.messages || [];
  return `<div class="card"><h3>Inbox ${inbox?.unread ? "(" + inbox.unread + ")" : ""}</h3>
    ${msgs.length
      ? msgs
          .map(
            (m) => `<div class="panel" style="margin:8px 0;opacity:${m.read ? 0.65 : 1}">
        <strong>${m.from}</strong> · ${m.subject}
        <div class="muted">${m.body || ""}</div>
        ${!m.read ? `<button data-action="inbox-read" data-id="${m.id}">Mark read</button>` : ""}
      </div>`
          )
          .join("")
      : '<p class="muted">No messages</p>'}</div>`;
}

function renderHub() {
  if (!hub) return '<div class="card">Loading...</div>';
  const p = hub.player || {};
  return `
  <div class="card match-poster">
    <h2>${p.name || p.displayName || "Career"} · ${p.ovr ?? ""} OVR</h2>
    <div class="muted">${p.position || ""} · ${p.club || ""}</div>
    <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">
      <button class="btn" data-action="advance">Advance</button>
      <button data-action="train" data-focus="Tactical">Train</button>
      <button data-action="match-start">Play</button>
      <button data-action="match-finish">Full time</button>
      <button data-action="save">Save</button>
    </div>
  </div>
  ${renderJobs(hub.jobOffers)}
  ${renderObjectives(hub.objectives)}
  ${renderInbox(hub.inbox)}
  `;
}

function renderNews(items) {
  if (!items?.length) return '<div class="card"><h3>News</h3><p class="muted">Advance the calendar for stories.</p></div>';
  return `<div class="card"><h3>News</h3>${items
    .map(
      (n) => `<div class="panel" style="margin:10px 0"><strong>${n.headline || ""}</strong><p>${n.body || ""}</p></div>`
    )
    .join("")}</div>`;
}

function render() {
  const content = $("content");
  if (!content) return;
  if (view === "news") {
    content.innerHTML = '<div class="card">Loading news...</div>';
    api("/api/news")
      .then((d) => (content.innerHTML = renderNews(d.news || [])))
      .catch((e) => (content.innerHTML = `<div class="card">${e.message}</div>`));
    return;
  }
  content.innerHTML = renderHub();
}

window.api = api;
window.refresh = refresh;
window.setView = setView;
window.toast = toast;
window.$ = $;
