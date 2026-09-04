function bindNav() {
  document.querySelectorAll("#bottomNav button[data-view]").forEach((btn) => {
    btn.onclick = () => {
      const v = btn.getAttribute("data-view");
      setView(v);
      if (v === "match") {
        loadMatchStats();
        if (typeof loadComparison === "function") loadComparison();
      }
    };
  });
}

let lastComparison = null;
let selectedClubId = null;
let pendingIdentity = null;

async function loadComparison() {
  try {
    const data = await api("/api/comparison");
    lastComparison = data.comparison || null;
    window.lastComparison = lastComparison;
    if (hub) hub.teamComparison = lastComparison;
    if (view === "match") render();
  } catch (_) {}
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

function showClubStep(clubs) {
  const list = document.getElementById("clubList");
  const playerStep = document.getElementById("playerStep");
  const clubStep = document.getElementById("clubStep");
  if (!list || !clubStep) return;

  selectedClubId = null;
  const confirm = document.getElementById("confirmClub");
  if (confirm) confirm.disabled = true;

  const sorted = [...(clubs || [])].sort((a, b) => b.reputation - a.reputation);
  list.innerHTML = sorted
    .map((c) => {
      const crest =
        typeof Crests !== "undefined" && Crests.crestImgHtml
          ? Crests.crestImgHtml(c.name, 36, "crest-img md")
          : "";
      return `<button type="button" class="club-opt" data-club-id="${c.id}">
        ${crest}
        <div style="flex:1">
          <div class="name">${c.name}</div>
          <div class="meta">${c.nation} · ${c.city} · Rep ${c.reputation}</div>
        </div>
      </button>`;
    })
    .join("");

  list.querySelectorAll(".club-opt").forEach((btn) => {
    btn.onclick = () => {
      list.querySelectorAll(".club-opt").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedClubId = btn.getAttribute("data-club-id");
      if (confirm) confirm.disabled = !selectedClubId;
    };
  });

  playerStep?.classList.add("hide");
  clubStep.classList.add("show");
}

async function initWorldAndShowClubs() {
  const firstName = document.getElementById("firstName")?.value || "Jordan";
  const lastName = document.getElementById("lastName")?.value || "Okonkwo";
  const position = document.getElementById("position")?.value || "RW";
  pendingIdentity = { firstName, lastName, position, age: 17, potential: 85 };

  const btn = document.getElementById("startCareer");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Building world…";
  }
  toast("Building world — pick your club next…");

  try {
    const res = await api("/api/start/init", { method: "POST", body: "{}" });
    if (res.error) throw new Error(res.error);
    const clubs = res.clubs || [];
    if (!clubs.length) throw new Error("No clubs generated");
    showClubStep(clubs);
    toast("Choose your starting club");
  } catch (e) {
    toast("Start failed: " + String(e.message || e).slice(0, 140));
    console.error(e);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Continue";
    }
  }
}

async function confirmStartWithClub() {
  if (!selectedClubId || !pendingIdentity) {
    toast("Pick a club first");
    return;
  }
  const btn = document.getElementById("confirmClub");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Signing…";
  }
  toast("Signing for your club…");
  try {
    const res = await api("/api/start", {
      method: "POST",
      body: JSON.stringify({ ...pendingIdentity, clubId: selectedClubId }),
    });
    if (res.error) throw new Error(res.error);
    document.getElementById("gate")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");
    await refresh();
    setView("hub");
    const clubName = res.club?.name || "your club";
    toast(`Career started at ${clubName}`);
  } catch (e) {
    toast("Start failed: " + String(e.message || e).slice(0, 140));
    console.error(e);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Start Career";
    }
  }
}

function boot() {
  bindNav();
  bindActions();

  const startBtn = document.getElementById("startCareer");
  if (startBtn) startBtn.onclick = () => initWorldAndShowClubs();

  const confirm = document.getElementById("confirmClub");
  if (confirm) confirm.onclick = () => confirmStartWithClub();

  const back = document.getElementById("backToPlayer");
  if (back) {
    back.onclick = () => {
      document.getElementById("clubStep")?.classList.remove("show");
      document.getElementById("playerStep")?.classList.remove("hide");
    };
  }

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
