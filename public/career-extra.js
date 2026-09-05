/** Career extras: transfer offers panel + contract safety note */
(function () {
  const _render = window.render;
  if (!_render) return;
  // Hook after career view renders
  const origSetView = window.setView;
  window.setView = function (v) {
    origSetView(v);
    if (v === "career") enhanceCareer();
  };
  async function enhanceCareer() {
    const content = document.getElementById("content");
    if (!content) return;
    let offers = [];
    try {
      const hub = await api("/api/hub");
      offers = hub.transferOffers || [];
      window.hubData = hub;
    } catch (_) {}
    if (content.querySelector("[data-transfer-panel]")) return;
    const panel = document.createElement("div");
    panel.className = "card";
    panel.setAttribute("data-transfer-panel", "1");
    panel.innerHTML =
      `<h3>Transfer interest</h3>
      <p class="muted">${offers.length ? "Clubs watching you" : "Play well to get scouted from other leagues"}</p>
      <button class="ghost" data-action="scout-refresh">Scan scouting interest</button>
      ${offers
        .map(
          (o) =>
            `<div class="unlock-row"><div style="flex:1"><div class="unlock-title">${o.fromClubName}</div>
            <div class="muted">${o.leagueLabel} · ${o.wageLabel} · ${o.feeLabel}<br>${o.roleNote || ""}</div></div>
            <button class="sp-btn" data-action="transfer-accept" data-id="${o.id}">Join</button>
            <button class="ghost" data-action="transfer-decline" data-id="${o.id}">No</button></div>`
        )
        .join("")}`;
    content.appendChild(panel);
  }
  // After refresh, if on career
  const _refresh = window.refresh;
  if (_refresh) {
    window.refresh = async function () {
      await _refresh();
      if (typeof view !== "undefined" && view === "career") enhanceCareer();
    };
  }
})();
