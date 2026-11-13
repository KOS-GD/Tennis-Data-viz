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
