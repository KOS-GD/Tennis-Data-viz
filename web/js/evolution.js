// Onglet « Évolution du style de jeu » : la part des points joués au filet, décennie par décennie.
// Un point = un joueur dans un match noté ; violon + boîte à moustaches + points dispersés (TD 4).
// Données : data/charting_net_points.csv, data/charting_overview.csv et data/charting_matches.csv

const evCtx = {
  W: 1100,
  H: 470,
  MARGIN: { left: 56, right: 16, top: 12, bottom: 50 },
  DECADES: [1970, 1980, 1990, 2000, 2010, 2020],
  Y_MAX: 80,              // en %, les rares valeurs au-dessus sont posées sur le bord
  MIN_POINTS: 40,         // matchs trop courts écartés
  MIN_VIOLIN: 30,         // pas de violon sous 30 matchs dans la décennie
  MAX_SELECTED: 3,
  DURATION: 700,
  SURFACES: ["All", "Hard", "Clay", "Grass"],
  NAMES: { All: "Toutes", Hard: "Dur", Clay: "Terre battue", Grass: "Gazon" },
  // Joueurs proposés, rangés par époque, chacun avec une couleur fixe
  // (palette catégorielle vérifiée pour le daltonisme : la couleur suit le joueur, pas son rang)
  PLAYERS: [
    { name: "Ivan Lendl", color: "#e34948" },
    { name: "Stefan Edberg", color: "#2a78d6" },
    { name: "Pete Sampras", color: "#eb6834" },
    { name: "Andre Agassi", color: "#6250d6" },
    { name: "Roger Federer", color: "#1baf7a" },
    { name: "Rafael Nadal", color: "#e87ba4" },
    { name: "Novak Djokovic", color: "#008300" },
    { name: "Carlos Alcaraz", color: "#eda100" },
  ],
  surface: "All",
  selected: ["Stefan Edberg", "Pete Sampras", "Roger Federer"],
};

function initEvolution() {
  Promise.all([
    d3.csv("data/charting_net_points.csv", d3.autoType),
    d3.csv("data/charting_overview.csv", d3.autoType),
    d3.csv("data/charting_matches.csv", d3.autoType),
  ]).then(function (data) {
    evPrepare(data[0], data[1], data[2]);
    evCtx.PLAYERS = evCtx.PLAYERS.filter(p => evCtx.rows.some(d => d.name === p.name));
    evCtx.color = new Map(evCtx.PLAYERS.map(p => [p.name, p.color]));
    evDrawControls();
    evDrawAxes();
    evUpdate(true);
  });
}

// Une ligne par joueur et par match : part des points joués au filet.
function evPrepare(net, overview, matches) {
  const byId = {};
  matches.forEach(m => { byId[m.match_id] = m; });
  const points = {};   // clé "match_id|w" ou "match_id|l" -> points joués
  overview.filter(d => d.row === "Total").forEach(function (d) {
    points[d.match_id + "|" + d.player] = d.serve_pts + d.return_pts;
  });
  const random = d3.randomLcg(7);   // dispersion fixe : les points ne bougent pas quand on filtre
  evCtx.rows = [];
  net.filter(d => d.row === "NetPoints").forEach(function (d) {
    const m = byId[d.match_id];
    const pts = points[d.match_id + "|" + d.player];
    if (!m || !pts || pts < evCtx.MIN_POINTS) return;
    const year = m.date.getFullYear();
    const decade = Math.floor(year / 10) * 10;
    if (decade < evCtx.DECADES[0]) return;
    evCtx.rows.push({
      id: evCtx.rows.length,
      name: m[d.player + "_name"],
      year: year,
      decade: decade,
      surface: m.surface,
      points: pts,
      net: d.net_pts,
      pct: 100 * d.net_pts / pts,
      jitter: random() - 0.5,
    });
  });
}

function evDrawControls() {
  // Filtre surface (requête dynamique, séance 3)
  d3.select("#ev-surface").selectAll("button").data(evCtx.SURFACES).enter().append("button")
    .text(d => evCtx.NAMES[d])
    .classed("on", d => d === evCtx.surface)
    .on("click", function (event, d) {
      evCtx.surface = d;
      d3.selectAll("#ev-surface button").classed("on", s => s === d);
      evUpdate(true);
    });
  // Joueurs mis en avant : 3 au plus, le plus ancien choisi sort quand on en ajoute un 4e
  d3.select("#ev-players").selectAll("button").data(evCtx.PLAYERS).enter().append("button")
    .html(d => `<span class="ev-dot"></span>${d.name}`)
    .on("click", function (event, d) {
      const s = evCtx.selected;
      if (s.includes(d.name)) s.splice(s.indexOf(d.name), 1);
      else { s.push(d.name); if (s.length > evCtx.MAX_SELECTED) s.shift(); }
      evUpdate(false);
    });
}

