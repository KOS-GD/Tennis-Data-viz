// Onglet « Services » : où un joueur sert-il, sur dur, terre et gazon ?
// Données : web/data/charting_serve_direction.csv et charting_matches.csv (prepare_data.py).
// Tout le code est dans une fonction anonyme : ses variables (ctx...) ne gênent pas les scripts
// des autres onglets. Seule initServices() est exposée, appelée par js/tabs.js.
(() => {

const ctx = {
  // Court en mètres (dimensions ITF). On montre la moitié du relanceur, filet en haut, recadrée
  // un peu après la ligne de service : toute l'information est dans les carrés de service.
  W: 10.97, S: 8.23, SL: 6.40,
  TOP: 2.0,            // au-dessus du filet : d'où arrivent les services
  DEPTH: 9.2,          // profondeur montrée sous le filet
  SIDE: 0.9,
  PX: 34,              // pixels par mètre
  GAP: 30,
  HEAD: 44,            // titre au-dessus de chaque court
  STRIP: 70,           // bande des pourcentages sous chaque court
  N_DOTS: 160,         // balles par court : chacune vaut 1/160 des services bons du joueur sur la surface
  MIN_SERVES: 60,      // en dessous, le court est atténué
  MIN_MATCHES: 15,     // joueurs proposés dans la liste
  DELTA_MAX: 10,       // écart (points) qui donne la couleur la plus intense
  OUT: 450,            // étape 1 : les balles précédentes s'effacent
  PAINT: 700,          // étape 2 : la couleur se peint au sol, du filet vers le fond
  FLIGHT: 900,         // étape 3 : durée du vol d'une balle
  SPREAD: 1500,        // étalement des départs des 160 balles
  SURFACES: [["Hard", "Dur"], ["Clay", "Terre battue"], ["Grass", "Gazon"]],
  ZONES: ["wide", "middle", "t"],
  ZONE_NAMES: { wide: "Extérieur", middle: "Corps", t: "T" },
  ZONE_SHORT: { wide: "ext.", middle: "corps", t: "T" },
  BOXES: ["ad", "deuce"],
  BOX_NAMES: { deuce: "carré égalité", ad: "carré avantage" },
  PLUS: "#b8473d",     // plus que la moyenne
  MINUS: "#3f6fa3",    // moins que la moyenne
};

// Couleurs sourdes des surfaces : elles identifient le court sans attirer l'œil.
ctx.COURT = {
  Hard: { inner: "#5b7391", outer: "#6b8277" },
  Clay: { inner: "#b37c63", outer: "#a87259" },
  Grass: { inner: "#76926a", outer: "#6c8862" },
};

// ---------------------------------------------------------------------------
// Géométrie : u en travers (0 = ligne centrale, > 0 à droite = côté égalité), d en profondeur
// depuis le filet (d < 0 : de l'autre côté du filet).
// ---------------------------------------------------------------------------

const CW = () => (ctx.W + 2 * ctx.SIDE) * ctx.PX;
const CH = () => (ctx.TOP + ctx.DEPTH) * ctx.PX;
const X = u => (ctx.W / 2 + ctx.SIDE + u) * ctx.PX;
const Y = d => (ctx.TOP + d) * ctx.PX;

function zoneBounds(box, zone) {
  const third = ctx.S / 6, k = { t: 0, middle: 1, wide: 2 }[zone];
  return box === "deuce" ? [k * third, (k + 1) * third] : [-(k + 1) * third, -k * third];
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
    select(ctx.featured[0]);
  });
}

