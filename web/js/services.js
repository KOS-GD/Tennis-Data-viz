// Onglet « Services » : où un joueur sert-il, sur dur, terre et gazon ?
// Données : web/data/charting_serve_direction.csv et charting_matches.csv (prepare_data.py).
// Tout le code est dans une fonction anonyme : ses variables (ctx...) ne gênent pas les scripts
// des autres onglets. Seule initServices() est exposée, appelée par js/tabs.js.
(() => {

const ctx = {
  // Court en mètres (dimensions ITF) : on dessine la moitié du relanceur, filet en haut.
  W: 10.97, S: 8.23, HALF: 11.885, SL: 6.40,
  TOP: 2.4,            // espace au-dessus du filet, d'où arrivent les services
  BOTTOM: 1.4,         // recul derrière la ligne de fond
  SIDE: 1.3,
  PX: 24,              // pixels par mètre
  GAP: 34,             // espace entre deux courts
  TITLE_H: 46,         // hauteur réservée au titre de chaque court
  N_DOTS: 160,         // points par court : chacun vaut 1/160 des services bons du joueur sur la surface
  MIN_SERVES: 60,      // en dessous, le court est grisé
  MIN_MATCHES: 15,     // joueurs proposés dans la liste
  DELTA_MAX: 10,       // écart (en points) qui sature l'échelle de couleur
  STAGE: 500,          // durée d'une étape de transition
  FLIGHT: 700,         // durée du vol d'une balle
  SURFACES: [["Hard", "Dur"], ["Clay", "Terre battue"], ["Grass", "Gazon"]],
  ZONES: ["wide", "middle", "t"],
  ZONE_NAMES: { wide: "Extérieur", middle: "Corps", t: "T" },
  ZONE_SHORT: { wide: "ext.", middle: "corps", t: "T" },
  BOXES: ["ad", "deuce"],
  BOX_NAMES: { deuce: "carré égalité", ad: "carré avantage" },
  FIRST: "#14213d",    // 1re balle
  SECOND: "#fca311",   // 2e balle
};

// Surface : couleurs du court (identifient la surface, ne portent pas de donnée)
ctx.COURT = {
  Hard: { inner: "#3d6fae", outer: "#4f8b6c", stripes: false },
  Clay: { inner: "#c8693c", outer: "#bb5f35", stripes: false },
  Grass: { inner: "#5b9646", outer: "#518940", stripes: true },
};

// Échelle divergente (séance 2, comme au TD 5) : bleu = moins que la moyenne, rouge = plus.
ctx.delta = d3.scaleLinear().domain([-ctx.DELTA_MAX, 0, ctx.DELTA_MAX])
  .range(["#2f6db5", "#f4f1ea", "#c8322d"]).clamp(true);

// ---------------------------------------------------------------------------
// Géométrie d'un court : u en travers (0 = ligne centrale, > 0 à droite = côté égalité),
// d en profondeur depuis le filet.
// ---------------------------------------------------------------------------

const CW = () => (ctx.W + 2 * ctx.SIDE) * ctx.PX;
const CH = () => (ctx.TOP + ctx.HALF + ctx.BOTTOM) * ctx.PX;
const X = u => (ctx.W / 2 + ctx.SIDE + u) * ctx.PX;
const Y = d => (ctx.TOP + d) * ctx.PX;

function zoneBounds(box, zone) {
  const h = ctx.S / 2, third = h / 3, k = { t: 0, middle: 1, wide: 2 }[zone];
  const a = k * third, b = (k + 1) * third;
  return box === "deuce" ? [a, b] : [-b, -a];
}

// ---------------------------------------------------------------------------

function initServices() {
  Promise.all([
    d3.csv("data/charting_serve_direction.csv", d3.autoType),
    d3.csv("data/charting_matches.csv", d3.autoType),
  ]).then(([dir, matches]) => {
    prepareData(dir, matches);
    drawCourts();
    drawLegend();
    initPicker();
    select(ctx.featured[0], true);
  });
}

// Comptes par joueur, surface, carré, zone et balle (1re / 2e), et moyenne du circuit.
function prepareData(dir, matches) {
  const byMatch = new Map(matches.map(m => [m.match_id, m]));
  ctx.stats = new Map();                 // clé "joueur|surface"
  ctx.tour = new Map();                  // clé "surface"
  const empty = () => ({ n: 0, matches: new Set(), c: {} });
  const add = (map, key, d) => {
    if (!map.has(key)) map.set(key, empty());
    const s = map.get(key);
    s.matches.add(d.match_id);
    ctx.BOXES.forEach(b => ctx.ZONES.forEach(z => {
      const k = `${b}_${z}_${d.row}`;
      const v = d[`${b}_${z}`] || 0;
      s.c[k] = (s.c[k] || 0) + v;
      s.n += v;
    }));
  };
  dir.filter(d => d.row === 1 || d.row === 2).forEach(d => {
    const m = byMatch.get(d.match_id);
    if (!m) return;
    add(ctx.stats, `${m[`${d.player}_name`]}|${m.surface}`, d);
    add(ctx.tour, m.surface, d);
  });
  // Joueurs proposés : au moins MIN_MATCHES matchs notés
  const counts = d3.rollups(matches.flatMap(m => [m.w_name, m.l_name]), v => v.length, d => d)
    .filter(d => d[1] >= ctx.MIN_MATCHES).sort((a, b) => b[1] - a[1]);
  ctx.players = counts;
  ctx.featured = counts.slice(0, 8).map(d => d[0]);
}

// Part d'une zone dans son carré (1re et 2e balles ensemble)
function share(s, box, zone) {
  if (!s) return { k: 0, n: 0, p: NaN };
  const get = (z, r) => s.c[`${box}_${z}_${r}`] || 0;
  const k = get(zone, 1) + get(zone, 2);
  const n = d3.sum(ctx.ZONES, z => get(z, 1) + get(z, 2));
  return { k, n, p: n ? k / n : NaN };
}

// ---------------------------------------------------------------------------
// Les trois courts (petits multiples, séance 3 : même échelle, même orientation)
// ---------------------------------------------------------------------------

function drawCourts() {
  const width = 3 * CW() + 2 * ctx.GAP, height = CH() + ctx.TITLE_H;
  const svg = d3.select("#sv-courts").append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", "Trois demi-courts avec les services du joueur choisi");
  const defs = svg.append("defs");
  const stripe = ctx.HALF / 6 * ctx.PX;
  const mow = defs.append("pattern").attr("id", "sv-mow").attr("patternUnits", "userSpaceOnUse")
    .attr("width", 10).attr("height", stripe * 2).attr("y", Y(0));
  mow.append("rect").attr("width", 10).attr("height", stripe).attr("fill", "rgba(255,255,255,.08)");
  const shade = defs.append("linearGradient").attr("id", "sv-shade").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  shade.append("stop").attr("offset", "0%").attr("stop-color", "#000").attr("stop-opacity", 0.22);
  shade.append("stop").attr("offset", "25%").attr("stop-color", "#000").attr("stop-opacity", 0);

  ctx.courts = {};
  ctx.SURFACES.forEach(([surface, label], i) => {
    const g = svg.append("g").attr("transform", `translate(${i * (CW() + ctx.GAP)},0)`);
    g.append("text").attr("class", "court-title").attr("x", 2).attr("y", 18).text(label);
    const nText = g.append("text").attr("class", "court-n").attr("x", 2).attr("y", 36);
    const c = g.append("g").attr("transform", `translate(0,${ctx.TITLE_H})`);
    const st = ctx.COURT[surface];
    const hw = ctx.W / 2, hs = ctx.S / 2;

    c.append("rect").attr("width", CW()).attr("height", CH()).attr("rx", 14).attr("fill", st.outer);
    c.append("rect").attr("x", X(-hw)).attr("y", Y(0)).attr("width", ctx.W * ctx.PX)
      .attr("height", ctx.HALF * ctx.PX).attr("fill", st.inner);
    if (st.stripes) c.append("rect").attr("width", CW()).attr("height", CH()).attr("rx", 14).attr("fill", "url(#sv-mow)");
    c.append("rect").attr("width", CW()).attr("height", CH()).attr("rx", 14).attr("fill", "url(#sv-shade)");

    // Zones : couleur = écart à la moyenne du circuit
    const zones = c.append("g");
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone);
      zones.append("rect").attr("class", `zone z-${box}-${zone}`)
        .attr("x", X(u0)).attr("y", Y(0)).attr("width", (u1 - u0) * ctx.PX).attr("height", ctx.SL * ctx.PX)
        .attr("fill", ctx.delta(0)).attr("fill-opacity", 0.82);
    }));

    // Lignes et filet
    const lines = c.append("g").attr("stroke", "#fff").attr("stroke-width", 2).attr("fill", "none");
    lines.append("rect").attr("x", X(-hw)).attr("y", Y(0)).attr("width", ctx.W * ctx.PX).attr("height", ctx.HALF * ctx.PX);
    [-hs, hs].forEach(u => lines.append("line").attr("x1", X(u)).attr("x2", X(u)).attr("y1", Y(0)).attr("y2", Y(ctx.HALF)));
    lines.append("line").attr("x1", X(-hs)).attr("x2", X(hs)).attr("y1", Y(ctx.SL)).attr("y2", Y(ctx.SL));
    lines.append("line").attr("x1", X(0)).attr("x2", X(0)).attr("y1", Y(0)).attr("y2", Y(ctx.SL));
    lines.append("line").attr("x1", X(0)).attr("x2", X(0)).attr("y1", Y(ctx.HALF) - 6).attr("y2", Y(ctx.HALF));
    c.append("line").attr("x1", X(-hw - 0.9)).attr("x2", X(hw + 0.9)).attr("y1", Y(0)).attr("y2", Y(0))
      .attr("stroke", "#1b1f24").attr("stroke-width", 4);
    c.append("line").attr("x1", X(-hw - 0.9)).attr("x2", X(hw + 0.9)).attr("y1", Y(0) - 2).attr("y2", Y(0) - 2)
      .attr("stroke", "#fff").attr("stroke-width", 1.5);

    // Étiquettes par zone : part (%) et écart à la moyenne
    const labels = c.append("g");
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone);
      const lg = labels.append("g").attr("class", `lab l-${box}-${zone}`)
        .attr("transform", `translate(${X((u0 + u1) / 2)},${Y(ctx.SL + 0.95)})`);
      lg.append("text").attr("class", "zone-pct").attr("text-anchor", "middle");
      lg.append("text").attr("class", "zone-delta").attr("text-anchor", "middle").attr("dy", 15);
      labels.append("text").attr("class", "zone-name").attr("text-anchor", "middle")
        .attr("x", X((u0 + u1) / 2)).attr("y", Y(0.55)).text(ctx.ZONE_SHORT[zone]);
    }));

    const dots = c.append("g");
    // Zones survolables, au-dessus de tout
    const hits = c.append("g");
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone);
      hits.append("rect").attr("class", "zone-hit").datum({ surface, box, zone })
        .attr("x", X(u0)).attr("y", Y(0)).attr("width", (u1 - u0) * ctx.PX).attr("height", ctx.SL * ctx.PX)
        .on("mousemove", showTooltip).on("mouseleave", hideTooltip);
    }));
    ctx.courts[surface] = { g: c, nText, dots };
  });
}

