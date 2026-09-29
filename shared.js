/* =====================================================================
   SHARED ROUTES — visitors paste their own traceroute, it is saved to
   Firebase, and everyone's routes appear on the globe live.

   SETUP (once)
   ------------
   1. console.firebase.google.com → Add project (Analytics not needed).
   2. Build → Realtime Database → Create database → start in *locked* mode,
      then paste the rules from the README into the Rules tab.
   3. Project settings (gear) → Your apps → Web (</>) → register an app.
      Copy the firebaseConfig object it shows you over the one below.
      Make sure it includes databaseURL; if not, copy it from the top of the
      Realtime Database page.

   Until you do that, the page runs in demo mode: the form works, but routes
   are only kept in your open tab.
   ===================================================================== */

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  appId: "PASTE_YOUR_APP_ID",
};

const FIREBASE = "https://www.gstatic.com/firebasejs/10.12.2";
const MAX_ROUTES = 150;   // only load the newest ones

/* ---------------------------------------------------------------------
   City clues found in router names.
   A hostname is split into words, trailing numbers are dropped
   (jfk02 → jfk, lga34s11 → lga, Chicago3 → chicago) and each word is
   looked up here. 6-letter keys are the telecom codes Verizon & AT&T use
   (NYCMNY = New York, NY; PHLAPA = Philadelphia, PA).
   Add more as you find them: code: [longitude, latitude, "Name"]
   --------------------------------------------------------------------- */