// Comptes par joueur, surface, carré, zone et balle (1re / 2e), et moyenne du circuit.
function prepareData(dir, matches) {
  const byMatch = new Map(matches.map(m => [m.match_id, m]));
  ctx.stats = new Map();
  ctx.tour = new Map();
  const add = (map, key, d) => {
    if (!map.has(key)) map.set(key, { n: 0, matches: new Set(), c: {} });
    const s = map.get(key);
    s.matches.add(d.match_id);
    ctx.BOXES.forEach(b => ctx.ZONES.forEach(z => {
      const k = `${b}_${z}_${d.row}`, v = d[`${b}_${z}`] || 0;
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
  ctx.players = d3.rollups(matches.flatMap(m => [m.w_name, m.l_name]), v => v.length, d => d)
    .filter(d => d[1] >= ctx.MIN_MATCHES).sort((a, b) => b[1] - a[1]);
  ctx.featured = ctx.players.slice(0, 8).map(d => d[0]);
}

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
  const width = 3 * CW() + 2 * ctx.GAP, height = ctx.HEAD + CH() + ctx.STRIP;
  const svg = d3.select("#sv-courts").append("svg").attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img").attr("aria-label", "Trois demi-courts avec les services du joueur choisi");
  const defs = svg.append("defs");

  // Balles : dégradé radial (éclairées en haut à gauche) ; 1re balle claire, 2e balle sombre
  [["sv-ball1", "#ffffff", "#e9e6df", "#b9b4a8"], ["sv-ball2", "#5d5a55", "#2f2d2a", "#141312"]]
    .forEach(([id, a, b, c]) => {
      const g = defs.append("radialGradient").attr("id", id).attr("cx", "35%").attr("cy", "30%").attr("r", "75%");
      g.append("stop").attr("offset", "0%").attr("stop-color", a);
      g.append("stop").attr("offset", "60%").attr("stop-color", b);
      g.append("stop").attr("offset", "100%").attr("stop-color", c);
    });
  // Bord flou des zones colorées : la couleur semble peinte au sol
  defs.append("filter").attr("id", "sv-soft").attr("x", "-10%").attr("y", "-10%").attr("width", "120%").attr("height", "120%")
    .append("feGaussianBlur").attr("stdDeviation", 2.5);
  // Le bas du court se fond dans la page
  const fade = defs.append("linearGradient").attr("id", "sv-fade").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  fade.append("stop").attr("offset", "78%").attr("stop-color", "#fff").attr("stop-opacity", 1);
  fade.append("stop").attr("offset", "100%").attr("stop-color", "#fff").attr("stop-opacity", 0);
  defs.append("mask").attr("id", "sv-fade-mask").attr("maskContentUnits", "userSpaceOnUse")
    .append("rect").attr("width", CW()).attr("height", CH()).attr("fill", "url(#sv-fade)");
  // Éclairage : léger assombrissement côté filet
  const light = defs.append("linearGradient").attr("id", "sv-light").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", 1);
  light.append("stop").attr("offset", "0%").attr("stop-color", "#000").attr("stop-opacity", 0.18);
  light.append("stop").attr("offset", "30%").attr("stop-color", "#000").attr("stop-opacity", 0);

  ctx.courts = {};
  ctx.SURFACES.forEach(([surface, label], i) => {
    const g = svg.append("g").attr("transform", `translate(${i * (CW() + ctx.GAP)},0)`);
    g.append("text").attr("class", "court-title").attr("x", 0).attr("y", 20).text(label);
    const nText = g.append("text").attr("class", "court-n").attr("x", 0).attr("y", 37);

    const c = g.append("g").attr("transform", `translate(0,${ctx.HEAD})`).attr("opacity", 1);
    const ground = c.append("g").attr("mask", "url(#sv-fade-mask)");
    const st = ctx.COURT[surface], hw = ctx.W / 2, hs = ctx.S / 2;
    ground.append("rect").attr("width", CW()).attr("height", CH()).attr("rx", 10).attr("fill", st.outer);
    ground.append("rect").attr("x", X(-hw)).attr("y", Y(0)).attr("width", ctx.W * ctx.PX)
      .attr("height", ctx.DEPTH * ctx.PX).attr("fill", st.inner);

    // Couleur d'écart peinte au sol, révélée du filet vers le fond par un masque qui s'agrandit
    const clipId = `sv-paint-${surface}`;
    const clip = defs.append("clipPath").attr("id", clipId).append("rect")
      .attr("x", 0).attr("y", Y(0)).attr("width", CW()).attr("height", 0);
    const paint = ground.append("g").attr("clip-path", `url(#${clipId})`).attr("filter", "url(#sv-soft)");
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone);
      paint.append("rect").attr("class", `zone z-${box}-${zone}`)
        .attr("x", X(u0) + 1).attr("y", Y(0)).attr("width", (u1 - u0) * ctx.PX - 2).attr("height", ctx.SL * ctx.PX)
        .attr("fill", ctx.PLUS).attr("fill-opacity", 0);
    }));
    ground.append("rect").attr("width", CW()).attr("height", CH()).attr("fill", "url(#sv-light)");

    // Lignes (blanches, fines) et filet
    const lines = ground.append("g").attr("stroke", "rgba(255,255,255,.92)").attr("stroke-width", 2).attr("fill", "none");
    [-hw, -hs, hs, hw].forEach(u => lines.append("line").attr("x1", X(u)).attr("x2", X(u)).attr("y1", Y(0)).attr("y2", CH()));
    lines.append("line").attr("x1", X(-hs)).attr("x2", X(hs)).attr("y1", Y(ctx.SL)).attr("y2", Y(ctx.SL));
    lines.append("line").attr("x1", X(0)).attr("x2", X(0)).attr("y1", Y(0)).attr("y2", Y(ctx.SL));
    // repères discrets entre les zones
    ctx.BOXES.forEach(box => ["middle", "wide"].forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone), u = box === "deuce" ? u0 : u1;
      lines.append("line").attr("x1", X(u)).attr("x2", X(u)).attr("y1", Y(0)).attr("y2", Y(ctx.SL))
        .attr("stroke", "rgba(255,255,255,.28)").attr("stroke-width", 1).attr("stroke-dasharray", "3 5");
    }));
    c.append("rect").attr("x", X(-hw - 0.6)).attr("y", Y(0) - 1).attr("width", (ctx.W + 1.2) * ctx.PX).attr("height", 7)
      .attr("fill", "#000").attr("opacity", 0.18);
    c.append("line").attr("x1", X(-hw - 0.6)).attr("x2", X(hw + 0.6)).attr("y1", Y(0) - 2).attr("y2", Y(0) - 2)
      .attr("stroke", "#23262b").attr("stroke-width", 3);
    c.append("line").attr("x1", X(-hw - 0.6)).attr("x2", X(hw + 0.6)).attr("y1", Y(0) - 4).attr("y2", Y(0) - 4)
      .attr("stroke", "#f4f2ee").attr("stroke-width", 1.5);

    // Noms des zones, discrets, en haut de chaque zone
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone);
      c.append("text").attr("class", "zone-name").attr("text-anchor", "middle")
        .attr("x", X((u0 + u1) / 2)).attr("y", Y(0) + 18).text(ctx.ZONE_SHORT[zone]);
    }));

    const shadows = c.append("g"), balls = c.append("g"), ripples = c.append("g");

    // Bande sous le court : part de chaque zone (grand) et écart à la moyenne (petit)
    const strip = g.append("g").attr("transform", `translate(0,${ctx.HEAD + CH() + 6})`);
    ctx.BOXES.forEach(box => {
      const [a] = zoneBounds(box, box === "deuce" ? "t" : "wide"), [, b] = zoneBounds(box, box === "deuce" ? "wide" : "t");
      strip.append("line").attr("x1", X(a) + 3).attr("x2", X(b) - 3).attr("y1", 0).attr("y2", 0).attr("class", "strip-rule");
      strip.append("text").attr("class", "strip-box").attr("text-anchor", "middle").attr("x", X((a + b) / 2)).attr("y", 62)
        .text(ctx.BOX_NAMES[box]);
      ctx.ZONES.forEach(zone => {
        const [u0, u1] = zoneBounds(box, zone);
        const z = strip.append("g").attr("class", `lab l-${box}-${zone}`).attr("transform", `translate(${X((u0 + u1) / 2)},0)`);
        z.append("text").attr("class", "zone-pct").attr("text-anchor", "middle").attr("y", 26);
        z.append("text").attr("class", "zone-delta").attr("text-anchor", "middle").attr("y", 43);
      });
    });

    // Zones survolables
    ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
      const [u0, u1] = zoneBounds(box, zone);
      c.append("rect").attr("class", "zone-hit").datum({ surface, box, zone })
        .attr("x", X(u0)).attr("y", Y(0)).attr("width", (u1 - u0) * ctx.PX).attr("height", ctx.SL * ctx.PX)
        .on("mousemove", showTooltip).on("mouseleave", hideTooltip);
    }));
    ctx.courts[surface] = { g: c, nText, clip, shadows, balls, ripples };
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
    if (ctx.players.some(p => p[0] === name)) { select(name); input.property("value", ""); }
  };
  input.on("change", pick).on("keydown", e => { if (e.key === "Enter") pick(); });
  d3.select("#sv-featured").selectAll("button").data(ctx.featured).join("button")
    .text(d => d).on("click", (e, d) => select(d));
}

