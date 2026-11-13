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
| 13/11/2026 | Onglet « Fiche joueur » : radar à 7 axes dans un ordre fixe (victoires sur dur, terre, gazon ; points gagnés au service, au retour ; balles de break sauvées ; victoires contre un top 10), moquette laissée de côté | Comparer des formes suppose le même ordre d'axes pour tous ; la moquette disparaît après 2009 |
| 13/11/2026 | Chaque axe va du plus faible au meilleur des joueurs avec au moins 200 matchs depuis 1991, bornes réelles écrites sous chaque axe, joueur médian en pointillés | Même échelle sur tous les axes sans cacher les valeurs ; la médiane donne un repère |
| 13/11/2026 | Mode « barres alignées » en plus du radar, avec une transition en trois étapes | Angle et aire sont des canaux peu précis, la position sur une échelle commune est le plus précis (séance 2) ; transitions en étapes pour suivre chaque marque (séance 5) |
| 13/11/2026 | Intervalle de Wilson à 95 % sur chaque pourcentage, effectif au survol, marqueur creux sous 20 matchs (500 points, 50 balles de break), « n.d. » si absent, jamais 0 | Incertitude (séance 4) ; un petit échantillon ou une absence ne doit pas passer pour une vraie valeur |
| 13/11/2026 | Trois joueurs au maximum, une couleur et une forme par joueur, gardées tant qu'il reste sélectionné | L'identité ne repose pas sur la couleur seule (daltonisme, séance 2) ; la couleur suit le joueur, pas son rang |
| 13/11/2026 | Survol d'un critère : courbe saison par saison ; valeur exacte, intervalle et effectif au survol de chaque marqueur | Détails à la demande, sans surcharger la vue |
| 13/11/2026 | Interface en noir, blanc et gris, sans cadres ni fonds colorés ; la couleur ne sert qu'aux données (joueurs, surfaces, écart à la moyenne) | La teinte est le canal qui distingue le mieux des catégories (séance 2) : l'utiliser aussi pour l'interface la rendrait moins lisible |
| 13/11/2026 | Onglet « Services » : légende en dégradé de l'échelle de couleur, bornée à ±10 points, et légende des balles | Une échelle de couleur ne se lit pas sans sa légende ; dégradé fait à la main comme au TD 5 |
| 13/11/2026 | Textes d'explication retirés de la page, il ne reste que les légendes ; chaque onglet tient sur un écran | Les explications sont dans le rapport ; pas de défilement pour comparer |
| 13/11/2026 | Onglet « Fiche joueur » : un seul joueur choisi par une barre de recherche ; identité (pays, main, taille, années de carrière, âge au dernier match), chiffres de carrière, adversaires marquants et le même profil à 7 axes (radar ou barres alignées) que l'onglet « Comparer les joueurs », face au joueur médian | Vue de détail d'un joueur (vue d'ensemble puis détails à la demande) ; mêmes axes et mêmes bornes que la comparaison pour pouvoir passer de l'une à l'autre |
| 13/11/2026 | Titres = finales gagnées hors Coupe Davis, avec le détail Grand Chelem et Masters 1000 ; meilleur classement = meilleur rang au moment d'un match | Seules données disponibles ; les finales gagnées sur abandon ou forfait sont retirées des données, le total peut être un peu sous-estimé (Federer : 102 au lieu de 103) |
| 13/11/2026 | Adversaire le plus affronté, bête noire (le plus de défaites contre lui) et victime préférée (le plus de victoires contre lui), en comptes absolus ; un clic sur le nom ouvre sa fiche | Comptes simples à lire et à vérifier ; un taux sur deux ou trois matchs serait trompeur ; navigation entre fiches |
| 13/11/2026 | Surface préférée : meilleur taux de victoires, avec la mention « nettement » ou « pas nettement » devant la deuxième selon que les intervalles de Wilson à 95 % se chevauchent ou non | Incertitude (séance 4) : ne pas annoncer une préférence que les données ne permettent pas d'affirmer |
| 13/11/2026 | Emplacement de photo en pointillés avec les initiales en attendant | Place réservée pour une photo ajoutée plus tard |
| 13/11/2026 | Ancien onglet « Fiche joueur » renommé « Comparer les joueurs » | Deux onglets distincts ; le doublon radar sera revu |
| 13/11/2026 | Onglet « Évolution du style de jeu » : part des points joués au filet par décennie, en points dispersés + violon + boîte à moustaches (un point = un joueur dans un match noté) | Montre à la fois la tendance (la médiane baisse) et la dispersion (deux styles cohabitent dans les années 1990) ; distributions et incertitude, séance 4 et TD 4 |
| 13/11/2026 | Filtre surface sur cet onglet | Les décennies anciennes comptent plus de gazon : sans filtre, on mélangerait l'effet de l'époque et celui de la surface (requête dynamique, séance 3) |
| 13/11/2026 | Violons tous à la même largeur maximale, effectif n écrit sous chaque décennie, pas de violon sous 30 matchs, années 1960 retirées (10 matchs) | On compare des formes ; les effectifs vont de 48 à 6 578 ; une forme sur quelques matchs ne veut rien dire (séance 4) |
| 13/11/2026 | Joueurs mis en avant : 3 au plus, couleur fixe par joueur, tous les autres matchs en gris | La couleur suit le joueur et ne change pas avec la sélection ; au-delà de 3 couleurs superposées dans un nuage, elles se confondent pour les daltoniens (séance 2) |
| 13/11/2026 | Calcul fait dans le navigateur à partir de charting_net_points, charting_overview et charting_matches, matchs de moins de 40 points écartés | Pas de nouvelle table : les tables existantes suffisent ; un match très court donne un pourcentage instable |
