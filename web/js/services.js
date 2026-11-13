// Onglet « Services » : où un joueur sert-il, sur dur, terre et gazon ?
// Données : data/charting_serve_direction.csv et data/charting_matches.csv

const svCtx = {
  PX: 30,                // pixels par mètre
  W: 10.97,              // largeur du court (double)
  S: 8.23,               // largeur du simple
  SL: 6.4,               // ligne de service, depuis le filet
  DEPTH: 8.5,            // profondeur de court dessinée sous le filet
  MARGIN: 1,             // bord autour du court
  GAP: 40,               // espace entre deux courts
  N_BALLS: 120,          // balles par court
  DURATION: 900,
  SURFACES: ["Hard", "Clay", "Grass"],
  NAMES: { Hard: "Dur", Clay: "Terre battue", Grass: "Gazon" },
  COURT: { Hard: "#5d7594", Clay: "#b5785c", Grass: "#6f8f63" },
  ZONES: ["ad_wide", "ad_middle", "ad_t", "deuce_t", "deuce_middle", "deuce_wide"],
};

// Écart à la moyenne du circuit (en points) : échelle divergente, neutre à 0 (séance 2, TD 5)
svCtx.color = d3.scaleLinear().domain([-10, 0, 10])
  .range(["#4a78b0", "#f2efe8", "#c0473c"]).clamp(true);

function initServices() {
  Promise.all([
    d3.csv("data/charting_serve_direction.csv", d3.autoType),
    d3.csv("data/charting_matches.csv", d3.autoType),
  ]).then(function (data) {
    svPrepare(data[0], data[1]);
    svDrawCourts();
    const players = Array.from(svCtx.players.keys());
    d3.select("#sv-player").selectAll("option").data(players).enter().append("option")
      .attr("value", d => d).text(d => d);
    d3.select("#sv-player").on("change", function () { svUpdate(this.value); });
    svUpdate(players[0]);
  });
}

// Services bons par zone : pour chaque joueur et surface, et pour tout le circuit.
function svPrepare(dir, matches) {
  const byId = {};
  matches.forEach(m => { byId[m.match_id] = m; });
  svCtx.counts = {};   // clé "joueur|surface" ou "tous|surface"
  const nMatches = {};
  dir.filter(d => d.row === "Total").forEach(function (d) {
    const m = byId[d.match_id];
    const name = m[d.player + "_name"];
    [name + "|" + m.surface, "tous|" + m.surface].forEach(function (key) {
      if (!svCtx.counts[key]) svCtx.counts[key] = { ad_wide: 0, ad_middle: 0, ad_t: 0, deuce_t: 0, deuce_middle: 0, deuce_wide: 0 };
      svCtx.ZONES.forEach(z => { svCtx.counts[key][z] += d[z]; });
    });
    nMatches[name] = (nMatches[name] || 0) + 1;
  });
  // Joueurs proposés : au moins 30 matchs notés, du plus suivi au moins suivi
  svCtx.players = new Map(Object.entries(nMatches).filter(d => d[1] >= 30).sort((a, b) => b[1] - a[1]));
}

// Part de chaque zone dans son carré de service (égalité ou avantage)
function svShares(c) {
  const ad = c.ad_wide + c.ad_middle + c.ad_t;
  const deuce = c.deuce_t + c.deuce_middle + c.deuce_wide;
  const res = {};
  svCtx.ZONES.forEach(z => { res[z] = c[z] / (z.startsWith("ad") ? ad : deuce); });
  return res;
}

// x d'une zone : les six zones côte à côte, carré avantage à gauche, carré égalité à droite
function svZoneX(i) {
  return (svCtx.MARGIN + (svCtx.W - svCtx.S) / 2 + i * svCtx.S / 6) * svCtx.PX;
}