function select(name) {
  ctx.player = name;
  d3.select("#sv-featured").selectAll("button").classed("on", d => d === name);
  ctx.SURFACES.forEach(([surface], i) => updateCourt(surface, i * 120));
  updateInsight();
}

// ---------------------------------------------------------------------------
// Transition en trois étapes (séance 5, TD 5), décalée d'un court à l'autre :
//   1. les balles du joueur précédent s'effacent et la peinture se retire vers le filet ;
//   2. la couleur d'écart se peint au sol, du filet vers le fond ;
//   3. les balles sont servies une à une : vol en cloche au-dessus de leur ombre, impact marqué
//      par une onde, et le pourcentage de chaque zone monte au rythme des impacts.
// ---------------------------------------------------------------------------

function updateCourt(surface, offset) {
  const court = ctx.courts[surface];
  const s = ctx.stats.get(`${ctx.player}|${surface}`), tour = ctx.tour.get(surface);
  const n = s ? s.n : 0, few = n < ctx.MIN_SERVES;
  court.nText.text(s ? `${d3.format(",")(n)} services bons · ${s.matches.size} matchs${few ? " · trop peu pour conclure" : ""}`
                     : "aucun match noté");

  // Étape 1
  const t0 = offset;
  court.balls.selectAll("circle").interrupt().transition().delay(() => t0 + Math.random() * 150).duration(ctx.OUT)
    .attr("opacity", 0).attr("r", 0).remove();
  court.shadows.selectAll("ellipse").interrupt().transition().delay(t0).duration(ctx.OUT).attr("opacity", 0).remove();
  court.clip.interrupt().transition().delay(t0).duration(ctx.OUT).ease(d3.easeCubicIn).attr("height", 0);

  // Étape 2
  const t1 = t0 + ctx.OUT;
  ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
    const p = share(s, box, zone), a = share(tour, box, zone), delta = (p.p - a.p) * 100;
    const ok = !few && !isNaN(delta);
    court.g.select(`.z-${box}-${zone}`).transition().delay(t1 - 1).duration(0)
      .attr("fill", delta >= 0 ? ctx.PLUS : ctx.MINUS)
      .attr("fill-opacity", ok ? 0.72 * Math.min(1, Math.abs(delta) / ctx.DELTA_MAX) : 0);
  }));
  court.clip.transition().delay(t1).duration(ctx.PAINT).ease(d3.easeCubicOut).attr("height", ctx.SL * ctx.PX + 6);
  court.g.transition().delay(t0).duration(ctx.OUT).attr("opacity", few ? 0.55 : 1);

  // Étape 3
  const t2 = t1 + ctx.PAINT * 0.6;
  const dots = s ? allocate(s, surface) : [];
  const landing = ctx.SPREAD + ctx.FLIGHT;
  dots.forEach(d => { d.delay = t2 + d.order / ctx.N_DOTS * ctx.SPREAD; });

  court.shadows.selectAll(null).data(dots).enter().append("ellipse")
    .attr("cx", d => d.x0).attr("cy", d => d.y0).attr("rx", 0).attr("ry", 0)
    .attr("fill", "#000").attr("opacity", 0)
    .transition().delay(d => d.delay).duration(ctx.FLIGHT).ease(d3.easeLinear)
    .tween("flight", function (d) {
      const el = d3.select(this);
      return t => {
        const h = height(t);
        el.attr("cx", d.x0 + (d.x - d.x0) * t).attr("cy", d.y0 + (d.y - d.y0) * t)
          .attr("rx", 3 + h * 0.06).attr("ry", 1.6 + h * 0.03).attr("opacity", 0.28 - h * 0.003);
      };
    });

  court.balls.selectAll(null).data(dots).enter().append("circle")
    .attr("cx", d => d.x0).attr("cy", d => d.y0).attr("r", 0)
    .attr("fill", d => `url(#sv-ball${d.serve})`)
    .transition().delay(d => d.delay).duration(ctx.FLIGHT).ease(d3.easeLinear)
    .tween("flight", function (d) {
      const el = d3.select(this);
      return t => {
        const h = height(t);
        el.attr("cx", d.x0 + (d.x - d.x0) * t).attr("cy", d.y0 + (d.y - d.y0) * t - h)
          .attr("r", 3.4 + h * 0.045);
      };
    })
    .on("end", function (d) {
      court.ripples.append("circle").attr("cx", d.x).attr("cy", d.y).attr("r", 2)
        .attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 1.2).attr("opacity", 0.8)
        .transition().duration(600).ease(d3.easeCubicOut).attr("r", 13).attr("opacity", 0).remove();
    });

  // Pourcentages : ils montent pendant que les balles tombent
  ctx.BOXES.forEach(box => ctx.ZONES.forEach(zone => {
    const p = share(s, box, zone), a = share(tour, box, zone), delta = (p.p - a.p) * 100;
    const lab = d3.select(court.g.node().parentNode).select(`.l-${box}-${zone}`);
    const pct = lab.select(".zone-pct"), del = lab.select(".zone-delta");
    pct.interrupt().transition().delay(t0).duration(ctx.OUT).style("opacity", 0.25)
      .transition().delay(t2 - t0 - ctx.OUT + ctx.FLIGHT * 0.6).duration(landing).ease(d3.easeCubicOut)
      .style("opacity", 1)
      .tween("text", () => { const i = d3.interpolateNumber(0, isNaN(p.p) ? 0 : p.p); return t => pct.text(isNaN(p.p) ? "–" : d3.format(".0%")(i(t))); });
    del.interrupt().style("opacity", 0)
      .text(few || isNaN(delta) ? "" : `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toFixed(0)} pts`)
      .style("fill", delta >= 0 ? ctx.PLUS : ctx.MINUS)
      .transition().delay(t2 + landing).duration(500).style("opacity", 1);
  }));
}

