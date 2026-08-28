const $ = (id) => document.getElementById(id);
let hub = null;
let playerDev = null;
let scout = null;
let feed = null;
let view = "overview";

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

function setView(name) {
  view = name;
  document.querySelectorAll("#sideNav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === name);
  });
  render();
}

document.querySelectorAll("#sideNav button").forEach((b) => {
  b.addEventListener("click", () => setView(b.dataset.view));
});

$("btnStart").onclick = async () => {
  $("btnStart").disabled = true;
  try {
    await api("/api/start", {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jordan",
        lastName: "Vale",
        position: "RW",
        age: 17,
        potential: 84,
        nationality: "England",
      }),
    });
    await refresh();
    $("gate").classList.add("hidden");
    $("app").classList.remove("hidden");
    toast("Career started");
  } catch (e) {
    toast(e.message);
    $("btnStart").disabled = false;
  }
};

async function refresh() {
  hub = await api("/api/hub");
  try { playerDev = await api("/api/player"); } catch { playerDev = null; }
  try { scout = await api("/api/scout"); } catch { scout = { targets: [] }; }
  try { feed = await api("/api/feed"); } catch { feed = { news: [], social: [] }; }
  render();
}

function render() {
  if (!hub) return;
  const p = hub.player;
  $("sideSeason").textContent = hub.season || "—";
  $("sideName").textContent = p ? p.name : "—";
  $("sideMeta").textContent = p ? `${p.position} · ${p.ovr} OVR · ${p.club || "—"}` : "—";
  const titles = {
    overview: ["OVERVIEW", p?.name || "Career", p ? `${p.club} · ${p.position} · Age ${p.age}` : ""],
    league: ["COMPETITION", "Premier Division", `${hub.season || ""} · ${hub.date || ""}`],
    transfers: ["TRANSFERS", "Transfer Network", "Window · Scouting targets"],
    development: ["DEVELOPMENT", "Player Development Plan", p ? `${p.name} · ${p.position}` : ""],
    news: ["WORLD", "News & Social", "Event-driven feed only"],
    inbox: ["INBOX", "Messages", "Manager · Agent · Media"],
  };
  const t = titles[view] || titles.overview;
  $("pageEyebrow").textContent = t[0];
  $("pageTitle").textContent = t[1];
  $("pageSub").textContent = t[2];
  const el = $("content");
  if (view === "overview") el.innerHTML = renderOverview();
  else if (view === "league") el.innerHTML = renderLeague();
  else if (view === "transfers") el.innerHTML = renderTransfers();
  else if (view === "development") el.innerHTML = renderDev();
  else if (view === "news") el.innerHTML = renderNews();
  else if (view === "inbox") el.innerHTML = renderInbox();
  bindActions();
}

