function bindNav() {
  document.querySelectorAll("#bottomNav button[data-view]").forEach((btn) => {
    btn.onclick = () => {
      const v = btn.getAttribute("data-view");
      setView(v);
      if (v === "match") {
        loadMatchStats();
        loadComparison();
      }
    };
  });
}

let lastComparison = null;

async function loadComparison() {
  try {
    const data = await api("/api/comparison");
    lastComparison = data.comparison || null;
    if (hub) hub.teamComparison = lastComparison;
    if (view === "match") render();
  } catch (_) {
    /* optional */
  }
}
window.loadComparison = loadComparison;

function bindActions() {
  document.body.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    try {
      if (action === "set-view") {
        const v = t.getAttribute("data-view") || "hub";
        setView(v);
        if (v === "match") {
          loadMatchStats();
          loadComparison();
        }
        return;
      }
      if (action === "advance") {
        toast("Advancing…");
        await api("/api/advance", { method: "POST", body: "{}" });
        await refresh();
        await loadMatchStats();
        await loadComparison();
        toast("Matchday done");
      } else if (action === "train") {
        await api("/api/train", {
          method: "POST",
          body: JSON.stringify({ focus: t.getAttribute("data-focus") || "Tactical" }),
        });
        await refresh();
        toast("Training complete");
      } else if (action === "ps-spend") {
        const res = await api("/api/playstyle/spend", {
          method: "POST",
          body: JSON.stringify({ playStyleId: t.getAttribute("data-id") }),
        });
        await refresh();
        toast(res.ok ? "PlayStyle progress" : res.message || "Not yet");
      } else if (action === "claim-obj") {
        await api("/api/objectives/claim", {
          method: "POST",
          body: JSON.stringify({ objectiveId: t.getAttribute("data-id") }),
        });
        await refresh();
        toast("Claimed");
      } else if (action === "neg-open") {
        await api("/api/negotiation/open", { method: "POST", body: "{}" });
        await refresh();
        setView("career");
        toast("Talks opened");
      } else if (action === "neg-respond") {
        await api("/api/negotiation/respond", {
          method: "POST",
          body: JSON.stringify({ action: t.getAttribute("data-neg") || "mediate" }),
        });
        await refresh();
      } else if (action === "jobs-refresh") {
        await api("/api/jobs/refresh", { method: "POST", body: "{}" });
        await refresh();
        toast("Market scanned");
      } else if (action === "job-accept") {
        const res = await api("/api/jobs/accept", {
          method: "POST",
          body: JSON.stringify({ offerId: t.getAttribute("data-id") }),
        });
        await refresh();
        toast(res.ok ? "Job accepted" : "Failed");
      } else if (action === "match-start") {
        await loadComparison();
        await api("/api/match/start", { method: "POST", body: "{}" });
        toast("Match live");
        setView("match");
        await refresh();
      } else if (action === "match-finish") {
        await api("/api/match/finish", { method: "POST", body: "{}" });
        await refresh();
        await loadMatchStats();
        setView("match");
        toast("Full time");
      } else if (action === "save") {
        await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
        toast("Saved");
      } else if (action === "refresh-cmp") {
        await loadComparison();
        toast("Preview refreshed");
      }
    } catch (err) {
      console.error(action, err);
      toast(err.message || String(err));
    }
  });
}

async function startCareerFromGate() {
  const firstName = document.getElementById("firstName")?.value || "Jordan";
  const lastName = document.getElementById("lastName")?.value || "Okonkwo";
  const position = document.getElementById("position")?.value || "RW";
  toast("Building world…");
  const res = await api("/api/start", {
    method: "POST",
    body: JSON.stringify({ firstName, lastName, position, age: 17, potential: 85 }),
  });
  if (res.error) throw new Error(res.error);
  document.getElementById("gate")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
  await refresh();
  setView("hub");
  toast("Career started");
}

function boot() {
  bindNav();
  bindActions();
  const startBtn = document.getElementById("startCareer");
  if (startBtn) startBtn.onclick = () => startCareerFromGate().catch((e) => toast(e.message || e));
  api("/api/status")
    .then((s) => {
      if (s?.careerStarted) {
        refresh().then(() => {
          document.getElementById("gate")?.classList.add("hidden");
          document.getElementById("app")?.classList.remove("hidden");
        });
      }
    })
    .catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
