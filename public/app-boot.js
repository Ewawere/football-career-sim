function bindNav() {
  document.querySelectorAll("#bottomNav button[data-view], #sideNav button[data-view]").forEach((btn) => {
    btn.onclick = () => setView(btn.getAttribute("data-view"));
  });
}

function bindActions() {
  document.body.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    try {
      if (action === "advance") {
        await api("/api/advance", { method: "POST", body: "{}" });
        await refresh();
        toast("Matchday advanced");
      } else if (action === "train") {
        await api("/api/train", {
          method: "POST",
          body: JSON.stringify({ focus: t.getAttribute("data-focus") || "Tactical" }),
        });
        await refresh();
        toast("Training complete");
      } else if (action === "claim-obj") {
        await api("/api/objectives/claim", {
          method: "POST",
          body: JSON.stringify({ objectiveId: t.getAttribute("data-id") }),
        });
        await refresh();
        toast("Objective claimed");
      } else if (action === "inbox-read") {
        await api("/api/inbox/read", {
          method: "POST",
          body: JSON.stringify({ id: t.getAttribute("data-id") }),
        });
        await refresh();
      } else if (action === "set-role") {
        await api("/api/roles", {
          method: "POST",
          body: JSON.stringify({
            role: t.getAttribute("data-role"),
            instruction: t.getAttribute("data-instruction"),
          }),
        });
        await refresh();
        toast("Role updated");
      } else if (action === "neg-open") {
        await api("/api/negotiation/open", { method: "POST", body: "{}" });
        await refresh();
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
        toast("Job market scanned");
      } else if (action === "job-accept") {
        const res = await api("/api/jobs/accept", {
          method: "POST",
          body: JSON.stringify({ offerId: t.getAttribute("data-id") }),
        });
        await refresh();
        toast(res.ok ? "Job accepted" : "Could not accept");
      } else if (action === "job-decline") {
        await api("/api/jobs/decline", {
          method: "POST",
          body: JSON.stringify({ offerId: t.getAttribute("data-id") }),
        });
        await refresh();
        toast("Declined");
      } else if (action === "match-start") {
        await api("/api/match/start", { method: "POST", body: "{}" });
        await refresh();
        toast("Match started");
      } else if (action === "match-finish") {
        await api("/api/match/finish", { method: "POST", body: "{}" });
        await refresh();
        toast("Full time");
      } else if (action === "save") {
        await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
        toast("Saved");
      }
    } catch (err) {
      console.error(action, err);
      toast(err.message || String(err));
    }
  });
}

async function startCareerFromGate() {
  const firstName = document.getElementById("firstName")?.value || "Alex";
  const lastName = document.getElementById("lastName")?.value || "Vale";
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
