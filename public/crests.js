/**
 * Procedural football crests — original SVG shields (not official trademarks).
 * Hash club name → palette, pattern, monogram.
 */
(function (global) {
  const PALETTES = [
    ["#dc2626", "#7f1d1d", "#fef2f2"],
    ["#2563eb", "#1e3a8a", "#eff6ff"],
    ["#059669", "#064e3b", "#ecfdf5"],
    ["#ca8a04", "#713f12", "#fefce8"],
    ["#7c3aed", "#4c1d95", "#f5f3ff"],
    ["#0891b2", "#155e75", "#ecfeff"],
    ["#e11d48", "#9f1239", "#fff1f2"],
    ["#334155", "#0f172a", "#f8fafc"],
    ["#ea580c", "#7c2d12", "#fff7ed"],
    ["#4f46e5", "#312e81", "#eef2ff"],
    ["#16a34a", "#14532d", "#f0fdf4"],
    ["#db2777", "#9d174d", "#fdf2f8"],
  ];

  function hash(s) {
    let h = 2166136261;
    const str = String(s || "Club");
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mono(name) {
    const parts = String(name || "FC")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "FC";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function palette(name) {
    return PALETTES[hash(name) % PALETTES.length];
  }

  function patternId(name) {
    return "p" + (hash(name) % 5);
  }

  /**
   * Inline SVG crest as data URI for <img> or CSS background.
   * @param {string} name club name
   * @param {number} [size=64]
   */
  function crestSvg(name, size) {
    const s = size || 64;
    const [c1, c2, ink] = palette(name);
    const letters = mono(name);
    const pat = patternId(name);
    const h = hash(name);

    // Shield path (classic football badge)
    const shield =
      "M32 2 L58 10 C58 10 60 38 32 62 C4 38 6 10 6 10 Z";

    let pattern = "";
    if (pat === "p0") {
      // vertical halves
      pattern = `<path d="M32 2 L58 10 C58 10 60 38 32 62 Z" fill="${c2}"/>`;
    } else if (pat === "p1") {
      // horizontal band
      pattern = `<rect x="8" y="24" width="48" height="14" fill="${c2}" opacity="0.95"/>`;
    } else if (pat === "p2") {
      // diagonal
      pattern = `<path d="M6 10 L58 48 L58 10 Z" fill="${c2}" opacity="0.85"/>`;
    } else if (pat === "p3") {
      // chevron
      pattern = `<path d="M10 40 L32 22 L54 40 L54 48 L32 30 L10 48 Z" fill="${c2}" opacity="0.9"/>`;
    } else {
      // center disc
      pattern = `<circle cx="32" cy="30" r="14" fill="${c2}" opacity="0.9"/>`;
    }

    // Star count from hash
    const stars = h % 4;
    let starSvg = "";
    for (let i = 0; i < stars; i++) {
      const x = 20 + i * 8;
      starSvg += `<circle cx="${x}" cy="12" r="1.6" fill="${ink}" opacity="0.85"/>`;
    }

    const fontSize = letters.length > 2 ? 14 : 18;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <path d="${shield}" fill="url(#g)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" filter="url(#sh)"/>
  ${pattern}
  <path d="${shield}" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2"/>
  ${starSvg}
  <text x="32" y="36" text-anchor="middle" font-family="Inter,Arial,sans-serif"
    font-weight="800" font-size="${fontSize}" fill="${ink}"
    stroke="rgba(0,0,0,0.2)" stroke-width="0.4">${letters}</text>
</svg>`;

    return svg;
  }

  function crestDataUri(name, size) {
    const svg = crestSvg(name, size);
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function crestImgHtml(name, size, className) {
    const s = size || 48;
    const cls = className || "crest-img";
    return `<img class="${cls}" src="${crestDataUri(name, s)}" width="${s}" height="${s}" alt="${String(name).replace(/"/g, "")}" draggable="false" />`;
  }

  global.Crests = {
    hash,
    mono,
    palette,
    crestSvg,
    crestDataUri,
    crestImgHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
