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
| 13/11/2026 | Site en une seule page (`web/index.html`), une vue par onglet ; chaque vue a son script et sa feuille de style ; code simple, dans le style des PC | Une seule page à ouvrir ; les deux membres du binôme travaillent sur des fichiers séparés |
| 13/11/2026 | Onglet « Services » : trois demi-courts côte à côte (dur, terre, gazon), un menu pour choisir le joueur | Petits multiples (séance 3) : même échelle et même orientation pour comparer les surfaces |
| 13/11/2026 | Chaque zone colorée selon l'écart à la moyenne du circuit sur la surface : bleu (moins), neutre (comme la moyenne), rouge (plus) | Donnée divergente autour de 0 → échelle bifurquée avec neutre au centre (séance 2, comme au TD 5) |
| 13/11/2026 | 120 balles par court, réparties entre les zones selon les services du joueur ; position dans la zone tirée au hasard | Représentation unitaire, lisible directement ; le Match Charting ne note que la zone |
| 13/11/2026 | Au changement de joueur, les balles glissent vers leurs nouvelles zones et les couleurs changent en douceur | Transitions animées (séance 5) : on suit le changement |
| 13/11/2026 | Pourcentage de chaque zone écrit sous le court | La couleur est un canal peu précis |
