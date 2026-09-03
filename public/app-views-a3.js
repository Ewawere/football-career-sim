/* Views A3 - awards, narrative threads, transfer centre snippets */
function renderAwards(hub) {
  const awards = hub?.awards || [];
  if (!awards.length) return `<div class="card"><h3>Awards</h3><p class="muted">No awards yet this season.</p></div>`;
  return `<div class="card"><h3>Awards</h3><ul>${awards.map(a => `<li>${a.type || a.name || "Award"} ${a.position ? "(" + a.position + ")" : ""}</li>`).join("")}</ul></div>`;
}

function renderThreads(threads) {
  const list = threads || [];
  if (!list.length) return `<div class="card"><h3>Storylines</h3><p class="muted">No active narratives.</p></div>`;
  return `<div class="card"><h3>Storylines</h3>${list.map(t => `
    <div class="panel" style="margin-bottom:8px">
      <div class="pill">${t.kind || "story"}</div>
      <strong>${t.title || ""}</strong>
      <div class="muted">${t.latestBeat || ""}</div>
      <div class="muted">Beats: ${t.beatCount || 0} · Sentiment ${t.sentimentScore ?? 0}</div>
    </div>`).join("")}</div>`;
}

function renderObjectives(obj) {
  if (!obj || !obj.objectives) return "";
  return `<div class="card"><h3>Season objectives</h3>
    <div class="muted">Progress ${obj.progress || 0}%</div>
    ${obj.objectives.map(o => `
      <div class="panel" style="margin:8px 0">
        <div><strong>${o.label}</strong> — ${o.current}/${o.target} ${o.unit || ""}</div>
        <div class="muted">${o.description || ""}</div>
        ${o.completed && !o.claimed ? `<button class="btn" data-action="claim-obj" data-id="${o.id}">Claim +${o.rewardSp} SP</button>` : o.claimed ? `<span class="pill">Claimed</span>` : ""}
      </div>`).join("")}
  </div>`;
}

function renderInbox(inbox) {
  const msgs = inbox?.messages || [];
  return `<div class="card"><h3>Inbox ${inbox?.unread ? `(${inbox.unread} unread)` : ""}</h3>
    ${msgs.length ? msgs.map(m => `
      <div class="panel" style="margin:8px 0;opacity:${m.read ? 0.7 : 1}">
        <div><strong>${m.from}</strong> · ${m.subject}</div>
        <div class="muted">${m.body}</div>
        ${!m.read ? `<button data-action="inbox-read" data-id="${m.id}">Mark read</button>` : ""}
      </div>`).join("") : "<p class=\"muted\">No messages</p>"}
  </div>`;
}

window.renderAwards = renderAwards;
window.renderThreads = renderThreads;
window.renderObjectives = renderObjectives;
window.renderInbox = renderInbox;
