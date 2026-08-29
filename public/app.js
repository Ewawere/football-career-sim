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
  return `
  <div class="grid-hero">
    <div class="hero-card">
      <div class="hero-top">
        <div class="ovr-box">
          <div class="num">${p.ovr ?? "—"}</div>
          <div class="pos">${p.position || ""}</div>
        </div>
        <div class="hero-info">
          <h2>${p.name || "—"}</h2>
          <div class="club">${p.club || "—"} · Age ${p.age ?? "—"} · ${p.nationality || ""}</div>
          <div class="club" style="margin-top:6px">
            <b>${p.preferredFoot || "—"}</b>-footed
            · ${p.heightCm ? p.heightCm + " cm" : ""}
            · ${p.physicalProfile || ""}
          </div>
          <div class="club" style="margin-top:6px">POT <b style="color:var(--accent)">${p.potential ?? "—"}</b>
            · Value <b>${p.marketValueLabel || fmtVal(p.marketValue) || "—"}</b></div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${p.form ?? "—"}</div><div class="l">Form</div></div>
        <div class="hero-stat"><div class="v">${p.fitness ?? "—"}</div><div class="l">Fitness</div></div>
        <div class="hero-stat"><div class="v">${p.morale ?? "—"}</div><div class="l">Morale</div></div>
        <div class="hero-stat"><div class="v">${p.managerTrust ?? "—"}</div><div class="l">Trust</div></div>
      </div>
    </div>
    <div>
      <div class="grid-4" style="margin-bottom:14px">
        <div class="stat-tile"><div class="label">League pos</div><div class="value">${ord(pos?.pos)}</div><div class="hint">${pos?.pts ?? "—"} pts</div></div>
        <div class="stat-tile"><div class="label">Appearances</div><div class="value">${p.apps ?? 0}</div><div class="hint">This season</div></div>
        <div class="stat-tile"><div class="label">Goals</div><div class="value">${p.goals ?? 0}</div><div class="hint">Assists tracked in match</div></div>
        <div class="stat-tile"><div class="label">GD</div><div class="value">${pos != null ? (pos.gd > 0 ? "+" + pos.gd : pos.gd) : "—"}</div><div class="hint">Club goal difference</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Career actions</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn" data-act="train">Train</button>
          <button class="btn secondary" data-act="advance">Play Matchday</button>
          <button class="btn secondary" data-act="endSeason">End Season</button>
          <button class="btn secondary" data-act="nextSeason">Next Season</button>
          <button class="btn secondary" data-act="save">Save</button>
          <button class="btn secondary" data-act="agent">Agent Advice</button>
        </div>
      </div>
    </div>
  </div>
  <div class="grid-2">
    <div class="panel">
      <div class="panel-head"><h3>Inbox</h3></div>
      <table class="data">
        <tr><td style="width:90px;font-weight:700;color:var(--accent)">Manager</td><td class="muted">Keep training hard — minutes are earned.</td></tr>
        <tr><td style="font-weight:700;color:var(--accent)">Agent</td><td class="muted">Stay patient; form opens doors.</td></tr>
        <tr><td style="font-weight:700;color:var(--accent)">Media</td><td class="muted">${(hub.news && hub.news[0]?.headline) || "Quiet day in the papers."}</td></tr>
      </table>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Latest news</h3></div>
      ${(hub.news || []).slice(0, 4).map((n) => `
        <div style="padding:8px 0;border-bottom:1px solid var(--line)">
          <div style="font-weight:600;font-size:13px">${n.headline || n.title || "—"}</div>
          <div class="muted" style="font-size:11px;margin-top:2px">${n.importance || ""} · ${n.category || ""}</div>
        </div>`).join("") || '<div class="muted">No stories yet — play matchdays.</div>'}
    </div>
  </div>`;
}

