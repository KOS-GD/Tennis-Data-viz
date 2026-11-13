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
| 13/11/2026 | Onglet « Services », première version (heatmap en perspective, nombreux filtres) abandonnée | Trop de filtres pour une question simple, et des taches trop semblables d'une sélection à l'autre : on voyait mal les différences |
| 13/11/2026 | Onglet « Services » : un seul choix, le joueur (recherche ou 8 joueurs les plus notés) | La question est « où sert ce joueur, et est-ce que ça change selon la surface » ; un seul contrôle rend la vue directe |
| 13/11/2026 | Trois demi-courts côte à côte (dur, terre, gazon), même échelle et même orientation, recadrés sur les carrés de service ; couleurs de surface sourdes | Petits multiples (séance 3) : on compare les surfaces d'un coup d'œil ; la surface est identifiée sans attirer l'œil, la couleur est réservée à la donnée |
| 13/11/2026 | Zones colorées selon l'écart à la moyenne du circuit sur la même surface, bleu (moins) ou rouge (plus), d'autant plus intense que l'écart est grand (saturée à ±10 points), peinte au sol avec des bords adoucis | Donnée divergente autour de 0 → échelle bifurquée avec un neutre au centre (séance 2), comme au TD 5 ; les écarts ressortent alors que les parts brutes se ressemblent |
| 13/11/2026 | 160 balles par court, chacune vaut la même part des services bons ; balle claire = 1re balle, balle sombre = 2e balle | Représentation unitaire : le nombre de balles dans une zone se lit directement ; deux valeurs de luminance pour une donnée binaire, sans ajouter de teinte |
| 13/11/2026 | Position d'une balle dans sa zone tirée au hasard (plus souvent près de la ligne de service), dit sur la page | Le Match Charting ne note que la zone |
| 13/11/2026 | Transition en trois étapes au changement de joueur : les balles disparaissent, les zones changent de couleur et les pourcentages défilent, puis la couleur se peint au sol du filet vers le fond, puis les balles sont servies une à une : vol en cloche au-dessus de leur ombre, onde à l'impact, pourcentages qui montent au rythme des impacts ; les trois courts démarrent l'un après l'autre | Transitions animées par étapes (séance 5, TD 5) : on suit le changement au lieu de comparer deux images |
| 13/11/2026 | Pourcentage et écart écrits dans une bande sous chaque court, alignés sur les zones ; infobulle avec effectif, intervalle de confiance de Wilson à 95 % et moyenne du circuit ; court grisé sous 60 services | La couleur est un canal peu précis ; incertitude (séance 4) |
| 13/11/2026 | Phrase de synthèse : la zone où le joueur s'écarte le plus de la moyenne | Guide la lecture vers le résultat le plus marquant |