function renderOverview() {
  const p = hub.player || {};
  const pos = hub.table?.find((r) => r.clubId === p.clubId);
  const ord = (n) => (!n ? "—" : n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"));
  return `
    <div class="grid-3">
      <div class="panel ovr-box">
        <div class="big">${p.ovr ?? "—"}</div>
        <div class="lbl">OVR</div>
        <div class="pot">POT ${p.potential ?? "—"}</div>
      </div>
      <div class="panel">
        <div class="grid-stats">
          <div class="stat-cell"><b>${p.form ?? "—"}</b><span>Form</span></div>
          <div class="stat-cell"><b>${p.fitness ?? "—"}</b><span>Fitness</span></div>
          <div class="stat-cell"><b>${p.morale ?? "—"}</b><span>Morale</span></div>
          <div class="stat-cell"><b>${p.managerTrust ?? "—"}</b><span>Trust</span></div>
          <div class="stat-cell"><b>${p.apps ?? 0}</b><span>Apps</span></div>
          <div class="stat-cell"><b>${p.goals ?? 0}</b><span>Goals</span></div>
        </div>
      </div>
      <div class="panel">
        <div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:8px">NEXT STEP</div>
        <div style="font-size:16px;font-weight:600;margin-bottom:6px">Advance the career</div>
        <div class="muted" style="font-size:13px;margin-bottom:12px">Train, play matchdays, finish the season when ready.</div>
        <div class="btn-row">
          <button class="btn" data-act="train">Train</button>
          <button class="btn ghost" data-act="advance">Play Matchday</button>
        </div>
      </div>
    </div>
    <div class="section-title">SEASON PROGRESS</div>
    <div class="strip">
      <div class="cell"><b>${ord(pos?.pos)}</b><span>League Pos</span></div>
      <div class="cell"><b>${pos?.pts ?? "—"}</b><span>Points</span></div>
      <div class="cell"><b>${pos != null ? (pos.gd > 0 ? "+" + pos.gd : pos.gd) : "—"}</b><span>GD</span></div>
      <div class="cell"><b>${p.apps ?? 0}</b><span>Apps</span></div>
      <div class="cell"><b>${p.goals ?? 0}</b><span>Goals</span></div>
      <div class="cell"><b>${p.assists ?? 0}</b><span>Assists</span></div>
    </div>
    <div class="grid-2" style="margin-top:18px">
      <div class="panel">
        <div class="section-title" style="margin-top:0">INBOX</div>
        <div class="inbox-row"><div class="who">Manager</div><div>Keep training hard — minutes are earned.</div></div>
        <div class="inbox-row"><div class="who">Agent</div><div>Stay patient; form opens doors.</div></div>
        <div class="inbox-row"><div class="who">Media</div><div>${(hub.news && hub.news[0]) ? hub.news[0].headline : "Quiet news day."}</div></div>
      </div>
      <div class="panel">
        <div class="section-title" style="margin-top:0">QUICK ACTIONS</div>
        <div class="action-list">
          <button data-act="train">Train · Technical</button>
          <button data-act="advance">Advance Matchday</button>
          <button data-act="endSeason">Finish Season</button>
          <button data-act="nextSeason">Next Season + Transfers</button>
          <button data-act="save">Save Career</button>
        </div>
      </div>
    </div>`;
}

function renderLeague() {
  const rows = hub.table || [];
  const me = hub.player?.clubId;
  const body = rows.map((r) => `
    <tr class="${r.clubId === me ? "me" : ""}">
      <td>${r.pos}</td><td>${r.club}</td>
      <td>${r.played ?? "—"}</td><td>${r.won ?? "—"}</td><td>${r.drawn ?? "—"}</td><td>${r.lost ?? "—"}</td>
      <td>${r.gf ?? "—"}</td><td>${r.ga ?? "—"}</td>
      <td>${r.gd > 0 ? "+" + r.gd : r.gd}</td>
      <td><b>${r.pts}</b></td>
      <td class="muted">${r.form || "—"}</td>
    </tr>`).join("");
  return `<div class="panel"><table class="data">
    <thead><tr>
      <th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th>
      <th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th>
    </tr></thead>
    <tbody>${body || "<tr><td colspan=11 class='muted'>No table yet — play matchdays.</td></tr>"}</tbody>
  </table></div>`;
}

function renderTransfers() {
  const targets = scout?.targets || [];
  const rows = targets.map((t) => `
    <tr>
      <td><b>${t.name}</b></td><td>${t.age}</td><td>${t.position}</td>
      <td>${t.ovr}</td><td>${t.potential}</td><td>${t.club}</td>
      <td>€${((t.fee || 0) / 1e6).toFixed(1)}m</td>
      <td class="${t.fit > 70 ? "high" : ""}">${t.fit > 75 ? "High" : t.fit > 55 ? "Med" : "Low"}</td>
    </tr>`).join("");
  return `
    <div class="filters">
      <span class="chip">Position: All</span>
      <span class="chip">Age: 16–23</span>
      <span class="chip">Role: Prospect</span>
      <span class="chip">Sort: Fit score</span>
    </div>
    <div class="panel"><table class="data">
      <thead><tr>
        <th>Player</th><th>Age</th><th>Pos</th><th>OVR</th><th>POT</th>
        <th>Club</th><th>Value</th><th>Interest</th>
      </tr></thead>
      <tbody>${rows || "<tr><td colspan=8 class='muted'>No targets yet.</td></tr>"}</tbody>
    </table></div>`;
}

function bar(label, val) {
  const v = Math.round(Number(val) || 0);
  const good = v >= 70 ? "good" : "";
  return `<div class="attr-row">
    <span>${label}</span><span style="text-align:right;font-weight:600">${v}</span>
    <div class="bar"><i class="${good}" style="width:${Math.min(100, v)}%"></i></div>
  </div>`;
}

function renderDev() {
  const d = playerDev;
  if (!d) return `<div class="panel muted">Start a career to see development.</div>`;
  const tech = [["Finishing", d.detail.finishing],["Dribbling", d.detail.dribbling],["Crossing", d.detail.crossing],["Passing", d.detail.shortPass],["Ball Control", d.detail.ballControl]];
  const phys = [["Pace", d.detail.sprintSpeed],["Acceleration", d.detail.acceleration],["Stamina", d.detail.stamina],["Strength", d.detail.strength],["Agility", d.detail.agility]];
  const ment = [["Composure", d.detail.composure],["Decisions", d.detail.decisions],["Vision", d.detail.vision],["Aggression", d.detail.aggression],["Positioning", d.detail.positioning]];
  return `
    <div class="attr-grid">
      <div class="panel attr-group"><h3>Technical</h3>${tech.map(([l,v]) => bar(l,v)).join("")}</div>
      <div class="panel attr-group"><h3>Physical</h3>${phys.map(([l,v]) => bar(l,v)).join("")}</div>
      <div class="panel attr-group"><h3>Mental</h3>${ment.map(([l,v]) => bar(l,v)).join("")}</div>
    </div>
    <div class="panel" style="margin-top:14px">
      <div class="section-title" style="margin-top:0">TRAINING FOCUS</div>
      <div style="margin-bottom:12px;font-size:14px">Current: Technical · Intensity: Medium · Fatigue risk: Low</div>
      <div class="btn-row">
        <button class="btn sm" data-act="train" data-focus="Attacking">Sharpen finishing</button>
        <button class="btn sm ghost" data-act="train" data-focus="Tactical">Wide play patterns</button>
        <button class="btn sm ghost" data-act="train" data-focus="Physical">Pressing / stamina</button>
      </div>
    </div>`;
}

function renderNews() {
  const news = (feed?.news?.length ? feed.news : hub.news) || [];
  const social = (feed?.social?.length ? feed.social : hub.social) || [];
  const cards = news.slice(0, 12).map((n) => `
    <div class="feed-card">
      <div class="badge">${(n.category || n.importance || "NEWS").toString().toUpperCase()}</div>
      <div class="headline">${n.headline}</div>
      <div class="body">${n.body || n.date || ""}</div>
    </div>`).join("");
  const socialCards = social.slice(0, 8).map((s) => `
    <div class="feed-card">
      <div class="badge">SOCIAL</div>
      <div class="headline">${s.author}</div>
      <div class="body">${s.content}</div>
    </div>`).join("");
  return `<div class="grid-2">
    <div>${cards || "<div class='panel muted'>No news yet — play matches to generate events.</div>"}</div>
    <div>${socialCards || "<div class='panel muted'>No social posts yet.</div>"}</div>
  </div>`;
}

function renderInbox() {
  return `
    <div class="panel">
      <div class="inbox-row"><div class="who">Manager</div><div>Selection is competitive. Impress in training and when called upon.</div></div>
      <div class="inbox-row"><div class="who">Agent</div><div>I'll keep an eye on clubs that need a ${hub.player?.position || "player"}.</div></div>
      <div class="inbox-row"><div class="who">Board</div><div>Focus on development this season.</div></div>
      <div class="inbox-row"><div class="who">Media</div><div>${hub.news?.[0]?.headline || "No active storylines."}</div></div>
    </div>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn ghost" data-act="agent">Ask Agent</button>
    </div>`;
}

function bindActions() {
  document.querySelectorAll("[data-act]").forEach((btn) => {
    btn.onclick = async () => {
      const act = btn.getAttribute("data-act");
      btn.disabled = true;
      try {
        if (act === "train") {
          const focus = btn.getAttribute("data-focus") || "Technical";
          await api("/api/train", { method: "POST", body: JSON.stringify({ focus }) });
          toast("Training session completed");
        } else if (act === "advance") {
          const r = await api("/api/advance", { method: "POST", body: "{}" });
          toast(r.done ? r.message : `Matchday ${r.matchday} played (${r.matchesPlayed} matches)`);
        } else if (act === "endSeason") {
          await api("/api/season/end", { method: "POST", body: "{}" });
          toast("Season ended");
        } else if (act === "nextSeason") {
          await api("/api/season/next", { method: "POST", body: "{}" });
          toast("New season + transfer window");
        } else if (act === "save") {
          await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
          toast("Career saved");
        } else if (act === "agent") {
          const r = await api("/api/agent");
          toast(r.advice?.summary || JSON.stringify(r.advice || r).slice(0, 120));
        }
        await refresh();
      } catch (e) {
        toast(e.message);
      } finally {
        btn.disabled = false;
      }
    };
  });
}

api("/api/status").then((s) => {
  if (s?.careerStarted) {
    refresh().then(() => {
      $("gate").classList.add("hidden");
      $("app").classList.remove("hidden");
    });
  }
}).catch(() => {});
