/* =====================================================================
   TRACEROUTE MAP — YOUR DATA
   This is the only file you need to edit to add traces.

   HOW TO ADD A TRACE (e.g. a school trace)
   ---------------------------------------
   1. Run tracert / traceroute and copy the output.
   2. Add one object to the `traces` list at the bottom of this file.
      Copy an existing one and change these fields:
        id          any unique name, e.g. "google-school"
        dest        a key from `destinations` below (sets the color)
        from        a key from `origins` below ("home" or "school")
        label       name shown on the chip, e.g. "Gmail"
        target      what you traced, shown in the notes panel
        finalRtt    the time on the last hop, e.g. "~15 ms"
        conclusion  1–3 sentences on what stands out about this path
        hops        one row per hop (see below)
   3. Save, refresh the page. The line, chip and popups appear on their own.

   HOW A HOP ROW WORKS
   -------------------
   [ hop number, "what you see", "what it likely is", place ]

     [4, "loopback1.NWRKNJMD-PPR01-CC.ALTER.NET", "Verizon Business, Newark", "EWR"]

   The last item is where to draw the hop on the globe:
     • a key from `places` below, like "EWR"
     • or null when you have no location clue yet (timeouts, bare IPs).
       Those hops aren't drawn; they are listed in the popup of the last
       hop that was placed, and in the "All hops" list under the notes.
     • or an inline place: [-87.63, 41.88, "Chicago, IL"]  (longitude first!)

   Good location clues: city codes in hostnames (PHLAPA = Philadelphia,
   Chicago3 = Chicago), airport codes (lga, ewr, ord, sea), and the
   results of whois / geoIP lookups on the IP.

   HOW TO ADD A NEW PLACE, DESTINATION OR ORIGIN
   ---------------------------------------------
   Add a line to `places`, `destinations` or `origins` below. Colors are
   any CSS color. Origin `opacity` is how bright that origin's lines are.
   ===================================================================== */

