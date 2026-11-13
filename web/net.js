// Vue « La disparition du jeu au filet » : jitter + boîte + violon par décennie (comme au TD s04).
// Données : data/charting_net_matches.csv (un joueur dans un match par ligne).

(function () {
  const DECADES = [1980, 1990, 2000, 2010, 2020];
  const Y_MAX = 80;              // % ; les rares valeurs au-dessus sont posées sur le bord
  const MIN_VIOLIN = 30;         // nombre de matchs minimum pour tracer un violon

  let rows = [], surface = "All", selected = ["Stefan Edberg", "Pete Sampras", "Roger Federer"];

  const W = 1080, H = 470, m = { l: 56, r: 20, t: 14, b: 58 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const x = d3.scaleBand().domain(DECADES).range([0, iw]).paddingInner(0.18).paddingOuter(0.08);
  const y = d3.scaleLinear().domain([0, Y_MAX]).range([ih, 0]);
  const bw = x.bandwidth();

  const svg = d3.select("#net-chart").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
    .attr("aria-label", "Part des points joués au filet, par décennie");
  const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
  g.append("g").attr("class", "gridline").call(d3.axisLeft(y).ticks(8).tickSize(-iw).tickFormat(""));
  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(8).tickFormat(d => `${d} %`));
  g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`)
    .call(d3.axisBottom(x).tickSize(0).tickFormat(d => `Années ${d}`)).select(".domain").remove();
  g.append("text").attr("transform", "rotate(-90)").attr("x", -ih / 2).attr("y", -42).attr("text-anchor", "middle")
    .attr("font-size", 12).attr("fill", cssVar("--muted")).text("Part des points joués au filet");
  const layerViolin = g.append("g"), layerDots = g.append("g"), layerBox = g.append("g"),
        layerSelected = g.append("g"), layerN = g.append("g");

  // Densité par noyau d'Epanechnikov (TD s04).
  function kde(values, bandwidth, ticks) {
    const K = u => (Math.abs(u /= bandwidth) <= 1 ? 0.75 * (1 - u * u) / bandwidth : 0);
    return ticks.map(t => [t, d3.mean(values, v => K(t - v))]);
  }

  // Chaque violon à sa propre largeur maximale : on compare des formes, pas des effectifs.
  function violinPath(dens) {
    const w = d3.scaleLinear().domain([0, d3.max(dens, d => d[1])]).range([0, bw / 2]);
    return d3.area().curve(d3.curveBasis).y(d => y(d[0])).x0(d => -w(d[1])).x1(d => w(d[1]))(dens);
  }

  function boxStats(values) {
    const v = values.slice().sort(d3.ascending);
    const q1 = d3.quantile(v, 0.25), q2 = d3.quantile(v, 0.5), q3 = d3.quantile(v, 0.75), iqr = q3 - q1;
    return { q1, q2, q3, lo: d3.min(v.filter(e => e >= q1 - 1.5 * iqr)), hi: d3.max(v.filter(e => e <= q3 + 1.5 * iqr)) };
  }

  const cx = d => x(d.decade) + bw / 2 + d.jitter * bw * 0.82;
  const cy = d => y(Math.min(d.pct, Y_MAX));

  function draw(animate) {
    const t = d3.transition().duration(animate ? 700 : 0).ease(d3.easeExpInOut);
    const visible = rows.filter(d => surface === "All" || d.surface === surface);
    const byDecade = d3.group(visible, d => d.decade);
    const stats = DECADES.map(decade => {
      const v = (byDecade.get(decade) || []).map(d => d.pct);
      return { decade, n: v.length, dens: v.length >= MIN_VIOLIN ? kde(v, 4, d3.range(0, Y_MAX + 0.5, 1)) : null,
               box: v.length >= 5 ? boxStats(v) : null };
    });

    layerViolin.selectAll("path").data(stats, d => d.decade).join("path")
      .attr("transform", d => `translate(${x(d.decade) + bw / 2},0)`)
      .attr("fill", cssVar("--shape")).attr("fill-opacity", 0.45)
      .transition(t).attr("d", d => (d.dens ? violinPath(d.dens) : null));

    const isSelected = d => selected.includes(d.player);
    layerDots.selectAll("circle").data(visible.filter(d => !isSelected(d)), d => d.id)
      .join("circle").attr("r", 1.6).attr("fill", cssVar("--dot")).attr("fill-opacity", 0.28)
      .attr("cx", cx).attr("cy", cy);

    const half = bw * 0.065;
    const box = layerBox.selectAll("g.box").data(stats, d => d.decade)
      .join(enter => {
        const e = enter.append("g").attr("class", "box");
        e.append("line").attr("class", "whisker"); e.append("rect"); e.append("line").attr("class", "median");
        return e;
      })
      .attr("transform", d => `translate(${x(d.decade) + bw / 2},0)`)
      .style("display", d => (d.box ? null : "none"))
      .on("mouseenter", (event, d) => showTip(event,
        `<b>Années ${d.decade}</b> · ${SURFACE_FR[surface]}<br>Médiane ${d.box.q2.toFixed(1)} %<br>` +
        `Quartiles ${d.box.q1.toFixed(1)} – ${d.box.q3.toFixed(1)} %<br><span class="m">${d.n} joueurs-matchs</span>`))
      .on("mousemove", moveTip).on("mouseleave", hideTip);
    const b = d => d.box || { q1: 0, q2: 0, q3: 0, lo: 0, hi: 0 };
    box.select("line.whisker").attr("stroke", cssVar("--muted")).attr("stroke-width", 1.5)
      .transition(t).attr("y1", d => y(b(d).lo)).attr("y2", d => y(Math.min(b(d).hi, Y_MAX)));
    box.select("rect").attr("x", -half).attr("width", 2 * half).attr("rx", 2)
      .attr("fill", cssVar("--bg")).attr("stroke", cssVar("--muted")).attr("stroke-width", 1.5)
      .transition(t).attr("y", d => y(b(d).q3)).attr("height", d => y(b(d).q1) - y(b(d).q3));
    box.select("line.median").attr("x1", -half).attr("x2", half).attr("stroke", cssVar("--text")).attr("stroke-width", 2.5)
      .transition(t).attr("y1", d => y(b(d).q2)).attr("y2", d => y(b(d).q2));

    layerSelected.selectAll("circle").data(visible.filter(isSelected), d => d.id)
      .join(enter => enter.append("circle").attr("r", 0).call(e => e.transition(t).attr("r", 3.4)))
      .attr("cx", cx).attr("cy", cy)
      .attr("fill", d => playerColor(d.player)).attr("stroke", cssVar("--bg")).attr("stroke-width", 1)
      .on("mouseenter", (event, d) => showTip(event,
        `<b>${d.player}</b> · ${d.year}, ${SURFACE_FR[d.surface]}<br>${d.pct.toFixed(1)} % des points au filet` +
        `<br><span class="m">${d.net_pts} points au filet sur ${d.points}</span>`))
      .on("mousemove", moveTip).on("mouseleave", hideTip);

    layerN.selectAll("text").data(stats, d => d.decade).join("text")
      .attr("x", d => x(d.decade) + bw / 2).attr("y", ih + 34).attr("text-anchor", "middle")
      .attr("font-size", 11).attr("fill", cssVar("--muted")).text(d => `n = ${d.n}`);

    const f = v => (v == null ? "–" : v.toFixed(1));
    htmlTable("#net-table", ["Décennie", "n", "Q1 (%)", "Médiane (%)", "Q3 (%)"],
      stats.map(d => [`Années ${d.decade}`, d.n, f(d.box?.q1), f(d.box?.q2), f(d.box?.q3)]));
  }

  function chips() {
    const box = d3.select("#net-players");
    box.selectAll("button").data(FEATURED).join("button").attr("class", "chip")
      .html(d => `<i></i>${d.name}`)
      .on("click", (event, d) => {
        if (selected.includes(d.name)) selected = selected.filter(n => n !== d.name);
        else { selected.push(d.name); if (selected.length > 3) selected.shift(); }
        paint(); draw(false);
      });
    function paint() {
      box.selectAll("button").attr("aria-pressed", d => selected.includes(d.name))
        .select("i").style("background", d => (selected.includes(d.name) ? playerColor(d.name) : null));
    }
    paint();
  }

  d3.csv("data/charting_net_matches.csv", d3.autoType).then(data => {
    // Jitter fixe (pseudo-aléatoire à graine) : les points ne bougent pas quand on change de filtre.
    const random = d3.randomLcg(7);
    rows = data.map((d, i) => ({ ...d, id: i, decade: Math.floor(d.year / 10) * 10,
                                 pct: (100 * d.net_pts) / d.points, jitter: random() - 0.5 }));
    surfaceButtons("#net-surface", s => { surface = s; draw(true); });
    chips();
    draw(true);
  });
})();
