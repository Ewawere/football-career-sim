/** Career extras: transfer offers panel */
(function () {
  async function enhanceCareer() {
    const content = document.getElementById("content");
    if (!content || content.querySelector("[data-transfer-panel]")) return;
    let offers = [];
    try {
      const hub = await api("/api/hub");
      offers = hub.transferOffers || [];
    } catch (_) {}
    const panel = document.createElement("div");
    panel.className = "card";
    panel.setAttribute("data-transfer-panel", "1");
    panel.style.marginTop = "12px";
    panel.innerHTML =
      `<h3>Transfer interest</h3>
      <p class="muted">${offers.length ? "Clubs from other leagues are watching" : "Play well to get scouted across leagues"}</p>
      <button class="ghost" type="button" data-action="scout-refresh">Scan scouting interest</button>
      ${offers
        .map(
          (o) =>
            `<div class="unlock-row"><div style="flex:1"><div class="unlock-title">${o.fromClubName}</div>
            <div class="muted">${o.leagueLabel} · ${o.wageLabel} · ${o.feeLabel}<br>${o.roleNote || ""}</div></div>
            <button class="sp-btn" type="button" data-action="transfer-accept" data-id="${o.id}">Join</button>
            <button class="ghost" type="button" data-action="transfer-decline" data-id="${o.id}">No</button></div>`
        )
        .join("")}`;
    content.appendChild(panel);
  }

  const origSetView = window.setView;
  if (origSetView) {
    window.setView = function (v) {
      origSetView(v);
      if (v === "career") setTimeout(enhanceCareer, 50);
    };
  }
  const origRefresh = window.refresh;
  if (origRefresh) {
    window.refresh = async function () {
      await origRefresh();
      try {
        if (typeof view !== "undefined" && view === "career") enhanceCareer();
      } catch (_) {}
    };
  }
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      try {
        if (typeof view !== "undefined" && view === "career") enhanceCareer();
      } catch (_) {}
    }, 500);
  });
})();
