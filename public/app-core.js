/**
 * Career Mode UI core - hybrid hub (FM + EA FC)
 */
const $ = (id) => document.getElementById(id);

let hub = null;
let view = "hub";

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

function renderObjectives(obj) {
  if (!obj || !obj.objectives || !obj.objectives.length) {
    return `<div class="card"><h3>Season objectives</h3><p class="muted">Will appear once the season is active.</p></div>`;
  }
  return `<div class="card"><h3>Season objectives · ${obj.completed || 0}/${obj.total || 0}</h3>
    <div class="muted">${obj.progress || 0}% · claim SP when complete</div>
    ${(obj.objectives || [])
      .map(
        (o) => `<div class="panel" style="margin:8px 0">
      <strong>${o.label}</strong>
      <div class="muted">${o.description || ""}</div>
      <div>${o.current}/${o.target} ${o.unit || ""} · +${o.rewardSp || 0} SP</div>
      <button class="btn" data-action="claim-obj" data-id="${o.id}" ${!o.completed || o.claimed ? "disabled" : ""}>
        ${o.claimed ? "Claimed" : o.completed ? "Claim" : (o.pct || 0) + "%"}
      </button></div>`
      )
      .join("")}</div>`;
}

function renderInbox(inbox) {
  const msgs = (inbox && inbox.messages) || [];
  return `<div class="card"><h3>Inbox ${inbox && inbox.unread ? "(" + inbox.unread + " unread)" : ""}</h3>
    ${msgs.length
      ? msgs
          .map(
            (m) => `<div class="panel" style="margin:8px 0;opacity:${m.read ? 0.65 : 1}">
        <strong>${m.from || "Club"}</strong> · ${m.subject || ""}
        <div class="muted">${m.body || ""}</div>
        ${!m.read ? `<button data-action="inbox-read" data-id="${m.id}">Mark read</button>` : ""}
      </div>`
          )
          .join("")
      : '<p class="muted">No messages</p>'}</div>`;
}

function renderSquad(ms) {
  if (!ms) return "";
  const xi = ms.xi || [];
  return `<div class="card"><h3>Matchday · ${ms.formation || ""}</h3>
    <p class="muted">${(ms.user && ms.user.standing) || ""}</p>
    <div class="grid-2">${xi
      .map(
        (x) =>
          `<div class="panel">${x.isUser ? "★ " : ""}${x.name} <span class="pill">${x.position}</span> ${x.ovr}</div>`
      )
      .join("")}</div>
    ${(ms.bench || []).length
      ? `<div class="muted" style="margin-top:8px">Bench: ${ms.bench
          .map((b) => b.name)
          .join(", ")}</div>`
      : ""}</div>`;
}

function renderRoles(roles) {
  if (!roles) return "";
  return `<div class="card"><h3>Role · ${roles.roleLabel || ""} / ${roles.instructionLabel || ""}</h3>
    <div>${(roles.availableRoles || [])
      .map((r) => `<button data-action="set-role" data-role="${r.id}">${r.label}</button> `)
      .join("")}</div>
    <div style="margin-top:8px">${(roles.instructions || [])
      .map(
        (i) =>
          `<button data-action="set-role" data-instruction="${i.id}">${i.label}</button> `
      )
      .join("")}</div></div>`;
}

function renderMedical(med) {
  if (!med) return "";
  return `<div class="card"><h3>Medical centre</h3>
    <pre style="white-space:pre-wrap;font-size:12px;opacity:.9">${JSON.stringify(med, null, 2)}</pre></div>`;
}

function renderBriefing() {
  const b = hub && (hub.briefing || hub.preMatch);
  if (!b) return "";
  return `<div class="card"><h3>Pre-match briefing</h3>
    <div class="grid-3">
      <div><span class="pill">Form</span> ${b.form ?? "-"}</div>
      <div><span class="pill">Fitness</span> ${b.fitness ?? "-"}</div>
      <div><span class="pill">Trust</span> ${b.trust ?? "-"}</div>
    </div>
    <ul>${(b.tips || b.notes || []).map((t) => `<li>${t}</li>`).join("")}</ul></div>`;
}

function renderHub() {
  if (!hub) return '<div class="card">Loading career hub...</div>';
  const p = hub.player || {};
  return `
  <div class="card match-poster">
    <h2>${p.name || p.displayName || "Player"} · ${p.ovr ?? ""} OVR</h2>
    <div class="muted">${p.position || ""} · Age ${p.age ?? ""} · ${p.club || ""}</div>
    <div class="grid-3" style="margin-top:12px">
      <div><span class="pill">Form</span> ${p.form ?? "-"}</div>
      <div><span class="pill">Fitness</span> ${p.fitness ?? "-"}</div>
      <div><span class="pill">Trust</span> ${p.trust ?? p.managerTrust ?? "-"}</div>
    </div>
    <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">
      <button class="btn" data-action="advance">Advance matchday</button>
      <button data-action="train" data-focus="Tactical">Train</button>
      <button data-action="match-start">Play match</button>
      <button data-action="match-finish">Finish match</button>
      <button data-action="save">Save</button>
      <button data-action="neg-open">Contract</button>
    </div>
  </div>
  ${renderBriefing()}
  ${renderObjectives(hub.objectives)}
  ${renderInbox(hub.inbox)}
  ${renderSquad(hub.matchdaySquad)}
  ${renderRoles(hub.roles)}
  ${renderMedical(hub.medical)}
  `;
}

function renderNews(items) {
  if (!items || !items.length) return '<div class="card"><h3>News</h3><p class="muted">No stories yet - advance the calendar.</p></div>';
  return `<div class="card"><h3>News</h3>${items
    .map(
      (n) => `<div class="panel news-card" style="margin:10px 0">
      <strong>${n.headline || ""}</strong>
      <div class="muted">${n.category || ""} · ${n.importance || ""}</div>
      <p>${n.body || ""}</p>
      <div class="reactions">
        <button data-action="like-news">Like</button>
        <button data-action="react-news">🔥</button>
      </div>
    </div>`
    )
    .join("")}</div>`;
}

function render() {
  const content = $("content");
  if (!content) return;
  if (view === "news") {
    content.innerHTML = '<div class="card">Loading news...</div>';
    api("/api/news")
      .then((d) => {
        content.innerHTML = renderNews(d.news || []);
      })
      .catch((e) => {
        content.innerHTML = `<div class="card">${e.message}</div>`;
      });
    return;
  }
  content.innerHTML = renderHub();
}

window.api = api;
window.refresh = refresh;
window.setView = setView;
window.toast = toast;
window.$ = $;
window.hub = () => hub;
