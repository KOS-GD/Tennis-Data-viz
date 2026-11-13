// Outils partagés par les vues : couleurs lues dans style.css, infobulle, boutons de surface.

const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const SURFACE_LABELS = { All: "Toutes", Hard: "Dur", Clay: "Terre", Grass: "Gazon" };
const SURFACE_FR = { All: "toutes surfaces", Hard: "dur", Clay: "terre", Grass: "gazon" };

// Joueurs mis en avant, rangés par époque. Chacun garde sa couleur partout (la couleur suit le joueur).
const FEATURED = [
  { name: "Stefan Edberg", color: "--p1" },
  { name: "Pete Sampras", color: "--p2" },
  { name: "Andre Agassi", color: "--p7" },
  { name: "Roger Federer", color: "--p3" },
  { name: "Rafael Nadal", color: "--p8", lefty: true },
  { name: "Novak Djokovic", color: "--p6" },
  { name: "Jannik Sinner", color: "--p5" },
  { name: "Carlos Alcaraz", color: "--p4" },
];
const playerColor = name => cssVar(FEATURED.find(p => p.name === name).color);

// Infobulle unique pour toute la page.
const tooltip = d3.select("body").append("div").attr("class", "tip");
function showTip(event, html) { tooltip.html(html).style("opacity", 1); moveTip(event); }
function moveTip(event) {
  const w = tooltip.node().offsetWidth;
  const x = event.clientX + 14 + w > innerWidth - 8 ? event.clientX - w - 14 : event.clientX + 14;
  tooltip.style("left", `${x}px`).style("top", `${event.clientY + 14}px`);
}
function hideTip() { tooltip.style("opacity", 0); }

// Boutons segmentés Toutes / Dur / Terre / Gazon. onChange reçoit "All", "Hard", "Clay" ou "Grass".
function surfaceButtons(selector, onChange) {
  const seg = d3.select(selector);
  seg.selectAll("button").data(Object.keys(SURFACE_LABELS)).join("button")
    .text(d => SURFACE_LABELS[d])
    .attr("aria-pressed", d => d === "All")
    .on("click", (event, d) => {
      seg.selectAll("button").attr("aria-pressed", b => b === d);
      onChange(d);
    });
}

// Petit tableau HTML (accessibilité : les valeurs exactes sans passer par la couleur).
function htmlTable(selector, header, rows) {
  const table = d3.select(selector).html("").append("table");
  table.append("tr").selectAll("th").data(header).join("th").text(d => d);
  table.selectAll("tr.r").data(rows).join("tr").attr("class", "r")
    .selectAll("td").data(d => d).join("td")
    .attr("class", (d, i) => (i > 0 ? "num" : null)).text(d => d);
}
