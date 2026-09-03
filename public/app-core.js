/**
 * Career Mode UI core - FM density + EA FC presentation
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
    const dv = b.getAttribute("data-view");
    b.classList.toggle("active", dv === v);
  });
  render();
}

function fmtVal(n) {
  if (n == null) return "-";
  if (typeof n === "string") return n;
  if (n >= 1e6) return "EUR " + (n / 1e6).toFixed(1) + "m";
  if (n >= 1e3) return "EUR " + Math.round(n / 1e3) + "k";
  return "EUR " + n;
}

async function refresh() {
  hub = await api("/api/hub");
  render();
  return hub;
}

function renderHub() {
  if (!hub) return "<div class=\"card\">Loading...</div>";
  const p = hub.player || {};
  const obj = window.renderObjectives ? window.renderObjectives(hub.objectives) : "";
  const inbox = window.renderInbox ? window.renderInbox(hub.inbox) : "";
  const medical = hub.medical
    ? `<div class="card"><h3>Medical</h3><pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(hub.medical, null, 2)}</pre></div>`
    : "";
  const squad = hub.matchdaySquad
    ? `<div class="card"><h3>Matchday squad (${hub.matchdaySquad.formation || ""})</h3>
        <p class="muted">${hub.matchdaySquad.user?.standing || ""}</p>
        <div class="grid-2">${(hub.matchdaySquad.xi || [])
          .map(
            (x) =>
              `<div class="panel">${x.isUser ? "★ " : ""}${x.name} <span class="pill">${x.position}</span> ${x.ovr}</div>`
          )
          .join("")}</div></div>`
    : "";
  const roles = hub.roles
    ? `<div class="card"><h3>Role & instructions</h3>
        <p>${hub.roles.roleLabel || ""} · ${hub.roles.instructionLabel || ""}</p>
        <div>${(hub.roles.availableRoles || [])
          .map(
            (r) =>
              `<button data-action="set-role" data-role="${r.id}">${r.label}</button> `
          )
          .join("")}</div>
        <div style="margin-top:8px">${(hub.roles.instructions || [])
          .map(
            (i) =>
              `<button data-action="set-role" data-instruction="${i.id}">${i.label}</button> `
          )
          .join("")}</div></div>`
    : "";
  const neg = hub.negotiation
    ? `<div class="card"><h3>Contract</h3>
        <button class="btn" data-action="neg-open">Open negotiation</button>
        <button data-action="neg-respond" data-neg="accept">Accept</button>
        <button data-action="neg-respond" data-neg="counter">Counter</button>
        <button data-action="neg-respond" data-neg="mediate">Mediate</button>
        <pre style="font-size:12px">${JSON.stringify(hub.negotiation, null, 2)}</pre></div>`
    : `<div class="card"><button class="btn" data-action="neg-open">Open negotiation</button></div>`;

  return `
    <div class="card match-poster">
      <h2>${p.name || "Player"} · ${p.ovr ?? ""} OVR</h2>
      <div class="muted">${p.position || ""} · Age ${p.age ?? ""} · ${p.club || ""}</div>
      <div class="grid-3" style="margin-top:12px">
        <div><span class="pill">Form</span> ${p.form ?? "-"}</div>
        <div><span class="pill">Fitness</span> ${p.fitness ?? "-"}</div>
        <div><span class="pill">Trust</span> ${p.trust ?? p.managerTrust ?? "-"}</div>
      </div>
      <div style="margin-top:14px">
        <button class="btn" data-action="advance">Advance matchday</button>
        <button data-action="train" data-focus="Tactical">Train</button>
        <button data-action="match-start">Play match</button>
        <button data-action="save">Save</button>
      </div>
    </div>
    ${obj}${inbox}${squad}${roles}${medical}${neg}
  `;
}

function render() {
  const content = $("content");
  if (!content) return;
  if (view === "hub" || view === "overview") content.innerHTML = renderHub();
  else if (view === "news") {
    content.innerHTML = `<div class="card"><h3>News</h3><p class="muted">Loading feed...</p></div>`;
    api("/api/news")
      .then((d) => {
        const items = d.news || [];
        content.innerHTML = `<div class="card"><h3>News</h3>${items
          .map(
            (n) =>
              `<div class="panel news-card" style="margin:10px 0"><strong>${n.headline}</strong><div class="muted">${n.body || ""}</div></div>`
          )
          .join("")}</div>`;
      })
      .catch((e) => (content.innerHTML = `<div class="card">${e.message}</div>`));
  } else {
    content.innerHTML = renderHub();
  }
}

window.api = api;
window.refresh = refresh;
window.setView = setView;
window.toast = toast;
window.$ = $;
