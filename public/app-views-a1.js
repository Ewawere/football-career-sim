function renderOverview() {
  const p = hub.player || {};
  const pos = hub.table?.find((r) => r.clubId === p.clubId);
  const clubForm = pos?.form || "";
  const news = (hub.news || []).slice(0, 6);
  const trust = Math.max(0, Math.min(100, p.managerTrust ?? 50));
  return `
  <div class="hub-grid">
    <div class="hero-card">
      <div class="hero-top">
        ${faceSlot(p, 72)}
        <div class="ovr-box">
          <div class="num">${p.ovr ?? "—"}</div>
          <div class="pos">${p.position || ""}</div>
        </div>
        <div class="hero-info">
          <h2>${p.name || "—"}</h2>
          <div class="club" style="display:flex;align-items:center;gap:8px;margin-top:6px">
            ${crestSlot(p.club, 22)}
            <span>${p.club || "Free agent"} · Age ${p.age ?? "—"}</span>
          </div>
          <div class="foot-pill">${p.preferredFoot || "—"} foot · ${p.nationality || ""} · ${p.heightCm ? p.heightCm + "cm" : ""}</div>
        </div>
      </div>
      <div class="value-line">${p.marketValueLabel || fmtVal(p.marketValue) || "—"} market value</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="v">${p.form ?? "—"}</div><div class="l">Form</div></div>
        <div class="hero-stat"><div class="v">${p.fitness ?? "—"}</div><div class="l">Fitness</div></div>
        <div class="hero-stat"><div class="v">${p.morale ?? "—"}</div><div class="l">Morale</div></div>
        <div class="hero-stat"><div class="v">${p.potential ?? "—"}</div><div class="l">Potential</div></div>
      </div>
      <div style="margin-top:14px;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Manager trust · ${trust}</div>
      <div class="trust-bar"><span style="width:${trust}%"></span></div>
      <div class="hero-stats" style="margin-top:14px">
        <div class="hero-stat"><div class="v">${p.apps ?? 0}</div><div class="l">Apps</div></div>
        <div class="hero-stat"><div class="v">${p.goals ?? 0}</div><div class="l">Goals</div></div>
        <div class="hero-stat"><div class="v">${p.assists ?? 0}</div><div class="l">Assists</div></div>
        <div class="hero-stat"><div class="v">${p.reputation ?? "—"}</div><div class="l">Rep</div></div>
      </div>
    </div>

    <div>
      <div class="next-match-card">
        <div class="nm-label">Club status</div>
        <div class="nm-teams" style="display:flex;align-items:center;gap:10px">${crestSlot(p.club, 28)}<span>${p.club || "—"} · ${ord(pos?.pos)} place</span></div>
        <div class="nm-meta">${pos ? `${pos.pts} pts · ${pos.played} played · GD ${pos.gd > 0 ? "+" + pos.gd : pos.gd}` : "Play matchdays to fill the table"}</div>
        ${formPills(clubForm)}
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" data-act="advance">Play Matchday</button>
          <button class="btn secondary" data-act="train">Train</button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Season snapshot</h3></div>
        <div class="grid-4">
          <div class="stat-tile"><div class="label">League</div><div class="value">${ord(pos?.pos)}</div><div class="hint">${pos?.pts ?? "—"} pts</div></div>
          <div class="stat-tile"><div class="label">Apps</div><div class="value">${p.apps ?? 0}</div><div class="hint">This season</div></div>
          <div class="stat-tile"><div class="label">G / A</div><div class="value">${p.goals ?? 0}/${p.assists ?? 0}</div><div class="hint">Goals · Assists</div></div>
          <div class="stat-tile"><div class="label">Wage</div><div class="value" style="font-size:16px">${p.wage ? "€" + Math.round(p.wage / 1000) + "k" : "—"}</div><div class="hint">Weekly</div></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Quick actions</h3></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn secondary sm" data-act="endSeason">End Season</button>
          <button class="btn secondary sm" data-act="nextSeason">Next Season</button>
          <button class="btn secondary sm" data-act="save">Save</button>
          <button class="btn secondary sm" data-act="agent">Agent Advice</button>
        </div>
      </div>
    </div>

    <div class="hub-news news-stack">
      <div class="panel" style="margin-bottom:10px">
        <div class="panel-head" style="margin-bottom:8px;padding-bottom:8px"><h3>Storylines</h3></div>
        ${(hub.threads || []).slice(0, 4).map((t) => `
          <div class="feed-card" style="padding:10px 12px">
            <div class="badge ${t.status === "active" ? "club" : ""}">${t.kind} · ${t.status}</div>
            <div class="headline" style="font-size:13px">${t.title}</div>
            <div class="meta">${t.latestBeat || ""} · ${t.beatCount || 0} beats</div>
          </div>`).join("") || '<div class="muted" style="padding:6px 0">No active storylines yet — they grow from loans, form, transfers and awards.</div>'}
      </div>
      <div class="panel" style="margin-bottom:10px">
        <div class="panel-head" style="margin-bottom:8px;padding-bottom:8px"><h3>News & media</h3></div>
        ${news.map((n) => `
          <div class="feed-card" style="padding:12px 14px">
            <div class="badge ${newsBadgeClass(n)}">${n.importance || "News"}${n.category ? " · " + n.category : ""}</div>
            <div class="headline" style="font-size:13px">${n.headline || "—"}</div>
            <div class="meta">${n.date || ""}</div>
          </div>`).join("") || '<div class="muted" style="padding:8px 0">No stories yet — play matchdays. News only fires from real events.</div>'}
      </div>
    </div>
  </div>`;
}

function renderLeague() {
  const rows = (hub.table || []).map((r, i) => `
    <tr class="${hub.player && r.clubId === hub.player.clubId ? "me" : ""}">
      <td><b>${r.pos ?? i + 1}</b></td>
      <td style="display:flex;align-items:center;gap:8px">${crestSlot(r.club || r.name || r.clubName, 20)}<span>${r.club || r.name || r.clubName || "—"}</span></td>
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