function evDrawAxes() {
  const m = evCtx.MARGIN;
  evCtx.iw = evCtx.W - m.left - m.right;
  evCtx.ih = evCtx.H - m.top - m.bottom;
  evCtx.x = d3.scaleBand().domain(evCtx.DECADES).range([0, evCtx.iw]).paddingInner(0.18).paddingOuter(0.06);
  evCtx.y = d3.scaleLinear().domain([0, evCtx.Y_MAX]).range([evCtx.ih, 0]);
  evCtx.bw = evCtx.x.bandwidth();

  const svg = d3.select("#ev-chart").append("svg").attr("viewBox", `0 0 ${evCtx.W} ${evCtx.H}`);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
  g.append("g").attr("class", "ev-grid")
    .call(d3.axisLeft(evCtx.y).ticks(8).tickSize(-evCtx.iw).tickFormat(""));
  g.append("g").attr("class", "ev-axis")
    .call(d3.axisLeft(evCtx.y).ticks(8).tickFormat(d => d + " %"));
  g.append("g").attr("class", "ev-axis ev-xaxis").attr("transform", `translate(0,${evCtx.ih})`)
    .call(d3.axisBottom(evCtx.x).tickSize(0).tickPadding(8).tickFormat(d => "Années " + d));
  g.append("text").attr("class", "ev-label").attr("transform", "rotate(-90)")
    .attr("x", -evCtx.ih / 2).attr("y", -42).attr("text-anchor", "middle")
    .text("Part des points joués au filet");

  evCtx.gViolin = g.append("g");
  evCtx.gDots = g.append("g");
  evCtx.gBox = g.append("g");
  evCtx.gSelected = g.append("g");
  evCtx.gCount = g.append("g");
}

// Densité par noyau d'Epanechnikov (TD 4)
function evKde(values) {
  const bw = 4;
  const K = u => (Math.abs(u /= bw) <= 1 ? 0.75 * (1 - u * u) / bw : 0);
  return d3.range(0, evCtx.Y_MAX + 0.5, 1).map(t => [t, d3.mean(values, v => K(t - v))]);
}

// Chaque violon à sa propre largeur maximale : on compare des formes, l'effectif est écrit dessous
function evViolinPath(dens) {
  const w = d3.scaleLinear().domain([0, d3.max(dens, d => d[1])]).range([0, evCtx.bw / 2]);
  return d3.area().curve(d3.curveBasis)
    .y(d => evCtx.y(d[0])).x0(d => -w(d[1])).x1(d => w(d[1]))(dens);
}

function evBox(values) {
  const v = values.slice().sort(d3.ascending);
  const q1 = d3.quantile(v, 0.25), q2 = d3.quantile(v, 0.5), q3 = d3.quantile(v, 0.75);
  const iqr = q3 - q1;
  return {
    q1: q1, q2: q2, q3: q3,
    lo: d3.min(v.filter(e => e >= q1 - 1.5 * iqr)),
    hi: d3.max(v.filter(e => e <= q3 + 1.5 * iqr)),
  };
}

