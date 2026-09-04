/** FM-style team comparison renderer — loaded after app-core */
function formPills(form) {
  const s = String(form || "—");
  if (s === "—" || !s) return `<span class="muted">—</span>`;
  return [...s]
    .map((c) => {
      const cls = c === "W" ? "w" : c === "D" ? "d" : "l";
      return `<span class="form-pill ${cls}">${c}</span>`;
    })
    .join("");
}

function renderTeamCol(t, crestFn) {
  if (!t) return "";
  const crest = typeof clubCrest === "function" ? clubCrest(t.name, 40, "crest-img md") : "";
  const last = (t.last5 || [])
    .map(
      (g) =>
        `<div class="muted" style="font-size:11px">${g.result} ${g.score} vs ${g.vs} (${g.home ? "H" : "A"})</div>`
    )
    .join("");
  return `
  <div class="team-col">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      ${crest}
      <div>
        <div style="font-weight:800;font-size:14px">${t.name}</div>
        <div class="muted">${t.formLabel}${t.tablePos != null ? ` · ${t.tablePos}th` : ""}</div>
      </div>
    </div>
    <div style="margin:8px 0">${formPills(t.form)}</div>
    <div class="muted" style="margin-bottom:6px">Morale: ${t.moraleLabel}</div>
    <div class="muted">GF/GA avg ${t.avgGoalsFor} / ${t.avgGoalsAgainst}</div>
    <div style="margin-top:8px">${last || `<span class="muted">No recent results</span>`}</div>
  </div>`;
}

function renderTeamComparison(cmp) {
  if (!cmp) {
    return `<div class="card"><h3>Team comparison</h3><p class="muted">Advance the calendar to load a fixture preview.</p></div>`;
  }
  const chatter = [...(cmp.home?.chatter || []), ...(cmp.away?.chatter || [])]
    .slice(0, 5)
    .map((c) => `<li>${c}</li>`)
    .join("");
  const edges = (cmp.edges || []).map((e) => `<li>${e}</li>`).join("");
  return `
  <div class="card">
    <div class="section-label">Pre-match · FM intel</div>
    <h3 style="margin-bottom:4px">${cmp.headline || "Team comparison"}</h3>
    <p class="muted">${cmp.date || ""} · ${cmp.competition || "League"} · ${cmp.venue || ""}</p>
    <p style="margin:10px 0;font-size:13px;line-height:1.45">${cmp.preview || ""}</p>
    <div class="cmp-grid">
      ${renderTeamCol(cmp.home)}
      <div class="cmp-vs">VS</div>
      ${renderTeamCol(cmp.away)}
    </div>
    <div style="margin-top:12px">
      <div class="muted" style="font-weight:700;margin-bottom:4px">Form room chatter</div>
      <ul class="chatter">${chatter}</ul>
    </div>
    <div style="margin-top:10px">
      <div class="muted" style="font-weight:700;margin-bottom:4px">Edges</div>
      <ul class="chatter">${edges}</ul>
    </div>
  </div>`;
}

window.renderTeamComparison = renderTeamComparison;
window.formPills = formPills;