const CITIES = {
  // US
  nyc: [-74.006, 40.713, "New York, NY"], jfk: [-74.006, 40.713, "New York, NY"], lga: [-74.006, 40.713, "New York, NY"],
  nycmny: [-74.006, 40.713, "New York, NY"], newyork: [-74.006, 40.713, "New York, NY"],
  ewr: [-74.172, 40.736, "Newark, NJ"], nwk: [-74.172, 40.736, "Newark, NJ"], nwrknj: [-74.172, 40.736, "Newark, NJ"], newark: [-74.172, 40.736, "Newark, NJ"],
  phl: [-75.165, 39.953, "Philadelphia, PA"], phlapa: [-75.165, 39.953, "Philadelphia, PA"],
  bos: [-71.057, 42.361, "Boston, MA"], bstnma: [-71.057, 42.361, "Boston, MA"], boston: [-71.057, 42.361, "Boston, MA"],
  iad: [-77.487, 39.044, "Ashburn, VA"], ash: [-77.487, 39.044, "Ashburn, VA"], asbnva: [-77.487, 39.044, "Ashburn, VA"], ashburn: [-77.487, 39.044, "Ashburn, VA"],
  dca: [-77.037, 38.907, "Washington, DC"], wdc: [-77.037, 38.907, "Washington, DC"], washdc: [-77.037, 38.907, "Washington, DC"],
  atl: [-84.388, 33.749, "Atlanta, GA"], atlnga: [-84.388, 33.749, "Atlanta, GA"], atlanta: [-84.388, 33.749, "Atlanta, GA"],
  mia: [-80.192, 25.762, "Miami, FL"], miamfl: [-80.192, 25.762, "Miami, FL"], miami: [-80.192, 25.762, "Miami, FL"],
  ord: [-87.630, 41.878, "Chicago, IL"], chi: [-87.630, 41.878, "Chicago, IL"], chcgil: [-87.630, 41.878, "Chicago, IL"], chicago: [-87.630, 41.878, "Chicago, IL"],
  dfw: [-96.797, 32.777, "Dallas, TX"], dal: [-96.797, 32.777, "Dallas, TX"], dllstx: [-96.797, 32.777, "Dallas, TX"], dallas: [-96.797, 32.777, "Dallas, TX"],
  hou: [-95.370, 29.760, "Houston, TX"], iah: [-95.370, 29.760, "Houston, TX"], hstntx: [-95.370, 29.760, "Houston, TX"],
  den: [-104.990, 39.739, "Denver, CO"], dnvrco: [-104.990, 39.739, "Denver, CO"], denver: [-104.990, 39.739, "Denver, CO"],
  lax: [-118.244, 34.052, "Los Angeles, CA"], lsanca: [-118.244, 34.052, "Los Angeles, CA"], losangeles: [-118.244, 34.052, "Los Angeles, CA"],
  sjc: [-121.886, 37.338, "San Jose, CA"], snjsca: [-121.886, 37.338, "San Jose, CA"], sanjose: [-121.886, 37.338, "San Jose, CA"],
  sfo: [-122.419, 37.775, "San Francisco, CA"], pao: [-122.143, 37.442, "Palo Alto, CA"],
  sea: [-122.332, 47.606, "Seattle, WA"], sttlwa: [-122.332, 47.606, "Seattle, WA"], seattle: [-122.332, 47.606, "Seattle, WA"],
  pdx: [-122.676, 45.523, "Portland, OR"], phx: [-112.074, 33.448, "Phoenix, AZ"], slc: [-111.891, 40.761, "Salt Lake City, UT"],
  msp: [-93.265, 44.978, "Minneapolis, MN"], stl: [-90.199, 38.627, "St. Louis, MO"], mci: [-94.579, 39.100, "Kansas City, MO"],
  clt: [-80.843, 35.227, "Charlotte, NC"], bna: [-86.781, 36.163, "Nashville, TN"],
  yyz: [-79.383, 43.653, "Toronto, CA"], yul: [-73.568, 45.502, "Montreal, CA"], ymq: [-73.568, 45.502, "Montreal, CA"],
  // Latin America
  mex: [-99.133, 19.433, "Mexico City, MX"], mty: [-100.316, 25.687, "Monterrey, MX"], gdl: [-103.349, 20.659, "Guadalajara, MX"], qro: [-100.389, 20.589, "Querétaro, MX"],
  bog: [-74.072, 4.711, "Bogotá, CO"], lim: [-77.043, -12.046, "Lima, PE"], scl: [-70.669, -33.449, "Santiago, CL"],
  gru: [-46.633, -23.551, "São Paulo, BR"], sao: [-46.633, -23.551, "São Paulo, BR"], eze: [-58.382, -34.604, "Buenos Aires, AR"],
  // Europe
  lhr: [-0.128, 51.507, "London, UK"], lon: [-0.128, 51.507, "London, UK"], london: [-0.128, 51.507, "London, UK"],
  ams: [4.897, 52.377, "Amsterdam, NL"], amsterdam: [4.897, 52.377, "Amsterdam, NL"],
  fra: [8.682, 50.110, "Frankfurt, DE"], frankfurt: [8.682, 50.110, "Frankfurt, DE"],
  par: [2.352, 48.857, "Paris, FR"], cdg: [2.352, 48.857, "Paris, FR"], paris: [2.352, 48.857, "Paris, FR"],
  mad: [-3.704, 40.417, "Madrid, ES"], mxp: [9.190, 45.464, "Milan, IT"], muc: [11.576, 48.137, "Munich, DE"],
  vie: [16.373, 48.208, "Vienna, AT"], lju: [14.505, 46.056, "Ljubljana, SI"], arn: [18.069, 59.329, "Stockholm, SE"],
  cph: [12.568, 55.676, "Copenhagen, DK"], dub: [-6.260, 53.350, "Dublin, IE"], zrh: [8.541, 47.377, "Zurich, CH"],
  bru: [4.352, 50.847, "Brussels, BE"], waw: [21.012, 52.230, "Warsaw, PL"], prg: [14.438, 50.076, "Prague, CZ"],
  // Asia / Oceania
  nrt: [139.692, 35.690, "Tokyo, JP"], hnd: [139.692, 35.690, "Tokyo, JP"], tyo: [139.692, 35.690, "Tokyo, JP"],
  hkg: [114.169, 22.319, "Hong Kong"], sin: [103.820, 1.352, "Singapore"], icn: [126.978, 37.567, "Seoul, KR"],
  tpe: [121.565, 25.033, "Taipei, TW"], bom: [72.878, 19.076, "Mumbai, IN"], del: [77.209, 28.614, "Delhi, IN"],
  syd: [151.209, -33.869, "Sydney, AU"],
};

/* Colors for visitors' lines, chosen to stand apart from your own */
const PALETTE = ["#ff6ad5", "#f5ff3d", "#ff7a1a", "#7df9ff", "#c9a0ff", "#ffffff", "#ff9e9e", "#9dff00"];

/* =====================================================================
   Parsing pasted traceroute text (Windows tracert or Mac/Linux traceroute)
   ===================================================================== */
function isPrivate(ip) {
  if (!ip) return false;
  if (/^(10\.|192\.168\.|127\.|169\.254\.)/.test(ip)) return true;
  let m = ip.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  m = ip.match(/^100\.(\d+)\./);            // carrier-grade NAT, 100.64–100.127
  if (m && +m[1] >= 64 && +m[1] <= 127) return true;
  return /^(f[cd]|fe8)/i.test(ip);          // IPv6 private / link-local
}

function cityFromName(name) {
  if (!name || /^[0-9a-f.:]+$/i.test(name)) return null;   // bare IP, no clue
  for (const word of name.toLowerCase().split(/[^a-z0-9]+/)) {
    for (const key of [word, word.replace(/\d.*$/, ""), word.slice(0, 6)]) {
      if (key.length >= 3 && CITIES[key]) return key;
    }
  }
  return null;
}