function renderLeague() {
  const rows = (hub.table || []).map((r, i) => `
    <tr class="${hub.player && r.clubId === hub.player.clubId ? "me" : ""}">
      <td><b>${r.pos ?? i + 1}</b></td>
      <td>${r.name || r.clubName || "—"}</td>
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

function renderMatchStats() {
  const m = matchStats;
  if (!m || m.error || !m.home) {
    return `<div class="panel muted">No finished match for your club yet — hit <b>Play Matchday</b>.</div>`;
  }
  const rows = [
    ["Expected goals (xG)", m.home.stats.xG.toFixed(2), m.away.stats.xG.toFixed(2), true],
    ["Total shots", m.home.stats.shots, m.away.stats.shots, true],
    ["Shots on target", m.home.stats.shotsOnTarget, m.away.stats.shotsOnTarget, true],
    ["Touches in opposition box", m.home.stats.touchesInBox, m.away.stats.touchesInBox, true],
    ["Big chances", m.home.stats.bigChances, m.away.stats.bigChances, true],
    ["Big chances missed", m.home.stats.bigChancesMissed, m.away.stats.bigChancesMissed, false],
    ["Accurate passes", `${m.home.stats.accuratePasses} (${m.home.stats.passAccuracy}%)`, `${m.away.stats.accuratePasses} (${m.away.stats.passAccuracy}%)`, true],
    ["Fouls committed", m.home.stats.fouls, m.away.stats.fouls, false],
    ["Offsides", m.home.stats.offsides, m.away.stats.offsides, false],
    ["Corners", m.home.stats.corners, m.away.stats.corners, true],
  ];
  const posH = m.home.stats.possession;
  const posA = m.away.stats.possession;
  const body = rows.map(([lab, h, a, chip]) => `
    <div class="stat-row">
      <div class="hl">${chip ? `<span class="chip">${h}</span>` : h}</div>
      <div class="lab">${lab}</div>
      <div class="al">${chip ? `<span class="chip blue">${a}</span>` : a}</div>
    </div>`).join("");

  return `
  <div class="panel">
    <div class="match-score">
      <div class="teams">${m.home.name} <span class="score-num">${m.score}</span> ${m.away.name}</div>
    </div>
    <div class="poss-bar">
      <div class="h" style="width:${posH}%">${posH}%</div>
      <div class="a" style="width:${posA}%">${posA}%</div>
    </div>
    ${body}
  </div>
  <div class="panel" style="padding:0;overflow:hidden">
    <div class="panel-head" style="padding:14px 18px;margin:0"><h3>Player ratings</h3></div>
    <table class="data">
      <thead><tr><th>Player</th><th>Min</th><th>G</th><th>A</th><th>Rating</th></tr></thead>
      <tbody>
        ${(m.ratings || []).slice(0, 18).map((r) => `
          <tr class="${hub.player && r.id === hub.player.id ? "me" : ""}">
            <td>${r.name}</td>
            <td>${r.minutes}</td>
            <td>${r.goals}</td>
            <td>${r.assists}</td>
            <td><span class="rating ${ratingClass(r.rating)}">${r.rating}</span></td>
          </tr>`).join("") || "<tr><td colspan=5 class='muted'>No ratings</td></tr>"}
      </tbody>
    </table>
  </div>`;
}

function renderClubSocial() {
  const cs = clubSocial;
  if (!cs || cs.error || !cs.account) {
    return `<div class="panel muted">Start a career to see club social media.</div>`;
  }
  const acc = cs.account;
  const posts = (cs.posts || []).map((p) => {
    const tag = (p.tags && p.tags[0]) || "club";
    const badgeClass = tag.includes("next") ? "next-match" : tag.includes("result") ? "breaking" : "";
    return `
    <div class="feed-card">
      <div class="badge ${badgeClass}">${String(tag).replace(/-/g, " ")}</div>
      <div class="headline">${p.authorLabel}</div>
      <div class="body">${p.content}</div>
      <div class="meta">${p.engagement || 0} engagements · ${p.timestamp || ""}</div>
    </div>`;
  }).join("");
  return `
  <div class="panel" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:14px">
      <div class="ovr-box" style="width:56px;height:56px">
        <div class="num" style="font-size:14px">${(acc.handle || "").replace("@","").slice(0,3)}</div>
      </div>
      <div>
        <div style="font-size:18px;font-weight:800">${acc.displayName}</div>
        <div class="muted">${acc.handle} · ${Math.round((acc.followers || 0) / 1000)}k followers ${acc.verified ? "· Verified" : ""}</div>
      </div>
    </div>
  </div>
  ${posts || '<div class="panel muted">No official posts yet — play matchdays.</div>'}`;
}

function renderTransfers() {
  const list = (hub.transfers || hub.recentTransfers || []).slice(0, 20);
  return `
  <div class="panel" style="padding:0;overflow:hidden">
    <table class="data">
      <thead><tr><th>Player</th><th>From</th><th>To</th><th>Fee</th><th>Type</th></tr></thead>
      <tbody>
        ${list.map((t) => `
          <tr>
            <td>${t.playerName || t.player || "—"}</td>
            <td>${t.from || t.fromClub || "—"}</td>
            <td>${t.to || t.toClub || "—"}</td>
            <td>${t.feeLabel || fmtVal(t.fee) || "—"}</td>
            <td><span class="pos-badge">${t.type || "Transfer"}</span></td>
          </tr>`).join("") || '<tr><td colspan="5" class="muted">No recent transfers</td></tr>'}
      </tbody>
    </table>
  </div>`;
}

function renderDev() {
  const p = hub.player || {};
  return `
  <div class="grid-2">
    <div class="hero-card">
      <div class="hero-top">
        <div class="ovr-box"><div class="num">${p.ovr ?? "—"}</div><div class="pos">${p.position || ""}</div></div>
        <div class="hero-info">
          <h2>${p.name || "—"}</h2>
          <div class="club">Potential ${p.potential ?? "—"} · Age ${p.age ?? "—"}</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${p.form ?? "—"}</div><div class="l">Form</div></div>
        <div class="hero-stat"><div class="v">${p.fitness ?? "—"}</div><div class="l">Fitness</div></div>
        <div class="hero-stat"><div class="v">${p.morale ?? "—"}</div><div class="l">Morale</div></div>
        <div class="hero-stat"><div class="v">${p.managerTrust ?? "—"}</div><div class="l">Trust</div></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Training focus</h3></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn" data-act="train" data-focus="Technical">Technical session</button>
        <button class="btn secondary" data-act="train" data-focus="Physical">Physical session</button>
        <button class="btn secondary" data-act="train" data-focus="Mental">Mental session</button>
        <button class="btn secondary" data-act="train" data-focus="Position">Position mastery</button>
      </div>
      <p class="muted" style="margin-top:14px;line-height:1.45">Training raises attributes over time. High form and manager trust improve selection odds.</p>
    </div>
  </div>`;
}

function renderPress() {
  const qs = press?.questions || [];
  if (!qs.length) {
    return `<div class="panel">
      <p class="muted" style="margin-bottom:12px">No press questions yet. Play a matchday after you feature, then return here.</p>
      <button class="btn secondary" data-act="refreshPress">Refresh press pool</button>
    </div>`;
  }
  return qs.map((q) => `
    <div class="press-q">
      <div class="muted" style="font-size:11px;margin-bottom:6px">${q.journalist || "Journalist"} · ${q.outlet || "Press"}</div>
      <div class="q">${q.question || q.text}</div>
      <div class="opts">
        ${(q.responses || q.choices || []).map((c) => `
          <button data-act="answerPress" data-qid="${q.id}" data-rid="${c.id}">${c.label || c.text}</button>
        `).join("")}
      </div>
    </div>`).join("") +
    `<button class="btn secondary sm" data-act="refreshPress" style="margin-top:8px">Refresh</button>`;
}

function renderNews() {
  const items = hub.news || [];
  return items.slice(0, 30).map((n) => {
    const imp = (n.importance || "").toLowerCase();
    const badge = imp === "breaking" ? "breaking" : "";
    return `
    <div class="feed-card">
      <div class="badge ${badge}">${n.importance || "News"} · ${n.category || ""}</div>
      <div class="headline">${n.headline || n.title || "—"}</div>
      <div class="body">${n.body || ""}</div>
      <div class="meta">${n.timestamp || n.date || ""}</div>
    </div>`;
  }).join("") || `<div class="panel muted">No news yet — the feed only fills from real simulation events.</div>`;
}

function renderInbox() {
  return `
  <div class="panel">
    <table class="data">
      <thead><tr><th>From</th><th>Message</th></tr></thead>
      <tbody>
        <tr><td style="font-weight:700">Manager</td><td class="muted">Selection is competitive. Train, stay fit, deliver when called.</td></tr>
        <tr><td style="font-weight:700">Agent</td><td class="muted">I'll push for minutes when your form justifies it.</td></tr>
        <tr><td style="font-weight:700">Club media</td><td class="muted">Official posts appear under Club Social after fixtures and results.</td></tr>
      </tbody>
    </table>
  </div>`;
}

function renderSquad() {
  const players = squad?.players || [];
  return `
  <div class="panel" style="padding:0;overflow:hidden">
    <table class="data">
      <thead><tr><th>Pos</th><th>Name</th><th>Age</th><th>OVR</th><th>POT</th><th>Value</th></tr></thead>
      <tbody>
        ${players.map((pl) => `
          <tr class="${hub.player && pl.id === hub.player.id ? "me" : ""}">
            <td><span class="pos-badge">${pl.position || pl.pos || ""}</span></td>
            <td>${pl.name || pl.displayName}</td>
            <td>${pl.age ?? "—"}</td>
            <td><b>${pl.ovr ?? "—"}</b></td>
            <td>${pl.potential ?? "—"}</td>
            <td>${pl.marketValueLabel || fmtVal(pl.marketValue) || "—"}</td>
          </tr>`).join("") || '<tr><td colspan="6" class="muted">No squad data</td></tr>'}
      </tbody>
    </table>
  </div>`;
}

function renderMarket() {
  const players = market?.players || [];
  return `
  <div class="panel" style="padding:0;overflow:hidden">
    <table class="data">
      <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Age</th><th>OVR</th><th>Club</th><th>Value</th></tr></thead>
      <tbody>
        ${players.slice(0, 100).map((pl, i) => `
          <tr>
            <td class="muted">${i + 1}</td>
            <td>${pl.name || pl.displayName}</td>
            <td><span class="pos-badge">${pl.position || ""}</span></td>
            <td>${pl.age ?? "—"}</td>
            <td><b>${pl.ovr ?? "—"}</b></td>
            <td class="muted">${pl.club || "—"}</td>
            <td style="color:var(--accent);font-weight:700">${pl.marketValueLabel || fmtVal(pl.marketValue)}</td>
          </tr>`).join("") || '<tr><td colspan="7" class="muted">No market data</td></tr>'}
      </tbody>
    </table>
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
          toast("Training session completed · " + focus);
        } else if (act === "advance") {
          const r = await api("/api/advance", { method: "POST", body: "{}" });
          if (r.done) toast(r.message);
          else {
            const nq = (r.pressQuestions || []).length;
            toast(`Matchday ${r.matchday} · ${r.matchesPlayed} matches` + (nq ? ` · ${nq} press Qs` : ""));
            if (nq) setView("press");
          }
        } else if (act === "endSeason") {
          await api("/api/season/end", { method: "POST", body: "{}" });
          toast("Season ended · trophies awarded");
        } else if (act === "nextSeason") {
          await api("/api/season/next", { method: "POST", body: "{}" });
          toast("New season · transfer window open");
        } else if (act === "save") {
          await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
          toast("Career saved");
        } else if (act === "agent") {
          const r = await api("/api/agent");
          toast(r.advice?.summary || JSON.stringify(r.advice || r).slice(0, 140));
        } else if (act === "answerPress") {
          const r = await api("/api/press/answer", {
            method: "POST",
            body: JSON.stringify({
              questionId: btn.getAttribute("data-qid"),
              responseId: btn.getAttribute("data-rid"),
            }),
          });
          toast(r.narrative || "Answer submitted");
          try { press = await api("/api/press"); } catch {}
        } else if (act === "refreshPress") {
          await api("/api/press");
          try { press = await api("/api/press"); } catch {}
          toast("Press pool refreshed");
        }
        await refresh();
      } catch (e) {
        toast(e.message || String(e));
      } finally {
        btn.disabled = false;
      }
    };
  });
}