// ---------------------------------------------------------------------------
// Choix du joueur
// ---------------------------------------------------------------------------

function initPicker() {
  d3.select("#sv-player-list").selectAll("option").data(ctx.players).join("option")
    .attr("value", d => d[0]).text(d => `${d[1]} matchs notés`);
  const input = d3.select("#sv-player-input");
  const pick = () => {
    const name = input.property("value").trim();
    if (ctx.players.some(p => p[0] === name)) { select(name, false); input.property("value", ""); }
  };
  input.on("change", pick).on("keydown", e => { if (e.key === "Enter") pick(); });
  d3.select("#sv-featured").selectAll("button").data(ctx.featured).join("button")
    .text(d => d).on("click", (e, d) => select(d, false));
}

function select(name, first) {
  ctx.player = name;
  d3.select("#sv-featured").selectAll("button").classed("on", d => d === name);
  ctx.SURFACES.forEach(([surface]) => updateCourt(surface, first));
  updateInsight();
}

// ---------------------------------------------------------------------------
// Mise à jour d'un court : transition en trois étapes (séance 5, TD 5)
//   1. les balles du joueur précédent disparaissent ;
//   2. les zones changent de couleur, les pourcentages défilent ;
//   3. les nouvelles balles sont servies une à une depuis l'autre côté du filet.
// ---------------------------------------------------------------------------

