# Les données en chiffres

Résultats de `notebooks/01_exploration.ipynb` et `scripts/build_data.py`, premier passage le 13/11/2026.

| Mesure | Valeur | Remarque |
| --- | --- | --- |
| Matchs du circuit principal | 199 389 | Fichiers `atp_matches_1968.csv` à `atp_matches_2026.csv` (14 matchs datés de fin 1967 dans le fichier 1968) |
| Période couverte | 1968 – mai 2026 | 2026 incomplète (1 449 matchs) : l'archive s'arrête au 25/05/2026 |
| Matchs par saison complète récente | ~2 900 à 3 200 | |
| Joueurs dans la base | 66 912 | |
| Lignes de classement | 3,4 millions | Du 27/08/1973 au 08/06/2026 |
| Statistiques de service | ~87 à 91 % des matchs à partir de 1991 | 2 % en 1990 : rien d'exploitable avant 1991 |
| Niveaux de tournoi | A 129 719 · G 28 299 · M 25 513 · D 15 170 · F 624 · O 64 | Codes : autres ATP, Grand Chelem, Masters, Coupe Davis, Masters Cup, JO |
| Surfaces | Dur 80 877 · Terre 70 920 · Gazon 23 702 · Moquette 20 900 · inconnue 2 990 | |
| Joueurs retenus | 35 | ≥ 3 Grands Chelems ou ≥ 1 semaine au n°1 |

## Contrôles

| Contrôle | Attendu (officiel) | Obtenu | OK ? |
| --- | --- | --- | --- |
| Grands Chelems Djokovic / Nadal / Federer | 24 / 22 / 20 | 24 / 22 / 20 | oui |
| Grands Chelems Sampras / Borg | 14 / 11 | 14 / 11 | oui |
| Semaines au n°1 Federer / Sampras / Nadal | 310 / 286 / 209 | 310 / 286 / 209 | oui |
| Semaines au n°1 Djokovic | 428 | 450 | **non** : nos 22 semaines en trop correspondent probablement au gel des classements en 2020 (Covid), que l'ATP n'a pas compté. À corriger dans `weeks_at_no1`. |
| Titres Federer | 103 | 103 | oui |

## Limites connues

- Source d'origine (github.com/JeffSackmann/tennis_atp) retirée en 2026 ; on utilise sa copie d'archive (github.com/Aneeshers/tennis-sackmann-archive), mêmes fichiers.
- Classements à partir d'août 1973 seulement, incomplets avant 1985 : les joueurs d'avant (Laver, Rosewall) ont 0 semaine au n°1 par construction.
- Pas de statistiques de service avant 1991.
- Gel des classements ATP en 2020 : voir le contrôle Djokovic.
- Longévité Elo : avec le seuil provisoire de 2200, Djokovic et Nadal ont 20 ans « au top », ce qui est trop généreux. Seuil à recalibrer.
