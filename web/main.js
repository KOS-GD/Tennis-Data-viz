// Point d'entrée du site : onglets et onglet « Les données ».
// Chaque vue a son propre fichier dans js/ et une fonction d'initialisation appelée ici.

function createViz() {
  initTabs();
  initSummary();
  initServices();   // js/services.js
  initFiche();      // js/fiche.js
  initJoueur();     // js/joueur.js
}

// Onglets : un bouton par section, on affiche celle qui est choisie.
function initTabs() {
  d3.selectAll("#tabs button").on("click", function () {
    showTab(this.dataset.tab);
  });
  showTab("services");
}

function showTab(name) {
  d3.selectAll("#tabs button").classed("on", function () { return this.dataset.tab === name; });
  d3.selectAll(".tab").classed("on", function () { return this.id === name; });
}

// Onglet « Les données » : nombre de matchs de chaque source.
function initSummary() {
  Promise.all([
    d3.csv("data/atp_matches.csv"),
    d3.csv("data/charting_matches.csv"),
    d3.csv("data/slam_matches.csv"),
  ]).then(function (data) {
    const rows = [
      ["Matchs ATP (1991-2026)", data[0].length],
      ["Matchs notés coup par coup (Match Charting)", data[1].length],
      ["Matchs de Grand Chelem point par point (2011-2024)", data[2].length],
    ];
    d3.select("#summary").append("table")
      .selectAll("tr").data(rows).enter().append("tr")
      .selectAll("td").data(d => d).enter().append("td")
      .attr("class", (d, i) => (i === 1 ? "num" : null))
      .text(d => (typeof d === "number" ? d.toLocaleString("fr-FR") : d));
  });
}
