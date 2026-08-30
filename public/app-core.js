/**
 * Career Mode UI — FM density + EA FC presentation
 */
const $ = (id) => document.getElementById(id);

let hub = null;
let press = null;
let squad = null;
let market = null;
let matchStats = null;
let clubSocial = null;
let view = "overview";

async function api(path, opts) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json();
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3200);
}

function setView(v) {
  view = v;
  document.querySelectorAll("#sideNav button").forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-view") === v);
  });
  render();
}

function fmtVal(n) {
  if (n == null) return "—";
  if (typeof n === "string") return n;
  if (n >= 1e6) return "€" + (n / 1e6).toFixed(1) + "m";
  if (n >= 1e3) return "€" + Math.round(n / 1e3) + "k";
  return "€" + n;
}

function newsBadgeClass(n) {
  const imp = (n.importance || "").toLowerCase();
  const cat = (n.category || "").toLowerCase();
  if (imp === "breaking") return "breaking";
  if (cat.includes("transfer") || cat.includes("rumour")) return "transfer";
  if (cat.includes("award") || (n.headline || "").toLowerCase().includes("team of the")) return "award";
  if (cat.includes("injury")) return "injury";
  if (cat.includes("club") || cat.includes("manager")) return "club";
  if (cat.includes("player")) return "player";
  return "";
}

function formPills(formStr) {
  if (!formStr || formStr === "—") return "";
  return `<div class="form-pills">${[...String(formStr)].map((c) => `<span class="${c}">${c}</span>`).join("")}</div>`;
}

/** Deterministic palette from string (crest / face placeholder colour) */
function hashHue(s) {
  let h = 0;
  const str = String(s || "x");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

function faceSlot(player, size) {
  const p = player || {};
  const name = p.name || "Player";
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0] && parts[0][0]) || "?") + ((parts[1] && parts[1][0]) || "");
  const hue = hashHue(name + (p.position || ""));
  const sz = size || 56;
  return `<div class="face-slot" style="width:${sz}px;height:${sz}px;--face-hue:${hue}" title="${name}"><span>${ini.toUpperCase()}</span></div>`;
}

function crestSlot(clubName, size) {
  const name = clubName || "Club";
  const words = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  let ini = "";
  if (words.length >= 2) ini = (words[0][0] || "") + (words[1][0] || "");
  else ini = (words[0] || "CL").slice(0, 2);
  const hue = hashHue(name);
  const sz = size || 40;
  return `<div class="crest-slot" style="width:${sz}px;height:${sz}px;--crest-hue:${hue}" title="${name}"><span>${ini.toUpperCase()}</span></div>`;
}

function ratingClass(r) {
  if (r >= 7.5) return "high";
  if (r >= 6.0) return "mid";
  return "low";
}

function ord(n) {
  if (!n) return "—";
  return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
}

async function refresh() {
  hub = await api("/api/hub");
  try { press = await api("/api/press"); } catch { press = { questions: [] }; }
  try { squad = await api("/api/squad"); } catch { squad = { players: [] }; }
  try { market = await api("/api/market?limit=200"); } catch { market = { players: [] }; }
  try { matchStats = await api("/api/match/stats"); } catch { matchStats = null; }
  try { clubSocial = await api("/api/club/social"); } catch { clubSocial = null; }
  render();
}

function render() {
  if (!hub) return;
  const p = hub.player;
  $("sideSeason").textContent = (hub.season || "—") + "  ·  " + (hub.date || "");
  $("sideName").textContent = p ? p.name : "—";
  $("sideMeta").textContent = p ? `${p.position} · ${p.club || "Free Agent"}` : "—";
  $("sideOvr").textContent = p ? `${p.ovr} OVR` : "— OVR";
  const sf = $("sideFace");
  if (sf) sf.innerHTML = p ? faceSlot(p, 40) : "";

  const titles = {
    overview: ["OVERVIEW", p?.name || "Career", p ? `${p.club} · ${p.position} · Age ${p.age}` : ""],
    league: ["COMPETITION", "League Table", `${hub.season || ""} · ${hub.date || ""}`],
    stats: ["MATCH CENTRE", "Match Statistics", "xG · shots · possession · ratings"],
    clubSocial: ["CLUB MEDIA", "Official Club Feed", "Fixtures · results · club posts"],
    transfers: ["TRANSFER CENTRE", "Transfer Network", "Window activity · targets"],
    development: ["DEVELOPMENT", "Training & Growth", p ? `${p.name} · ${p.position}` : ""],
    press: ["MEDIA", "Press Conference", "Answer questions after matches"],
    news: ["WORLD FEED", "News & Social", "Event-driven stories only"],
    inbox: ["INBOX", "Messages", "Manager · Agent · Media"],
    squad: ["SQUAD", "First-Team Squad", "Values · wages · roles"],
    market: ["MARKET", "Player Valuations", "Ranked by estimated market value"],
  };
  const t = titles[view] || titles.overview;
  $("pageEyebrow").textContent = t[0];
  $("pageTitle").textContent = t[1];
  $("pageSub").textContent = t[2];

  const el = $("content");
  if (view === "overview") el.innerHTML = renderOverview();
  else if (view === "league") el.innerHTML = renderLeague();
  else if (view === "stats") el.innerHTML = renderMatchStats();
  else if (view === "clubSocial") el.innerHTML = renderClubSocial();
  else if (view === "transfers") el.innerHTML = renderTransfers();
  else if (view === "development") el.innerHTML = renderDev();
  else if (view === "press") el.innerHTML = renderPress();
  else if (view === "news") el.innerHTML = renderNews();
  else if (view === "inbox") el.innerHTML = renderInbox();
  else if (view === "squad") el.innerHTML = renderSquad();
  else if (view === "market") el.innerHTML = renderMarket();
  bindActions();
}