// Hauteur de la balle (pixels) le long du vol : frappée haut, elle descend en cloche vers le sol.
function height(t) {
  return 38 * (1 - t) * (1 - t) + 48 * Math.sin(Math.PI * t) * (1 - t);
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
      const d = Math.max(0.5, Math.min(ctx.SL - 0.18, ctx.SL * (1 - 0.8 * beta(1.4, 3.0))));
      const lat = u0 + 0.16 + (u1 - u0 - 0.32) * u();
      // Le serveur est en face, de l'autre côté du filet : à gauche pour le carré égalité
      dots.push({ ...c, x: X(lat), y: Y(d), x0: X(c.box === "deuce" ? -1.2 : 1.2) + (u() - 0.5) * 10, y0: 46 });
    }
  });
  d3.shuffle(dots).forEach((d, i) => { d.order = i; });
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
      const p = share(s, box, zone), a = share(tour, box, zone), delta = (p.p - a.p) * 100;
      if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { label, box, zone, p: p.p, a: a.p, delta };
    }));
  });
  const el = d3.select("#sv-insight");
  el.interrupt().style("opacity", 0);
  if (!best) { el.text(`Pas assez de services notés pour ${ctx.player}.`).style("opacity", 1); return; }
  const pct = d3.format(".0%");
  const where = best.zone === "t" ? "au T" : best.zone === "wide" ? "à l'extérieur" : "dans le corps";
  el.html(`<b>${ctx.player}</b> · sur ${best.label.toLowerCase()}, ${pct(best.p)} de ses services dans le ${ctx.BOX_NAMES[best.box]} vont ${where}, contre ${pct(best.a)} en moyenne.`)
    .transition().delay(ctx.OUT + ctx.PAINT).duration(600).style("opacity", 1);
}

