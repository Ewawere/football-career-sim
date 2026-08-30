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
  return items.slice(0, 40).map((n) => {
    return `
    <div class="feed-card">
      <div class="badge ${newsBadgeClass(n)}">${n.importance || "News"}${n.category ? " · " + n.category : ""}</div>
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
        <tr><td style="font-weight:700">Agent</td><td class="muted">I'll push for minutes when your form justifies it. Don't force a move early.</td></tr>
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
