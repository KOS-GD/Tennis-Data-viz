// Vue « Où servent-ils ? » : petits multiples, un mini-court de service par joueur.
// Données : data/charting_serve_direction.csv (comptes bruts par joueur, surface et zone).

(function () {
  // Zones de gauche à droite vues du serveur : carré égalité (extérieur → T), puis carré avantage (T → extérieur).
  const ZONES = [
    { key: "deuce_wide", label: "Extérieur", side: "deuce" },
    { key: "deuce_middle", label: "Corps", side: "deuce" },
    { key: "deuce_t", label: "Centre (T)", side: "deuce" },
    { key: "ad_t", label: "Centre (T)", side: "ad" },
    { key: "ad_middle", label: "Corps", side: "ad" },
    { key: "ad_wide", label: "Extérieur", side: "ad" },
  ];
  const SIDE_FR = { deuce: "égalité", ad: "avantage" };
  const MIN_MATCHES = 20;   // en dessous : cases hachurées

  // Échelle séquentielle à une seule teinte (bleu), domaine commun à tous les mini-courts.
  const ramp = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
                "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
  const color = d3.scaleSequential(d3.interpolateRgbBasis(ramp)).domain([0, 0.7]).clamp(true);

  const sideTotal = (r, side) => d3.sum(ZONES.filter(z => z.side === side), z => r[z.key]);
  const share = (r, z) => r[z.key] / sideTotal(r, z.side);

  let data = [], surface = "All";

  function legend() {
    const w = 220, h = 10;
    const box = d3.select("#serve-legend");
    box.append("span").text("Part des services du carré");
    const svg = box.append("svg").attr("width", w + 40).attr("height", 32);
    const grad = svg.append("defs").append("linearGradient").attr("id", "serve-grad");
    d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t).attr("stop-color", color(t * 0.7)));
    svg.append("rect").attr("x", 8).attr("y", 4).attr("width", w).attr("height", h).attr("rx", 2).attr("fill", "url(#serve-grad)");
    const x = d3.scaleLinear().domain([0, 0.7]).range([8, 8 + w]);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${4 + h})`)
      .call(d3.axisBottom(x).ticks(7).tickSize(4).tickFormat(d => `${Math.round(d * 100)}${d === 0.7 ? " %+" : ""}`))
      .select(".domain").remove();
  }

  function draw() {
    const grid = d3.select("#serve-grid").html("");
    const W = 240, H = 200, m = { l: 14, r: 14, t: 10, b: 22 };
    const cw = W - m.l - m.r, ch = H - m.t - m.b;
    const svcDepth = ch * 6.40 / 11.89;          // carré de service : 6,40 m sur 11,89 m de demi-court
    const yService = ch - svcDepth, lane = cw / 6;

    FEATURED.forEach(p => {
      const r = data.find(d => d.player === p.name && d.surface === surface);
      const n = r ? r.matches : 0;
      const cell = grid.append("div");
      cell.append("h3").text(p.name + (p.lefty ? " (G)" : ""));
      cell.append("p").attr("class", "sub")
        .text(r ? `${n} matchs · ${d3.sum(ZONES, z => r[z.key]).toLocaleString("fr-FR")} services` : "aucun match noté");

      const svg = cell.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img")
        .attr("aria-label", `Direction du service de ${p.name}, ${SURFACE_FR[surface]}`);
      const hatchId = `hatch-${p.name.replace(/\W/g, "")}`;
      svg.append("defs").append("pattern").attr("id", hatchId).attr("width", 6).attr("height", 6)
        .attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)")
        .append("line").attr("y2", 6).attr("stroke", cssVar("--bg")).attr("stroke-width", 2).attr("stroke-opacity", 0.7);
      const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
      const line = (x1, y1, x2, y2, w = 1) => g.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2)
        .attr("stroke", cssVar("--court-line")).attr("stroke-width", w);

      g.append("rect").attr("width", cw).attr("height", ch).attr("fill", cssVar("--court")).attr("stroke", cssVar("--court-line"));
      g.append("text").attr("x", cw / 2).attr("y", yService - 8).attr("text-anchor", "middle")
        .attr("font-size", 10).attr("fill", cssVar("--muted")).text("fond de court adverse ↑");

      ZONES.forEach((z, i) => {
        const v = r ? share(r, z) : null;
        g.append("rect").attr("x", i * lane + 1).attr("y", yService + 1).attr("width", lane - 2).attr("height", svcDepth - 2)
          .attr("rx", 2).attr("fill", v == null ? cssVar("--surface-2") : color(v));
        if (v != null) {
          g.append("text").attr("class", "val").attr("x", i * lane + lane / 2).attr("y", yService + svcDepth / 2 + 4)
            .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600)
            .attr("fill", v > 0.38 ? "#ffffff" : "#0b0b0b").text(Math.round(v * 100));
        }
        // zone de survol par-dessus la case
        g.append("rect").attr("x", i * lane).attr("y", yService).attr("width", lane).attr("height", svcDepth)
          .attr("fill", "transparent")
          .on("mouseenter", event => {
            if (v == null) return;
            showTip(event, `<b>${p.name}</b> · ${SURFACE_FR[surface]}<br>Côté ${SIDE_FR[z.side]}, zone <b>${z.label}</b><br>` +
              `${Math.round(v * 100)} % des services de ce carré<br>` +
              `<span class="m">${r[z.key]} services sur ${sideTotal(r, z.side)} · ${n} matchs</span>`);
          })
          .on("mousemove", moveTip).on("mouseleave", hideTip);
      });
      if (r && n < MIN_MATCHES) {
        g.append("rect").attr("y", yService).attr("width", cw).attr("height", svcDepth)
          .attr("fill", `url(#${hatchId})`).attr("pointer-events", "none");
        g.selectAll("text.val").raise();
      }
      line(0, yService, cw, yService);
      line(cw / 2, yService, cw / 2, ch, 1.5);
      line(-6, ch, cw + 6, ch, 2.5);   // filet
      g.append("text").attr("x", cw / 2).attr("y", ch + 15).attr("text-anchor", "middle").attr("font-size", 10)
        .attr("fill", cssVar("--muted")).text("filet · côté égalité ← | → côté avantage");
    });

    htmlTable("#serve-table",
      ["Joueur", "Matchs", ...ZONES.map(z => `${z.side === "deuce" ? "Égal." : "Avant."} ${z.label}`)],
      FEATURED.map(p => {
        const r = data.find(d => d.player === p.name && d.surface === surface);
        return [p.name, r ? r.matches : 0, ...ZONES.map(z => (r ? `${Math.round(share(r, z) * 100)} %` : "–"))];
      }));
  }

  d3.csv("data/charting_serve_direction.csv", d3.autoType).then(rows => {
    data = rows;
    legend();
    surfaceButtons("#serve-surface", s => { surface = s; draw(); });
    draw();
  });
})();
