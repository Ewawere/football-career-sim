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
      <p class="muted" style="margin-top:14px;line-height:1.45">Training raises attributes over time. High form and manager trust improve selection odds — same loop as FM development plans.</p>
    </div>
  </div>`;
}
