// Tout le code de la vue est dans une fonction anonyme : ses variables (ctx, state...) ne gênent pas
// les scripts des autres onglets. Seule initFiche() est exposée, appelée par js/tabs.js.
(() => {
    // Fiche joueur : profil d'un à trois joueurs sur sept critères, en radar ou en barres alignées.
    // Données : web/data/atp_matches.csv (produit par prepare_data.py), regroupé ici par joueur.
    //
    // Choix (détaillés dans report/notes.md) :
    // - 7 axes dans un ordre fixe ; la moquette est laissée de côté (disparue après 2009).
    // - Chaque axe va du plus faible au meilleur du groupe de référence (joueurs avec au moins
    //   ctx.MIN_MATCHES matchs) : même échelle 0–1 pour tous les axes.
    // - Comptes bruts additionnés puis divisés ; intervalle de Wilson à 95 % sur chaque pourcentage (séance 4).
    // - Valeur absente = « n.d. », jamais 0 ; peu de données (n < minN) = marqueur creux.
    // - Une couleur ET une forme par joueur, gardées tant qu'il reste sélectionné.
     
    const ctx = {
      MAX_PLAYERS: 3,
      MIN_MATCHES: 200,
      DEFAULT_NAMES: ["Roger Federer", "Rafael Nadal"],
     
      // minN : en dessous, la valeur est jugée peu fiable (marqueur creux, cellule grisée).
      // minYear : minimum pour afficher une saison dans la courbe de carrière.
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
      MODES: [["radar", "Radar"], ["dots", "Barres alignées"]],
     
      // Trois couleurs catégorielles testées pour le daltonisme, et trois formes en plus (séance 2).
      COLORS: ["#2a78d6", "#eb6834", "#1baf7a"],
      SYMBOLS: [d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle],
      SYMBOL_CHARS: ["●", "■", "▲"],
     
      // Géométrie (coordonnées du viewBox ; le SVG s'adapte à la largeur)
      W: 640, H: 500,
      RADAR: { cx: 320, cy: 255, R: 165, r0: 22 },
      DOTS: { x0: 200, x1: 610, y0: 62, dy: 63 },
     
      // Transition en trois étapes (séance 5) : effacement, déplacement, apparition
      T_FADE: 250, T_MOVE: 650, T_STAGGER: 45,
    };
     
    const state = { mode: "radar", selected: [] };   // selected : [{ id, slot }]
     
    const fr = d3.formatLocale({ decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"] });
    const fmtInt = fr.format(",d");
    const pct = v => `${fr.format(".1f")(v * 100)} %`;
     
    function initFiche() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        ctx.T_FADE = 0; ctx.T_MOVE = 0; ctx.T_STAGGER = 0;
      }
      // Saison = 4 premiers caractères de tourney_id (un match daté du 31/12/1990 compte pour 1991).
      // On la lit avant d3.autoType, qui prend certains identifiants (« 1991-33 ») pour des dates.
      const parseRow = row => {
        const season = +row.tourney_id.slice(0, 4);
        return Object.assign(d3.autoType(row), { season });
      };
      d3.csv("data/atp_matches.csv", parseRow).then(rows => {
        prepareData(rows);
        initControls();
        drawGrids();
        ctx.DEFAULT_NAMES.map(n => ctx.byName.get(n)).filter(Boolean).forEach(p => addPlayer(p.id));
      });
    }
     
    // ---------------------------------------------------------------------------
    // Données
    // ---------------------------------------------------------------------------
     
    // Intervalle de score de Wilson à 95 % pour une proportion k / n.
    function wilson(k, n) {
      if (!n) return null;
      const z = 1.96, p = k / n, d = 1 + z * z / n;
      const c = (p + z * z / (2 * n)) / d, m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
      return [Math.max(0, c - m), Math.min(1, c + m)];
    }
     
    // Une passe sur les matchs : comptes (succès k, essais n) par joueur, par axe et par saison.
    function prepareData(rows) {
      const players = new Map();
      const get = (id, name) => {
        let p = players.get(id);
        if (!p) {
          p = { id, name, matches: 0, first: Infinity, last: -Infinity, stats: {}, years: {} };
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
          p.first = Math.min(p.first, year);
          p.last = Math.max(p.last, year);
     
          if (ctx.SURFACE_KEY[r.surface]) add(p, ctx.SURFACE_KEY[r.surface], year, won, 1);
     
          const oppRank = r[`${op}_rank`];
          if (oppRank != null && oppRank <= 10) add(p, "top10", year, won, 1);
     
          const svpt = r[`${me}_svpt`], w1 = r[`${me}_1st_won`], w2 = r[`${me}_2nd_won`];
          if (svpt > 0 && w1 != null && w2 != null) add(p, "serve", year, w1 + w2, svpt);
     
          // Points gagnés au retour = points de service de l'adversaire qu'il a perdus.
          const osv = r[`${op}_svpt`], o1 = r[`${op}_1st_won`], o2 = r[`${op}_2nd_won`];
          if (osv > 0 && o1 != null && o2 != null) add(p, "return", year, osv - o1 - o2, osv);
     
          const faced = r[`${me}_bp_faced`], saved = r[`${me}_bp_saved`];
          if (faced > 0 && saved != null) add(p, "bp", year, saved, faced);
        }
      }
     
      // Valeur, intervalle et fiabilité par axe.
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
     
      // Bornes de chaque axe : du plus faible au meilleur du groupe (valeurs fiables seulement).
      ctx.dom = {};
      for (const a of ctx.AXES) {
        const vals = ctx.pool.map(p => p.val[a.key]).filter(d => d && !d.low).map(d => d.v);
        ctx.dom[a.key] = { min: d3.min(vals), max: d3.max(vals), median: d3.median(vals) };
      }
    }
     
    // Position 0–1 sur l'axe (bornée : une valeur peu fiable peut sortir du groupe).
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
    const color = d => ctx.COLORS[d.slot];
    // Décalage vertical des joueurs sur une même ligne (mode barres), pour que les intervalles ne se recouvrent pas.
    const offset = d => (state.selected.findIndex(s => s.id === d.id) - (state.selected.length - 1) / 2) * 9;
     
    function markXY(d, mode) {
      const t = norm(d.axis.key, ctx.players.get(d.id).val[d.axis.key].v);
      return mode === "radar" ? radarXY(d.i, t) : [xDots(t), rowY(d.i) + offset(d)];
    }
     
    // ---------------------------------------------------------------------------
    // Contrôles : recherche de joueur, puces, bascule de mode
    // ---------------------------------------------------------------------------
     
    function initControls() {
      d3.select("#fj-pool").text(
        `${fmtInt(ctx.pool.length)} joueurs avec au moins ${ctx.MIN_MATCHES} matchs ATP depuis 1991`);
     
      d3.select("#fj-player-list").selectAll("option")
        .data(ctx.pool.slice().sort((a, b) => d3.ascending(a.name, b.name)))
        .join("option")
        .attr("value", d => d.name);
     
      // Ajout dès qu'un nom de la liste est choisi, ou avec Entrée.
      const input = d3.select("#fj-player-input");
      const tryAdd = () => {
        const p = ctx.byName.get(input.property("value").trim());
        if (p) { addPlayer(p.id); input.property("value", ""); }
      };
      input.on("change", tryAdd).on("keydown", e => { if (e.key === "Enter") tryAdd(); });
     
      d3.select("#fj-mode").selectAll("button").data(ctx.MODES).join("button")
        .text(d => d[1])
        .classed("on", d => d[0] === state.mode)
        .on("click", (e, d) => setMode(d[0]));
    }
     
    function addPlayer(id) {
      const msg = d3.select("#fj-message").text("");
      if (state.selected.some(s => s.id === id)) return;
      if (state.selected.length >= ctx.MAX_PLAYERS) {
        msg.text(`${ctx.MAX_PLAYERS} joueurs au maximum : retirez-en un d'abord.`);
        return;
      }
      // Un joueur prend le premier emplacement de couleur libre et le garde.
      const used = new Set(state.selected.map(s => s.slot));
      state.selected.push({ id, slot: ctx.COLORS.findIndex((_, i) => !used.has(i)) });
      update();
    }
     
    function removePlayer(id) {
      state.selected = state.selected.filter(s => s.id !== id);
      d3.select("#fj-message").text("");
      update();
    }
     
    // ---------------------------------------------------------------------------
    // Dessin des grilles (une fois)
    // ---------------------------------------------------------------------------
     
    function drawGrids() {
      const svg = d3.select("#fj-chart").html("").append("svg")
        .attr("viewBox", `0 0 ${ctx.W} ${ctx.H}`)
        .attr("role", "img")
        .attr("aria-label", "Profil des joueurs sélectionnés sur sept critères");
     
      ctx.gRadar = svg.append("g").attr("class", "radar-grid");
      ctx.gDots = svg.append("g").attr("class", "dots-grid").attr("opacity", 0).attr("pointer-events", "none");
      ctx.gPolys = svg.append("g");
      ctx.gCIs = svg.append("g").attr("opacity", 0).attr("pointer-events", "none");
      ctx.gMarks = svg.append("g");
     
      // Radar : trois anneaux (min, milieu, max du groupe), rayons, libellés, joueur médian.
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
      const below = i => Math.cos(angle(i)) < -0.5;   // libellés du bas : texte sous le point
      labels.append("text").attr("class", "label").attr("dy", (_, i) => below(i) ? "0.8em" : "-0.2em")
        .text(a => a.label);
      labels.append("text").attr("class", "range").attr("dy", (_, i) => below(i) ? "2em" : "1em")
        .text(a => `${pct(ctx.dom[a.key].min)} – ${pct(ctx.dom[a.key].max)}`);
      axisHover(labels);
     
      // Barres alignées : une ligne par critère, graduée en % réels (min, médiane, max du groupe).
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
     
    // ---------------------------------------------------------------------------
    // Mise à jour après un changement de sélection
    // ---------------------------------------------------------------------------
     
    function update() {
      const sel = state.selected.map(s => ({ ...s, p: ctx.players.get(s.id) }));
     
      // Puces = légende (couleur + forme + nom), avec un bouton pour retirer le joueur.
      d3.select("#fj-chips").selectAll(".chip").data(sel, d => d.id).join(enter => {
          const c = enter.append("span").attr("class", "chip");
          c.append("span").attr("class", "symbol").attr("aria-hidden", true);
          c.append("span").attr("class", "name");
          c.append("button").attr("type", "button").text("×");
          return c;
        })
        .call(c => c.select(".symbol").style("color", color).text(d => ctx.SYMBOL_CHARS[d.slot]))
        .call(c => c.select(".name").text(d => `${d.p.name} (${d.p.first}–${d.p.last})`))
        .call(c => c.select("button").attr("aria-label", d => `Retirer ${d.p.name}`)
          .on("click", (e, d) => removePlayer(d.id)));
     
      // Polygones du radar : remplis seulement si tous les axes existent, sinon contour interrompu.
      ctx.gPolys.selectAll("path").data(sel, d => d.id).join("path")
        .attr("class", "poly")
        .attr("fill", color).attr("stroke", color)
        .classed("partial", d => ctx.AXES.some(a => !d.p.val[a.key]))
        .attr("d", d => {
          const pts = ctx.AXES.map((a, i) => (d.p.val[a.key] ? radarXY(i, norm(a.key, d.p.val[a.key].v)) : null));
          if (pts.every(Boolean)) return `M${pts.join("L")}Z`;
          return pts.map((pt, i) => {
            const next = pts[(i + 1) % pts.length];
            return pt && next ? `M${pt}L${next}` : "";
          }).join("");
        });
     
      // Un marqueur par joueur et par axe disponible : le même élément dans les deux modes.
      const marks = sel.flatMap(s => ctx.AXES.map((axis, i) => ({ key: `${s.id}-${axis.key}`, id: s.id, slot: s.slot, axis, i }))
        .filter(d => ctx.players.get(d.id).val[d.axis.key]));
     
      // Intervalles de confiance (mode barres).
      ctx.gCIs.selectAll("g.ci").data(marks, d => d.key).join(enter => {
          const g = enter.append("g").attr("class", "ci");
          g.append("line").attr("class", "ci-line");
          g.append("line").attr("class", "cap lo");
          g.append("line").attr("class", "cap hi");
          return g;
        })
        .attr("stroke", color)
        .attr("transform", d => `translate(0,${rowY(d.i) + offset(d)})`)
        .each(function (d) {
          const [lo, hi] = ctx.players.get(d.id).val[d.axis.key].ci.map(v => xDots(norm(d.axis.key, v)));
          const g = d3.select(this);
          g.select(".ci-line").attr("x1", lo).attr("x2", hi);
          g.select(".lo").attr("x1", lo).attr("x2", lo).attr("y1", -4).attr("y2", 4);
          g.select(".hi").attr("x1", hi).attr("x2", hi).attr("y1", -4).attr("y2", 4);
        });
     
      ctx.gMarks.selectAll("g.mark").data(marks, d => d.key).join(enter => {
          const g = enter.append("g").attr("class", "mark");
          g.append("circle").attr("class", "hit").attr("r", 12);
          g.append("path").attr("class", "symbol");
          return g;
        })
        .classed("low", d => ctx.players.get(d.id).val[d.axis.key].low)
        .attr("transform", d => `translate(${markXY(d, state.mode)})`)
        .on("pointerenter", showMarkTooltip)
        .on("pointermove", moveTooltip)
        .on("pointerleave", hideTooltip)
        .select("path.symbol")
        .attr("d", d => d3.symbol(ctx.SYMBOLS[d.slot], 70)())
        .attr("stroke", color)
        .attr("fill", d => ctx.players.get(d.id).val[d.axis.key].low ? "var(--panel)" : color(d));
     
      updateTable(sel);
    }
     
    // Tableau des valeurs exactes, avec intervalle et effectif.
    function updateTable(sel) {
      const table = d3.select("#fj-table");
      table.select("thead tr").selectAll("th").data(["Critère", ...sel]).join("th")
        .html(d => typeof d === "string" ? d
          : `<span style="color:${color(d)}">${ctx.SYMBOL_CHARS[d.slot]}</span> ${d.p.name}`);
      table.select("tbody").selectAll("tr").data(ctx.AXES).join("tr")
        .selectAll("td").data(a => [a, ...sel.map(s => ({ a, o: s.p.val[a.key] }))]).join("td")
        .attr("class", d => (d.a ? (d.o && !d.o.low ? "num" : "num faint") : null))
        .html(d => {
          if (!d.a) return d.title;
          if (!d.o) return "n.d.";
          return `${pct(d.o.v)}<small>${pct(d.o.ci[0])} – ${pct(d.o.ci[1])} · ${fmtInt(d.o.n)} ${d.a.unit}</small>`;
        });
    }
     
    // ---------------------------------------------------------------------------
    // Bascule radar ↔ barres alignées, en trois étapes :
    // 1. la grille de départ s'efface, 2. les marqueurs glissent, 3. la nouvelle grille apparaît.
    // ---------------------------------------------------------------------------
     
    function setMode(mode) {
      if (mode === state.mode) return;
      state.mode = mode;
      d3.select("#fj-mode").selectAll("button").classed("on", d => d[0] === mode);
      d3.select("#fj-key-ci").attr("hidden", mode === "dots" ? null : true);
      hideTooltip();
     
      const toDots = mode === "dots";
      const out = toDots ? [ctx.gRadar, ctx.gPolys] : [ctx.gDots, ctx.gCIs];
      const into = toDots ? [ctx.gDots, ctx.gCIs] : [ctx.gRadar, ctx.gPolys];
      const moveEnd = ctx.T_FADE + ctx.T_MOVE + ctx.T_STAGGER * ctx.AXES.length;
     
      out.forEach(g => g.attr("pointer-events", "none")
        .transition("mode").duration(ctx.T_FADE).attr("opacity", 0));
      ctx.gMarks.selectAll("g.mark")
        .transition("mode").delay(d => ctx.T_FADE + d.i * ctx.T_STAGGER).duration(ctx.T_MOVE).ease(d3.easeCubicInOut)
        .attr("transform", d => `translate(${markXY(d, mode)})`);
      into.forEach(g => g.attr("pointer-events", null)
        .transition("mode").delay(moveEnd).duration(ctx.T_FADE).attr("opacity", 1));
    }
     
    // ---------------------------------------------------------------------------
    // Infobulles
    // ---------------------------------------------------------------------------
     
    function showMarkTooltip(e, d) {
      const p = ctx.players.get(d.id), a = d.axis, o = p.val[a.key];
      d3.select("#fj-tooltip").attr("hidden", null).html(`<b>${p.name}</b><br>${a.title}
        <div class="big">${pct(o.v)}</div>
        IC 95 % : ${pct(o.ci[0])} – ${pct(o.ci[1])}<br>
        <span class="faint">${fmtInt(o.k)} sur ${fmtInt(o.n)} ${a.unit}${o.low ? " · peu de données" : ""}</span>`);
      moveTooltip(e);
    }
     
    // Survol d'un critère : évolution saison par saison des joueurs sélectionnés.
    function axisHover(sel) {
      sel.on("pointerenter", (e, a) => {
          if (!state.selected.length) return;
          d3.select("#fj-tooltip").attr("hidden", null)
            .html(`<b>${a.title}</b><br><span class="faint">Saison par saison (au moins ${a.minYear} ${a.unit})</span>`)
            .node().appendChild(sparkline(a));
          moveTooltip(e);
        })
        .on("pointermove", moveTooltip)
        .on("pointerleave", hideTooltip);
    }
     
    function sparkline(a) {
      const w = 260, h = 110, m = { t: 8, r: 10, b: 20, l: 44 };
      const series = state.selected.map(s => {
        const p = ctx.players.get(s.id);
        const pts = d3.range(p.first, p.last + 1).map(y => {
          const o = p.years[a.key].get(y);
          return { y, v: o && o.n >= a.minYear ? o.k / o.n : null };
        });
        return { slot: s.slot, pts };
      });
      const all = series.flatMap(s => s.pts);
      const x = d3.scaleLinear().domain(d3.extent(all, d => d.y)).range([m.l, w - m.r]);
      const y = d3.scaleLinear().domain(d3.extent(all.filter(d => d.v != null), d => d.v)).nice().range([h - m.b, m.t]);
      const line = d3.line().defined(d => d.v != null).x(d => x(d.y)).y(d => y(d.v));
     
      const svg = d3.create("svg").attr("width", w).attr("height", h).attr("class", "spark");
      svg.append("g").attr("transform", `translate(0,${h - m.b})`)
        .call(d3.axisBottom(x).tickValues(x.domain()).tickFormat(d3.format("d")).tickSize(3));
      svg.append("g").attr("transform", `translate(${m.l},0)`)
        .call(d3.axisLeft(y).tickValues(y.domain()).tickFormat(v => `${fr.format(".0f")(v * 100)} %`).tickSize(3));
      svg.selectAll("path.spark-line").data(series).join("path")
        .attr("class", "spark-line")
        .attr("stroke", color)
        .attr("d", d => line(d.pts));
      return svg.node();
    }
     
    function moveTooltip(e) {
      const tip = document.getElementById("fj-tooltip"), pad = 14;
      let x = e.clientX + pad, y = e.clientY + pad;
      if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - pad;
      if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - pad;
      d3.select(tip).style("left", `${x}px`).style("top", `${y}px`);
    }
     
    function hideTooltip() { d3.select("#fj-tooltip").attr("hidden", true); }
     
    window.initFiche = initFiche;
    })();