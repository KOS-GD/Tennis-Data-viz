// Chargement des données produites par prepare_data.py.
// Pour l'instant, la page affiche seulement un résumé : les vues viendront ici.

Promise.all([
  d3.csv("data/atp_matches.csv", d3.autoType),
  d3.csv("data/charting_players.csv", d3.autoType),
]).then(([matches, players]) => {
  const fmt = d3.format(",");
  const years = d3.extent(matches, d => d.date.getFullYear());
  const rows = [
    ["Matchs ATP avec statistiques", fmt(matches.length), `${years[0]} – ${years[1]}`],
    ...d3.rollups(matches, v => v.length, d => d.surface ?? "inconnue")
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => [`  dont ${s}`, fmt(n), ""]),
    ["Joueurs suivis (Match Charting)", fmt(new Set(players.map(d => d.player)).size), "au moins 10 matchs notés"],
  ];

  const table = d3.select("#summary-content").html("").append("table");
  table.selectAll("tr").data(rows).join("tr")
    .selectAll("td").data(d => d).join("td")
    .attr("class", (d, i) => (i === 1 ? "num" : null))
    .text(d => d);
});