function parseTraceroute(text) {
  let target = "";
  let last = 0;
  const hops = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    let m = line.match(/^(?:tracing route to|traceroute6? to)\s+(\S+?),?(?:\s+[[(]([^\])]+)[\])])?(?:,|\s|$)/i);
    if (m) { target = m[2] && m[2] !== m[1] ? `${m[1]} [${m[2]}]` : m[1]; continue; }

    m = line.match(/^(\d{1,2})\s+(.*)$/);
    if (!m || +m[1] <= last || +m[1] > 64) continue;
    const n = +m[1];
    last = n;
    const rest = m[2];
    const rtts = [...rest.matchAll(/<?(\d+(?:\.\d+)?)\s*ms/g)].map((x) => parseFloat(x[1]));
    const left = rest.replace(/<?\d+(?:\.\d+)?\s*ms/g, " ").replace(/\*/g, " ")
      .replace(/request timed out\.?/i, " ").replace(/![A-Z]?\d*/g, " ").trim();

    let name = "", ip = "";
    if ((m = left.match(/^(\S+)\s+[[(]([0-9a-f.:]+)[\])]/i))) { name = m[1]; ip = m[2]; }
    else if ((m = left.match(/^([0-9a-f]*[.:][0-9a-f.:]+)/i))) { ip = m[1]; }
    else if ((m = left.match(/^(\S+)/))) { name = m[1]; }
    if (name === ip) name = "";

    let seen, likely, at = "";
    if (!name && !ip) {
      seen = "* * * Request timed out.";
      likely = "Didn't answer. Many routers ignore these probes";
    } else {
      seen = name ? (ip ? `${name} [${ip}]` : name) : ip;
      at = cityFromName(name) || "";
      if (isPrivate(ip)) likely = "A private address that only exists inside a local network, so it can't be mapped";
      else if (at) likely = `Placed from a clue in its name: ${CITIES[at][2]}`;
      else if (name) likely = "No location clue in its name";
      else likely = "No hostname, so no location clue";
    }
    hops.push({ n, seen, likely, at, rtt: rtts.length ? rtts.sort((a, b) => a - b)[rtts.length >> 1] : null });
  }
  const answered = hops.filter((h) => h.rtt != null);
  const finalRtt = answered.length ? `~${Math.round(answered[answered.length - 1].rtt)} ms` : "";
  return { target, finalRtt, hops: hops.map(({ rtt, ...h }) => h) };
}

/* =====================================================================
   Turning database records into traces the globe understands
   ===================================================================== */
