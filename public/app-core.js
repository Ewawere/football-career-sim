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
  setTimeout(() => el.classList.remove("show"), 2800);
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

function faceInitials(name) {
  const parts = String(name || "P").trim().split(/\s+/);
  return ((parts[0]?.[0] || "P") + (parts[1]?.[0] || "")).toUpperCase();
}

function renderJobs(offers) {
  const list = offers || [];
  return `<div class="card">
    <div class="row-between"><h3>Job Centre</h3><span class="pill blue">${list.length} open</span></div>
    <p class="muted">Multiple clubs across leagues can approach you when unemployed (manager career).</p>
    <div class="actions"><button data-action="jobs-refresh">Scan market</button></div>
    ${list.length ? list.map((o) => `
      <div class="panel" style="margin-top:10px">
        <div class="row-between">
          <strong>${o.clubName}</strong>
          <span class="pill">${o.leagueLabel || "League"}</span>
        </div>
        <div class="muted">Rep ${o.reputation} · ${o.wageLabel || ""} · ${o.contractYears}y</div>
        <div class="muted">Board target ~${o.expectations?.leaguePositionMin ?? "-"} · ${o.expectations?.style || ""}</div>
        <div class="actions">
          <button class="btn" data-action="job-accept" data-id="${o.id}">Accept</button>
          <button data-action="job-decline" data-id="${o.id}">Decline</button>
        </div>
      </div>`).join("") : `<p class="muted">No open managerial offers right now.</p>`}
  </div>`;
}

function renderObjectives(obj) {
  if (!obj?.objectives?.length) {
    return `<div class="card"><h3>Season objectives</h3><p class="muted">Objectives unlock with your season.</p></div>`;
  }
  return `<div class="card">
    <div class="row-between"><h3>Objectives</h3><span class="pill">${obj.completed || 0}/${obj.total || 0}</span></div>
    <div class="progress"><span style="width:${obj.progress || 0}%"></span></div>
    ${(obj.objectives || []).map((o) => `
      <div class="panel" style="margin-top:10px">
        <div class="row-between"><strong>${o.label}</strong><span class="muted">+${o.rewardSp || 0} SP</span></div>
        <div class="muted">${o.description || ""}</div>
        <div class="progress"><span style="width:${o.pct || 0}%"></span></div>
        <div class="row-between" style="margin-top:6px">
          <span class="muted">${o.current}/${o.target} ${o.unit || ""}</span>
          <button class="btn" data-action="claim-obj" data-id="${o.id}" ${!o.completed || o.claimed ? "disabled" : ""}>
            ${o.claimed ? "Claimed" : o.completed ? "Claim" : (o.pct || 0) + "%"}
          </button>
        </div>
      </div>`).join("")}
  </div>`;
}

function renderInbox(inbox) {
  const msgs = inbox?.messages || [];
  return `<div class="card">
    <div class="row-between"><h3>Inbox</h3>${inbox?.unread ? `<span class="pill warn">${inbox.unread} new</span>` : ""}</div>
    ${msgs.length ? msgs.map((m) => `
      <div class="panel" style="margin-top:10px;opacity:${m.read ? 0.7 : 1}">
        <div class="row-between"><strong>${m.from}</strong><span class="muted">${m.priority || ""}</span></div>
        <div>${m.subject || ""}</div>
        <div class="muted">${m.body || ""}</div>
        ${!m.read ? `<div class="actions"><button data-action="inbox-read" data-id="${m.id}">Mark read</button></div>` : ""}
      </div>`).join("") : `<p class="muted">No messages.</p>`}
  </div>`;
}

function renderSquad(ms) {
  if (!ms) return "";
  return `<div class="card">
    <div class="row-between"><h3>Matchday squad</h3><span class="pill blue">${ms.formation || ""}</span></div>
    <p class="muted">${ms.user?.standing || ""}</p>
    <div class="grid-2">${(ms.xi || []).map((x) => `
      <div class="panel">${x.isUser ? "★ " : ""}<strong>${x.name}</strong>
        <div class="muted"><span class="pill">${x.position}</span> ${x.ovr} · ${x.roleLabel || ""}</div>
      </div>`).join("")}</div>
  </div>`;
}

function renderMedical(med) {
  if (!med) return "";
  const tone = med.statusTone === "bad" ? "bad" : med.statusTone === "warn" ? "warn" : "";
  return `<div class="card">
    <div class="row-between"><h3>Medical Centre</h3><span class="pill ${tone}">${med.statusLabel || ""}</span></div>
    <div class="grid-3">
      <div class="stat-tile"><div class="label">Fitness</div><div class="value">${med.fitness ?? "-"}</div></div>
      <div class="stat-tile"><div class="label">Rust</div><div class="value">${med.comebackPenalty ?? 0}%</div></div>
      <div class="stat-tile"><div class="label">Re-injury</div><div class="value">${med.recurrenceRisk ?? 0}%</div></div>
    </div>
    ${med.active ? `<div class="panel" style="margin-top:10px"><strong>${med.active.name}</strong><div class="muted">${med.active.phase?.label || ""} · ${med.active.daysRemaining}d left</div><div class="muted">${med.active.phase?.detail || ""}</div></div>` : ""}
    <ul class="muted">${(med.notes || []).map((n) => `<li>${n}</li>`).join("")}</ul>
  </div>`;
}