window.TRACE_CONFIG = {

  /* Where traces start. `at` is a key from `places`. */
  origins: {
    home:   { label: "Home",   opacity: 1.0,  at: "HOME"   },
    school: { label: "School", opacity: 0.45, at: "SCHOOL" },
  },

  /* What you traced. One color per destination. */
  destinations: {
    whatsapp: { label: "WhatsApp Web", color: "#22ff55" },  // green
    google:   { label: "Gmail",        color: "#ff2e4d" },  // red
    albert:   { label: "NYU Albert",   color: "#b14dff" },  // purple
    sat:      { label: "SAT.gob.mx",   color: "#ffb020" },  // amber
    aljazeera: { label: "Al Jazeera", color: "#3db8ff" },  // blue
    filmoteka: { label: "Filmoteka (Slovenia)", color: "#00e0b0" },  // teal
  },

  /* City-level points: [longitude, latitude, "name shown on the map"] */
  places: {
    HOME:   [-74.006, 40.713, "New York, NY"],   // a generic NYC point, not your address
    SCHOOL: [-73.997, 40.729, "NYU, New York"],  // change this if you connect from another building
    NYC:    [-74.006, 40.713, "New York, NY"],
    NYU:    [-73.997, 40.729, "NYU, New York"],
    PHL:    [-75.165, 39.953, "Philadelphia, PA"],
    EWR:    [-74.172, 40.736, "Newark, NJ"],
    CHI:    [-87.630, 41.878, "Chicago, IL"],
    ASH:    [-77.487, 39.044, "Ashburn, VA"],
    LON:    [-0.128, 51.507, "London, UK"],
    BOS:    [-71.057, 42.361, "Boston, MA"],
    AMS:    [4.897, 52.377, "Amsterdam, NL"],
    FRA:    [8.682, 50.110, "Frankfurt, DE"],
    MUC:    [11.576, 48.137, "Munich, DE"],
    VIE:    [16.373, 48.208, "Vienna, AT"],
    LJU:    [14.505, 46.056, "Ljubljana, SI"],
  },

  /* ------------------------------------------------------------------
     THE TRACES
     ------------------------------------------------------------------ */
  traces: [

    /* ---------- WhatsApp Web, from home (IPv4) ---------- */
    {
      id: "whatsapp-home",
      dest: "whatsapp",
      from: "home",
      label: "WhatsApp Web",
      target: "webwhatsapp.com [104.247.81.99]",
      finalRtt: "~57 ms",
      conclusion:
        "The longest and oddest route of the three. My traffic leaves New York, detours through " +
        "Philadelphia on Verizon's network, then is handed to Lumen in Chicago. The last hops sit " +
        "about 30 ms beyond Chicago, which suggests a server far to the west or south. The 205–529 ms " +
        "spike at hop 10 is a router that answers probes slowly, not a real delay. Two things to check: " +
        "the last hops (104.247.x.x) have no location clue yet, so the line stops in Chicago until I look " +
        "them up with whois, and webwhatsapp.com is not the same name as WhatsApp Web's official address, " +
        "web.whatsapp.com, so it is worth finding out who owns it.",
      hops: [
        [1,  "CR1000A.mynetworksettings.com [192.168.1.1]",           "My Fios router (a private address, so it can't be mapped)", "HOME"],
        [2,  "lo0-100.NYCMNY-VFTTP-393.verizon-gni.net [72.80.171.1]", "Verizon's local Fios equipment in New York City (VFTTP = fiber to the premises)", "NYC"],
        [3,  "G104-0-0-30.PHLAPA-LCR-21.verizon-gni.net [100.41.6.240]", "A Verizon router in Philadelphia", "PHL"],
        [4,  "* * * Request timed out.",                                "A router that forwarded my packets but didn't answer", null],
        [5,  "ALTER.NET.customer.alter.net [208.214.138.94]",           "Verizon's backbone (Verizon Business), probably where traffic is handed to the next network", null],
        [6,  "ae21.3621.ear1.Chicago3.net.lumen.tech [4.69.141.158]",   "Lumen (formerly Level 3), in Chicago", "CHI"],
        [7,  "4.53.96.234",                                             "No hostname. The 4.x range historically belonged to Level 3, so probably still Lumen", null],
        [8,  "38.142.62.154",                                           "No hostname. 38.x addresses historically belong to Cogent, so possibly another handoff", null],
        [9,  "104.247.84.102",                                          "Same address block as the destination, so probably inside its own network", null],
        [10, "104.247.80.26",                                           "Same block. The 205–529 ms spike is a slow-to-answer router, not real delay", null],
        [11, "104.247.81.99",                                           "The destination, webwhatsapp.com. Look up its owner with whois", null],
      ],
    },

    /* ---------- Gmail, from home (IPv6) ---------- */
    {
      id: "google-home",
      dest: "google",
      from: "home",
      label: "Gmail",
      target: "gmail.com [2607:f8b0:4006:801::2005]",
      finalRtt: "~15 ms",
      conclusion:
        "The shortest, cleanest path. Verizon Business hands my traffic to Google in Newark, NJ after " +
        "only four hops, and it lands on a Google server with a LaGuardia (New York) name in eight hops " +
        "and about 15 ms. Google runs servers close to its users, so my email traffic barely leaves the " +
        "New York area. The hops in the middle have no hostname, but 2001:4860 is Google's own address block.",
      hops: [
        [1, "2600:4041:5809:4100::1",                                   "My home router", "HOME"],
        [2, "2600:4041:5800::1",                                        "My ISP's local network (Verizon Fios)", null],
        [3, "2600:4000:1:132::ca",                                      "Still my ISP's network, no hostname", null],
        [4, "loopback1.NWRKNJMD-PPR01-CC.ALTER.NET [2600:802::1b]",     "Verizon Business peering router in Newark, NJ (NWRKNJ = Newark; PPR likely = peering router)", "EWR"],
        [5, "2600:803:d0f::1da",                                        "Verizon Business again, no hostname", null],
        [6, "2001:4860:0:1::84cb",                                      "Google's network (2001:4860 is Google's IPv6 block)", null],
        [7, "2001:4860:0:1::5f77",                                      "Google's network", null],
        [8, "lga34s11-in-x05.1e100.net [2607:f8b0:4006:801::2005]",     "A Google server. lga = LaGuardia, so the New York area; 1e100.net is Google's domain", "NYC"],
      ],
    },

    /* ---------- NYU Albert, from home (IPv4) ---------- */
    {
      id: "albert-home",
      dest: "albert",
      from: "home",
      label: "NYU Albert",
      target: "albert.nyu.edu [216.165.62.30]",
      finalRtt: "~13 ms",
      conclusion:
        "A short trip that still zigzags: New York, Philadelphia, New York, Newark, New York, on Verizon " +
        "and then Zayo, before entering NYU's own network. It only takes about 13 ms, but the route is far " +
        "from a straight line. Hops 14–19 are inside NYU, where firewalls hide the routers, so they show as " +
        "timeouts. From school, I expect this path to shrink to a few hops entirely inside NYU.",
      hops: [
        [1,  "CR1000A.mynetworksettings.com [192.168.1.1]",                    "My Fios router", "HOME"],
        [2,  "lo0-100.NYCMNY-VFTTP-393.verizon-gni.net [72.80.171.1]",         "Verizon's local Fios equipment in New York City", "NYC"],
        [3,  "G104-0-0-30.PHLAPA-LCR-21.verizon-gni.net [100.41.6.240]",       "A Verizon router in Philadelphia", "PHL"],
        [4,  "100.lag-13.NYCMNYAA-PPR01-CC.ALTER.NET [140.222.9.217]",         "Verizon Business peering router, back in New York", "NYC"],
        [5,  "* * * Request timed out.",                                        "A router that didn't answer", null],
        [6,  "ae18.cr1.ewr1.us.zip.zayo.com [64.125.22.0]",                    "Zayo, in Newark (ewr = Newark airport code)", "EWR"],
        [7,  "ae7.mcr1.lga5.us.zip.zayo.com [64.125.23.91]",                   "Zayo, in the New York area (lga = LaGuardia)", "NYC"],
        [8,  "* * * Request timed out.",                                        "A router that didn't answer", null],
        [9,  "209.66.118.177.IDIA-282827-ZYO.zip.zayo.com [209.66.118.177]",   "Another Zayo interface, tagged with what looks like a customer circuit ID: probably the link to NYU", null],
        [10, "* * * Request timed out.",                                        "A router that didn't answer", null],
        [11, "* * * Request timed out.",                                        "A router that didn't answer", null],
        [12, "* * * Request timed out.",                                        "A router that didn't answer", null],
        [13, "pa7500-ae13092.net.nyu.edu [128.122.254.200]",                   "NYU's own network", "NYU"],
        [14, "* * * Request timed out.",                                        "Inside NYU: probably a firewall blocking the probes", null],
        [15, "* * * Request timed out.",                                        "Inside NYU: probably a firewall blocking the probes", null],
        [16, "* * * Request timed out.",                                        "Inside NYU: probably a firewall blocking the probes", null],
        [17, "* * * Request timed out.",                                        "Inside NYU: probably a firewall blocking the probes", null],
        [18, "* * * Request timed out.",                                        "Inside NYU: probably a firewall blocking the probes", null],
        [19, "* * * Request timed out.",                                        "Inside NYU: probably a firewall blocking the probes", null],
        [20, "albert.nyu.edu [216.165.62.30]",                                 "The destination: NYU's student portal", "NYU"],
      ],
    },
    /* ---------- Gmail, from school (IPv4) ---------- */
    {
      id: "google-school",
      dest: "google",
      from: "school",
      label: "Gmail",
      target: "gmail.com [142.251.167.17]",
      finalRtt: "~10 ms",
      conclusion:
        "From school, Gmail is only 12 hops away, and nine of them are inside NYU's own network, mostly " +
        "private 10.x addresses that only exist on campus. Traffic leaves through NYU's external gateway, " +
        "crosses NYSERNet (the New York State education and research network) in New York City, and reaches " +
        "a Google server in about 10 ms. The 53 ms on the first probe is a one-off delay. Unlike the path " +
        "from home, there is no Verizon and no detour through Newark: the route stays in the city.",
      hops: [
        [1,  "wlangwc-7e12-vl1471.wireless.net.nyu.edu [10.20.0.2]",       "NYU's campus Wi-Fi gateway (wlan = wireless LAN). A private address, so it can't be mapped", "SCHOOL"],
        [2,  "coregwd-te7-8-vl901-wlangwc-7e12.net.nyu.edu [10.254.8.44]", "An NYU core gateway (coregw), still a private address inside campus", "NYU"],
        [3,  "nyugwb-fo2-18-coregwd.net.nyu.edu [10.254.8.51]",            "Another NYU gateway (nyugwb), private address", "NYU"],
        [4,  "pa7500-ae2203.net.nyu.edu [10.254.30.142]",                  "Probably a Palo Alto PA-7500 firewall (pa7500), the same kind of device as hop 13 in the Albert trace from home", "NYU"],
        [5,  "nyugwa-vl3092.net.nyu.edu [128.122.254.201]",                "An NYU gateway (nyugwa) with a public address; 128.122.x.x is NYU's address block", "NYU"],
        [6,  "vl3000-nyunatb.net.nyu.edu [10.254.30.70]",                  "Probably NYU's NAT box (nat = network address translation), which swaps private campus addresses for public ones", "NYU"],
        [7,  "dmzgwb-vl755.net.nyu.edu [192.76.177.66]",                   "NYU's DMZ gateway (dmz = the buffer zone between campus and the outside internet)", "NYU"],
        [8,  "dmzgwc-e13-1-nyugwa.net.nyu.edu [10.254.255.78]",            "Another DMZ gateway, private address", "NYU"],
        [9,  "extgwa-dmzgwc.net.nyu.edu [10.254.255.63]",                  "NYU's external gateway (extgw), the last router before traffic leaves NYU", "NYU"],
        [10, "nyc-9208-nyu-cdn.nysernet.net [199.109.105.5]",              "NYSERNet, the New York State education and research network, in New York City (nyc). Likely NYU's upstream provider", "NYC"],
        [11, "nyc32-55a1-nyc32-9208-cdn.nysernet.net [199.109.107.202]",   "Another NYSERNet router in New York City", "NYC"],
        [12, "ww-in-f17.1e100.net [142.251.167.17]",                       "A Google server (1e100.net is Google's domain). No city in the name, so it isn't placed on the map yet", null],
      ],
    },
    /* ---------- NYU Albert, from school (IPv4) ---------- */
    {
      id: "albert-school",
      dest: "albert",
      from: "school",
      label: "NYU Albert",
      target: "albert.nyu.edu [216.165.62.30]",
      finalRtt: "~5 ms",
      conclusion:
        "From school, Albert is only 7 hops and about 5 ms away, and the whole path stays inside NYU's own " +
        "network. Every hop except the destination uses a private 10.x address, which only exists on campus, " +
        "so this traffic never reaches the public internet. The first two hops (the campus Wi-Fi gateway and a " +
        "core gateway) are the same as in my Gmail trace from school, but then the path turns toward NYU's " +
        "internal servers instead of the external gateway. From home, the same site took a zigzag through " +
        "Verizon and Zayo via Philadelphia and Newark; from school it never leaves campus. On the globe this " +
        "trace is a single point, because every hop sits at NYU.",
      hops: [
        [1, "wlangwc-7e12-vl1471.wireless.net.nyu.edu [10.20.0.2]",                            "NYU's campus Wi-Fi gateway, the same first hop as in the Gmail trace from school. A private address, so it can't be mapped", "SCHOOL"],
        [2, "coregwd-te7-8-vl901-wlangwc-7e12.net.nyu.edu [10.254.8.44]",                      "An NYU core gateway (coregw), private address, also shared with the Gmail trace", "NYU"],
        [3, "rdcgwb-eth28-1-904-coregwd-fo2-0-14-904-p2p.net.nyu.edu [10.254.8.121]",          "Another NYU gateway (rdcgwb). This is where the path splits away from the Gmail route, probably toward NYU's internal servers", "NYU"],
        [4, "v3100-blf201-rdcgwb.net.nyu.edu [10.40.1.2]",                                     "An NYU internal router just past rdcgwb, private address", "NYU"],
        [5, "v3243-sns-low-pbr-gw.net.nyu.edu [10.254.248.97]",                                "An NYU gateway, private address (pbr in the name probably means policy-based routing)", "NYU"],
        [6, "10.40.8.35",                                                                       "No hostname, a private NYU address, probably in the same network as the destination", null],
        [7, "albert.nyu.edu [216.165.62.30]",                                                  "The destination: NYU's student portal", "NYU"],
      ],
    },
    /* ---------- SAT (Mexico), from school (IPv4) ---------- */
    {
      id: "sat-school",
      dest: "sat",
      from: "school",
      label: "SAT.gob.mx",
      target: "sat.gob.mx [3.162.112.61]",
      finalRtt: "~9 ms",
      conclusion:
        "Mexico's tax authority website is served from Virginia, not Mexico. The first nine hops are inside " +
        "NYU's network, the same as my Gmail trace from school. Then the traffic goes out through NYSERNet, " +
        "which carries it from New York City to Ashburn, Virginia, and hands it to Amazon there. The last hop " +
        "is a CloudFront server, Amazon's content delivery network, which keeps copies of sites on servers near " +
        "each visitor. That is why a page hosted for Mexico answers in about 9 ms from campus. The five timeouts " +
        "in the middle are inside Amazon's network, which does not answer these probes.",
      hops: [
        [1,  "wlangwc-7e12-vl1471.wireless.net.nyu.edu [10.20.0.2]",         "NYU's campus Wi-Fi gateway. A private address, so it can't be mapped", "SCHOOL"],
        [2,  "coregwd-te7-8-vl901-wlangwc-7e12.net.nyu.edu [10.254.8.44]",   "An NYU core gateway (coregw), private address", "NYU"],
        [3,  "nyugwb-fo2-18-coregwd.net.nyu.edu [10.254.8.51]",              "Another NYU gateway (nyugwb), private address", "NYU"],
        [4,  "pa7500-ae2203.net.nyu.edu [10.254.30.142]",                    "Probably a Palo Alto PA-7500 firewall (pa7500)", "NYU"],
        [5,  "nyugwb-vl3093.net.nyu.edu [128.122.254.203]",                  "An NYU gateway with a public address; 128.122.x.x is NYU's address block", "NYU"],
        [6,  "vl3000-nyunatb.net.nyu.edu [10.254.30.70]",                    "Probably NYU's NAT box, which swaps private campus addresses for public ones", "NYU"],
        [7,  "dmzgwb-vl755.net.nyu.edu [192.76.177.66]",                     "NYU's DMZ gateway (the buffer zone between campus and the outside internet)", "NYU"],
        [8,  "dmzgwc-e13-1-nyugwa.net.nyu.edu [10.254.255.78]",              "Another DMZ gateway, private address", "NYU"],
        [9,  "extgwa-dmzgwc.net.nyu.edu [10.254.255.63]",                    "NYU's external gateway (extgw), the last router before traffic leaves NYU", "NYU"],
        [10, "nyc-9208-nyu-cdn.nysernet.net [199.109.105.5]",                "NYSERNet, the New York State education and research network, in New York City (nyc)", "NYC"],
        [11, "ash-9204-nyc-9208-cdn.nysernet.net [199.109.107.186]",         "A NYSERNet router in Ashburn, Virginia (ash). The path leaves New York here", "ASH"],
        [12, "equinix02-iad2.amazon.com [206.126.236.35]",                   "Amazon, at an Equinix data center in the Ashburn / Washington Dulles area (iad2). Where NYSERNet hands traffic to Amazon", "ASH"],
        [13, "* * * Request timed out.",                                     "Inside Amazon's network, which doesn't answer these probes", null],
        [14, "* * * Request timed out.",                                     "Inside Amazon's network, which doesn't answer these probes", null],
        [15, "* * * Request timed out.",                                     "Inside Amazon's network, which doesn't answer these probes", null],
        [16, "* * * Request timed out.",                                     "Inside Amazon's network, which doesn't answer these probes", null],
        [17, "* * * Request timed out.",                                     "Inside Amazon's network, which doesn't answer these probes", null],
        [18, "server-3-162-112-61.iad61.r.cloudfront.net [3.162.112.61]",    "The destination: an Amazon CloudFront server. iad61 points to the Ashburn area", "ASH"],
      ],
    },
    /* ---------- Al Jazeera, from school (IPv4) ---------- */
    {
      id: "aljazeera-school",
      dest: "aljazeera",
      from: "school",
      label: "Al Jazeera",
      target: "aljazeera.com [13.49.84.150]",
      finalRtt: "",   // the trace never reached the server
      conclusion:
        "The only trace of mine that crosses an ocean. The first nine hops are inside NYU. Then the traffic " +
        "leaves through GTT, a large backbone provider, in New York City, and the very next hop is a GTT " +
        "router in London. The time jumps from about 22 ms to about 73 ms between those two hops, and a " +
        "50 ms leap like that is the Atlantic undersea cable. After London, every hop times out and the " +
        "trace never reaches the server, so I can't see the end of the route. The destination address " +
        "probably belongs to Amazon's Stockholm region, but I still need to confirm that. Unlike my other " +
        "school traces, which left through NYSERNet, this one used a different NYU gateway and a different " +
        "provider.",
      hops: [
        [1,  "wlangwc-7e12-vl1471.wireless.net.nyu.edu [10.20.0.2]",           "NYU's campus Wi-Fi gateway. A private address, so it can't be mapped", "SCHOOL"],
        [2,  "coregwc-te7-8-vl901-wlangwc-7e12.net.nyu.edu [10.254.6.44]",     "An NYU core gateway (coregw), private address. The c in coregwc instead of d suggests a second, redundant gateway", "NYU"],
        [3,  "nyugwb-fo1-18-coregwc.net.nyu.edu [10.254.6.51]",                "Another NYU gateway (nyugwb), private address", "NYU"],
        [4,  "pa7500-ae2203.net.nyu.edu [10.254.30.142]",                      "Probably a Palo Alto PA-7500 firewall (pa7500)", "NYU"],
        [5,  "nyugwb-vl3093.net.nyu.edu [128.122.254.203]",                    "An NYU gateway with a public address; 128.122.x.x is NYU's address block", "NYU"],
        [6,  "vl3000-nyunatb.net.nyu.edu [10.254.30.70]",                      "Probably NYU's NAT box, which swaps private campus addresses for public ones", "NYU"],
        [7,  "dmzgwb-vl755.net.nyu.edu [192.76.177.66]",                       "NYU's DMZ gateway (the buffer zone between campus and the outside internet)", "NYU"],
        [8,  "dmzgwd-e13-1-nyugwa.net.nyu.edu [10.254.255.80]",                "Another DMZ gateway (dmzgwd instead of dmzgwc in other traces), private address", "NYU"],
        [9,  "extgwd-dmzgwb.net.nyu.edu [10.254.255.5]",                       "NYU's external gateway (extgw), the last router before traffic leaves NYU. A different one from the Gmail trace", "NYU"],
        [10, "ae0-3958.cr2-nyc2.ip4.gtt.net [209.120.137.217]",                "GTT, a large international backbone provider, in New York City (nyc2)", "NYC"],
        [11, "ae1.cr6-lon1.ip4.gtt.net [213.200.113.38]",                      "GTT in London (lon1). The 50 ms jump from the previous hop is the Atlantic undersea cable", "LON"],
        ...Array.from({ length: 19 }, (_, i) =>
          [12 + i, "* * * Request timed out.", "No reply. The trace never reached the destination, so I can't see where the route goes after London", null]),
      ],
    },
    /* ---------- Filmoteka (Slovenia), from home (IPv4) ---------- */
    {
      id: "filmoteka-home",
      dest: "filmoteka",
      from: "home",
      label: "Filmoteka",
      target: "filmoteka.si [193.2.1.67]",
      finalRtt: "~236 ms",
      conclusion:
        "The longest and most international path of any of my traces. After Verizon, my traffic is carried " +
        "entirely by Cogent, a single backbone provider, from New York up to Boston, across the Atlantic to " +
        "London, then down through Amsterdam, Frankfurt, Munich and Vienna before reaching Ljubljana. That's " +
        "seven cities in one company's network. From there, Arnes, Slovenia's national research and education " +
        "network (the Slovenian counterpart to NYU's NYSERNet), carries it the rest of the way to the " +
        "destination. The real transatlantic jump is between Boston and London, where the time rises from " +
        "about 15 ms to about 91 ms. The 409 ms reading at hop 9 is a single slow reply, not a real delay, " +
        "since the next hop drops right back down. Inside Arnes, the times bounce between about 104 and " +
        "305 ms with no clear pattern, which looks like a smaller, more congested network rather than added " +
        "distance.",
      hops: [
        [1,  "router.asus.com [192.168.50.1]",                                  "My home Wi-Fi router. A private address, so it can't be mapped", "HOME"],
        [2,  "lo0-100.NYCMNY-VFTTP-395.verizon-gni.net [100.33.69.1]",          "Verizon's local Fios equipment in New York City", "NYC"],
        [3,  "100.41.35.184",                                                   "No hostname, likely still Verizon", null],
        [4,  "* * * Request timed out.",                                        "A router that didn't answer", null],
        [5,  "* * * Request timed out.",                                        "A router that didn't answer", null],
        [6,  "be2272.ccr42.jfk02.atlas.cogentco.com [154.54.83.201]",           "Cogent, a global backbone provider, in New York (jfk02)", "NYC"],
        [7,  "be3472.ccr32.bos01.atlas.cogentco.com [154.54.46.33]",            "Cogent in Boston (bos01)", "BOS"],
        [8,  "port-channel3467.ccr92.lhr01.atlas.cogentco.com [154.54.94.46]",  "Cogent in London (lhr01 = Heathrow). The jump from Boston is the Atlantic crossing", "LON"],
        [9,  "be8444.ccr82.lon05.atlas.cogentco.com [154.54.72.181]",           "Cogent, still London (lon05). The 409 ms reading is a slow single reply, not a real delay", "LON"],
        [10, "be9036.ccr42.ams03.atlas.cogentco.com [154.54.72.186]",           "Cogent in Amsterdam (ams03)", "AMS"],
        [11, "be2950.ccr42.fra05.atlas.cogentco.com [154.54.72.42]",            "Cogent in Frankfurt (fra05)", "FRA"],
        [12, "be7944.ccr22.muc03.atlas.cogentco.com [154.54.75.97]",            "Cogent in Munich (muc03)", "MUC"],
        [13, "be9456.ccr82.vie01.atlas.cogentco.com [154.54.63.141]",           "Cogent in Vienna (vie01)", "VIE"],
        [14, "be4080.agr62.vie01.atlas.cogentco.com [130.117.50.82]",           "Cogent, still Vienna, a different router (agr62)", "VIE"],
        [15, "be9461.rcr62.lju01.atlas.cogentco.com [154.54.72.162]",           "Cogent in Ljubljana (lju01), Slovenia's capital", "LJU"],
        [16, "be9462.nr61.b021176-0.lju01.atlas.cogentco.com [154.25.17.165]",  "Cogent, still Ljubljana, a different router", "LJU"],
        [17, "149.6.52.146",                                                    "No hostname, between two Ljubljana routers, so likely still Ljubljana", "LJU"],
        [18, "rljtpl1.bb.arnes.si [88.200.7.247]",                              "Arnes, Slovenia's national research and education network, headquartered in Ljubljana. Where Cogent hands off to the destination's network", "LJU"],
        [19, "dc2f104a-root.bb.arnes.si [178.172.87.3]",                        "Arnes, still in Ljubljana", "LJU"],
        [20, "dc2f104a-arnes.bb.arnes.si [178.172.87.7]",                       "Arnes, still in Ljubljana", "LJU"],
        [21, "178.172.87.23",                                                   "No hostname, inside Arnes's address range", "LJU"],
        [22, "dc2l211b.bb.arnes.si [88.200.1.208]",                             "Arnes, still in Ljubljana", "LJU"],
        [23, "splet.arnes.si [193.2.1.67]",                                     "The destination: a Slovenian film archive site, hosted on Arnes's network", "LJU"],
      ],
    },
    /* Add school traces here, for example:
    {
      id: "google-school",
      dest: "google",
      from: "school",
      label: "Gmail",
      target: "gmail.com",
      finalRtt: "~8 ms",
      conclusion: "…",
      hops: [
        [1, "…", "The school router", "SCHOOL"],
        …
      ],
    },
    */
  ],
};