function evUpdate(animate) {
  const ctx = evCtx;
  const t = d3.transition().duration(animate ? ctx.DURATION : 0).ease(d3.easeExpInOut);
  const rows = ctx.rows.filter(d => ctx.surface === "All" || d.surface === ctx.surface);
  const byDecade = d3.group(rows, d => d.decade);
  const stats = ctx.DECADES.map(function (decade) {
    const v = (byDecade.get(decade) || []).map(d => d.pct);
    return {
      decade: decade,
      n: v.length,
      dens: v.length >= ctx.MIN_VIOLIN ? evKde(v) : null,
      box: v.length >= 5 ? evBox(v) : null,
    };
  });
  const cx = d => ctx.x(d.decade) + ctx.bw / 2 + d.jitter * ctx.bw * 0.82;
  const cy = d => ctx.y(Math.min(d.pct, ctx.Y_MAX));
  const isSelected = d => ctx.selected.includes(d.name);

  // Violons
  ctx.gViolin.selectAll("path").data(stats, d => d.decade).join("path")
    .attr("class", "ev-violin")
    .attr("transform", d => `translate(${ctx.x(d.decade) + ctx.bw / 2},0)`)
    .transition(t).attr("d", d => (d.dens ? evViolinPath(d.dens) : null));

  // Tous les matchs, en gris
  ctx.gDots.selectAll("circle").data(rows.filter(d => !isSelected(d)), d => d.id)
    .join("circle").attr("class", "ev-point").attr("r", 1.6)
    .attr("cx", cx).attr("cy", cy);

  // Boîtes à moustaches
  const half = ctx.bw * 0.065;
  const b = d => d.box || { q1: 0, q2: 0, q3: 0, lo: 0, hi: 0 };
  const box = ctx.gBox.selectAll("g").data(stats, d => d.decade)
    .join(function (enter) {
      const e = enter.append("g").attr("class", "ev-box");
      e.append("line").attr("class", "ev-whisker");
      e.append("rect").attr("x", -half).attr("width", 2 * half).attr("rx", 2);
      e.append("line").attr("class", "ev-median").attr("x1", -half).attr("x2", half);
      return e;
    })
    .attr("transform", d => `translate(${ctx.x(d.decade) + ctx.bw / 2},0)`)
    .style("display", d => (d.box ? null : "none"))
    .on("mouseenter", (event, d) => evShowTooltip(event,
      `<b>Années ${d.decade}</b> · ${ctx.NAMES[ctx.surface].toLowerCase()}<br>` +
      `Médiane ${d.box.q2.toFixed(1)} %<br>Quartiles ${d.box.q1.toFixed(1)} – ${d.box.q3.toFixed(1)} %` +
      `<br><span class="ev-muted">${d.n} joueurs-matchs</span>`))
    .on("mousemove", evMoveTooltip).on("mouseleave", evHideTooltip);
  box.select(".ev-whisker").transition(t)
    .attr("y1", d => ctx.y(b(d).lo)).attr("y2", d => ctx.y(Math.min(b(d).hi, ctx.Y_MAX)));
  box.select("rect").transition(t)
    .attr("y", d => ctx.y(b(d).q3)).attr("height", d => ctx.y(b(d).q1) - ctx.y(b(d).q3));
  box.select(".ev-median").transition(t)
    .attr("y1", d => ctx.y(b(d).q2)).attr("y2", d => ctx.y(b(d).q2));

  // Joueurs choisis, en couleur, au-dessus de tout
  ctx.gSelected.selectAll("circle").data(rows.filter(isSelected), d => d.id)
    .join(enter => enter.append("circle").attr("r", 0).call(e => e.transition(t).attr("r", 3.4)))
    .attr("class", "ev-chosen")
    .attr("cx", cx).attr("cy", cy)
    .attr("fill", d => ctx.color.get(d.name))
    .on("mouseenter", (event, d) => evShowTooltip(event,
      `<b>${d.name}</b> · ${d.year}, ${ctx.NAMES[d.surface].toLowerCase()}<br>` +
      `${d.pct.toFixed(1)} % des points au filet<br>` +
      `<span class="ev-muted">${d.net} points au filet sur ${d.points}</span>`))
    .on("mousemove", evMoveTooltip).on("mouseleave", evHideTooltip);

  // Effectif sous chaque décennie
  ctx.gCount.selectAll("text").data(stats, d => d.decade).join("text")
    .attr("class", "ev-count")
    .attr("x", d => ctx.x(d.decade) + ctx.bw / 2).attr("y", ctx.ih + 38)
    .attr("text-anchor", "middle").text(d => "n = " + d.n.toLocaleString("fr-FR"));

  // Boutons des joueurs : pastille colorée seulement si le joueur est choisi
  d3.selectAll("#ev-players button").classed("on", d => ctx.selected.includes(d.name))
    .select(".ev-dot").style("background", d => (ctx.selected.includes(d.name) ? ctx.color.get(d.name) : null));
}

function evShowTooltip(event, html) {
  d3.select("#ev-tooltip").html(html).attr("hidden", null);
  evMoveTooltip(event);
}
function evMoveTooltip(event) {
  const tip = d3.select("#ev-tooltip");
  const w = tip.node().offsetWidth;
  const x = event.clientX + 14 + w > window.innerWidth - 8 ? event.clientX - w - 14 : event.clientX + 14;
  tip.style("left", x + "px").style("top", (event.clientY + 14) + "px");
}
function evHideTooltip() {
  d3.select("#ev-tooltip").attr("hidden", true);
}
