/** In-match decisions — overrides Play match to pause for choices */
(function () {
  window.liveMatch = window.liveMatch || null;

  function showDecision(state) {
    window.liveMatch = state;
    const content = document.getElementById("content");
    if (!content || !state?.moment) return false;
    const mom = state.moment;
    const actions = (mom.actions || [])
      .map(
        (a) =>
          `<button class="btn" style="width:100%;margin:6px 0" data-live-choice="${a.id}">${a.label}</button>`
      )
      .join("");
    const last = state.lastOutcome
      ? `<p class="muted">${state.lastOutcome.success ? "✅" : "❌"} ${state.lastOutcome.description}</p>`
      : "";
    content.innerHTML = `<div class="anim-stagger"><div class="card">
      <div class="pill">Decision ${(state.momentsResolved || 0) + 1} / ${state.momentsPlanned || 3}</div>
      <h2 style="margin:10px 0 6px">${mom.minute}' — Your moment</h2>
      <p style="font-size:15px;line-height:1.45">${mom.description || ""}</p>
      ${last}
      <div style="margin-top:12px">${actions}</div>
      <button class="ghost" style="width:100%;margin-top:10px" data-live-skip="1">Skip rest of match</button>
    </div></div>`;
    return true;
  }

  async function finishMatch() {
    const res = await api("/api/match/finish", { method: "POST", body: "{}" });
    window.liveMatch = null;
    await refresh();
    if (typeof loadMatchStats === "function") await loadMatchStats();
    setView("match");
    const st = res.state || {};
    const score =
      st.homeScore != null ? `${st.homeScore}-${st.awayScore}` : st.score;
    toast(score ? `Full time ${score}` : "Full time");
  }

  document.body.addEventListener(
    "click",
    async (e) => {
      const choice = e.target.closest("[data-live-choice]");
      if (choice) {
        e.preventDefault();
        e.stopPropagation();
        const id = choice.getAttribute("data-live-choice");
        try {
          const res = await api("/api/match/action", {
            method: "POST",
            body: JSON.stringify({ actionId: id }),
          });
          if (res.outcome) toast(res.outcome.description || "...");
          if (res.finished) {
            window.liveMatch = null;
            await refresh();
            if (typeof loadMatchStats === "function") await loadMatchStats();
            setView("match");
            toast(res.state?.score ? `Full time ${res.state.score}` : "Full time");
          } else {
            showDecision(res.state);
          }
        } catch (err) {
          toast(err.message || String(err));
        }
        return;
      }
      if (e.target.closest("[data-live-skip]")) {
        e.preventDefault();
        e.stopPropagation();
        try {
          await finishMatch();
        } catch (err) {
          toast(err.message || String(err));
        }
        return;
      }

      const t = e.target.closest('[data-action="match-start"]');
      if (!t) return;
      // Intercept Play match → decisions instead of instant FT
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        toast("Kick-off — make your decisions");
        const res = await api("/api/match/start", { method: "POST", body: "{}" });
        if (res.error) throw new Error(res.error);
        if (res.state?.moment) {
          setView("match");
          showDecision(res.state);
        } else {
          await finishMatch();
        }
      } catch (err) {
        toast(err.message || String(err));
      }
    },
    true
  );
})();
