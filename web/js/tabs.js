// Onglets : un onglet par <section class="view"> de index.html.
// Pour ajouter une vue : une section <section class="view" id="view-xxx" data-title="…" data-init="initXxx">,
// sa feuille css/xxx.css et son script js/xxx.js qui définit initXxx(). La fonction n'est appelée
// qu'à la première ouverture de l'onglet (les données ne sont chargées que si l'on regarde la vue).
// L'onglet ouvert est gardé dans l'adresse (#services, ...), pour pouvoir partager un lien.

function initTabs() {
  const views = d3.selectAll("section.view");
  const started = new Set();
  const nav = d3.select("#tabs");

  function open(id) {
    views.attr("hidden", function () { return this.id === id ? null : true; });
    nav.selectAll("button").classed("on", function () { return this.dataset.target === id; });
    if (!started.has(id)) {
      started.add(id);
      const init = document.getElementById(id).dataset.init;
      if (init && typeof window[init] === "function") window[init]();
    }
    history.replaceState(null, "", `#${id.replace(/^view-/, "")}`);
  }

  views.each(function () {
    nav.append("button").attr("data-target", this.id).text(this.dataset.title)
      .on("click", () => open(this.id));
  });
  const fromHash = () => `view-${location.hash.slice(1)}`;
  open(document.getElementById(fromHash()) ? fromHash() : views.node().id);
  window.addEventListener("hashchange", () => {
    if (document.getElementById(fromHash())) open(fromHash());
  });
}

window.addEventListener("DOMContentLoaded", initTabs);
