# Notes pour le rapport

Une ligne par décision, avec sa raison, au fil de l'eau.

| Date | Choix | Pourquoi |
| --- | --- | --- |
| 13/11/2026 | Deux sources : archive ATP de Jeff Sackmann et Match Charting Project | Résultats et stats de tous les matchs ATP d'un côté, style de jeu coup par coup de l'autre |
| 13/11/2026 | Matchs à partir de 1991 seulement | Aucune statistique de match avant 1991 |
| 13/11/2026 | Forfaits retirés, abandons gardés (colonne `retired`) | Un forfait n'est pas un match joué |
| 13/11/2026 | Match Charting : hommes seulement, surfaces dur / terre / gazon, au moins 10 matchs notés par joueur et surface | En dessous, les pourcentages sont trop instables |
| 13/11/2026 | Les effectifs (`matches`, `points`) sont gardés dans les fichiers | Pour afficher l'incertitude (séance 4) |
| 13/11/2026 | ATP : disqualifications et matchs interrompus retirés, ainsi que 8 matchs aux statistiques impossibles | Pas de vainqueur sportif, ou erreur de saisie |
| 13/11/2026 | ATP : moquette (`Carpet`) gardée dans le fichier | Surface réelle jusqu'en 2009 ; la vue peut la filtrer |
| 13/11/2026 | Match Charting : nouveau fichier `charting_matches.csv`, vainqueur déduit du dernier point, matchs incomplets retirés (environ 1 %) | Le fichier des matchs ne donne pas le vainqueur, or c'est le cœur de la question |
| 13/11/2026 | Fichier `slam_pointbypoint` non utilisé pour l'instant | Le Match Charting couvre déjà le style de jeu, avec plus de détail |
