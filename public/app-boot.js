
function bindBottomNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;
  nav.querySelectorAll("button[data-view]").forEach((btn) => {
    btn.onclick = () => setView(btn.getAttribute("data-view"));
  });
}

function bindActions() {
  document.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.onclick = () => setView(btn.getAttribute("data-nav"));
  });
  document.querySelectorAll("[data-news-filter]").forEach((btn) => {
    btn.onclick = () => {
      const f = btn.getAttribute("data-news-filter");
      document.querySelectorAll("[data-news-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".news-card").forEach((card) => {
        const cat = card.getAttribute("data-news-cat") || "";
        card.style.display = f === "all" || cat === f ? "" : "none";
      });
    };
  });

  document.body.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.getAttribute("data-action");
    try {
      if (action === "advance") {
        await api("/api/advance", { method: "POST", body: "{}" });
        await refresh();
      } else if (action === "train") {
        const focus = t.getAttribute("data-focus") || "Tactical";
        await api("/api/train", { method: "POST", body: JSON.stringify({ focus }) });
        await refresh();
      } else if (action === "claim-obj") {
        const id = t.getAttribute("data-id");
        await api("/api/objectives/claim", { method: "POST", body: JSON.stringify({ objectiveId: id }) });
        await refresh();
      } else if (action === "inbox-read") {
        const id = t.getAttribute("data-id");
        await api("/api/inbox/read", { method: "POST", body: JSON.stringify({ id }) });
        await refresh();
      } else if (action === "neg-open") {
        await api("/api/negotiation/open", { method: "POST", body: "{}" });
        await refresh();
      } else if (action === "neg-respond") {
        const act = t.getAttribute("data-neg") || "mediate";
        await api("/api/negotiation/respond", { method: "POST", body: JSON.stringify({ action: act }) });
        await refresh();
      } else if (action === "set-role") {
        const role = t.getAttribute("data-role");
        const instruction = t.getAttribute("data-instruction");
        await api("/api/roles", {
          method: "POST",
          body: JSON.stringify({ role, instruction }),
        });
        await refresh();
      } else if (action === "match-start") {
        await api("/api/match/start", { method: "POST", body: "{}" });
        setView("match");
        await refresh();
      } else if (action === "match-finish") {
        await api("/api/match/finish", { method: "POST", body: "{}" });
        await refresh();
      } else if (action === "season-end") {
        await api("/api/season/end", { method: "POST", body: "{}" });
        await refresh();
      } else if (action === "season-next") {
        await api("/api/season/next", { method: "POST", body: "{}" });
        await refresh();
      } else if (action === "save") {
        await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
      } else if (action === "like-news" || action === "react-news") {
        t.classList.add("active");
      }
    } catch (err) {
      console.error(action, err);
      alert(err.message || String(err));
    }
  });
}

async function startCareerFromGate() {
  const firstName = document.getElementById("firstName")?.value || "Alex";
  const lastName = document.getElementById("lastName")?.value || "Player";
  const position = document.getElementById("position")?.value || "CM";
  const res = await api("/api/start", {
    method: "POST",
    body: JSON.stringify({ firstName, lastName, position, age: 17, potential: 82 }),
  });
  if (res.error) throw new Error(res.error);
  document.getElementById("gate")?.classList.add("hidden");
  document.getElementById("app")?.classList.remove("hidden");
  await refresh();
  setView("hub");
}

function boot() {
  bindBottomNav();
  bindActions();
  const startBtn = document.getElementById("startCareer");
  if (startBtn) startBtn.onclick = () => startCareerFromGate().catch((e) => alert(e.message || e));
  api("/api/status")
    .then((s) => {
      if (s?.careerStarted) {
        refresh().then(() => {
          document.getElementById("gate")?.classList.add("hidden");
          document.getElementById("app")?.classList.remove("hidden");
          bindBottomNav();
        });
      }
    })
    .catch(() => {});
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