function svDrawCourts() {
  const w = (svCtx.W + 2 * svCtx.MARGIN) * svCtx.PX;
  const h = (svCtx.DEPTH + svCtx.MARGIN) * svCtx.PX;
  const zw = svCtx.S / 6 * svCtx.PX, zh = svCtx.SL * svCtx.PX;
  const top = svCtx.MARGIN * svCtx.PX;
  const svg = d3.select("#sv-courts").append("svg")
    .attr("viewBox", `0 0 ${3 * w + 2 * svCtx.GAP} ${h + 70}`);

  svCtx.SURFACES.forEach(function (s, i) {
    const g = svg.append("g").attr("id", "sv-" + s)
      .attr("transform", `translate(${i * (w + svCtx.GAP)},30)`);
    g.append("text").attr("class", "sv-title").attr("y", -10).text(svCtx.NAMES[s]);
    g.append("rect").attr("width", w).attr("height", h).attr("rx", 6).attr("fill", svCtx.COURT[s]);

    // Six zones, colorées selon l'écart à la moyenne
    g.selectAll("rect.zone").data(svCtx.ZONES).enter().append("rect")
      .attr("class", "zone")
      .attr("x", (d, j) => svZoneX(j)).attr("y", top)
      .attr("width", zw).attr("height", zh)
      .attr("fill", svCtx.color(0));

    // Lignes du court
    const x0 = svCtx.MARGIN * svCtx.PX, x1 = w - x0;
    const xs0 = svZoneX(0), xs1 = svZoneX(6), xc = svZoneX(3);
    const lines = [
      [x0, top, x0, h], [x1, top, x1, h], [xs0, top, xs0, h], [xs1, top, xs1, h],
      [xs0, top + zh, xs1, top + zh], [xc, top, xc, top + zh],
    ];
    g.selectAll("line.court").data(lines).enter().append("line")
      .attr("x1", d => d[0]).attr("y1", d => d[1]).attr("x2", d => d[2]).attr("y2", d => d[3])
      .attr("stroke", "white").attr("stroke-width", 2);
    // Filet
    g.append("line").attr("x1", 0).attr("x2", w).attr("y1", top).attr("y2", top)
      .attr("stroke", "#222").attr("stroke-width", 4);

    g.append("g").attr("class", "balls");

    // Pourcentage de chaque zone, sous le court
    g.selectAll("text.sv-pct").data(svCtx.ZONES).enter().append("text")
      .attr("class", "sv-pct").attr("text-anchor", "middle")
      .attr("x", (d, j) => svZoneX(j) + zw / 2).attr("y", h + 22);
    g.append("text").attr("class", "sv-small").attr("x", svZoneX(1.5)).attr("y", h + 40)
      .attr("text-anchor", "middle").text("carré avantage");
    g.append("text").attr("class", "sv-small").attr("x", svZoneX(4.5)).attr("y", h + 40)
      .attr("text-anchor", "middle").text("carré égalité");
  });
}

function svUpdate(player) {
  const zw = svCtx.S / 6 * svCtx.PX, zh = svCtx.SL * svCtx.PX, top = svCtx.MARGIN * svCtx.PX;

  svCtx.SURFACES.forEach(function (s) {
    const g = d3.select("#sv-" + s);
    const c = svCtx.counts[player + "|" + s];
    const avg = svShares(svCtx.counts["tous|" + s]);
    const p = c ? svShares(c) : null;

    // Couleur des zones
    g.selectAll("rect.zone").transition().duration(svCtx.DURATION)
      .attr("fill", z => (p ? svCtx.color((p[z] - avg[z]) * 100) : "#ddd"));

    // Pourcentages
    g.selectAll("text.sv-pct").text(z => (p ? d3.format(".0%")(p[z]) : "–"));

    // Balles : N_BALLS par court, réparties entre les zones selon les services du joueur.
    // Leur position dans la zone est tirée au hasard (les données ne donnent que la zone).
    const balls = [];
    if (c) {
      const total = d3.sum(svCtx.ZONES, z => c[z]);
      svCtx.ZONES.forEach(function (z, j) {
        const n = Math.round(c[z] / total * svCtx.N_BALLS);
        for (let k = 0; k < n; k++) {
          balls.push({
            x: svZoneX(j) + 5 + Math.random() * (zw - 10),
            y: top + zh * (0.25 + 0.72 * Math.sqrt(Math.random())),
          });
        }
      });
    }

    // Les balles déjà là glissent vers leur nouvelle place ; les nouvelles partent du filet.
    g.select(".balls").selectAll("circle").data(balls)
      .join(
        enter => enter.append("circle")
          .attr("cx", d => d.x).attr("cy", top).attr("r", 3.5)
          .attr("fill", "#222").attr("fill-opacity", 0),
        update => update,
        exit => exit.transition().duration(svCtx.DURATION / 2).attr("fill-opacity", 0).remove()
      )
      .transition().duration(svCtx.DURATION).delay((d, i) => i * 4)
      .attr("cx", d => d.x).attr("cy", d => d.y).attr("fill-opacity", 0.75);
  });
}