document.querySelectorAll("#sideNav button").forEach((b) => {
  b.addEventListener("click", () => setView(b.getAttribute("data-view")));
});

const createForm = $("createForm");
if (createForm) {
  createForm.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(createForm);
    const body = {
      firstName: String(fd.get("firstName") || "Jordan").trim(),
      lastName: String(fd.get("lastName") || "Vale").trim(),
      position: String(fd.get("position") || "RW"),
      preferredFoot: String(fd.get("preferredFoot") || "Right"),
      physicalProfile: String(fd.get("physicalProfile") || "Athletic"),
      nationality: String(fd.get("nationality") || "England"),
      age: Number(fd.get("age") || 17),
      potential: Number(fd.get("potential") || 86),
    };
    const h = fd.get("heightCm");
    if (h) body.heightCm = Number(h);

    const btn = $("btnStart");
    if (btn) btn.disabled = true;
    try {
      const result = await api("/api/career/start", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await refresh();
      $("gate").classList.add("hidden");
      $("app").classList.remove("hidden");
      const foot = body.preferredFoot;
      const club = result?.club?.name || hub?.player?.club || "your club";
      toast(`${body.firstName} ${body.lastName} · ${foot}-footed ${body.position} at ${club}`);
    } catch (e) {
      toast(e.message || String(e));
      if (btn) btn.disabled = false;
    }
  };
}

$("btnTrain").onclick = () => {
  const b = document.createElement("button");
  b.setAttribute("data-act", "train");
  document.body.appendChild(b);
  bindActions();
  b.click();
  b.remove();
};
$("btnMatchday").onclick = () => {
  const b = document.createElement("button");
  b.setAttribute("data-act", "advance");
  document.body.appendChild(b);
  bindActions();
  b.click();
  b.remove();
};

api("/api/status")
  .then((s) => {
    if (s?.careerStarted) {
      refresh().then(() => {
        $("gate").classList.add("hidden");
        $("app").classList.remove("hidden");
      });
    }
  })
  .catch(() => {});
