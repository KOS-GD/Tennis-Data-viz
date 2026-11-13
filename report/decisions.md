# Journal des choix

Une ligne par décision, avec sa raison. C'est la matière première du rapport : notez au fil de l'eau, pas à la fin.

| Date | Choix | Pourquoi | Qui |
| --- | --- | --- | --- |
| 2026-11-13 | Base ATP de Jeff Sackmann comme source principale | Seule base libre qui couvre tous les matchs depuis 1968, avec classements et stats | |
| 2026-11-13 | Critères convertis en rang percentile avant pondération | Unités différentes (titres, semaines, points Elo) ; le rang évite qu'une valeur extrême écrase les autres | |
| 2026-11-13 | Donnée manquante = `null`, retirée du calcul du joueur, jamais 0 | Ne pas pénaliser les joueurs d'avant 1991 (pas de stats) ou d'avant 1985 (classements partiels) | |
| 2026-11-13 | Barres empilées par critère dans le classement | On voit d'où vient le score de chaque joueur | |
| 2026-11-13 | Une couleur fixe par critère, palette testée pour le daltonisme, teintes dédiées en mode sombre | Lisibilité et accessibilité ; la couleur suit le critère, pas son rang | |
| 2026-11-13 | Forfaits (« W/O ») exclus des % de victoires, abandons conservés | Un forfait n'est pas un match joué | |
| 2026-11-13 | Elo avec K dégressif K = 250 / (n + 5)^0,4, départ à 1500 | Méthode publiée (FiveThirtyEight), simple à expliquer | |
| 2026-11-13 | Polyvalence = % de victoires sur sa plus mauvaise surface (min. 20 matchs) | Récompense le joueur bon partout, pas seulement sur sa surface favorite | |
