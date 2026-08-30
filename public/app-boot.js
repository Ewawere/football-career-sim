function bindActions() {
  document.querySelectorAll("[data-act]").forEach((btn) => {
    btn.onclick = async () => {
      const act = btn.getAttribute("data-act");
      btn.disabled = true;
      try {
        if (act === "train") {
          const focus = btn.getAttribute("data-focus") || "Technical";
          await api("/api/train", { method: "POST", body: JSON.stringify({ focus }) });
          toast("Training session completed · " + focus);
        } else if (act === "advance") {
          const r = await api("/api/advance", { method: "POST", body: "{}" });
          if (r.done) toast(r.message);
          else {
            const nq = (r.pressQuestions || []).length;
            toast(`Matchday ${r.matchday} · ${r.matchesPlayed} matches` + (nq ? ` · ${nq} press Qs` : ""));
            if (nq) setView("press");
          }
        } else if (act === "endSeason") {
          await api("/api/season/end", { method: "POST", body: "{}" });
          toast("Season ended · trophies awarded");
        } else if (act === "nextSeason") {
          await api("/api/season/next", { method: "POST", body: "{}" });
          toast("New season · transfer window open");
        } else if (act === "save") {
          await api("/api/save", { method: "POST", body: JSON.stringify({ name: "career" }) });
          toast("Career saved");
        } else if (act === "agent") {
          const r = await api("/api/agent");
          toast(r.advice?.summary || JSON.stringify(r.advice || r).slice(0, 140));
        } else if (act === "answerPress") {
          const r = await api("/api/press/answer", {
            method: "POST",
            body: JSON.stringify({
              questionId: btn.getAttribute("data-qid"),
              responseId: btn.getAttribute("data-rid"),
            }),
          });
          toast(r.narrative || "Answer submitted");
          try { press = await api("/api/press"); } catch {}
        } else if (act === "refreshPress") {
          await api("/api/press");
          try { press = await api("/api/press"); } catch {}
          toast("Press pool refreshed");
        }
        await refresh();
      } catch (e) {
        toast(e.message || String(e));
      } finally {
        btn.disabled = false;
      }
    };
  });
}

// Nav
document.querySelectorAll("#sideNav button").forEach((b) => {
  b.addEventListener("click", () => setView(b.getAttribute("data-view")));
});

const createForm = $("createForm");
if (createForm) {
  createForm.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(createForm);
    const body = {
      firstName: String(fd.get("firstName") || "Jordan").trim(),
      lastName: String(fd.get("lastName") || "Vale").trim(),
      position: String(fd.get("position") || "RW"),
      preferredFoot: String(fd.get("preferredFoot") || "Right"),
      physicalProfile: String(fd.get("physicalProfile") || "Athletic"),
      nationality: String(fd.get("nationality") || "England"),
      age: Number(fd.get("age") || 17),
      potential: Number(fd.get("potential") || 86),
    };
    const h = fd.get("heightCm");
    if (h) body.heightCm = Number(h);

    const btn = $("btnStart");
    if (btn) btn.disabled = true;
    try {
      const result = await api("/api/career/start", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await refresh();
      $("gate").classList.add("hidden");
      $("app").classList.remove("hidden");
      const foot = body.preferredFoot;
      const club = result?.club?.name || hub?.player?.club || "your club";
      toast(`${body.firstName} ${body.lastName} · ${foot}-footed ${body.position} at ${club}`);
    } catch (e) {
      toast(e.message || String(e));
      if (btn) btn.disabled = false;
    }
  };
}

$("btnTrain").onclick = () => {
  const b = document.createElement("button");
  b.setAttribute("data-act", "train");
  document.body.appendChild(b);
  bindActions();
  b.click();
  b.remove();
};
$("btnMatchday").onclick = () => {
  const b = document.createElement("button");
  b.setAttribute("data-act", "advance");
  document.body.appendChild(b);
  bindActions();
  b.click();
  b.remove();
};

api("/api/status")
  .then((s) => {
    if (s?.careerStarted) {
      refresh().then(() => {
        $("gate").classList.add("hidden");
        $("app").classList.remove("hidden");
      });
    }
  })
  .catch(() => {});
