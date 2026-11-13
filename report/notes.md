# Notes pour le rapport

Une ligne par décision, avec sa raison, au fil de l'eau.

| Date | Choix | Pourquoi |
| --- | --- | --- |
| 13/11/2026 | Deux sources : archive ATP de Jeff Sackmann et Match Charting Project | Résultats et stats de tous les matchs ATP d'un côté, style de jeu coup par coup de l'autre |
| 13/11/2026 | Matchs à partir de 1991 seulement | Aucune statistique de match avant 1991 |
| 13/11/2026 | Préparation : garder le maximum de détail (tous les tableaux du Match Charting, les points, le point par point des Grands Chelems) | Une seule base propre, réutilisée par toutes les vues ; les regroupements se font dans les vues |
| 13/11/2026 | Même règle pour toutes les sources : simple messieurs, matchs joués jusqu'au bout, tout orienté vainqueur (`w`) / perdant (`l`), comptes bruts, identifiant entier par source | Comparer vainqueur et perdant est le cœur de la question ; des fichiers homogènes évitent les erreurs entre vues |
| 13/11/2026 | Abandons retirés aussi (ATP, Match Charting, Grands Chelems) | Les stats d'un match incomplet ne sont pas comparables ; même règle partout |
| 13/11/2026 | ATP : 8 matchs aux statistiques impossibles retirés | Erreurs de saisie |
| 13/11/2026 | ATP : moquette (`Carpet`) gardée | Surface réelle jusqu'en 2009 ; la vue peut la filtrer |
| 13/11/2026 | Match Charting et Grands Chelems : vainqueur déduit des points (dernier point, sets gagnés) | Les fichiers de matchs ne donnent pas toujours le vainqueur |
| 13/11/2026 | Fichiers point par point compressés en `.csv.gz` | 55 et 85 Mo bruts, 14 Mo compressés ; le navigateur décompresse lui-même |
| 13/11/2026 | Site en une seule page (`web/index.html`), une vue par onglet ; chaque vue a son script et sa feuille de style | Une seule page à ouvrir ; les deux membres du binôme travaillent sur des fichiers séparés |
| 13/11/2026 | Onglet « Services » : court vu de dessus en légère perspective, depuis derrière le relanceur | Les carrés de service, où se trouve l'information, sont au premier plan et occupent le plus de place |
| 13/11/2026 | Carte de chaleur par estimation de densité (`d3.contourDensity`) sur des impacts tirés au hasard dans chaque zone, en nombre proportionnel aux services de la zone | Le Match Charting ne code que 3 zones par carré ; le tirage donne une carte lisible, seule la répartition entre zones vient des données (dit sur la page) |
| 13/11/2026 | Nombre d'impacts simulés fixe et seuils de densité fixes pour toutes les sélections | Même échelle partout : on compare des répartitions, pas des effectifs (petits multiples, séance 3) |
| 13/11/2026 | Échelle de couleur séquentielle à luminance croissante, teinte choisie pour contraster avec la surface (chaude sur dur et gazon, froide sur terre) ; pas d'arc-en-ciel | Séance 2 : la luminance porte l'ordre ; la teinte sert seulement au contraste avec le fond |
| 13/11/2026 | Pourcentage écrit dans chaque zone, infobulle avec effectif et intervalle de confiance de Wilson à 95 %, alerte sous 150 services | La couleur est un canal peu précis ; incertitude (séance 4) |
| 13/11/2026 | Filtres combinables : surface, 1re / 2e balle, joueurs, pays, classement au moment du match, main, vainqueur / perdant, années ; fondu enchaîné entre deux états | Exploration interactive par filtrage ; transitions animées (séance 5) |
| 13/11/2026 | Onglet « Fiche joueur » : radar à 7 axes dans un ordre fixe (victoires sur dur, terre, gazon ; points gagnés au service, au retour ; balles de break sauvées ; victoires contre un top 10), moquette laissée de côté | Comparer des formes suppose le même ordre d'axes pour tous ; la moquette disparaît après 2009 |
| 13/11/2026 | Chaque axe va du plus faible au meilleur des joueurs avec au moins 200 matchs depuis 1991, bornes réelles écrites sous chaque axe, joueur médian en pointillés | Même échelle sur tous les axes sans cacher les valeurs ; la médiane donne un repère |
| 13/11/2026 | Mode « barres alignées » en plus du radar, avec une transition en trois étapes | Angle et aire sont des canaux peu précis, la position sur une échelle commune est le plus précis (séance 2) ; transitions en étapes pour suivre chaque marque (séance 5) |
| 13/11/2026 | Intervalle de Wilson à 95 % sur chaque pourcentage, effectif au survol, marqueur creux sous 20 matchs (500 points, 50 balles de break), « n.d. » si absent, jamais 0 | Incertitude (séance 4) ; un petit échantillon ou une absence ne doit pas passer pour une vraie valeur |
| 13/11/2026 | Trois joueurs au maximum, une couleur et une forme par joueur, gardées tant qu'il reste sélectionné | L'identité ne repose pas sur la couleur seule (daltonisme, séance 2) ; la couleur suit le joueur, pas son rang |
| 13/11/2026 | Survol d'un critère : courbe saison par saison ; valeur exacte, intervalle et effectif au survol de chaque marqueur | Détails à la demande, sans surcharger la vue |