function updateCourt(surface, first) {
  const court = ctx.courts[surface];
  const s = ctx.stats.get(`${ctx.player}|${surface}`);
  const tour = ctx.tour.get(surface);
  const n = s ? s.n : 0;
  const few = n < ctx.MIN_SERVES;
  const fmt = d3.format(",");
  court.nText.text(s ? `${fmt(n)} services bons · ${s.matches.size} matchs${few ? " · trop peu pour conclure" : ""}`
                     : "aucun match noté");

  const t1 = first ? 0 : ctx.STAGE;
  // Étape 2 : couleur des zones et étiquettes
  ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
    const p = share(s, box, zone), avg = share(tour, box, zone);
    const delta = (p.p - avg.p) * 100;
    court.g.select(`.z-${box}-${zone}`).transition().delay(t1).duration(ctx.STAGE)
      .attr("fill", few || isNaN(delta) ? "#d9d6cf" : ctx.delta(delta));
    const lab = court.g.select(`.l-${box}-${zone}`);
    const pct = lab.select(".zone-pct"), del = lab.select(".zone-delta");
    const from = +pct.attr("data-v") || 0, to = isNaN(p.p) ? 0 : p.p;
    pct.attr("data-v", to).transition().delay(t1).duration(ctx.STAGE)
      .tween("text", () => { const i = d3.interpolateNumber(from, to); return t => pct.text(isNaN(p.p) ? "–" : d3.format(".0%")(i(t))); });
    del.transition().delay(t1).duration(ctx.STAGE).style("opacity", few || isNaN(delta) ? 0 : 1)
      .text(isNaN(delta) ? "" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(0)}`)
      .style("fill", delta >= 0 ? "#9b1d19" : "#1f4f8c");
  }));
  court.g.transition().delay(t1).duration(ctx.STAGE).attr("opacity", few ? 0.55 : 1);

  // Nouvelles balles : N_DOTS réparties entre (carré, zone, balle) au prorata des comptes
  const dots = s ? allocate(s, surface) : [];

  // Étape 1 : les anciennes balles disparaissent (rétrécissent sur place)
  court.dots.selectAll("circle")
    .transition("out").delay(() => Math.random() * 200).duration(first ? 0 : ctx.STAGE * 0.8)
    .attr("r", 0).remove();

  // Étape 3 : service des nouvelles balles, dans un ordre aléatoire, avec un effet de hauteur
  // (le rayon grossit au milieu du vol, comme une balle qui monte vers la caméra).
  const start = ctx.STAGE * (first ? 0.5 : 1.6);
  court.dots.selectAll(null).data(dots).enter().append("circle")
    .attr("cx", d => d.x0).attr("cy", d => d.y0).attr("r", 0)
    .attr("fill", d => (d.serve === 1 ? ctx.FIRST : ctx.SECOND))
    .attr("stroke", d => (d.serve === 1 ? "#fff" : "#5a3d00")).attr("stroke-width", 0.7)
    .transition("in").delay(d => start + d.order * 9).duration(ctx.FLIGHT).ease(d3.easeCubicOut)
    .attr("cx", d => d.x).attr("cy", d => d.y)
    .attrTween("r", () => t => 3.2 * (1 + 1.3 * Math.sin(Math.PI * t)));
}

// Répartit N_DOTS balles par la méthode du plus fort reste, puis tire une position dans la zone.
function allocate(s, surface) {
  const cats = [];
  ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => [1, 2].forEach(serve => {
    cats.push({ box, zone, serve, k: s.c[`${box}_${zone}_${serve}`] || 0 });
  })));
  const total = d3.sum(cats, c => c.k);
  if (!total) return [];
  cats.forEach(c => { c.exact = c.k / total * ctx.N_DOTS; c.m = Math.floor(c.exact); });
  let left = ctx.N_DOTS - d3.sum(cats, c => c.m);
  cats.slice().sort((a, b) => (b.exact - b.m) - (a.exact - a.m)).forEach(c => { if (left-- > 0) c.m++; });

  const rng = d3.randomLcg(surface.length * 0.137 + 0.01);
  const u = d3.randomUniform.source(rng)();
  const beta = (a, b) => d3.randomBeta.source(rng)(a, b)();
  const dots = [];
  cats.forEach(c => {
    const [u0, u1] = zoneBounds(c.box, c.zone);
    for (let i = 0; i < c.m; i++) {
      // Profondeur : surtout près de la ligne de service ; en travers : uniforme dans la zone
      const d = Math.max(0.35, Math.min(ctx.SL - 0.15, ctx.SL * (1 - 0.85 * beta(1.4, 3.2))));
      const lat = u0 + 0.12 + (u1 - u0 - 0.24) * u();
      // Le serveur est en face, de l'autre côté du filet : à gauche pour le carré égalité
      const sx = c.box === "deuce" ? -1.6 : 1.6;
      dots.push({ ...c, x: X(lat), y: Y(d), x0: X(sx), y0: Y(-ctx.TOP + 0.2) });
    }
  });
  d3.shuffle(dots, 0, dots.length).forEach((d, i) => { d.order = i; });
  return dots;
}

// ---------------------------------------------------------------------------
// Phrase de synthèse : la zone où le joueur s'écarte le plus de la moyenne
// ---------------------------------------------------------------------------

function updateInsight() {
  let best = null;
  ctx.SURFACES.forEach(([surface, label]) => {
    const s = ctx.stats.get(`${ctx.player}|${surface}`), tour = ctx.tour.get(surface);
    if (!s || s.n < ctx.MIN_SERVES) return;
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const p = share(s, box, zone), a = share(tour, box, zone);
      const delta = (p.p - a.p) * 100;
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { label, box, zone, p: p.p, a: a.p, delta };
    }));
  });
  const el = d3.select("#sv-insight");
  if (!best) { el.text(`Pas assez de services notés pour ${ctx.player}.`); return; }
  const pct = d3.format(".0%");
  const where = best.zone === "t" ? "au T" : best.zone === "wide" ? "à l'extérieur" : "dans le corps";
  el.style("opacity", 0).html(`<b>${ctx.player}</b> : sur ${best.label.toLowerCase()}, ${pct(best.p)} de ses services dans le ${ctx.BOX_NAMES[best.box]} vont ${where}, contre ${pct(best.a)} en moyenne (${best.delta > 0 ? "+" : "−"}${Math.abs(best.delta).toFixed(0)} points).`)
    .transition().delay(ctx.STAGE).duration(ctx.STAGE).style("opacity", 1);
}

// ---------------------------------------------------------------------------
// Légende et infobulle
// ---------------------------------------------------------------------------

function drawLegend() {
  const svg = d3.select("#sv-legend").append("svg").attr("width", 660).attr("height", 46)
    .append("g").attr("transform", "translate(14,0)");
  const w = 220;
  const grad = svg.append("defs").append("linearGradient").attr("id", "sv-delta-grad");
  d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", `${t * 100}%`)
    .attr("stop-color", ctx.delta(-ctx.DELTA_MAX + 2 * ctx.DELTA_MAX * t)));
  svg.append("rect").attr("x", 0).attr("y", 6).attr("width", w).attr("height", 12).attr("rx", 3)
    .attr("fill", "url(#sv-delta-grad)");
  const scale = d3.scaleLinear().domain([-ctx.DELTA_MAX, ctx.DELTA_MAX]).range([0, w]);
  svg.append("g").attr("transform", "translate(0,18)")
    .call(d3.axisBottom(scale).tickValues([-10, -5, 0, 5, 10]).tickFormat(d => (d > 0 ? `+${d}` : d)).tickSize(4))
    .call(g => g.select(".domain").remove()).selectAll("text").attr("class", "legend-text");
  svg.append("text").attr("class", "legend-text").attr("x", w + 10).attr("y", 16)
    .text("écart à la moyenne du circuit (points)");
  [[ctx.FIRST, "#fff", "1re balle"], [ctx.SECOND, "#5a3d00", "2e balle"]].forEach(([fill, stroke, label], i) => {
    const x = w + 10 + i * 90;
    svg.append("circle").attr("cx", x + 5).attr("cy", 34).attr("r", 4.5).attr("fill", fill).attr("stroke", stroke);
    svg.append("text").attr("class", "legend-text").attr("x", x + 14).attr("y", 38).text(label);
  });
}

// Intervalle de confiance de Wilson à 95 % pour une proportion (séance 4)
function wilson(k, n) {
  if (!n) return [NaN, NaN];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - m), Math.min(1, c + m)];
}

function showTooltip(e, d) {
  const s = ctx.stats.get(`${ctx.player}|${d.surface}`), tour = ctx.tour.get(d.surface);
  const p = share(s, d.box, d.zone), a = share(tour, d.box, d.zone), [lo, hi] = wilson(p.k, p.n);
  const pct = d3.format(".1%"), fmt = d3.format(",");
  d3.select("#sv-tooltip").attr("hidden", null)
    .style("left", `${e.clientX + 14}px`).style("top", `${e.clientY + 14}px`)
    .html(`<b>${ctx.ZONE_NAMES[d.zone]}</b>, ${ctx.BOX_NAMES[d.box]}<br>
      ${ctx.player} : ${p.n ? `${pct(p.p)} (${fmt(p.k)} sur ${fmt(p.n)})<br>IC 95 % : ${pct(lo)} – ${pct(hi)}` : "aucun service"}<br>
      Moyenne du circuit : ${pct(a.p)}`);
}

function hideTooltip() { d3.select("#sv-tooltip").attr("hidden", true); }

window.initServices = initServices;
})();
