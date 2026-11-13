// Vue « Classement réglable » : barres empilées, une couleur par critère.
// Données : data/goat.json (produit par scripts/build_data.py),
// sinon data/goat_sample.json (fictif) pour développer sans les vraies données.

(async function () {
  const data = await loadData();
  const criteria = data.criteria.map((c, i) => ({ ...c, color: `var(--series-${i + 1})` }));
  const players = data.players;

  // Normalisation : rang percentile de chaque critère (0 = dernier, 1 = premier).
  // Les valeurs manquantes restent nulles et ne pénalisent pas le joueur.
  const norm = new Map(players.map(p => [p.id, {}]));
  for (const c of criteria) {
    const vals = players.map(p => p.values[c.key]).filter(v => v != null).sort(d3.ascending);
    for (const p of players) {
      const v = p.values[c.key];
      norm.get(p.id)[c.key] = v == null ? null : percentileRank(vals, v);
    }
  }

  const weights = Object.fromEntries(criteria.map(c => [c.key, 1]));
  const selection = new Set();   // joueurs sélectionnés, partagés avec les futures vues

  const PRESETS = {
    equal: () => criteria.forEach(c => (weights[c.key] = 1)),
    slams: () => criteria.forEach(c => (weights[c.key] = c.key === "slams" ? 1 : 0)),
    peak: () => criteria.forEach(c => (weights[c.key] = c.key === "peak_elo" ? 1 : 0)),
    longevity: () => criteria.forEach(c => (weights[c.key] = c.key === "longevity" ? 1 : 0)),
  };

  buildSliders();
  buildLegend();
  d3.selectAll(".presets button").on("click", function () {
    PRESETS[this.dataset.preset]();
    d3.selectAll(".presets button").classed("is-active", false);
    d3.select(this).classed("is-active", true);
    syncSliders();
    render();
  });

  // ---- Graphique ---------------------------------------------------------
  const margin = { top: 24, right: 56, bottom: 8, left: 150 };
  const rowH = 30, barH = 18, width = 900;
  const height = margin.top + margin.bottom + rowH * players.length;
  const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().range([margin.top, height - margin.bottom]).padding(0);

  const svg = d3.select("#goat-chart").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img")
    .attr("aria-label", "Classement des joueurs selon les critères pondérés");

  svg.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${margin.top - 4})`)
    .call(d3.axisTop(x).ticks(5).tickFormat(d3.format(".0%")).tickSizeOuter(0))
    .call(g => g.select(".domain").remove());

  const defs = svg.append("defs");
  const tooltip = d3.select("#tooltip");

  function render() {
    const rows = players.map(p => ({ ...p, ...score(p) }))
      .sort((a, b) => d3.descending(a.score, b.score) || d3.ascending(a.name, b.name));
    y.domain(rows.map(d => d.id));
    const t = svg.transition().duration(600).ease(d3.easeCubicInOut);

    // Bords arrondis de 4 px en bout de barre (clipPath par joueur)
    defs.selectAll("clipPath").data(rows, d => d.id).join(
      enter => enter.append("clipPath").attr("id", d => `clip-${d.id}`)
        .call(cp => cp.append("rect").attr("rx", 4).attr("height", barH).attr("x", x(0))),
    ).select("rect")
      .transition(t)
      .attr("y", (rowH - barH) / 2)   // coordonnées de la ligne (le <g> est déjà translaté)
      .attr("width", d => Math.max(0, x(d.score) - x(0)));

    const row = svg.selectAll("g.row").data(rows, d => d.id).join(enter => {
      const g = enter.append("g").attr("class", "row")
        .attr("transform", d => `translate(0,${y(d.id)})`);
      g.append("rect").attr("class", "hit").attr("x", 0).attr("width", width)
        .attr("height", rowH).attr("fill", "transparent");
      g.append("text").attr("class", "name").attr("x", margin.left - 10)
        .attr("y", rowH / 2).attr("dy", "0.35em").attr("text-anchor", "end").text(d => d.name);
      g.append("g").attr("class", "bar");
      g.append("text").attr("class", "score").attr("y", rowH / 2).attr("dy", "0.35em");
      return g;
    });

    row.transition(t).attr("transform", d => `translate(0,${y(d.id)})`);
    row.select(".name").attr("font-weight", d => (selection.has(d.id) ? 600 : 400));
    row.select(".score").transition(t)
      .attr("x", d => x(d.score) + 8)
      .text(d => d3.format(".0%")(d.score));

    // Segments : un par critère, la clé est le critère (sa couleur ne change jamais)
    row.select(".bar")
      .attr("clip-path", d => `url(#clip-${d.id})`)
      .selectAll("rect.segment")
      .data(d => d.parts, s => s.key)
      .join(enter => enter.append("rect").attr("class", "segment")
        .attr("y", (rowH - barH) / 2).attr("height", barH)
        .attr("fill", s => s.color).attr("x", x(0)).attr("width", 0))
      .transition(t)
      .attr("x", s => x(s.start))
      .attr("width", s => Math.max(0, x(s.end) - x(s.start)));

    row.on("mousemove", (event, d) => showTooltip(event, d))
      .on("mouseleave", () => tooltip.attr("hidden", true))
      .on("click", (event, d) => {
        selection.has(d.id) ? selection.delete(d.id) : selection.add(d.id);
        document.dispatchEvent(new CustomEvent("selectionchange", { detail: [...selection] }));
        render();
      });
  }

  // Score d'un joueur = moyenne pondérée des critères disponibles.
  function score(p) {
    const n = norm.get(p.id);
    const avail = criteria.filter(c => n[c.key] != null && weights[c.key] > 0);
    const total = d3.sum(avail, c => weights[c.key]);
    let start = 0;
    const parts = criteria.map(c => {
      const contrib = total && n[c.key] != null ? (weights[c.key] * n[c.key]) / total : 0;
      const part = { key: c.key, color: c.color, start, end: start + contrib, contrib };
      start += contrib;
      return part;
    });
    return { score: start, parts };
  }

  function showTooltip(event, d) {
    const n = norm.get(d.id);
    const lines = criteria.map(c => {
      const v = d.values[c.key];
      const raw = v == null ? '<span class="muted">non disponible</span>' : formatValue(c.key, v);
      const pts = v == null || !weights[c.key] ? "" : d3.format(".0%")(d.parts.find(s => s.key === c.key).contrib);
      return `<tr><td><i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c.color}"></i> ${c.label}</td><td>${raw}</td><td class="muted">${pts}</td></tr>`;
    }).join("");
    tooltip.attr("hidden", null)
      .html(`<strong>${d.name}${d.ioc ? ` · ${d.ioc}` : ""} — ${d3.format(".0%")(d.score)}</strong><table>${lines}</table>`)
      .style("left", `${Math.min(event.clientX + 16, window.innerWidth - 300)}px`)
      .style("top", `${event.clientY + 16}px`);
  }

  // ---- Commandes ---------------------------------------------------------
  function buildSliders() {
    const s = d3.select("#sliders").selectAll("div").data(criteria).join("div").attr("class", "slider");
    s.append("span").attr("class", "swatch").style("background", c => c.color);
    const label = s.append("label");
    label.append("span").text(c => c.label);
    label.append("input").attr("type", "range").attr("min", 0).attr("max", 5).attr("step", 1)
      .attr("aria-label", c => `Poids : ${c.label}`)
      .property("value", c => weights[c.key])
      .on("input", function (event, c) {
        weights[c.key] = +this.value;
        d3.selectAll(".presets button").classed("is-active", false);
        syncSliders();
        render();
      });
    s.append("output");
    syncSliders();
  }

  function syncSliders() {
    d3.selectAll(".slider input").property("value", c => weights[c.key]);
    d3.selectAll(".slider output").text(c => `×${weights[c.key]}`);
  }

  function buildLegend() {
    d3.select("#legend").selectAll("span").data(criteria).join("span")
      .html(c => `<i style="background:${c.color}"></i>${c.label}`);
  }

  render();
})();

// ---- Utilitaires -----------------------------------------------------------
async function loadData() {
  try {
    return await d3.json("data/goat.json");
  } catch {
    document.getElementById("sample-banner").hidden = false;
    return d3.json("data/goat_sample.json");
  }
}

// Rang percentile avec gestion des ex æquo : 0 = plus petite valeur, 1 = plus grande.
function percentileRank(sorted, v) {
  if (sorted.length < 2) return 1;
  const lo = d3.bisectLeft(sorted, v), hi = d3.bisectRight(sorted, v) - 1;
  return ((lo + hi) / 2) / (sorted.length - 1);
}

function formatValue(key, v) {
  if (key === "versatility" || key === "h2h") return d3.format(".0%")(v);
  if (key === "longevity") return `${v} an${v > 1 ? "s" : ""}`;
  return d3.format(",.0f")(v).replace(/,/g, " ");
}
