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
let selectedArchetype = null;
let pendingIdentity = null;

const ARCHETYPES_BY_POS = {
  ST: [
    { id: "poacher", name: "Poacher", meta: "Finishing + movement in the box" },
    { id: "target", name: "Target man", meta: "Aerial + hold-up strength" },
    { id: "complete_forward", name: "Complete forward", meta: "All-round attacking threat" },
  ],
  CF: [
    { id: "complete_forward", name: "Complete forward", meta: "Link play + goals" },
    { id: "target", name: "Target man", meta: "Physical focal point" },
    { id: "poacher", name: "Poacher", meta: "Box predator" },
  ],
  RW: [
    { id: "winger", name: "Traditional winger", meta: "Pace + crossing" },
    { id: "inside_forward", name: "Inside forward", meta: "Cut inside + shoot" },
    { id: "balanced", name: "Balanced wide", meta: "Mix of cross and carry" },
  ],
  LW: [
    { id: "winger", name: "Traditional winger", meta: "Pace + crossing" },
    { id: "inside_forward", name: "Inside forward", meta: "Cut inside + shoot" },
    { id: "balanced", name: "Balanced wide", meta: "Mix of cross and carry" },
  ],
  RM: [
    { id: "winger", name: "Wide midfielder", meta: "Width + delivery" },
    { id: "box_to_box", name: "Shuttler", meta: "Work rate both ways" },
  ],
  LM: [
    { id: "winger", name: "Wide midfielder", meta: "Width + delivery" },
    { id: "box_to_box", name: "Shuttler", meta: "Work rate both ways" },
  ],
  CAM: [
    { id: "playmaker", name: "Playmaker", meta: "Vision + through balls" },
    { id: "inside_forward", name: "Shadow striker", meta: "Late runs + finishing" },
    { id: "balanced", name: "Hybrid 10", meta: "Create and arrive" },
  ],
  CM: [
    { id: "box_to_box", name: "Box-to-box", meta: "Stamina + all-phase mid" },
    { id: "playmaker", name: "Midfield creator", meta: "Dictate tempo" },
    { id: "deep_lying", name: "Deep-lying", meta: "Progress from deeper" },
  ],
  CDM: [
    { id: "destroyer", name: "Destroyer", meta: "Tackles + protection" },
    { id: "deep_lying", name: "Anchor / deep play", meta: "Shield + distribute" },
    { id: "balanced", name: "Balanced 6", meta: "Do a bit of everything" },
  ],
  CB: [
    { id: "stopper", name: "Stopper", meta: "Aggressive defending" },
    { id: "ball_playing_cb", name: "Ball-playing CB", meta: "Build from the back" },
    { id: "balanced", name: "Complete CB", meta: "Solid all-round" },
  ],
  LB: [
    { id: "fullback", name: "Full-back", meta: "Defend first, overlap" },
    { id: "wingback", name: "Attacking full-back", meta: "High stamina wide" },
  ],
  RB: [
    { id: "fullback", name: "Full-back", meta: "Defend first, overlap" },
    { id: "wingback", name: "Attacking full-back", meta: "High stamina wide" },
  ],
  LWB: [{ id: "wingback", name: "Wing-back", meta: "End-to-end width" }],
  RWB: [{ id: "wingback", name: "Wing-back", meta: "End-to-end width" }],
  GK: [
    { id: "shot_stopper", name: "Shot-stopper", meta: "Reflexes + handling" },
    { id: "sweeper_keeper", name: "Sweeper-keeper", meta: "With feet + claim space" },
  ],
};

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
        setView(t.getAttribute("data-view") || "hub");
        if (view === "match") {
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
        toast("Day advanced");
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
      } else if (action === "match-start" || action === "match-finish") {
        // Player career: one tap = play the next fixture to full time
        toast("Playing match…");
        try {
          await api("/api/match/start", { method: "POST", body: "{}" });
        } catch (e) {
          // start may fail if already live — still try finish
          console.warn("match/start", e);
        }
        const res = await api("/api/match/finish", { method: "POST", body: "{}" });
        if (res.error) throw new Error(res.error);
        await refresh();
        await loadMatchStats();
        setView("match");
        const score = res.state?.score || res.report?.score || lastMatch?.homeScore != null
          ? `${lastMatch?.homeScore ?? "?"}-${lastMatch?.awayScore ?? "?"}`
          : null;
        toast(score ? `Full time ${res.state?.score || score}` : "Full time");
      } else if (action === "save") {
        await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
        toast("Saved");
      } else if (action === "refresh-cmp") {
        await loadComparison();
      }
    } catch (err) {
      console.error(action, err);
      toast(err.message || String(err));
    }
  });
}

