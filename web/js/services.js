// Tout le code de la vue est dans une fonction anonyme : ses variables (ctx, state...) ne gênent pas
// les scripts des autres onglets. Seule initServices() est exposée, appelée par js/tabs.js.
(() => {
// Où tombent les services : carte de chaleur des services sur un court dessiné selon la surface.
// Données : web/data/charting_serve_direction.csv, charting_matches.csv, charting_player_info.csv
// (produites par prepare_data.py).

const ctx = {
  // Court, en mètres (dimensions officielles ITF)
  L: 23.77,            // longueur
  W: 10.97,            // largeur double
  S: 8.23,             // largeur simple
  SL: 6.40,            // ligne de service, depuis le filet
  RUN_BACK: 2.6,       // recul derrière la ligne de fond du serveur
  RUN_FAR: 2.4,        // recul derrière la ligne de fond du relanceur
  RUN_SIDE: 3.0,
  PX: 34,              // pixels par mètre
  SAMPLES: 4200,       // nombre d'impacts simulés pour la carte (fixe : la forme ne dépend pas de l'effectif)
  BANDWIDTH: 14,       // lissage de la carte de chaleur, en pixels
  N_THRESHOLDS: 14,
  T: 750,              // durée des transitions
  MIN_SERVES: 150,     // en dessous, la carte est signalée comme peu fiable
  ZONES: ["wide", "middle", "t"],
  ZONE_NAMES: { wide: "Extérieur", middle: "Corps", t: "Centre (T)" },
  SURFACES: [["All", "Toutes"], ["Hard", "Dur"], ["Clay", "Terre"], ["Grass", "Gazon"]],
  SERVES: [["Total", "Toutes"], ["1", "1re balle"], ["2", "2e balle"]],
  RANKS: [["all", "Tous"], ["10", "Top 10"], ["100", "Top 100"], ["101", "Au-delà"]],
  HANDS: [["all", "Tous"], ["R", "Droitiers"], ["L", "Gauchers"]],
  RESULTS: [["all", "Tous"], ["w", "Vainqueur"], ["l", "Perdant"]],
};

// Style du court selon la surface. La couleur de la carte de chaleur change aussi : elle doit
// contraster avec le court (bleu → teintes chaudes, terre orange → teintes froides, gazon vert →
// magenta-orangé). Chaque échelle reste séquentielle, avec une luminance croissante (séance 2).
ctx.STYLES = {
  All: {
    inner: "#2c3646", outer: "#222a36", line: "#d9dee6", net: "#0b0e12",
    heat: t => d3.interpolateInferno(0.18 + 0.82 * t),
  },
  Hard: {
    inner: "#2f62a8", outer: "#3f7c5c", line: "#ffffff", net: "#0e1622",
    heat: t => d3.interpolateYlOrRd(1 - 0.92 * t),
  },
  Clay: {
    inner: "#c4643a", outer: "#b95a33", line: "#f7efe6", net: "#2a1a12",
    heat: t => d3.interpolateYlGnBu(1 - 0.9 * t),
  },
  Grass: {
    inner: "#4d8a3a", outer: "#467f35", line: "#f6f8f2", net: "#13210e",
    heat: t => d3.interpolateMagma(0.25 + 0.75 * t),
  },
};

const state = {
  surface: "All", serve: "Total", players: [], country: "all",
  rank: "all", hand: "all", result: "all", yearMin: null, yearMax: null, faults: true,
};

// ---------------------------------------------------------------------------
// Géométrie, en mètres : x le long du court (0 = ligne de fond du serveur), y en travers
// (0 = ligne centrale, y < 0 côté égalité). La caméra est derrière le relanceur : le serveur est
// au fond (en haut), les carrés de service au premier plan, le carré égalité à droite.
// ---------------------------------------------------------------------------

const X = y => (ctx.W / 2 + ctx.RUN_SIDE - y) * ctx.PX;      // abscisse écran
const Y = x => (x + ctx.RUN_BACK) * ctx.PX;                    // ordonnée écran
const NET = () => ctx.L / 2;
// Rectangle écran couvrant [x0, x1] x [y0, y1] (mètres)
function box(sel, x0, x1, y0, y1) {
  return sel.attr("x", Math.min(X(y0), X(y1))).attr("y", Math.min(Y(x0), Y(x1)))
    .attr("width", Math.abs(X(y1) - X(y0))).attr("height", Math.abs(Y(x1) - Y(x0)));
}
const line = (g, x1, y1, x2, y2) => g.append("line")
  .attr("x1", X(y1)).attr("y1", Y(x1)).attr("x2", X(y2)).attr("y2", Y(x2));

// Limites latérales des trois zones de chaque carré (en mètres). Égalité : y < 0.
function zoneBounds(box, zone) {
  const h = ctx.S / 2, third = h / 3;
  const k = { wide: 0, middle: 1, t: 2 }[zone];
  return box === "deuce"
    ? [-h + k * third, -h + (k + 1) * third]
    : [h - (k + 1) * third, h - k * third];
}

// ---------------------------------------------------------------------------

function initServices() {
  Promise.all([
    d3.csv("data/charting_serve_direction.csv", d3.autoType),
    d3.csv("data/charting_matches.csv", d3.autoType),
    d3.csv("data/charting_player_info.csv", d3.autoType),
  ]).then(([dir, matches, info]) => {
    prepareData(dir, matches, info);
    drawCourt();
    initFilters();
    initDensityScale();
    update(false);
  });
}

function prepareData(dir, matches, info) {
  const byMatch = new Map(matches.map(m => [m.match_id, m]));
  const infoKey = new Map(info.map(d => [`${d.match_id}-${d.player}`, d]));
  ctx.rows = dir.map(d => {
    const m = byMatch.get(d.match_id);
    const i = infoKey.get(`${d.match_id}-${d.player}`) || {};
    return {
      ...d,
      row: String(d.row),
      name: m[`${d.player}_name`],
      hand: m[`${d.player}_hand`],
      surface: m.surface,
      year: m.date.getFullYear(),
      ioc: i.ioc || null,
      rank: i.rank ?? null,
    };
  });
  ctx.yearExtent = d3.extent(ctx.rows, d => d.year);
  state.yearMin = Math.max(ctx.yearExtent[0], 1990);
  state.yearMax = ctx.yearExtent[1];
}

// ---------------------------------------------------------------------------
// Le court
// ---------------------------------------------------------------------------

function drawCourt() {
  const [width, height] = courtSize();
  const svg = d3.select("#sv-court").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Court de tennis vu de dessus avec la carte de chaleur des services");
  ctx.svg = svg;
  const defs = svg.append("defs");
  const hw = ctx.W / 2, hs = ctx.S / 2, n = NET();

  // Grain de la terre battue et du dur
  const grain = defs.append("filter").attr("id", "sv-grain").attr("x", 0).attr("y", 0)
    .attr("width", 1).attr("height", 1);
  grain.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", 0.85)
    .attr("numOctaves", 2).attr("seed", 3).attr("result", "noise");
  grain.append("feColorMatrix").attr("in", "noise").attr("type", "matrix")
    .attr("values", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0").attr("result", "alpha");
  grain.append("feComposite").attr("in", "alpha").attr("in2", "SourceGraphic").attr("operator", "in");

  // Rayures de tonte du gazon, perpendiculaires à la longueur du court
  const stripe = ctx.L / 12 * ctx.PX;
  const mow = defs.append("pattern").attr("id", "sv-mow").attr("patternUnits", "userSpaceOnUse")
    .attr("width", 10).attr("height", stripe * 2).attr("y", Y(0));
  mow.append("rect").attr("width", 10).attr("height", stripe).attr("fill", "rgba(255,255,255,0.075)");

  // Éclairage de stade : plus clair au premier plan, assombri sur les bords
  const vignette = defs.append("radialGradient").attr("id", "sv-vignette").attr("cy", "60%").attr("r", "75%");
  vignette.append("stop").attr("offset", "50%").attr("stop-color", "#000").attr("stop-opacity", 0);
  vignette.append("stop").attr("offset", "100%").attr("stop-color", "#000").attr("stop-opacity", 0.4);
  const light = defs.append("linearGradient").attr("id", "sv-light")
    .attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  light.append("stop").attr("offset", "0%").attr("stop-color", "#000").attr("stop-opacity", 0.18);
  light.append("stop").attr("offset", "100%").attr("stop-color", "#fff").attr("stop-opacity", 0.06);

  const wear = defs.append("radialGradient").attr("id", "sv-wear");
  wear.append("stop").attr("offset", "0%").attr("stop-color", "#c2a76c").attr("stop-opacity", 0.8);
  wear.append("stop").attr("offset", "100%").attr("stop-color", "#c2a76c").attr("stop-opacity", 0);

  // Fond (hors court) et court (intérieur des lignes de double)
  ctx.outer = svg.append("rect").attr("width", width).attr("height", height).attr("rx", 22);
  ctx.inner = box(svg.append("rect"), 0, ctx.L, -hw, hw);
  ctx.texture = svg.append("g").attr("pointer-events", "none");
  ctx.texture.append("rect").attr("class", "tex-grain").attr("width", width).attr("height", height)
    .attr("rx", 22).attr("fill", "#000").attr("filter", "url(#sv-grain)");
  ctx.texture.append("rect").attr("class", "tex-mow").attr("fill", "url(#sv-mow)")
    .attr("x", 0).attr("y", Y(-ctx.RUN_BACK)).attr("width", width).attr("height", height).attr("rx", 22);
  [0, ctx.L].forEach(x => ctx.texture.append("ellipse").attr("class", "tex-wear")
    .attr("cx", X(0)).attr("cy", Y(x)).attr("rx", 2.4 * ctx.PX).attr("ry", 2.8 * ctx.PX)
    .attr("fill", "url(#sv-wear)"));
  svg.append("rect").attr("width", width).attr("height", height).attr("rx", 22)
    .attr("fill", "url(#sv-light)").attr("pointer-events", "none");
  svg.append("rect").attr("width", width).attr("height", height).attr("rx", 22)
    .attr("fill", "url(#sv-vignette)").attr("pointer-events", "none");

  // Couches : carte de chaleur, fautes, lignes, filet, étiquettes
  ctx.heatLayer = svg.append("g").attr("class", "heat").attr("pointer-events", "none");
  ctx.faultLayer = svg.append("g").attr("class", "faults").attr("pointer-events", "none");
  ctx.lines = svg.append("g").attr("fill", "none").attr("stroke-width", 0.05 * ctx.PX)
    .attr("pointer-events", "none");
  box(ctx.lines.append("rect"), 0, ctx.L, -hw, hw);
  line(ctx.lines, 0, -hs, ctx.L, -hs); line(ctx.lines, 0, hs, ctx.L, hs);
  line(ctx.lines, n - ctx.SL, -hs, n - ctx.SL, hs); line(ctx.lines, n + ctx.SL, -hs, n + ctx.SL, hs);
  line(ctx.lines, n - ctx.SL, 0, n + ctx.SL, 0);
  line(ctx.lines, 0, 0, 0.15, 0); line(ctx.lines, ctx.L - 0.15, 0, ctx.L, 0);

  // Filet, bande blanche, poteaux et ombre portée vers le relanceur
  box(svg.append("rect").attr("fill", "#000").attr("opacity", 0.25).attr("pointer-events", "none"),
    n, n + 0.45, -hw - 0.91, hw + 0.91);
  ctx.net = svg.append("line").attr("x1", X(-hw - 0.91)).attr("x2", X(hw + 0.91))
    .attr("y1", Y(n)).attr("y2", Y(n)).attr("stroke-width", 0.14 * ctx.PX);
  svg.append("line").attr("x1", X(-hw - 0.91)).attr("x2", X(hw + 0.91))
    .attr("y1", Y(n) - 0.05 * ctx.PX).attr("y2", Y(n) - 0.05 * ctx.PX)
    .attr("stroke", "#fff").attr("stroke-width", 0.05 * ctx.PX).attr("opacity", 0.9);
  [-hw - 0.91, hw + 0.91].forEach(y => svg.append("circle").attr("cx", X(y)).attr("cy", Y(n))
    .attr("r", 0.17 * ctx.PX).attr("fill", "#dfe3e8").attr("stroke", "#1b1f24").attr("stroke-width", 1.5));

  // Le serveur, au fond, côté égalité
  const sv = svg.append("g").attr("transform", `translate(${X(0.8)},${Y(-0.6)})`);
  sv.append("circle").attr("r", 16).attr("fill", "none").attr("stroke", "#fff").attr("stroke-opacity", 0.35);
  sv.append("circle").attr("r", 9).attr("fill", "#fff").attr("opacity", 0.9);
  svg.append("text").attr("class", "box-title").attr("x", X(0.8) + 26).attr("y", Y(-0.6) + 4).text("Serveur");

  // Titres des carrés, étiquettes des zones et zones survolables
  ctx.labels = svg.append("g");
  ["deuce", "ad"].forEach(b => {
    ctx.labels.append("text").attr("class", "box-title")
      .attr("x", X(b === "deuce" ? -hs / 2 : hs / 2)).attr("y", Y(ctx.L) + 0.9 * ctx.PX)
      .attr("text-anchor", "middle")
      .text(b === "deuce" ? "Carré égalité" : "Carré avantage");
    ctx.ZONES.forEach(zone => {
      const [y0, y1] = zoneBounds(b, zone);
      box(ctx.labels.append("rect").attr("class", "zone-hit").datum({ box: b, zone }), n, n + ctx.SL, y0, y1)
        .on("mousemove", showTooltip).on("mouseleave", hideTooltip);
      const g = ctx.labels.append("g").attr("class", `zl zl-${b}-${zone}`)
        .attr("transform", `translate(${X((y0 + y1) / 2)},${Y(n + 1.0)})`);
      g.append("text").attr("class", "zone-label").attr("text-anchor", "middle").attr("font-size", 19);
      g.append("text").attr("class", "zone-sub").attr("text-anchor", "middle").attr("dy", 14)
        .text(zone === "t" ? "T" : ctx.ZONE_NAMES[zone]);
    });
  });
  applySurfaceStyle(false);
}

function applySurfaceStyle(animate) {
  const st = ctx.STYLES[state.surface];
  const t = sel => (animate ? sel.transition().duration(ctx.T) : sel);
  t(ctx.outer).attr("fill", st.outer);
  t(ctx.inner).attr("fill", st.inner);
  t(ctx.lines).attr("stroke", st.line);
  t(ctx.net).attr("stroke", st.net);
  t(ctx.texture.select(".tex-grain")).attr("opacity", state.surface === "Clay" ? 1 : state.surface === "Hard" ? 0.35 : 0.2);
  t(ctx.texture.select(".tex-mow")).attr("opacity", state.surface === "Grass" ? 1 : 0);
  t(ctx.texture.selectAll(".tex-wear")).attr("opacity", state.surface === "Grass" ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Filtres
// ---------------------------------------------------------------------------

function segmented(id, options, key) {
  const root = d3.select(`#${id}`);
  root.selectAll("button").data(options).join("button")
    .text(d => d[1])
    .classed("on", d => state[key] === d[0])
    .on("click", (e, d) => {
      state[key] = d[0];
      root.selectAll("button").classed("on", o => state[key] === o[0]);
      if (key === "surface") applySurfaceStyle(true);
      update(true);
    });
}

function initFilters() {
  segmented("sv-surface", ctx.SURFACES, "surface");
  segmented("sv-serve", ctx.SERVES, "serve");
  segmented("sv-rank", ctx.RANKS, "rank");
  segmented("sv-hand", ctx.HANDS, "hand");
  segmented("sv-result", ctx.RESULTS, "result");

  // Joueurs : au moins 5 matchs notés, les plus suivis en premier
  const counts = d3.rollups(ctx.rows.filter(d => d.row === "Total"), v => v.length, d => d.name)
    .filter(d => d[1] >= 5).sort((a, b) => b[1] - a[1]);
  ctx.knownPlayers = new Set(counts.map(d => d[0]));
  d3.select("#sv-player-list").selectAll("option").data(counts).join("option")
    .attr("value", d => d[0]).text(d => `${d[1]} matchs`);
  const input = d3.select("#sv-player-input");
  const add = () => {
    const name = input.property("value").trim();
    if (ctx.knownPlayers.has(name) && !state.players.includes(name)) {
      state.players.push(name);
      input.property("value", "");
      drawChips();
      update(true);
    }
  };
  input.on("change", add).on("keydown", e => { if (e.key === "Enter") add(); });

  // Pays : liste triée par nombre de services notés
  const countries = d3.rollups(ctx.rows.filter(d => d.ioc && d.row === "Total"), v => v.length, d => d.ioc)
    .sort((a, b) => b[1] - a[1]);
  d3.select("#sv-country").selectAll("option")
    .data([["all", null], ...countries]).join("option")
    .attr("value", d => d[0])
    .text(d => (d[0] === "all" ? "Tous les pays" : `${d[0]} · ${d[1]} matchs-joueurs`));
  d3.select("#sv-country").on("change", function () { state.country = this.value; update(true); });

  // Années : double curseur
  const [y0, y1] = ctx.yearExtent;
  const minI = d3.select("#sv-year-min").attr("min", y0).attr("max", y1).property("value", state.yearMin);
  const maxI = d3.select("#sv-year-max").attr("min", y0).attr("max", y1).property("value", state.yearMax);
  const onYears = () => {
    let a = +minI.property("value"), b = +maxI.property("value");
    if (a > b) [a, b] = [b, a];
    state.yearMin = a; state.yearMax = b;
    d3.select("#sv-year-label").text(`${a} – ${b}`);
    update(true);
  };
  minI.on("input", onYears); maxI.on("input", onYears);
  d3.select("#sv-year-label").text(`${state.yearMin} – ${state.yearMax}`);

  d3.select("#sv-faults").on("change", function () { state.faults = this.checked; update(true); });
  d3.select("#sv-reset").on("click", () => {
    Object.assign(state, { surface: "All", serve: "Total", players: [], country: "all", rank: "all",
      hand: "all", result: "all", yearMin: Math.max(y0, 1990), yearMax: y1, faults: true });
    minI.property("value", state.yearMin); maxI.property("value", state.yearMax);
    d3.select("#sv-year-label").text(`${state.yearMin} – ${state.yearMax}`);
    d3.select("#sv-country").property("value", "all");
    d3.select("#sv-faults").property("checked", true);
    initFilters(); drawChips(); applySurfaceStyle(true); update(true);
  });
}

function drawChips() {
  const chips = d3.select("#sv-players").selectAll(".chip").data(state.players, d => d)
    .join(enter => {
      const c = enter.append("span").attr("class", "chip");
      c.append("span").text(d => d);
      c.append("button").attr("title", "Retirer").text("×")
        .on("click", (e, d) => {
          state.players = state.players.filter(p => p !== d);
          drawChips(); update(true);
        });
      return c;
    });
  return chips;
}

function filtered() {
  return ctx.rows.filter(d =>
    d.row === state.serve
    && (state.surface === "All" || d.surface === state.surface)
    && (state.players.length === 0 || state.players.includes(d.name))
    && (state.country === "all" || d.ioc === state.country)
    && (state.hand === "all" || d.hand === state.hand)
    && (state.result === "all" || d.player === state.result)
    && (state.rank === "all"
        || (state.rank === "10" && d.rank != null && d.rank <= 10)
        || (state.rank === "100" && d.rank != null && d.rank <= 100)
        || (state.rank === "101" && d.rank != null && d.rank > 100))
    && d.year >= state.yearMin && d.year <= state.yearMax);
}

// ---------------------------------------------------------------------------
// Agrégation, simulation des impacts et carte de chaleur
// ---------------------------------------------------------------------------

function aggregate(rows) {
  const keys = ["deuce_wide", "deuce_middle", "deuce_t", "ad_wide", "ad_middle", "ad_t",
                "err_net", "err_wide", "err_deep", "err_wide_deep"];
  const sum = Object.fromEntries(keys.map(k => [k, d3.sum(rows, d => d[k] || 0)]));
  sum.inDeuce = sum.deuce_wide + sum.deuce_middle + sum.deuce_t;
  sum.inAd = sum.ad_wide + sum.ad_middle + sum.ad_t;
  sum.in = sum.inDeuce + sum.inAd;
  sum.faults = sum.err_net + sum.err_wide + sum.err_deep + sum.err_wide_deep;
  sum.matches = new Set(rows.map(d => d.match_id)).size;
  sum.players = new Set(rows.map(d => d.name)).size;
  return sum;
}

// Positions simulées : même graine à chaque fois, pour que seule la répartition change.
function simulate(agg) {
  const rng = d3.randomLcg(0.4242);
  const u = d3.randomUniform.source(rng);
  const beta = (a, b) => d3.randomBeta.source(rng)(a, b)();
  const n = NET(), pts = [];
  if (agg.in === 0) return { pts, faults: [] };

  ["deuce", "ad"].forEach(box => {
    ctx.ZONES.forEach(zone => {
      const count = agg[`${box}_${zone}`];
      const k = Math.round(ctx.SAMPLES * count / agg.in);
      const [y0, y1] = zoneBounds(box, zone);
      const outer = box === "deuce" ? y0 : y1;     // bord côté ligne de côté
      for (let i = 0; i < k; i++) {
        // Profondeur : surtout près de la ligne de service
        const depth = ctx.SL * (1 - 0.88 * beta(1.35, 4.6));
        let y;
        if (zone === "wide") y = outer + (box === "deuce" ? 1 : -1) * (y1 - y0) * beta(1.25, 4.2);
        else if (zone === "t") y = (box === "deuce" ? -1 : 1) * (y1 - y0) * beta(1.25, 4.2);
        else y = y0 + (y1 - y0) * (0.5 + 0.16 * (u()() + u()() + u()() - 1.5));
        pts.push([X(y), Y(n + depth)]);
      }
    });
  });

  // Fautes : points blancs hors du carré, en proportion du nombre réel de fautes.
  const faults = [];
  const scale = ctx.SAMPLES / agg.in;
  const deuceShare = agg.inDeuce / agg.in;
  const pick = () => (u()() < deuceShare ? "deuce" : "ad");
  const side = box => (box === "deuce" ? -1 : 1);
  const kinds = [["err_net", "net"], ["err_deep", "deep"], ["err_wide", "wide"], ["err_wide_deep", "wd"]];
  kinds.forEach(([key, kind]) => {
    const k = Math.min(Math.round(agg[key] * scale * 0.45), 1200);
    for (let i = 0; i < k; i++) {
      const box = pick(), s = side(box), h = ctx.S / 2;
      let x, y;
      if (kind === "net") { x = n - 0.15 - 0.9 * beta(1.2, 3); y = s * h * u()(); }
      else if (kind === "deep") { x = n + ctx.SL + 0.08 + 1.6 * beta(1.2, 3.5); y = s * h * (0.05 + 0.95 * u()()); }
      else if (kind === "wide") { x = n + ctx.SL * (0.25 + 0.75 * u()()); y = s * (h + 0.08 + 1.3 * beta(1.2, 3.5)); }
      else { x = n + ctx.SL + 0.08 + 1.2 * beta(1.2, 3); y = s * (h + 0.08 + 1.0 * beta(1.2, 3)); }
      faults.push([X(y), Y(x)]);
    }
  });
  return { pts, faults };
}

// Seuils de densité fixes, calculés une fois sur l'ensemble des services : toutes les sélections
// partagent la même échelle de couleur et restent comparables.
function initDensityScale() {
  const all = aggregate(ctx.rows.filter(d => d.row === "Total"));
  const ref = d3.contourDensity().x(d => d[0]).y(d => d[1])
    .size(courtSize()).bandwidth(ctx.BANDWIDTH).thresholds(40)(simulate(all).pts);
  ctx.maxDensity = d3.max(ref, c => c.value) * 1.35;
  ctx.thresholds = d3.range(1, ctx.N_THRESHOLDS + 1).map(i => ctx.maxDensity * (i / ctx.N_THRESHOLDS) ** 1.6);
  drawLegend();
}

function courtSize() {
  return [(ctx.W + 2 * ctx.RUN_SIDE) * ctx.PX, (ctx.RUN_BACK + ctx.L + ctx.RUN_FAR) * ctx.PX];
}

function update(animate) {
  const rows = filtered();
  const agg = aggregate(rows);
  const { pts, faults } = simulate(agg);
  const st = ctx.STYLES[state.surface];
  const dur = animate ? ctx.T : 0;

  const contours = pts.length
    ? d3.contourDensity().x(d => d[0]).y(d => d[1]).size(courtSize())
      .bandwidth(ctx.BANDWIDTH).thresholds(ctx.thresholds)(pts)
    : [];
  const color = v => st.heat(Math.min(1, v / ctx.maxDensity) ** 0.62);
  const opacity = d3.scaleLinear().domain([0, ctx.maxDensity * 0.25]).range([0.32, 0.92]).clamp(true);

  // Fondu enchaîné : l'ancienne carte s'efface pendant que la nouvelle apparaît (séance 5).
  ctx.heatLayer.selectAll("g.frame").classed("old", true)
    .transition().duration(dur).attr("opacity", 0).remove();
  const frame = ctx.heatLayer.append("g").attr("class", "frame").attr("opacity", 0);
  frame.selectAll("path").data(contours).join("path")
    .attr("d", d3.geoPath())
    .attr("fill", d => color(d.value))
    .attr("fill-opacity", d => opacity(d.value))
    .attr("stroke", d => color(d.value))
    .attr("stroke-opacity", 0.25)
    .attr("stroke-width", 0.6);
  frame.transition().duration(dur).attr("opacity", 1);

  ctx.faultLayer.selectAll("g.frame").transition().duration(dur).attr("opacity", 0).remove();
  if (state.faults) {
    const fl = ctx.faultLayer.append("g").attr("class", "frame").attr("opacity", 0);
    fl.selectAll("circle").data(faults).join("circle")
      .attr("cx", d => d[0]).attr("cy", d => d[1]).attr("r", 1.4)
      .attr("fill", "#fff").attr("fill-opacity", 0.38);
    fl.transition().duration(dur).attr("opacity", 1);
  }

  // Pourcentage par zone (chaque carré = 100 %)
  ctx.agg = agg;
  ["deuce", "ad"].forEach(box => {
    const tot = box === "deuce" ? agg.inDeuce : agg.inAd;
    ctx.ZONES.forEach(zone => {
      const p = tot ? agg[`${box}_${zone}`] / tot : NaN;
      const lab = ctx.labels.select(`.zl-${box}-${zone} .zone-label`);
      const from = +lab.attr("data-v") || 0;
      lab.attr("data-v", isNaN(p) ? 0 : p)
        .transition().duration(dur)
        .tween("text", () => {
          const i = d3.interpolateNumber(from, isNaN(p) ? 0 : p);
          return t => lab.text(isNaN(p) ? "–" : d3.format(".0%")(i(t)));
        });
    });
  });

  drawSummary(agg);
  drawLegend();
}

// ---------------------------------------------------------------------------
// Légende, résumé, info-bulle
// ---------------------------------------------------------------------------

function drawLegend() {
  const st = ctx.STYLES[state.surface];
  const w = 320, h = 12;
  const root = d3.select("#sv-legend");
  let svg = root.select("svg");
  if (svg.empty()) {
    svg = root.append("svg").attr("width", w + 260).attr("height", 40);
    svg.append("defs").append("linearGradient").attr("id", "sv-legend-grad");
    svg.append("rect").attr("class", "bar").attr("x", 0).attr("y", 6).attr("width", w).attr("height", h)
      .attr("rx", 3).attr("fill", "url(#sv-legend-grad)");
    svg.append("text").attr("x", 0).attr("y", 34).style("fill", "var(--muted)").attr("font-size", 11).text("peu de services");
    svg.append("text").attr("x", w).attr("y", 34).attr("text-anchor", "end").style("fill", "var(--muted)")
      .attr("font-size", 11).text("beaucoup");
    svg.append("circle").attr("cx", w + 26).attr("cy", 12).attr("r", 3).attr("fill", "#8a8f96");
    svg.append("text").attr("x", w + 36).attr("y", 16).style("fill", "var(--muted)").attr("font-size", 11)
      .text("faute (filet, long, large)");
  }
  svg.select("#sv-legend-grad").selectAll("stop").data(d3.range(0, 1.01, 0.1)).join("stop")
    .attr("offset", d => `${d * 100}%`).attr("stop-color", d => st.heat(d));
}

function drawSummary(agg) {
  const pct = d3.format(".0%"), n = d3.format(",");
  const total = agg.in + agg.faults;
  const items = [
    [n(agg.in), "services bons", agg.in < ctx.MIN_SERVES],
    [n(agg.matches), "matchs notés"],
    [n(agg.players), agg.players > 1 ? "joueurs" : "joueur"],
    [total ? pct(agg.faults / total) : "–", state.serve === "2" ? "doubles fautes" : "fautes"],
    [agg.faults ? pct(agg.err_net / agg.faults) : "–", "des fautes dans le filet"],
  ];
  d3.select("#sv-summary").selectAll(".stat").data(items).join("div")
    .attr("class", d => `stat${d[2] ? " warn" : ""}`)
    .html(d => `<b>${d[0]}</b><span>${d[1]}${d[2] ? " · trop peu pour conclure" : ""}</span>`);
}

// Intervalle de confiance de Wilson à 95 % pour une proportion
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}

function showTooltip(e, d) {
  const agg = ctx.agg, tot = d.box === "deuce" ? agg.inDeuce : agg.inAd;
  const k = agg[`${d.box}_${d.zone}`], [lo, hi] = wilson(k, tot);
  const pct = d3.format(".1%");
  d3.select("#sv-tooltip").attr("hidden", null)
    .style("left", `${e.clientX + 14}px`).style("top", `${e.clientY + 14}px`)
    .html(`<b>${ctx.ZONE_NAMES[d.zone]}</b>, carré ${d.box === "deuce" ? "égalité" : "avantage"}<br>
      ${d3.format(",")(k)} services sur ${d3.format(",")(tot)}<br>
      ${tot ? `${pct(k / tot)} (IC 95 % : ${pct(lo)} – ${pct(hi)})` : "aucun service"}`);
}

function hideTooltip() { d3.select("#sv-tooltip").attr("hidden", true); }

window.initServices = initServices;
})();
