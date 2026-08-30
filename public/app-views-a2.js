function renderMatchStats() {
  const m = matchStats;
  if (!m || m.error || !m.home) {
    return `<div class="panel muted">No finished match for your club yet — hit <b>Play Matchday</b>.</div>`;
  }
  const hs = m.home.stats || {};
  const as = m.away.stats || {};
  const posH = hs.possession ?? 50;
  const posA = as.possession ?? 50;
  const safe = (v, d = 0) => (v == null ? d : v);
  const rows = [
    ["xG", safe(hs.xG), safe(as.xG), true],
    ["Shots", safe(hs.shots), safe(as.shots), false],
    ["On target", safe(hs.shotsOnTarget), safe(as.shotsOnTarget), false],
    ["Big chances", safe(hs.bigChances), safe(as.bigChances), false],
    ["Passes", safe(hs.accuratePasses), safe(as.accuratePasses), false],
    ["Pass %", safe(hs.passAccuracy), safe(as.passAccuracy), false],
    ["Corners", safe(hs.corners), safe(as.corners), false],
    ["Fouls", safe(hs.fouls), safe(as.fouls), false],
  ];
  const barRows = rows.map(([lab, h, a, isFloat]) => {
    const hv = isFloat ? Number(h).toFixed(2) : h;
    const av = isFloat ? Number(a).toFixed(2) : a;
    const total = (Number(h) || 0) + (Number(a) || 0) || 1;
    const hw = Math.round((Number(h) / total) * 100);
    const aw = 100 - hw;
    return `<div class="stat-bar-row">
      <div class="num r">${hv}</div>
      <div><div class="lab">${lab}</div><div class="mini-bar"><div class="h" style="width:${hw}%"></div><div class="a" style="width:${aw}%"></div></div></div>
      <div class="num">${av}</div>
    </div>`;
  }).join("");

  const me = (m.ratings || []).find((r) => hub.player && r.id === hub.player.id);
  const myRating = me ? me.rating : null;
  const impact = myRating == null ? null : {
    rating: myRating,
    trust: myRating >= 7.5 ? "+" + Math.round((myRating - 6.5) * 4) : myRating < 6 ? String(Math.round((myRating - 6.5) * 3)) : "+1",
    rep: myRating >= 8 ? "+6" : myRating >= 7 ? "+3" : myRating < 5.5 ? "-2" : "0",
    fans: myRating >= 8 ? "+10" : myRating >= 7 ? "+4" : myRating < 5.5 ? "-4" : "0",
  };

  const ratingsHtml = (m.ratings || []).slice(0, 14).map((r) => `
    <div class="rating-row ${hub.player && r.id === hub.player.id ? "me" : ""}">
      <div class="r-name">${r.name}<div class="r-meta">${r.minutes}' · ${r.goals}G ${r.assists}A</div></div>
      <span class="rating ${ratingClass(r.rating)}">${r.rating}</span>
    </div>`).join("") || '<div class="muted" style="padding:12px">No ratings</div>';

  return `
  <div class="panel" style="margin-bottom:14px">
    <div class="match-score">
      <div class="teams">${m.home.name || "Home"} <span class="score-num">${m.score}</span> ${m.away.name || "Away"}</div>
    </div>
    <div class="poss-bar">
      <div class="h" style="width:${posH}%">${posH}%</div>
      <div class="a" style="width:${posA}%">${posA}%</div>
    </div>
  </div>
  <div class="match-layout">
    <div class="panel">
      <div class="panel-head"><h3>Match stats</h3></div>
      ${barRows}
    </div>
    <div class="panel" style="padding:0;overflow:hidden">
      <div class="panel-head" style="padding:14px 16px;margin:0"><h3>Player ratings</h3></div>
      ${ratingsHtml}
    </div>
    <div class="impact-col panel">
      <div class="panel-head"><h3>Career impact</h3></div>
      ${impact ? `
        <div class="big-rating">
          <div class="br-num">${impact.rating}</div>
          <div class="br-label">Your match rating</div>
        </div>
        <div class="impact-stat"><span>Manager trust</span><span class="delta ${String(impact.trust).startsWith("-") ? "neg" : ""}">${impact.trust}</span></div>
        <div class="impact-stat"><span>Reputation</span><span class="delta ${String(impact.rep).startsWith("-") ? "neg" : ""}">${impact.rep}</span></div>
        <div class="impact-stat"><span>Fan sentiment</span><span class="delta ${String(impact.fans).startsWith("-") ? "neg" : ""}">${impact.fans}</span></div>
        <div class="muted" style="font-size:11px;margin-top:8px">Estimates from rating — real deltas apply in simulation after full-time.</div>
      ` : `<div class="muted">You did not feature in this match (or no minutes). Play and earn selection to see career impact here.</div>`}
    </div>
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
    const badgeClass = String(tag).includes("next") ? "next-match" : String(tag).includes("result") || String(tag).includes("full") ? "breaking" : "club";
    const handle = (acc.handle || "@club").replace("@", "");
    return `
    <div class="social-card">
      <div class="sc-head">
        ${crestSlot(acc.displayName || handle, 40)}
        <div>
          <div style="font-weight:800;font-size:13px">${p.authorLabel || acc.displayName}</div>
          <div class="badge ${badgeClass}" style="margin:4px 0 0">${String(tag).replace(/-/g, " ")}</div>
        </div>
      </div>
      <div class="sc-body">${p.content}</div>
      <div class="sc-foot">
        <span>♥ ${p.engagement || 0}</span>
        <span>${p.timestamp || ""}</span>
      </div>
    </div>`;
  }).join("");
  return `
  <div class="panel" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:14px">
      ${crestSlot(acc.displayName || acc.handle, 56)}
      <div>
        <div style="font-size:18px;font-weight:800">${acc.displayName}</div>
        <div class="muted">${acc.handle} · ${Math.round((acc.followers || 0) / 1000)}k followers ${acc.verified ? "· Verified" : ""}</div>
      </div>
    </div>
  </div>
  <div class="social-grid">${posts || '<div class="panel muted">No official posts yet — play matchdays.</div>'}</div>`;
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
