// Chargement des données produites par prepare_data.py.
// Pour l'instant, la page affiche seulement un résumé : les vues viendront ici.

// Lit un fichier .csv.gz (fichiers point par point) : le navigateur le décompresse lui-même.
async function csvGz(url) {
  const res = await fetch(url);
  const text = await new Response(res.body.pipeThrough(new DecompressionStream("gzip"))).text();
  return d3.csvParse(text, d3.autoType);
}

Promise.all([
  d3.csv("data/atp_matches.csv", d3.autoType),
  d3.csv("data/charting_matches.csv", d3.autoType),
  d3.csv("data/slam_matches.csv", d3.autoType),
]).then(([atp, charting, slam]) => {
  const fmt = d3.format(",");
  const span = (rows, year) => d3.extent(rows, year).join(" – ");
  const bySurface = rows => d3.rollups(rows, v => v.length, d => d.surface)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => [`  dont ${s}`, fmt(n), ""]);
  const rows = [
    ["Matchs ATP (archive Sackmann)", fmt(atp.length), span(atp, d => d.date.getFullYear())],
    ...bySurface(atp),
    ["Matchs notés (Match Charting)", fmt(charting.length), span(charting, d => d.date.getFullYear())],
    ...bySurface(charting),
    ["Matchs de Grand Chelem point par point", fmt(slam.length), span(slam, d => d.year)],
    ...bySurface(slam),
  ];

  const table = d3.select("#summary-content").html("").append("table");
  table.selectAll("tr").data(rows).join("tr")
    .selectAll("td").data(d => d).join("td")
    .attr("class", (d, i) => (i === 1 ? "num" : null))
    .text(d => d);
});