function collectIdentity() {
  return {
    firstName: document.getElementById("firstName")?.value || "Jordan",
    lastName: document.getElementById("lastName")?.value || "Okonkwo",
    position: document.getElementById("position")?.value || "RW",
    preferredFoot: document.getElementById("preferredFoot")?.value || "Right",
    physicalProfile: document.getElementById("physicalProfile")?.value || "Athletic",
    age: 17,
    potential: 85,
  };
}

function showStyleStep() {
  pendingIdentity = collectIdentity();
  selectedArchetype = null;
  const list = document.getElementById("styleList");
  const opts = ARCHETYPES_BY_POS[pendingIdentity.position] || [
    { id: "balanced", name: "Balanced", meta: "All-round profile" },
  ];
  const hint = document.getElementById("styleHint");
  if (hint) hint.textContent = `${pendingIdentity.position} · ${pendingIdentity.preferredFoot} foot · shapes attributes`;

  list.innerHTML = opts
    .map(
      (o) => `<button type="button" class="style-opt" data-arch="${o.id}">
      <div style="flex:1"><div class="name">${o.name}</div><div class="meta">${o.meta}</div></div>
    </button>`
    )
    .join("");

  const next = document.getElementById("toClubStep");
  if (next) next.disabled = true;

  list.querySelectorAll(".style-opt").forEach((btn) => {
    btn.onclick = () => {
      list.querySelectorAll(".style-opt").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedArchetype = btn.getAttribute("data-arch");
      if (next) next.disabled = !selectedArchetype;
    };
  });

  document.getElementById("playerStep")?.classList.add("hide");
  document.getElementById("styleStep")?.classList.add("show");
  document.getElementById("clubStep")?.classList.remove("show");
}

function showClubStep(clubs) {
  const list = document.getElementById("clubList");
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

  document.getElementById("styleStep")?.classList.remove("show");
  document.getElementById("clubStep")?.classList.add("show");
}

async function initWorldAndShowClubs() {
  if (!selectedArchetype) {
    toast("Pick how you play first");
    return;
  }
  const btn = document.getElementById("toClubStep");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Building world…";
  }
  toast("Building world…");
  try {
    const res = await api("/api/start/init", { method: "POST", body: "{}" });
    if (res.error) throw new Error(res.error);
    const clubs = res.clubs || [];
    if (!clubs.length) throw new Error("No clubs generated");
    showClubStep(clubs);
    toast("Choose your starting club");
  } catch (e) {
    toast("Start failed: " + String(e.message || e).slice(0, 140));
  } finally {
    if (btn) {
      btn.disabled = !selectedArchetype;
      btn.textContent = "Choose club →";
    }
  }
}

async function confirmStartWithClub() {
  if (!selectedClubId || !pendingIdentity || !selectedArchetype) {
    toast("Complete all steps first");
    return;
  }
  const btn = document.getElementById("confirmClub");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Signing…";
  }
  toast("Signing…");
  try {
    const res = await api("/api/start", {
      method: "POST",
      body: JSON.stringify({
        ...pendingIdentity,
        clubId: selectedClubId,
        playArchetype: selectedArchetype,
      }),
    });
    if (res.error) throw new Error(res.error);
    document.getElementById("gate")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");
    await refresh();
    setView("hub");
    toast(`Career started at ${res.club?.name || "club"}`);
  } catch (e) {
    toast("Start failed: " + String(e.message || e).slice(0, 140));
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Start Career";
    }
  }
}

function boot() {
  bindNav();
  bindActions();

  document.getElementById("toStyleStep")?.addEventListener("click", () => showStyleStep());
  document.getElementById("toClubStep")?.addEventListener("click", () => initWorldAndShowClubs());
  document.getElementById("confirmClub")?.addEventListener("click", () => confirmStartWithClub());

  document.getElementById("backToPlayer")?.addEventListener("click", () => {
    document.getElementById("styleStep")?.classList.remove("show");
    document.getElementById("playerStep")?.classList.remove("hide");
  });
  document.getElementById("backToStyle")?.addEventListener("click", () => {
    document.getElementById("clubStep")?.classList.remove("show");
    document.getElementById("styleStep")?.classList.add("show");
  });

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
