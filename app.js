/* Traceroute analysis: 3D globe.
   You shouldn't need to edit this file. Add your data in traces.js. */
(() => {
  "use strict";

  const CFG = window.TRACE_CONFIG;
  const G = window.GlobeLibs;
  const $ = (sel, el = document) => el.querySelector(sel);
  const TAU = Math.PI * 2;
  const RAD = Math.PI / 180;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LITE = /[?&]lite\b/.test(location.search);   // add ?lite to the URL to turn off the digital rain

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Turn any CSS color into rgba(...) with a given alpha */
  const rgbCache = new Map();
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  function toRGB(color) {
    if (rgbCache.has(color)) return rgbCache.get(color);
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = "#000";
    probeCtx.fillStyle = color;
    probeCtx.fillRect(0, 0, 1, 1);
    const d = probeCtx.getImageData(0, 0, 1, 1).data;
    const v = [d[0], d[1], d[2]];
    rgbCache.set(color, v);
    return v;
  }
  const rgba = (color, a) => { const [r, g, b] = toRGB(color); return `rgba(${r},${g},${b},${a})`; };

  /* ================================================================
     1. Build the model from traces.js
     ================================================================ */
  function resolvePlace(at, traceId, hop) {
    if (at == null) return null;
    if (Array.isArray(at)) return at;
    const p = CFG.places[at];
    if (!p) console.warn(`[traceroute map] Unknown place "${at}" (trace "${traceId}", hop ${hop}). Add it to "places" in traces.js.`);
    return p || null;
  }

  const traces = [];
  (CFG.traces || []).forEach((t) => {
    const origin = CFG.origins[t.from];
    const dest = CFG.destinations[t.dest];
    if (!origin) { console.warn(`[traceroute map] Trace "${t.id}" uses unknown origin "${t.from}". Add it to "origins" in traces.js.`); return; }
    if (!dest) { console.warn(`[traceroute map] Trace "${t.id}" uses unknown destination "${t.dest}". Add it to "destinations" in traces.js.`); return; }

    // Group consecutive hops that share a location into one stop on the globe.
    // Hops with no location are attached to the last stop that had one.
    const stops = [];
    const rows = [];
    const lead = [];
    for (const [n, seen, likely, at] of t.hops) {
      const p = resolvePlace(at, t.id, n);
      const row = { n, seen, likely, placed: !!p };
      rows.push(row);
      if (p) {
        const key = p[0].toFixed(3) + "," + p[1].toFixed(3);
        const last = stops[stops.length - 1];
        if (last && last.key === key) last.rows.push(row);
        else stops.push({ key, lon: p[0], lat: p[1], name: p[2] || "", rows: [...lead.splice(0), row] });
      } else if (stops.length) {
        stops[stops.length - 1].rows.push(row);
      } else {
        lead.push(row);
      }
    }
    if (stops.length) stops[0].isOrigin = true;

    const tr = {
      id: t.id,
      index: traces.length,
      originKey: t.from,
      originLabel: origin.label,
      opacity: origin.opacity ?? 1,
      label: t.label || dest.label,
      target: t.target || "",
      finalRtt: t.finalRtt || "",
      conclusion: t.conclusion || "",
      color: dest.color,
      stops,
      rows,
      arcs: [],
    };

    // Great-circle arcs between stops, lifted off the surface so overlapping
    // traces fan apart instead of drawing on top of each other.
    const seenSegments = new Map();
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      const A = [a.lon, a.lat], B = [b.lon, b.lat];
      const segKey = [a.key, b.key].sort().join("|");
      const rep = seenSegments.get(segKey) || 0;
      seenSegments.set(segKey, rep + 1);
      const ang = G.geoDistance(A, B);
      const steps = Math.max(10, Math.min(80, Math.ceil(ang * 170)));
      const interp = G.geoInterpolate(A, B);
      const lift = Math.min(0.13, 0.3 * ang) + 0.005 * tr.index + 0.007 * rep;
      const pts = [];
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const [lon, lat] = interp(f);
        pts.push({ lon, lat, r: 1 + lift * Math.sin(Math.PI * f) });
      }
      tr.arcs.push({ pts });
    }
    traces.push(tr);
  });

  const byId = (id) => traces.find((t) => t.id === id);

  /* ================================================================
     2. State, canvas, projection
     ================================================================ */
  const ZMIN = 0.75, ZMAX = 60;
  const state = {
    rotate: [-100, -12],            // d3 rotation: centre longitude = -rotate[0]
    zoom: 0.9,
    selected: null,
    hoverChip: null,
    origins: new Set(traces.map((t) => t.originKey)),
    autoRotate: false,
    flight: null,
    tipKey: "",
  };

  const canvas = $("#globe");
  const ctx = canvas.getContext("2d");
  const stage = $("#stage");
  const tip = $("#tip");
  const readout = $("#readout");
  const view = { w: 0, h: 0, dpr: 1 };

  const projection = G.geoOrthographic().clipAngle(90).precision(0.6);
  const path = G.geoPath(projection, ctx);
  const graticule = G.geoGraticule10();
  const SPHERE = { type: "Sphere" };
  const frame = { stops: [], arcs: [] };   // what was drawn last frame, for hit-testing

  const baseR = () => 0.44 * Math.min(view.w, view.h);

  function applyProjection() {
    projection
      .scale(baseR() * state.zoom)
      .translate([view.w / 2, view.h / 2])
      .rotate([state.rotate[0], state.rotate[1], 0]);
  }

  /* Project a point, optionally lifted above the surface by factor r.
     Orthographic projection is linear, so lifting = scaling away from the globe's centre. */
  function proj(lon, lat, r) {
    const p = projection([lon, lat]);
    if (!p) return null;
    if (r === 1) return p;
    const cx = view.w / 2, cy = view.h / 2;
    return [cx + (p[0] - cx) * r, cy + (p[1] - cy) * r];
  }

  function projectRuns(pts, lifted) {
    const runs = [];
    let cur = null;
    for (const p of pts) {
      const q = proj(p.lon, p.lat, lifted ? p.r : 1);
      if (q) { if (!cur) cur = []; cur.push(q); }
      else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return runs;
  }

  function strokeRuns(runs) {
    ctx.beginPath();
    for (const run of runs) {
      ctx.moveTo(run[0][0], run[0][1]);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
    }
    ctx.stroke();
  }

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = stage.clientWidth;
    view.h = stage.clientHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
  }

  /* ================================================================
     3. Drawing
     ================================================================ */
  const isVisible = (tr) => state.origins.has(tr.originKey);
  const focusId = () => state.selected || state.hoverChip;

  function draw(now) {
    const { w, h } = view;
    if (!w || !h) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    applyProjection();

    const R = projection.scale();
    const cx = w / 2, cy = h / 2;
    const detail = state.zoom > 2.4 ? G.high : G.low;
    let g;

    // Atmosphere glow
    if (R < Math.max(w, h) * 2) {
      g = ctx.createRadialGradient(cx, cy, R * 0.97, cx, cy, R * 1.2);
      g.addColorStop(0, "rgba(45,255,122,.24)");
      g.addColorStop(1, "rgba(45,255,122,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.2, 0, TAU);
      ctx.fill();
    }

    // Sphere body, lit from the upper left
    ctx.beginPath();
    path(SPHERE);
    g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
    g.addColorStop(0, "#0b4d27");
    g.addColorStop(0.6, "#03200e");
    g.addColorStop(1, "#010a05");
    ctx.fillStyle = g;
    ctx.fill();

    // Latitude / longitude grid
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = "rgba(70,255,150,.18)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // Land and borders
    ctx.beginPath();
    path(detail.land);
    ctx.fillStyle = "rgba(30,170,90,.20)";
    ctx.fill();
    ctx.strokeStyle = "rgba(110,255,175,.62)";
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.beginPath();
    path(detail.borders);
    ctx.strokeStyle = "rgba(110,255,175,.25)";
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Rim light and outline
    ctx.beginPath();
    path(SPHERE);
    g = ctx.createRadialGradient(cx, cy, R * 0.74, cx, cy, R);
    g.addColorStop(0, "rgba(45,255,122,0)");
    g.addColorStop(1, "rgba(45,255,122,.30)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(150,255,195,.85)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // ---- Traces ----
    frame.stops.length = 0;
    frame.arcs.length = 0;
    const focus = focusId();
    const list = traces.filter(isVisible).sort((a, b) => (a.id === focus) - (b.id === focus));
    const hoveredStops = state.hovered || [];

    for (const tr of list) {
      const dim = !!focus && tr.id !== focus;
      const alpha = tr.opacity * (dim ? 0.18 : 1);
      const isFocus = tr.id === focus;

      const runsList = tr.arcs.map((arc) => projectRuns(arc.pts, true));

      // faint dotted "ground track" under each lifted arc
      ctx.save();
      ctx.setLineDash([2, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(tr.color, alpha * 0.4);
      tr.arcs.forEach((arc) => strokeRuns(projectRuns(arc.pts, false)));
      ctx.restore();

      // the arcs themselves
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = isFocus ? 2.8 : 2;
      ctx.strokeStyle = rgba(tr.color, alpha);
      ctx.shadowColor = rgba(tr.color, alpha);
      ctx.shadowBlur = isFocus ? 14 : 9;
      runsList.forEach((runs) => strokeRuns(runs));
      ctx.restore();
      if (!dim) frame.arcs.push({ tr, runs: runsList.flat() });

      // travelling packet
      if (!reduceMotion && !dim) drawPacket(tr, now, alpha);

      // hop markers
      for (const st of tr.stops) {
        const p = projection([st.lon, st.lat]);
        if (!p) continue;
        if (!dim) frame.stops.push({ tr, st, x: p[0], y: p[1] });
        const rad = st.isOrigin ? 5.6 : 3.8;

        if (st.isOrigin) {
          const phase = reduceMotion ? 0.35 : ((now / 1700) + tr.index * 0.21) % 1;
          ctx.beginPath();
          ctx.arc(p[0], p[1], rad + 3 + phase * 13, 0, TAU);
          ctx.strokeStyle = rgba(tr.color, alpha * (1 - phase) * 0.7);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p[0], p[1], rad, 0, TAU);
        ctx.fillStyle = "#020a05";
        ctx.fill();
        ctx.shadowColor = rgba(tr.color, alpha);
        ctx.shadowBlur = 8;
        ctx.strokeStyle = rgba(tr.color, alpha);
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(p[0], p[1], rad * 0.42, 0, TAU);
        ctx.fillStyle = rgba(tr.color, alpha);
        ctx.fill();

        if (hoveredStops.includes(st)) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], rad + 5, 0, TAU);
          ctx.strokeStyle = "rgba(230,255,240,.9)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      }
    }

    drawLabels();
    updateReadout();
  }

  /* A bright dot that walks the path hop by hop, like a packet */
  function drawPacket(tr, now, alpha) {
    const n = tr.arcs.length;
    if (!n) return;
    const per = 0.8, cycle = n * per + 1.8;
    const t = (now / 1000 + tr.index * 1.3) % cycle;
    if (t >= n * per) return;
    const ai = Math.floor(t / per);
    const f = (t - ai * per) / per;
    const pts = tr.arcs[ai].pts;
    const head = f * (pts.length - 1);
    const tail = Math.max(0, head - (pts.length - 1) * 0.4);

    const at = (idx) => {
      const i0 = Math.min(pts.length - 2, Math.floor(idx));
      const k = idx - i0;
      const a = pts[i0], b = pts[i0 + 1];
      return proj(a.lon + (b.lon - a.lon) * k, a.lat + (b.lat - a.lat) * k, a.r + (b.r - a.r) * k);
    };

    const trail = [];
    for (let idx = tail; idx < head; idx += Math.max(0.5, (head - tail) / 12)) {
      const q = at(idx);
      if (q) trail.push(q);
    }
    const headPt = at(head);
    if (headPt) trail.push(headPt);
    if (trail.length > 1) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * alpha})`;
      ctx.shadowColor = rgba(tr.color, alpha);
      ctx.shadowBlur = 12;
      strokeRuns([trail]);
      ctx.restore();
    }
    if (headPt) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(headPt[0], headPt[1], 3.4, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.shadowColor = rgba(tr.color, 1);
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.restore();
    }
  }

  /* City labels, skipping any that would overlap one already placed */
  function drawLabels() {
    ctx.font = "12px 'Share Tech Mono','Courier New',monospace";
    ctx.textBaseline = "alphabetic";
    const placed = [];
    const seen = new Set();
    const cand = frame.stops.filter((s) => s.st.name).sort((a, b) => (b.st.isOrigin ? 1 : 0) - (a.st.isOrigin ? 1 : 0));
    for (const s of cand) {
      if (seen.has(s.st.name)) continue;
      const tw = ctx.measureText(s.st.name).width;
      const lx = s.x + 10, ly = s.y - 10;
      if (lx < 4 || lx + tw > view.w - 4 || ly < 14 || ly > view.h - 4) continue;
      const rect = [lx - 3, ly - 12, tw + 6, 16];
      if (placed.some((r) => rect[0] < r[0] + r[2] && rect[0] + rect[2] > r[0] && rect[1] < r[1] + r[3] && rect[1] + rect[3] > r[1])) continue;
      placed.push(rect);
      seen.add(s.st.name);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,.9)";
      ctx.strokeText(s.st.name, lx, ly);
      ctx.fillStyle = "rgba(205,255,225,.95)";
      ctx.fillText(s.st.name, lx, ly);
    }
  }

  let lastReadout = "";
  function updateReadout() {
    const lon = -state.rotate[0], lat = -state.rotate[1];
    const wrap = ((lon + 540) % 360) - 180;
    const text = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}  ${Math.abs(wrap).toFixed(1)}°${wrap >= 0 ? "E" : "W"}  ${state.zoom.toFixed(1)}×`;
    if (text !== lastReadout) { readout.textContent = text; lastReadout = text; }
  }

  /* ================================================================
     4. Camera moves
     ================================================================ */
  const currentCenter = () => [-state.rotate[0], -state.rotate[1]];

  function flyTo(center, zoom, duration = 1400) {
    zoom = clamp(zoom, ZMIN, ZMAX);
    if (reduceMotion) {
      state.rotate = [-center[0], -center[1]];
      state.zoom = zoom;
      state.flight = null;
      return;
    }
    state.flight = {
      t0: performance.now(), dur: duration,
      interp: G.geoInterpolate(currentCenter(), center),
      z0: state.zoom, z1: zoom,
    };
  }

  function stepFlight(now) {
    const f = state.flight;
    if (!f) return;
    const k = clamp((now - f.t0) / f.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const c = f.interp(e);
    state.rotate = [-c[0], -c[1]];
    state.zoom = Math.exp(Math.log(f.z0) + (Math.log(f.z1) - Math.log(f.z0)) * e);
    if (k >= 1) state.flight = null;
  }

  function centroid(stops) {
    let x = 0, y = 0, z = 0;
    for (const s of stops) {
      const la = s.lat * RAD, lo = s.lon * RAD;
      x += Math.cos(la) * Math.cos(lo);
      y += Math.cos(la) * Math.sin(lo);
      z += Math.sin(la);
    }
    const n = Math.hypot(x, y, z) || 1;
    return [Math.atan2(y, x) / RAD, Math.asin(z / n) / RAD];
  }

  function fitFor(stops) {
    if (!stops.length) return null;
    const c = centroid(stops);
    let maxA = 0;
    for (const s of stops) maxA = Math.max(maxA, G.geoDistance(c, [s.lon, s.lat]));
    const M = Math.min(view.w, view.h);
    const R = (0.34 * M) / Math.sin(clamp(maxA, 0.006, 1.2));
    return { center: c, zoom: clamp(R / baseR(), 1.2, ZMAX) };
  }

  const visibleStops = () => traces.filter(isVisible).flatMap((t) => t.stops);

  function flyToStops(stops) {
    const fit = fitFor(stops);
    if (fit) flyTo(fit.center, fit.zoom, 1500);
  }

  function showWholeGlobe() {
    const stops = visibleStops();
    flyTo(stops.length ? centroid(stops) : [-80, 38], 1, 1500);
  }

  /* ================================================================
     5. Hover popup
     ================================================================ */
  function hopsTable(rows) {
    let html = '<table class="hops"><thead><tr><th>Hop</th><th>What you see</th><th>What it likely is</th></tr></thead><tbody>';
    for (const r of rows) {
      html += `<tr class="${r.placed ? "" : "unplaced"}"><td>${esc(r.n)}</td><td>${esc(r.seen)}</td><td>${esc(r.likely)}</td></tr>`;
    }
    return html + "</tbody></table>";
  }

  function tipHTML(hits) {
    // One section per trace, showing only the point closest to the cursor.
    const groups = [];
    const byTrace = new Map();
    let moreStops = false;
    for (const h of hits) {
      const g = byTrace.get(h.tr.id);
      if (!g) {
        const ng = { tr: h.tr, st: h.st };
        byTrace.set(h.tr.id, ng);
        groups.push(ng);
      } else if (g.st !== h.st) {
        moreStops = true;
      }
    }
    const MAX_GROUPS = 3, MAX_ROWS = 6;
    let hiddenRows = 0;
    let html = "";
    groups.slice(0, MAX_GROUPS).forEach((g) => {
      const rows = [...g.st.rows].sort((a, b) => a.n - b.n);
      const shown = rows.slice(0, MAX_ROWS);
      hiddenRows += rows.length - shown.length;
      html += `<div class="tip-sec" style="--c:${esc(g.tr.color)}">` +
        `<div class="tip-head"><i class="dot"></i><span>${esc(g.tr.label)}, from ${esc(g.tr.originLabel.toLowerCase())}</span>` +
        (g.st.name ? `<span class="where">${esc(g.st.name)}</span>` : "") + `</div>` +
        hopsTable(shown) +
        (shown.some((r) => !r.placed) ? `<p class="tip-note">Faded rows have no location clue yet, so they're listed at the last point that had one.</p>` : "") +
        `</div>`;
    });
    if (groups.length > MAX_GROUPS || moreStops) html += `<p class="tip-more">More points overlap here. Zoom in to separate them.</p>`;
    if (hiddenRows > 0) html += `<p class="tip-more">${hiddenRows} more hop${hiddenRows > 1 ? "s" : ""} at this point. Pick the trace to see them all below.</p>`;
    return html;
  }

  function showTip(hits, clientX, clientY) {
    const key = hits.map((h) => h.tr.id + h.st.key).join("|");
    if (key !== state.tipKey) {
      tip.innerHTML = tipHTML(hits);
      state.tipKey = key;
    }
    state.hovered = hits.map((h) => h.st);
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = clientX + 18, y = clientY + 18;
    if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 18;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function hideTip() {
    if (!tip.hidden) tip.hidden = true;
    state.tipKey = "";
    state.hovered = [];
  }

  /* ================================================================
     6. Hit testing and pointer input
     ================================================================ */
  const localPoint = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function hitStops(pt, touch) {
    const thr = touch ? 18 : 11;
    return frame.stops
      .map((s) => ({ ...s, d: Math.hypot(s.x - pt[0], s.y - pt[1]) }))
      .filter((s) => s.d <= thr)
      .sort((a, b) => a.d - b.d);
  }

  function distToSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2, 0, 1) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function hitArc(pt, touch) {
    const thr = touch ? 14 : 8;
    let best = null, bestD = thr;
    for (const { tr, runs } of frame.arcs) {
      for (const run of runs) {
        for (let i = 0; i < run.length - 1; i++) {
          const d = distToSegment(pt, run[i], run[i + 1]);
          if (d < bestD) { bestD = d; best = tr; }
        }
      }
    }
    return best;
  }

  const pointers = new Map();
  let drag = null;
  let pinch = null;

  canvas.addEventListener("pointerdown", (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.flight = null;
    if (pointers.size === 1) {
      drag = { sx: e.clientX, sy: e.clientY, moved: false, rot: [...state.rotate], type: e.pointerType };
      hideTip();
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: state.zoom };
      if (drag) drag.moved = true;
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      state.zoom = clamp(pinch.z * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d), ZMIN, ZMAX);
      return;
    }
    if (drag && pointers.size === 1) {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; canvas.style.cursor = "grabbing"; }
      if (drag.moved) {
        const k = (180 / Math.PI) / projection.scale();
        state.rotate = [drag.rot[0] + dx * k, clamp(drag.rot[1] - dy * k, -90, 90)];
      }
      return;
    }
    if (e.pointerType === "mouse") hover(e);
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && pointers.size === 0) {
      const wasClick = !drag.moved && e.type === "pointerup";
      const type = drag.type;
      drag = null;
      canvas.style.cursor = "grab";
      if (wasClick) handleClick(e, type);
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => { if (!drag) hideTip(); });

  function hover(e) {
    const pt = localPoint(e);
    const hits = hitStops(pt, false);
    if (hits.length) {
      canvas.style.cursor = "pointer";
      showTip(hits, e.clientX, e.clientY);
    } else {
      canvas.style.cursor = hitArc(pt, false) ? "pointer" : "grab";
      hideTip();
    }
  }

  function handleClick(e, type) {
    const pt = localPoint(e);
    const touch = type !== "mouse";
    const stops = hitStops(pt, touch);
    if (stops.length) {
      const tr = stops[0].tr;
      if (state.selected !== tr.id) select(tr.id);
      else if (touch) showTip(stops, e.clientX, e.clientY);   // no hover on touch screens: tap shows the popup
      return;
    }
    const arc = hitArc(pt, touch);
    if (arc) { if (state.selected !== arc.id) select(arc.id); return; }
    hideTip();
    if (state.selected) select(null);
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    state.flight = null;
    const unit = e.deltaMode === 1 ? 16 : 1;
    state.zoom = clamp(state.zoom * Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0016)), ZMIN, ZMAX);
    hideTip();
  }, { passive: false });

  canvas.addEventListener("keydown", (e) => {
    const k = ((180 / Math.PI) / projection.scale()) * 48;
    let used = true;
    switch (e.key) {
      case "ArrowLeft":  state.rotate[0] += k; break;
      case "ArrowRight": state.rotate[0] -= k; break;
      case "ArrowUp":    state.rotate[1] = clamp(state.rotate[1] - k, -90, 90); break;
      case "ArrowDown":  state.rotate[1] = clamp(state.rotate[1] + k, -90, 90); break;
      case "+": case "=": state.zoom = clamp(state.zoom * 1.25, ZMIN, ZMAX); break;
      case "-": case "_": state.zoom = clamp(state.zoom / 1.25, ZMIN, ZMAX); break;
      case "0": showWholeGlobe(); break;
      default: used = false;
    }
    if (used) { e.preventDefault(); if (e.key !== "0") state.flight = null; }
  });

  /* ================================================================
     7. Toolbar, controls and the notes panel
     ================================================================ */
  function select(id) {
    state.selected = id;
    state.hoverChip = null;
    updateChips();
    renderAnalysis();
    hideTip();
    if (id) {
      flyToStops(byId(id).stops);
      $("#analysis").scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
  }

  function buildChips() {
    const wrap = $("#chips");
    if (!traces.length) return;
    const label = document.createElement("span");
    label.className = "group-label";
    label.textContent = "Traces";
    wrap.append(label);
    for (const tr of traces) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = tr.id;
      b.setAttribute("aria-pressed", "false");
      b.style.setProperty("--c", tr.color);
      b.style.setProperty("--o", tr.opacity);
      b.innerHTML = `<span class="dot"></span><span>${esc(tr.label)}</span><span class="from">${esc(tr.originLabel.toLowerCase())}</span>`;
      b.addEventListener("click", () => select(state.selected === tr.id ? null : tr.id));
      b.addEventListener("mouseenter", () => { if (!state.selected) state.hoverChip = tr.id; });
      b.addEventListener("mouseleave", () => { state.hoverChip = null; });
      wrap.append(b);
    }
  }

  function updateChips() {
    document.querySelectorAll(".chip").forEach((b) => {
      const tr = byId(b.dataset.id);
      b.hidden = !isVisible(tr);
      b.setAttribute("aria-pressed", String(state.selected === b.dataset.id));
    });
  }

  function buildOriginToggles() {
    const used = [...new Set(traces.map((t) => t.originKey))];
    const wrap = $("#origins");
    if (used.length < 2) { wrap.hidden = true; return; }   // nothing to filter until there are traces from 2+ places
    const label = document.createElement("span");
    label.className = "group-label";
    label.textContent = "Show";
    wrap.append(label);
    for (const key of used) {
      const o = CFG.origins[key];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "toggle";
      b.setAttribute("aria-pressed", "true");
      b.style.setProperty("--o", o.opacity ?? 1);
      b.innerHTML = `<span class="swatch"></span><span>${esc(o.label)}</span>`;
      b.addEventListener("click", () => {
        if (state.origins.has(key)) state.origins.delete(key); else state.origins.add(key);
        b.setAttribute("aria-pressed", String(state.origins.has(key)));
        const sel = state.selected && byId(state.selected);
        if (sel && !isVisible(sel)) select(null);
        updateChips();
      });
      wrap.append(b);
    }
  }

  function renderAnalysis() {
    const box = $("#analysis");
    const tr = state.selected && byId(state.selected);
    if (!tr) {
      box.innerHTML = '<p class="empty">Click a line on the globe, or pick a trace above, to read what stands out about that path.</p>';
      return;
    }
    const n = tr.rows.length;
    const rtt = tr.finalRtt ? `; the last one answered in ${esc(tr.finalRtt)}` : "";
    box.innerHTML =
      `<h2 style="--c:${esc(tr.color)}"><i class="dot"></i>${esc(tr.label)}</h2>` +
      `<p class="meta">${esc(tr.target)}, traced from ${esc(tr.originLabel.toLowerCase())}. ${n} hops${rtt}.</p>` +
      `<p class="body">${esc(tr.conclusion)}</p>` +
      `<details><summary>Show all ${n} hops</summary><div class="all-hops">${hopsTable(tr.rows)}</div></details>`;
  }

  $("#controls").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    switch (btn.dataset.act) {
      case "in":    flyTo(currentCenter(), state.zoom * 1.8, 350); break;
      case "out":   flyTo(currentCenter(), state.zoom / 1.8, 350); break;
      case "fit":   flyToStops(visibleStops()); break;
      case "globe": showWholeGlobe(); break;
      case "spin":
        state.autoRotate = !state.autoRotate;
        btn.setAttribute("aria-pressed", String(state.autoRotate));
        break;
    }
  });

  /* ================================================================
     8. Digital rain and the loading screen
     ================================================================ */
  function createRain(cv, { size = 16, interval = 60, fade = 0.12, headColor = "#dfffea", color = "#2dff7a" } = {}) {
    const c = cv.getContext("2d");
    const glyphs = "0123456789ABCDEF<>/:.+*".split("");
    let w = 0, h = 0, cols = 0, drops = [], last = 0, raf = 0;
    function fit() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / size);
      drops = Array.from({ length: cols }, () => Math.random() * -(h / size));
    }
    function step(now) {
      raf = requestAnimationFrame(step);
      if (now - last < interval) return;
      last = now;
      c.globalCompositeOperation = "destination-out";     // fade old glyphs toward transparent
      c.fillStyle = `rgba(0,0,0,${fade})`;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = "source-over";
      c.font = `${size}px 'Share Tech Mono', monospace`;
      for (let i = 0; i < cols; i++) {
        const y = drops[i] * size;
        if (y > 0) {
          c.fillStyle = Math.random() < 0.05 ? headColor : color;
          c.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * size, y);
        }
        if (y > h && Math.random() > 0.975) drops[i] = 0; else drops[i] += 1;
      }
    }
    return {
      start() { if (reduceMotion || LITE) return; fit(); window.addEventListener("resize", fit); raf = requestAnimationFrame(step); },
      stop() { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); },
    };
  }

  /* Static backdrop for the loading screen: a bright core with rays streaming out of it */
  function drawBootBackdrop(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = w / 2, cy = h * 0.44, maxR = Math.hypot(w, h) * 0.6;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.5);
    g.addColorStop(0, "rgba(120,255,170,.55)");
    g.addColorStop(0.06, "rgba(45,255,122,.26)");
    g.addColorStop(0.3, "rgba(0,90,40,.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.lineCap = "round";
    for (let i = 0; i < 170; i++) {
      const a = Math.random() * TAU;
      const r0 = 26 + Math.random() * 70;
      const r1 = r0 + (0.15 + Math.random() * 0.85) * maxR;
      const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0;
      const x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
      const lg = c.createLinearGradient(x0, y0, x1, y1);
      lg.addColorStop(0, `rgba(90,255,150,${0.15 + Math.random() * 0.5})`);
      lg.addColorStop(1, "rgba(90,255,150,0)");
      c.strokeStyle = lg;
      c.lineWidth = 0.6 + Math.random() * 1.2;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    c.save();
    c.beginPath(); c.arc(cx, cy, 5, 0, TAU);
    c.fillStyle = "#eafff2"; c.shadowColor = "#2dff7a"; c.shadowBlur = 30; c.fill();
    c.restore();
    c.beginPath(); c.arc(cx, cy, 22, 0, TAU);
    c.strokeStyle = "rgba(140,255,190,.55)"; c.lineWidth = 1; c.stroke();
  }

  function runBoot(onDone) {
    const boot = $("#boot");
    const bar = $("#boot-bar");
    const tag = $("#boot-tag");
    const N = 30;
    for (let i = 0; i < N; i++) bar.appendChild(document.createElement("i"));
    const segs = [...bar.children];

    const backdrop = document.createElement("canvas");
    boot.insertBefore(backdrop, boot.firstChild);
    drawBootBackdrop(backdrop);
    const rain = createRain($("#boot-canvas"), { size: 18, interval: 50, fade: 0.1 });
    rain.start();

    const tags = ["INIT", "HOPS", "MAP", "LINK"];
    const dur = reduceMotion ? 250 : 2900;
    const t0 = performance.now();
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      segs.forEach((s) => s.classList.add("on"));
      tag.textContent = "OK";
      boot.classList.add("done");
      setTimeout(() => { boot.style.display = "none"; rain.stop(); }, reduceMotion ? 0 : 800);
      onDone();
    }
    function tick(now) {
      if (finished) return;
      const t = clamp((now - t0) / dur, 0, 1);
      const p = t + 0.07 * Math.sin(t * 11) * (1 - t);           // slightly uneven, like a real loader
      const on = Math.floor(clamp(p, 0, 1) * N);
      for (let i = 0; i < on; i++) segs[i].classList.add("on");
      tag.textContent = tags[Math.min(tags.length - 1, Math.floor(t * tags.length))];
      if (t >= 1) finish(); else requestAnimationFrame(tick);
    }
    boot.addEventListener("click", finish);
    window.addEventListener("keydown", finish, { once: true });
    requestAnimationFrame(tick);
  }

  /* ================================================================
     9. Go
     ================================================================ */
  let lastT = 0;
  let paused = false;
  function loop(now) {
    if (paused) return;
    const dt = lastT ? now - lastT : 16;
    lastT = now;
    stepFlight(now);
    if (state.autoRotate && !drag && !state.flight && !reduceMotion) state.rotate[0] -= dt * 0.006;
    draw(now);
    requestAnimationFrame(loop);
  }

  function init() {
    buildChips();
    buildOriginToggles();
    renderAnalysis();
    resize();
    new ResizeObserver(resize).observe(stage);
    createRain($("#bgrain"), { size: 16, interval: 80, fade: 0.14, color: "#1fd766" }).start();
    requestAnimationFrame(loop);
    runBoot(() => showWholeGlobe());   // spin in to face the traces once the loader finishes
  }

  // Expose a tiny hook so the page can be inspected from the console
  window.tracerouteMap = {
    state, traces, select, flyTo, frame, projection,
    pause() { paused = true; },
    resume() { if (paused) { paused = false; lastT = 0; requestAnimationFrame(loop); } },
    renderOnce() { stepFlight(performance.now()); draw(performance.now()); },
  };
  init();
})();
