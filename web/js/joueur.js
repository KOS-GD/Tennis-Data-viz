// Tout le code de la vue est dans une fonction anonyme : ses variables (ctx, state...) ne gênent pas
// les scripts des autres onglets. Seule initJoueur() est exposée, appelée par createViz() (main.js).
(() => {
  // Fiche d'un joueur : identité, chiffres de carrière, adversaires marquants et profil sur sept critères
  // (radar ou barres alignées, mêmes axes et même groupe de référence que l'onglet « Comparer »).
  // Données : web/data/atp_matches.csv (produit par prepare_data.py), regroupé ici par joueur.
  //
  // Choix (détaillés dans report/notes.md) :
  // - Un seul joueur, comparé au joueur médian du groupe (au moins ctx.MIN_MATCHES matchs depuis 1991).
  // - Titres = finales gagnées (hors Coupe Davis) ; les finales gagnées par abandon ou forfait ne sont
  //   pas dans les données, le total peut donc être un peu sous-estimé.
  // - Adversaire le plus affronté, bête noire (le plus de défaites) et victime préférée (le plus de
  //   victoires) : comptes absolus, pas de taux.
  // - Surface préférée : meilleur taux de victoires, et on dit si l'écart avec la deuxième est net
  //   (intervalles de Wilson à 95 % disjoints, séance 4).

  const ctx = {
    MIN_MATCHES: 200,
    DEFAULT_NAME: "Roger Federer",

    AXES: [
      { key: "hard",   label: "Dur",              title: "Victoires sur dur",          unit: "matchs",          minN: 20,  minYear: 5 },
      { key: "clay",   label: "Terre",            title: "Victoires sur terre battue", unit: "matchs",          minN: 20,  minYear: 5 },
      { key: "grass",  label: "Gazon",            title: "Victoires sur gazon",        unit: "matchs",          minN: 20,  minYear: 5 },
      { key: "serve",  label: "Service",          title: "Points gagnés au service",   unit: "points",          minN: 500, minYear: 200 },
      { key: "return", label: "Retour",           title: "Points gagnés au retour",    unit: "points",          minN: 500, minYear: 200 },
      { key: "bp",     label: "Balles de break",  title: "Balles de break sauvées",    unit: "balles de break", minN: 50,  minYear: 10 },
      { key: "top10",  label: "Contre le top 10", title: "Victoires contre un top 10", unit: "matchs",          minN: 20,  minYear: 3 },
    ],
    SURFACE_KEY: { Hard: "hard", Clay: "clay", Grass: "grass" },
    SURFACE_NAME: { hard: "Dur", clay: "Terre battue", grass: "Gazon" },
    SURFACE_LOWER: { hard: "le dur", clay: "la terre battue", grass: "le gazon" },
    HAND: { R: "droitier", L: "gaucher" },
    MODES: [["radar", "Radar"], ["dots", "Barres alignées"]],

    COLOR: "#2a78d6",   // même couleur que le premier joueur de l'onglet « Comparer »

    // Géométrie (coordonnées du viewBox ; le SVG s'adapte à la largeur)
    W: 640, H: 500,
    RADAR: { cx: 320, cy: 255, R: 165, r0: 22 },
    DOTS: { x0: 200, x1: 610, y0: 62, dy: 63 },

    // Transitions (séance 5) : changement de joueur, puis bascule de mode en trois étapes
    T_CHANGE: 500, T_FADE: 250, T_MOVE: 650, T_STAGGER: 45,
  };

  const state = { mode: "radar", id: null };

  const fr = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] });
  const fmtInt = fr.format(",d");
  const pct = v => `${fr.format(".1f")(v * 100)}\u00a0%`;   // espace insécable : « % » ne passe pas seul à la ligne
  const rankText = r => (r === 1 ? "1er" : `${r}e`);

  function initJoueur() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ctx.T_CHANGE = 0; ctx.T_FADE = 0; ctx.T_MOVE = 0; ctx.T_STAGGER = 0;
    }
    // Saison = 4 premiers caractères de tourney_id, lue avant d3.autoType (voir fiche.js).
    const parseRow = row => {
      const season = +row.tourney_id.slice(0, 4);
      return Object.assign(d3.autoType(row), { season });
    };
    d3.csv("data/atp_matches.csv", parseRow).then(rows => {
      prepareData(rows);
      initControls();
      drawGrids();
      const p = ctx.byName.get(ctx.DEFAULT_NAME) || ctx.pool[0];
      showPlayer(p.id);
    });
  }

  // ---------------------------------------------------------------------------
  // Données
  // ---------------------------------------------------------------------------

  function wilson(k, n) {
    if (!n) return null;
    const z = 1.96, p = k / n, d = 1 + z * z / n;
    const c = (p + z * z / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, c - m), Math.min(1, c + m)];
  }

  // Une passe sur les matchs (triés par date) : tout ce que la fiche affiche, par joueur.
  function prepareData(rows) {
    const players = new Map();
    const get = (id, name) => {
      let p = players.get(id);
      if (!p) {
        p = { id, name, matches: 0, wins: 0, first: Infinity, last: -Infinity, stats: {}, years: {},
              opponents: new Map(), titles: { all: 0, slam: 0, masters: 0 }, bestRank: null,
              age: null, ht: null, hand: null, ioc: null };
        for (const a of ctx.AXES) { p.stats[a.key] = { k: 0, n: 0 }; p.years[a.key] = new Map(); }
        players.set(id, p);
      }
      return p;
    };
    const add = (p, key, year, k, n) => {
      const s = p.stats[key]; s.k += k; s.n += n;
      let y = p.years[key].get(year);
      if (!y) p.years[key].set(year, (y = { k: 0, n: 0 }));
      y.k += k; y.n += n;
    };

    for (const r of rows) {
      const year = r.season;
      for (const [me, op, won] of [["w", "l", 1], ["l", "w", 0]]) {
        const p = get(r[`${me}_id`], r[`${me}_name`]);
        p.matches += 1;
        p.wins += won;
        p.first = Math.min(p.first, year);
        p.last = Math.max(p.last, year);

        // Identité : dernière valeur connue (les matchs sont dans l'ordre chronologique).
        if (r[`${me}_age`] != null) p.age = r[`${me}_age`];
        if (r[`${me}_ht`] != null) p.ht = r[`${me}_ht`];
        if (r[`${me}_hand`]) p.hand = r[`${me}_hand`];
        if (r[`${me}_ioc`]) p.ioc = r[`${me}_ioc`];

        const rank = r[`${me}_rank`];
        if (rank != null && (p.bestRank == null || rank < p.bestRank)) p.bestRank = rank;

        // Bilan contre chaque adversaire.
        const oid = r[`${op}_id`];
        let o = p.opponents.get(oid);
        if (!o) p.opponents.set(oid, (o = { id: oid, name: r[`${op}_name`], w: 0, l: 0 }));
        if (won) o.w += 1; else o.l += 1;

        // Titres : finales gagnées, hors Coupe Davis (rencontres par équipes).
        if (won && r.round === "F" && r.level !== "Coupe Davis") {
          p.titles.all += 1;
          if (r.level === "Grand Chelem") p.titles.slam += 1;
          if (r.level === "Masters 1000") p.titles.masters += 1;
        }

        if (ctx.SURFACE_KEY[r.surface]) add(p, ctx.SURFACE_KEY[r.surface], year, won, 1);

        const oppRank = r[`${op}_rank`];
        if (oppRank != null && oppRank <= 10) add(p, "top10", year, won, 1);

        const svpt = r[`${me}_svpt`], w1 = r[`${me}_1st_won`], w2 = r[`${me}_2nd_won`];
        if (svpt > 0 && w1 != null && w2 != null) add(p, "serve", year, w1 + w2, svpt);

        const osv = r[`${op}_svpt`], o1 = r[`${op}_1st_won`], o2 = r[`${op}_2nd_won`];
        if (osv > 0 && o1 != null && o2 != null) add(p, "return", year, osv - o1 - o2, osv);

        const faced = r[`${me}_bp_faced`], saved = r[`${me}_bp_saved`];
        if (faced > 0 && saved != null) add(p, "bp", year, saved, faced);
      }
    }

    for (const p of players.values()) {
      p.val = {};
      for (const a of ctx.AXES) {
        const { k, n } = p.stats[a.key];
        p.val[a.key] = n > 0 ? { v: k / n, k, n, ci: wilson(k, n), low: n < a.minN } : null;
      }
    }

    ctx.players = players;
    ctx.pool = [...players.values()].filter(p => p.matches >= ctx.MIN_MATCHES);
    ctx.byName = new Map(ctx.pool.map(p => [p.name, p]));

    ctx.dom = {};
    for (const a of ctx.AXES) {
      const vals = ctx.pool.map(p => p.val[a.key]).filter(d => d && !d.low).map(d => d.v);
      ctx.dom[a.key] = { min: d3.min(vals), max: d3.max(vals), median: d3.median(vals) };
    }
  }

  // Adversaires marquants, en comptes absolus. Égalités : on garde le bilan le plus marqué.
  function rivals(p) {
    const opp = [...p.opponents.values()];
    const pick = (score, tie) => opp.slice().sort((a, b) => d3.descending(score(a), score(b)) || tie(a, b))[0];
    return [
      { key: "most",   label: "Le plus affronté",  o: pick(o => o.w + o.l, (a, b) => d3.descending(a.w, b.w)) },
      { key: "nemesis", label: "Bête noire",       o: pick(o => o.l, (a, b) => d3.ascending(a.w, b.w)),
        why: "le plus de défaites contre lui" },
      { key: "victim", label: "Victime préférée",  o: pick(o => o.w, (a, b) => d3.ascending(a.l, b.l)),
        why: "le plus de victoires contre lui" },
    ];
  }

  // Surface préférée : la meilleure, et un écart jugé net si les intervalles à 95 % ne se touchent pas.
  function favouriteSurface(p) {
    const c = ["hard", "clay", "grass"].map(k => ({ k, o: p.val[k] })).filter(d => d.o && !d.o.low)
      .sort((a, b) => d3.descending(a.o.v, b.o.v));
    if (!c.length) return null;
    const [best, second] = c;
    return { best, second, clear: !second || best.o.ci[0] > second.o.ci[1] };
  }

  function norm(key, v) {
    const { min, max } = ctx.dom[key];
    return Math.max(0, Math.min(1, (v - min) / (max - min)));
  }

  // ---------------------------------------------------------------------------
  // Géométrie des deux modes
  // ---------------------------------------------------------------------------

  const angle = i => (i * 2 * Math.PI) / ctx.AXES.length;
  const radius = t => ctx.RADAR.r0 + t * (ctx.RADAR.R - ctx.RADAR.r0);
  const radarXY = (i, t) => [
    ctx.RADAR.cx + radius(t) * Math.sin(angle(i)),
    ctx.RADAR.cy - radius(t) * Math.cos(angle(i)),
  ];
  const xDots = d3.scaleLinear().domain([0, 1]).range([ctx.DOTS.x0, ctx.DOTS.x1]);
  const rowY = i => ctx.DOTS.y0 + i * ctx.DOTS.dy;

  function markXY(d, mode) {
    const t = norm(d.axis.key, d.o.v);
    return mode === "radar" ? radarXY(d.i, t) : [xDots(t), rowY(d.i)];
  }

  // ---------------------------------------------------------------------------
  // Contrôles : recherche du joueur, bascule de mode
  // ---------------------------------------------------------------------------

  function initControls() {
    d3.select("#jo-pool").text(`${fmtInt(ctx.pool.length)} joueurs avec au moins ${ctx.MIN_MATCHES} matchs ATP depuis 1991`);

    d3.select("#jo-list").selectAll("option")
      .data(ctx.pool.slice().sort((a, b) => d3.ascending(a.name, b.name)))
      .join("option")
      .attr("value", d => d.name);

    const input = d3.select("#jo-input");
    const tryShow = () => {
      const p = ctx.byName.get(input.property("value").trim());
      if (p) { showPlayer(p.id); input.property("value", ""); input.node().blur(); }
      else if (input.property("value").trim()) d3.select("#jo-message").text("Joueur introuvable dans la liste.");
    };
    input.on("change", tryShow)
      .on("keydown", e => { if (e.key === "Enter") tryShow(); })
      .on("input", () => d3.select("#jo-message").text(""));

    d3.select("#jo-mode").selectAll("button").data(ctx.MODES).join("button")
      .text(d => d[1])
      .classed("on", d => d[0] === state.mode)
      .on("click", (e, d) => setMode(d[0]));
  }

  function showPlayer(id) {
    state.id = id;
    d3.select("#jo-message").text("");
    hideTooltip();
    const p = ctx.players.get(id);
    drawIdentity(p);
    drawStats(p);
    drawRivals(p);
    drawChart(p);
  }

  // ---------------------------------------------------------------------------
  // Colonne de gauche : identité, chiffres de carrière, adversaires
  // ---------------------------------------------------------------------------

  function drawIdentity(p) {
    // Emplacement de la photo (à remplir plus tard) : les initiales en attendant.
    d3.select("#jo-photo").text(p.name.split(" ").map(w => w[0]).join("").slice(0, 3))
      .attr("aria-label", `Photo de ${p.name} (à venir)`);
    d3.select("#jo-name").text(p.name);
    const facts = [
      p.ioc,
      ctx.HAND[p.hand],
      p.ht ? `${p.ht} cm` : null,
    ].filter(Boolean).join(" · ");
    d3.select("#jo-facts").text(facts);
    d3.select("#jo-career").text(
      `${p.first}–${p.last}${p.age ? ` · ${Math.floor(p.age)} ans au dernier match` : ""}`);
  }

  function drawStats(p) {
    const ci = wilson(p.wins, p.matches);
    const fav = favouriteSurface(p);
    let favSub = "pas assez de matchs";
    if (fav && fav.second) {
      favSub = `${pct(fav.best.o.v)} de victoires, `
        + (fav.clear ? `nettement devant ${ctx.SURFACE_LOWER[fav.second.k]} (${pct(fav.second.o.v)})`
                     : `pas nettement devant ${ctx.SURFACE_LOWER[fav.second.k]} (${pct(fav.second.o.v)}) : intervalles à 95 % qui se chevauchent`);
    } else if (fav) favSub = `${pct(fav.best.o.v)} de victoires`;

    const stats = [
      { label: "Matchs", value: fmtInt(p.matches), sub: `${fmtInt(p.wins)} victoires, ${fmtInt(p.matches - p.wins)} défaites` },
      { label: "Victoires", value: pct(p.wins / p.matches), sub: `IC 95 % : ${pct(ci[0])} – ${pct(ci[1])}` },
      { label: "Titres", value: fmtInt(p.titles.all), sub: `dont ${fmtInt(p.titles.slam)} en Grand Chelem et ${fmtInt(p.titles.masters)} en Masters 1000` },
      { label: "Meilleur classement", value: p.bestRank ? rankText(p.bestRank) : "n.d.", sub: "au moment d'un match" },
      { label: "Surface préférée", value: fav ? ctx.SURFACE_NAME[fav.best.k] : "n.d.", sub: favSub, wide: true },
    ];

    d3.select("#jo-stats").selectAll("div.stat").data(stats).join(enter => {
        const g = enter.append("div").attr("class", "stat");
        g.append("div").attr("class", "label");
        g.append("div").attr("class", "value");
        g.append("div").attr("class", "sub");
        return g;
      })
      .classed("wide", d => d.wide)
      .call(g => g.select(".label").text(d => d.label))
      .call(g => g.select(".value").text(d => d.value))
      .call(g => g.select(".sub").text(d => d.sub));
  }

  function drawRivals(p) {
    const rows = d3.select("#jo-rivals").selectAll("div.rival").data(rivals(p)).join(enter => {
        const g = enter.append("div").attr("class", "rival");
        g.append("div").attr("class", "label");
        g.append("button").attr("type", "button").attr("class", "name");
        g.append("div").attr("class", "record");
        return g;
      });
    rows.select(".label").text(d => d.label).attr("title", d => d.why || null);
    // Un clic sur un adversaire ouvre sa fiche, s'il fait partie du groupe de référence.
    rows.select(".name").text(d => d.o.name)
      .property("disabled", d => !ctx.byName.has(d.o.name))
      .attr("title", d => ctx.byName.has(d.o.name) ? `Voir la fiche de ${d.o.name}` : "Moins de 200 matchs : pas de fiche")
      .on("click", (e, d) => showPlayer(d.o.id));
    rows.select(".record").text(d =>
      `${fmtInt(d.o.w)} V – ${fmtInt(d.o.l)} D en ${fmtInt(d.o.w + d.o.l)} match${d.o.w + d.o.l > 1 ? "s" : ""}`);
  }

  // ---------------------------------------------------------------------------
  // Graphique : grilles (une fois), puis le joueur
  // ---------------------------------------------------------------------------

  function drawGrids() {
    const svg = d3.select("#jo-chart").html("").append("svg")
      .attr("viewBox", `0 0 ${ctx.W} ${ctx.H}`)
      .attr("role", "img")
      .attr("aria-label", "Profil du joueur sur sept critères");

    const dots = state.mode === "dots";
    ctx.gRadar = svg.append("g").attr("opacity", dots ? 0 : 1).attr("pointer-events", dots ? "none" : null);
    ctx.gDots = svg.append("g").attr("opacity", dots ? 1 : 0).attr("pointer-events", dots ? null : "none");
    ctx.gPoly = svg.append("g").attr("opacity", dots ? 0 : 1);
    ctx.gCIs = svg.append("g").attr("opacity", dots ? 1 : 0).attr("pointer-events", "none");
    ctx.gMarks = svg.append("g");

    const ring = t => ctx.AXES.map((_, i) => radarXY(i, t));
    ctx.gRadar.selectAll("polygon.ring").data([0, 0.5, 1]).join("polygon")
      .attr("class", "ring")
      .attr("points", t => ring(t).join(" "));
    ctx.gRadar.selectAll("line.spoke").data(ctx.AXES).join("line")
      .attr("class", "spoke")
      .attr("x1", (_, i) => radarXY(i, 0)[0]).attr("y1", (_, i) => radarXY(i, 0)[1])
      .attr("x2", (_, i) => radarXY(i, 1)[0]).attr("y2", (_, i) => radarXY(i, 1)[1]);
    ctx.gRadar.append("polygon")
      .attr("class", "median")
      .attr("points", ctx.AXES.map((a, i) => radarXY(i, norm(a.key, ctx.dom[a.key].median))).join(" "));

    const labels = ctx.gRadar.selectAll("g.axis-label").data(ctx.AXES).join("g")
      .attr("class", "axis-label")
      .attr("transform", (_, i) => {
        const [x, y] = radarXY(i, 1);
        return `translate(${x + Math.sin(angle(i)) * 18},${y - Math.cos(angle(i)) * 18})`;
      })
      .attr("text-anchor", (_, i) => {
        const s = Math.sin(angle(i));
        return Math.abs(s) < 0.2 ? "middle" : s > 0 ? "start" : "end";
      });
    const below = i => Math.cos(angle(i)) < -0.5;
    labels.append("text").attr("class", "label").attr("dy", (_, i) => below(i) ? "0.8em" : "-0.2em")
      .text(a => a.label);
    labels.append("text").attr("class", "range").attr("dy", (_, i) => below(i) ? "2em" : "1em")
      .text(a => `${pct(ctx.dom[a.key].min)} – ${pct(ctx.dom[a.key].max)}`);
    axisHover(labels);

    const rows = ctx.gDots.selectAll("g.row").data(ctx.AXES).join("g")
      .attr("class", "row")
      .attr("transform", (_, i) => `translate(0,${rowY(i)})`);
    rows.append("line").attr("class", "track").attr("x1", ctx.DOTS.x0).attr("x2", ctx.DOTS.x1);
    rows.append("text").attr("class", "label").attr("x", ctx.DOTS.x0 - 14).attr("dy", "0.32em")
      .attr("text-anchor", "end").text(a => a.title);
    rows.selectAll("g.tick")
      .data(a => [
        { t: 0, v: ctx.dom[a.key].min, median: false },
        { t: norm(a.key, ctx.dom[a.key].median), v: ctx.dom[a.key].median, median: true },
        { t: 1, v: ctx.dom[a.key].max, median: false },
      ])
      .join("g")
      .attr("class", "tick")
      .classed("median-tick", d => d.median)
      .attr("transform", d => `translate(${xDots(d.t)},0)`)
      .call(g => g.append("line").attr("y1", -7).attr("y2", 7))
      .call(g => g.append("text").attr("y", 26).attr("text-anchor", "middle").text(d => pct(d.v)));
    axisHover(rows.append("rect").attr("class", "hit")
      .attr("x", 0).attr("width", ctx.DOTS.x0 - 6).attr("y", -14).attr("height", 28));
  }

  // Polygone : rempli si tous les axes existent, sinon contour interrompu.
  function polyPath(p) {
    const pts = ctx.AXES.map((a, i) => (p.val[a.key] ? radarXY(i, norm(a.key, p.val[a.key].v)) : null));
    if (pts.every(Boolean)) return `M${pts.join("L")}Z`;
    return pts.map((pt, i) => {
      const next = pts[(i + 1) % pts.length];
      return pt && next ? `M${pt}L${next}` : "";
    }).join("");
  }

  function drawChart(p) {
    // Au changement de joueur, les marques glissent vers leurs nouvelles valeurs (séance 5).
    const complete = ctx.AXES.every(a => p.val[a.key]);
    ctx.gPoly.selectAll("path").data([p]).join("path")
      .attr("class", "poly")
      .attr("fill", ctx.COLOR).attr("stroke", ctx.COLOR)
      .classed("partial", !complete)
      .transition("change").duration(ctx.T_CHANGE)
      .attr("d", polyPath);

    // Un marqueur par axe disponible, clé = axe : le même élément d'un joueur à l'autre.
    const marks = ctx.AXES.map((axis, i) => ({ axis, i, o: p.val[axis.key], p }))
      .filter(d => d.o);

    ctx.gCIs.selectAll("g.ci").data(marks, d => d.axis.key).join(enter => {
        const g = enter.append("g").attr("class", "ci").attr("stroke", ctx.COLOR);
        g.append("line").attr("class", "ci-line");
        g.append("line").attr("class", "cap lo").attr("y1", -4).attr("y2", 4);
        g.append("line").attr("class", "cap hi").attr("y1", -4).attr("y2", 4);
        return g;
      })
      .attr("transform", d => `translate(0,${rowY(d.i)})`)
      .each(function (d) {
        const [lo, hi] = d.o.ci.map(v => xDots(norm(d.axis.key, v)));
        const g = d3.select(this).transition("change").duration(ctx.T_CHANGE);
        g.select(".ci-line").attr("x1", lo).attr("x2", hi);
        g.select(".lo").attr("x1", lo).attr("x2", lo);
        g.select(".hi").attr("x1", hi).attr("x2", hi);
      });

    ctx.gMarks.selectAll("g.mark").data(marks, d => d.axis.key).join(enter => {
        const g = enter.append("g").attr("class", "mark")
          .attr("transform", d => `translate(${markXY(d, state.mode)})`);
        g.append("circle").attr("class", "hit").attr("r", 12);
        g.append("path").attr("class", "symbol").attr("d", d3.symbol(d3.symbolCircle, 70)());
        return g;
      })
      .classed("low", d => d.o.low)
      .on("pointerenter", showMarkTooltip)
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .call(g => g.select("path.symbol")
        .attr("stroke", ctx.COLOR)
        .attr("fill", d => d.o.low ? "var(--panel)" : ctx.COLOR))
      .transition("change").duration(ctx.T_CHANGE)
      .attr("transform", d => `translate(${markXY(d, state.mode)})`);
  }

  // ---------------------------------------------------------------------------
  // Bascule radar ↔ barres alignées, en trois étapes (comme dans l'onglet « Comparer »)
  // ---------------------------------------------------------------------------

  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    d3.select("#jo-mode").selectAll("button").classed("on", d => d[0] === mode);
    d3.select("#jo-key-ci").attr("hidden", mode === "dots" ? null : true);
    hideTooltip();

    const toDots = mode === "dots";
    const out = toDots ? [ctx.gRadar, ctx.gPoly] : [ctx.gDots, ctx.gCIs];
    const into = toDots ? [ctx.gDots, ctx.gCIs] : [ctx.gRadar, ctx.gPoly];
    const moveEnd = ctx.T_FADE + ctx.T_MOVE + ctx.T_STAGGER * ctx.AXES.length;

    out.forEach(g => g.attr("pointer-events", "none")
      .transition("mode").duration(ctx.T_FADE).attr("opacity", 0));
    ctx.gMarks.selectAll("g.mark")
      .transition("change").delay(d => ctx.T_FADE + d.i * ctx.T_STAGGER).duration(ctx.T_MOVE).ease(d3.easeCubicInOut)
      .attr("transform", d => `translate(${markXY(d, mode)})`);
    into.forEach(g => g.attr("pointer-events", g === ctx.gCIs ? "none" : null)
      .transition("mode").delay(moveEnd).duration(ctx.T_FADE).attr("opacity", 1));
  }

  // ---------------------------------------------------------------------------
  // Infobulles
  // ---------------------------------------------------------------------------

  function showMarkTooltip(e, d) {
    const a = d.axis, o = d.o, med = ctx.dom[a.key].median;
    d3.select("#jo-tooltip").attr("hidden", null).html(`<b>${d.p.name}</b><br>${a.title}
      <div class="big">${pct(o.v)}</div>
      IC 95 % : ${pct(o.ci[0])} – ${pct(o.ci[1])}<br>
      <span class="faint">${fmtInt(o.k)} sur ${fmtInt(o.n)} ${a.unit}${o.low ? " · peu de données" : ""}<br>
      médiane du groupe : ${pct(med)}</span>`);
    moveTooltip(e);
  }

  function axisHover(sel) {
    sel.on("pointerenter", (e, a) => {
        if (state.id == null) return;
        d3.select("#jo-tooltip").attr("hidden", null)
          .html(`<b>${a.title}</b><br><span class="faint">Saison par saison (au moins ${a.minYear} ${a.unit})</span>`)
          .node().appendChild(sparkline(a));
        moveTooltip(e);
      })
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip);
  }

  function sparkline(a) {
    const w = 260, h = 110, m = { t: 8, r: 10, b: 20, l: 44 };
    const p = ctx.players.get(state.id);
    const pts = d3.range(p.first, p.last + 1).map(y => {
      const o = p.years[a.key].get(y);
      return { y, v: o && o.n >= a.minYear ? o.k / o.n : null };
    });
    const svg = d3.create("svg").attr("width", w).attr("height", h).attr("class", "spark");
    const known = pts.filter(d => d.v != null);
    if (!known.length) {
      svg.attr("height", 24).append("text").attr("y", 16).text("Pas assez de données par saison");
      return svg.node();
    }
    const x = d3.scaleLinear().domain(d3.extent(pts, d => d.y)).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain(d3.extent(known, d => d.v)).nice().range([h - m.b, m.t]);
    const line = d3.line().defined(d => d.v != null).x(d => x(d.y)).y(d => y(d.v));

    svg.append("g").attr("transform", `translate(0,${h - m.b})`)
      .call(d3.axisBottom(x).tickValues(x.domain()).tickFormat(d3.format("d")).tickSize(3));
    svg.append("g").attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).tickValues(y.domain()).tickFormat(v => `${fr.format(".0f")(v * 100)} %`).tickSize(3));
    svg.append("path").attr("class", "spark-line").attr("stroke", ctx.COLOR).attr("d", line(pts));
    return svg.node();
  }

  function moveTooltip(e) {
    const tip = document.getElementById("jo-tooltip"), pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - pad;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - pad;
    d3.select(tip).style("left", `${x}px`).style("top", `${y}px`);
  }

  function hideTooltip() { d3.select("#jo-tooltip").attr("hidden", true); }

  window.initJoueur = initJoueur;
})();
