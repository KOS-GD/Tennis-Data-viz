# Notes pour le rapport

Une ligne par décision, avec sa raison, au fil de l'eau.

| Date | Choix | Pourquoi |
| --- | --- | --- |
| 13/11/2026 | Deux sources : archive ATP de Jeff Sackmann et Match Charting Project | Résultats et stats de tous les matchs ATP d'un côté, style de jeu coup par coup de l'autre |
| 13/11/2026 | Matchs à partir de 1991 seulement | Aucune statistique de match avant 1991 |
| 13/11/2026 | Forfaits retirés, abandons gardés (colonne `retired`) | Un forfait n'est pas un match joué |
| 13/11/2026 | Match Charting : hommes seulement, surfaces dur / terre / gazon, au moins 10 matchs notés par joueur et surface | En dessous, les pourcentages sont trop instables |
| 13/11/2026 | Les effectifs (`matches`, `points`) sont gardés dans les fichiers | Pour afficher l'incertitude (séance 4) |
| 13/11/2026 | Vue service : petits multiples, un mini-court par joueur (8 joueurs rangés par époque), même échelle de couleur pour tous | Comparer des formes d'un coup d'œil sans réapprendre la lecture ; tri par époque pour lire l'évolution |
| 13/11/2026 | Service découpé en 2 × 3 zones (carré égalité / avantage × extérieur / corps / T), sans profondeur | On ne dessine que ce qui est codé dans le Match Charting Project |
| 13/11/2026 | Couleur séquentielle à une seule teinte (bleu clair → foncé), domaine 0–70 %, valeur écrite dans chaque case et tableau des valeurs | Quantité ordonnée → teinte unique (séance 2) ; la couleur est un canal faible, d'où les valeurs exactes |
| 13/11/2026 | Pourcentage calculé par carré de service (chaque carré = 100 %) à partir de comptes bruts | Additionner des comptes puis diviser reste juste quand on regroupe des surfaces |
| 13/11/2026 | Mini-court hachuré sous 20 matchs notés | Signaler l'incertitude sans cacher la donnée (séance 4) |
| 13/11/2026 | Vue filet : jitter + boîte + violon par décennie, un point = un joueur dans un match | Montre la tendance et la dispersion (plusieurs styles cohabitent dans les années 1990) ; représentation de l'incertitude (séance 4, TD s04) |
| 13/11/2026 | Filtre surface sur la vue filet | Les années 1980-1990 comptent plus de gazon : sans filtre, on mélange effet de l'époque et effet de la surface |
| 13/11/2026 | Violons à la même largeur maximale, n écrit sous chaque décennie, pas de violon sous 30 matchs | On compare des formes ; les effectifs sont très inégaux (110 à 6 600) |
| 13/11/2026 | Une couleur fixe par joueur, 3 joueurs au plus mis en avant, les autres en gris | La couleur suit le joueur et ne change pas avec la sélection ; au-delà de 3 couleurs dans un nuage, elles se confondent pour les daltoniens |