// ---------------------------------------------------------------------------
// Légende et infobulle
// ---------------------------------------------------------------------------

function drawLegend() {
  const svg = d3.select("#sv-legend").append("svg").attr("width", 760).attr("height", 34);
  const sw = (x, color, op) => svg.append("rect").attr("x", x).attr("y", 9).attr("width", 16).attr("height", 16)
    .attr("rx", 3).attr("fill", color).attr("fill-opacity", op);
  let x = 0;
  [[ctx.MINUS, 0.85], [ctx.MINUS, 0.4], ["#cfcac0", 0.5], [ctx.PLUS, 0.4], [ctx.PLUS, 0.85]].forEach(([c, o], i) => sw(x + i * 18, c, o));
  svg.append("text").attr("class", "legend-text").attr("x", x + 98).attr("y", 21)
    .text(`moins … plus que la moyenne du circuit (couleur pleine : ±${ctx.DELTA_MAX} points ou plus)`);
  x = 520;
  [["url(#sv-ball1)", "1re balle"], ["url(#sv-ball2)", "2e balle"]].forEach(([fill, label], i) => {
    svg.append("circle").attr("cx", x + i * 100 + 6).attr("cy", 17).attr("r", 5.5).attr("fill", fill)
      .attr("stroke", "rgba(0,0,0,.25)").attr("stroke-width", 0.5);
    svg.append("text").attr("class", "legend-text").attr("x", x + i * 100 + 17).attr("y", 21).text(label);
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