function renderRoles(roles) {
  if (!roles) return "";
  return `<div class="card">
    <h3>Role · Instructions</h3>
    <p class="muted">${roles.roleLabel || "Default"} · ${roles.instructionLabel || "Balanced"}</p>
    <div class="actions">${(roles.availableRoles || []).map((r) => `<button data-action="set-role" data-role="${r.id}">${r.label}</button>`).join("")}</div>
    <div class="actions">${(roles.instructions || []).map((i) => `<button data-action="set-role" data-instruction="${i.id}">${i.label}</button>`).join("")}</div>
  </div>`;
}

function renderNegotiation(neg) {
  const n = neg || {};
  return `<div class="card">
    <h3>Contract office</h3>
    <div class="muted">${n.currentWageWeekly || "Current wage n/a"} · ends ${n.endDate || "-"}</div>
    <div class="grid-2" style="margin-top:10px">
      <div class="stat-tile"><div class="label">Demand</div><div class="value" style="font-size:16px">${n.demandedLabel || "-"}</div></div>
      <div class="stat-tile"><div class="label">Offer</div><div class="value" style="font-size:16px">${n.offeredLabel || "-"}</div></div>
    </div>
    <p class="muted">${n.agentNote || n.clubNote || ""}</p>
    <div class="actions">
      <button class="btn" data-action="neg-open">Open talks</button>
      <button data-action="neg-respond" data-neg="accept">Accept</button>
      <button data-action="neg-respond" data-neg="counter">Counter</button>
      <button data-action="neg-respond" data-neg="mediate">Mediate</button>
      <button data-action="neg-respond" data-neg="reject">Walk</button>
    </div>
    ${n.lastMessage ? `<p class="muted">${n.lastMessage}</p>` : ""}
  </div>`;
}

function renderHub() {
  if (!hub) return `<div class="card">Loading career hub…</div>`;
  const p = hub.player || {};
  return `
  <div class="card match-poster">
    <div class="row-between">
      <div>
        <div class="pill">PLAYER CAREER</div>
        <h2 style="margin-top:8px">${p.name || p.displayName || "Player"}</h2>
        <div class="muted">${p.position || ""} · Age ${p.age ?? "-"} · ${p.club || "Free agent"}</div>
      </div>
      <div style="text-align:right">
        <div class="face-ring">${faceInitials(p.name || p.displayName)}</div>
        <div style="margin-top:8px;font-size:28px;font-weight:800">${p.ovr ?? "-"}<span class="muted" style="font-size:12px"> OVR</span></div>
      </div>
    </div>
    <div class="grid-3" style="margin-top:14px">
      <div class="stat-tile"><div class="label">Form</div><div class="value">${p.form ?? "-"}</div></div>
      <div class="stat-tile"><div class="label">Fitness</div><div class="value">${p.fitness ?? "-"}</div></div>
      <div class="stat-tile"><div class="label">Trust</div><div class="value">${p.trust ?? p.managerTrust ?? "-"}</div></div>
    </div>
    <div class="actions">
      <button class="btn" data-action="advance">Advance matchday</button>
      <button data-action="train" data-focus="Tactical">Train</button>
      <button data-action="match-start">Play match</button>
      <button data-action="match-finish">Full time</button>
      <button data-action="save">Save</button>
    </div>
  </div>
  ${renderObjectives(hub.objectives)}
  ${renderInbox(hub.inbox)}
  ${renderSquad(hub.matchdaySquad)}
  ${renderRoles(hub.roles)}
  ${renderMedical(hub.medical)}
  ${renderNegotiation(hub.negotiation)}
  ${renderJobs(hub.jobOffers)}
  `;
}

function renderNews(items) {
  if (!items?.length) return `<div class="card"><h3>Newsroom</h3><p class="muted">Advance the calendar for stories.</p></div>`;
  return `<div class="card"><h3>Newsroom</h3>${items.map((n) => `
    <div class="panel" style="margin-top:10px">
      <div class="row-between"><strong>${n.headline || ""}</strong><span class="pill">${n.importance || n.category || "Story"}</span></div>
      <p class="muted">${n.body || ""}</p>
    </div>`).join("")}</div>`;
}

function render() {
  const content = $("content");
  if (!content) return;
  if (view === "news") {
    content.innerHTML = `<div class="card">Loading newsroom…</div>`;
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