const str = (v, max) => String(v ?? "").slice(0, max);
const ipOf = (seen) => (String(seen).match(/\[([0-9a-f.:]+)\]$/i) || String(seen).match(/^([0-9a-f]*[.:][0-9a-f.:]+)$/i) || [])[1] || "";
const shortTarget = (t) => str(t, 200).replace(/\s*\[.*$/, "") || "somewhere";

function colorFor(key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function toTrace(key, v) {
  const hops = (Array.isArray(v.hops) ? v.hops : Object.values(v.hops || {})).slice(0, 64).map((h) => {
    const at = CITIES[h.at] ? [...CITIES[h.at]] : null;    // look the code up; unknown codes aren't drawn
    return [Number(h.n) || 0, str(h.seen, 200), str(h.likely, 200), at];
  });
  return {
    id: "v-" + key,
    from: "visitors",
    by: str(v.name, 40) || "someone",
    color: colorFor(key),
    label: shortTarget(v.target),
    target: str(v.target, 200),
    finalRtt: str(v.finalRtt, 20),
    note: str(v.note, 600),
    hops,
  };
}

/* Which routers does a route share with the other routes on the page? */
function withOverlaps(list) {
  const all = [
    ...(window.TRACE_CONFIG.traces || []).map((t) => ({ id: t.id, name: `my ${t.label} trace from ${t.from}`, hops: t.hops })),
    ...list.map((t) => ({ id: t.id, name: `${t.by}'s ${t.label} trace`, hops: t.hops })),
  ];
  const owners = new Map();   // ip -> set of trace ids
  for (const t of all) for (const h of t.hops) {
    const ip = ipOf(h[1]);
    if (!ip || isPrivate(ip)) continue;
    if (!owners.has(ip)) owners.set(ip, new Set());
    owners.get(ip).add(t.id);
  }
  return list.map((t) => {
    const shared = new Map();
    for (const h of t.hops) {
      for (const other of owners.get(ipOf(h[1])) || []) if (other !== t.id) shared.set(other, (shared.get(other) || 0) + 1);
    }
    const names = [...shared].sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([id, n]) => `${all.find((x) => x.id === id).name} (${n} router${n > 1 ? "s" : ""})`);
    const overlap = names.length
      ? `Routers in common with other routes: ${names.join(", ")}.`
      : "No routers in common with any other route yet.";
    return { ...t, conclusion: (t.note ? t.note + " " : "") + overlap };
  });
}

/* =====================================================================
   Page wiring
   ===================================================================== */
const $ = (s) => document.querySelector(s);
const form = $("#share-form");
const status = $("#share-status");
const preview = $("#share-preview");
const button = form.querySelector("button[type=submit]");
let pendingSelect = null;

window.TRACE_CONFIG.origins.visitors = { label: "Visitors", opacity: 0.9, at: null };

// "Where did you run it from?" options
const citySel = form.elements.city;
const seenNames = new Set();
Object.entries(CITIES)
  .filter(([, c]) => !seenNames.has(c[2]) && seenNames.add(c[2]))
  .sort((a, b) => a[1][2].localeCompare(b[1][2]))
  .forEach(([key, c]) => citySel.add(new Option(c[2], key)));

function render(list) {
  window.tracerouteMap.setShared(withOverlaps(list));
  const people = new Set(list.map((t) => t.by.toLowerCase())).size;
  $("#share-count").textContent = list.length
    ? `${list.length} route${list.length > 1 ? "s" : ""} from ${people} ${people > 1 ? "people" : "person"} so far.`
    : "No one has added a route yet. Be the first.";
  if (pendingSelect && list.some((t) => t.id === pendingSelect)) {
    window.tracerouteMap.select(pendingSelect);
    pendingSelect = null;
  }
}

function currentParse() {
  const p = parseTraceroute(form.elements.trace.value);
  if (!p.target) p.target = form.elements.dest.value.trim();
  // If they told us where they are, pin the first hop (their own router) there.
  if (form.elements.city.value && p.hops.length && !p.hops[0].at) p.hops[0].at = form.elements.city.value;
  return p;
}

function updatePreview() {
  const p = currentParse();
  const placed = p.hops.filter((h) => h.at).length;
  const needsDest = !p.target;
  form.elements.dest.closest("label").hidden = !form.elements.trace.value.trim() || (!needsDest && !form.elements.dest.value);
  if (!form.elements.trace.value.trim()) preview.textContent = "";
  else if (!p.hops.length) preview.textContent = "I can't find any hops in that text. Paste the whole output, starting with the line that says “Tracing route to” or “traceroute to”.";
  else preview.textContent = `Found ${p.hops.length} hops to ${p.target || "(unknown destination)"}; ${placed} of them can go on the map${p.finalRtt ? `; the last one answered in ${p.finalRtt}` : ""}.`;
  button.disabled = !p.hops.length || !placed || !p.target;
}
form.addEventListener("input", updatePreview);

let saveRoute;
const configured = !firebaseConfig.apiKey.startsWith("PASTE");

if (configured) {
  const { initializeApp } = await import(`${FIREBASE}/firebase-app.js`);
  const { getDatabase, ref, push, onValue, query, limitToLast, serverTimestamp } = await import(`${FIREBASE}/firebase-database.js`);
  const db = getDatabase(initializeApp(firebaseConfig));
  const routes = ref(db, "routes");

  // Runs once now, then again every time anyone adds a route.
  onValue(query(routes, limitToLast(MAX_ROUTES)), (snap) => {
    const list = [];
    snap.forEach((child) => { list.push(toTrace(child.key, child.val())); });
    render(list);
  }, (err) => { status.textContent = "Couldn't load shared routes: " + err.message; });

  saveRoute = async (data) => (await push(routes, { ...data, createdAt: serverTimestamp() })).key;
  status.textContent = "Live: new routes appear for everyone as soon as they're added.";
} else {
  const local = [];
  saveRoute = async (data) => {
    const key = "demo" + local.length;
    local.push(toTrace(key, data));
    render(local);
    return key;
  };
  render(local);
  status.textContent = "Demo mode: routes stay in this tab only. Add your Firebase config in shared.js to share them.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const p = currentParse();
  const name = form.elements.name.value.trim();
  if (!name) { form.elements.name.focus(); return; }
  button.disabled = true;
  try {
    const key = await saveRoute({
      name: name.slice(0, 40),
      target: p.target.slice(0, 200),
      finalRtt: p.finalRtt,
      note: form.elements.note.value.trim().slice(0, 600),
      hops: p.hops.slice(0, 64),
    });
    pendingSelect = "v-" + key;
    if (window.tracerouteMap.traces.some((t) => t.id === pendingSelect)) { window.tracerouteMap.select(pendingSelect); pendingSelect = null; }
    form.elements.trace.value = "";
    form.elements.note.value = "";
    form.elements.dest.value = "";
    updatePreview();
    preview.textContent = "Added. Your route is highlighted on the globe.";
  } catch (err) {
    preview.textContent = "Couldn't save: " + err.message;
    button.disabled = false;
  }
});
updatePreview();

// For testing in the console: tracerouteShared.parse(text)
window.tracerouteShared = { parse: parseTraceroute, cityFromName };
