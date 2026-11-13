# Ce qui fait gagner au tennis

Projet du cours CSC_51052 Data Visualization (École polytechnique, 2026-2027).
Question : qu'est-ce qui sépare le vainqueur du perdant d'un match de tennis, et est-ce que cela change selon la surface ?

## Organisation

```
prepare_data.py   transforme les données brutes en fichiers prêts pour le site
data/raw/         données brutes, téléchargées à la main (non versionnées)
web/              le site (D3 v7 inclus), à lancer avec un serveur local
  data/           fichiers produits par prepare_data.py
report/notes.md   choix de conception, pour le rapport
```

## 1. Télécharger les données (une seule fois)

Télécharger les deux dépôts (bouton « Code » puis « Download ZIP » sur GitHub), les dézipper dans `data/raw/` et **renommer les dossiers** pour retirer le suffixe `-main` ou `-master` :

| Dossier attendu dans `data/raw/` | Source |
| --- | --- |
| `tennis-sackmann-archive/` | [github.com/Aneeshers/tennis-sackmann-archive](https://github.com/Aneeshers/tennis-sackmann-archive) (copie de l'ancien dépôt `JeffSackmann/tennis_atp`, retiré en 2026, avec les sous-dossiers `atp/` et `slam_pointbypoint/`) |
| `tennis_MatchChartingProject/` | [github.com/JeffSackmann/tennis_MatchChartingProject](https://github.com/JeffSackmann/tennis_MatchChartingProject) |

## 2. Préparer les données

```bash
pip install -r requirements.txt
python prepare_data.py
```

Le script vide `web/data/` puis y écrit tous les fichiers ci-dessous. On garde le maximum de détail : les vues font leurs propres regroupements.

### Règles communes

1. **Simple messieurs** seulement.
2. **Matchs joués jusqu'au bout** : forfaits, disqualifications, abandons et matchs interrompus ou notés en partie sont retirés. Les statistiques d'un match incomplet ne sont pas comparables.
3. **Vainqueur / perdant** partout : les noms de colonnes commencent par `w_` (vainqueur) ou `l_` (perdant) ; dans les tableaux à une ligne par joueur, la colonne `player` vaut `w` ou `l` ; dans les points, `server` et `point_winner` valent `w` ou `l`.
4. **Identifiant entier** `match_id` propre à chaque source : il relie les points et les stats au fichier de matchs de la même source (`charting_*` → `charting_matches`, `slam_points` → `slam_matches`).
5. **Comptes bruts**, pas de pourcentages : on additionne puis on divise, ce qui reste juste quand on regroupe.
6. Noms de colonnes en `snake_case`, dates `AAAA-MM-JJ`, surfaces `Hard`, `Clay`, `Grass` (et `Carpet` dans l'archive ATP, surface disparue après 2009).

### Fichiers

| Fichier | Une ligne = | Contenu |
| --- | --- | --- |
| `atp_matches.csv` | un match ATP du circuit principal, 1991 – mai 2026 | tournoi, niveau, surface, tour, score, durée ; pour chaque joueur : id, nom, classement, points, tête de série, entrée, âge, taille, main, pays et stats de service (aces, doubles fautes, points, 1res balles, points gagnés, jeux, balles de break) |
| `charting_matches.csv` | un match noté par le Match Charting Project | date, tournoi, tour, surface, court, arbitre, noms et mains, `first_server` |
| `charting_points.csv.gz` | un point noté | score avant le point, serveur, codes bruts de la 1re et de la 2e balle (`first`, `second`, voir l'onglet *Instructions* de `MatchChart 0.3.2.xlsm`), gagnant du point |
| `charting_<tableau>.csv` | un match × joueur × ligne du tableau | les 16 tableaux de stats du projet, complets : `overview` (la colonne `row` donne le set ou `Total`), `serve_basics`, `serve_direction`, `serve_influence`, `sv_break_total`, `sv_break_split`, `key_points_serve`, `key_points_return`, `return_outcomes`, `return_depth`, `rally`, `shot_types`, `shot_direction`, `shot_dir_outcomes`, `net_points`, `sn_v` |
| `slam_matches.csv` | un match de Grand Chelem suivi point par point, 2011-2024 | tournoi, surface, tour, court, noms et pays |
| `charting_player_info.csv` | un match noté × joueur (`player` = `w` / `l`) | identifiant ATP, pays et classement ATP à la date du match, retrouvés par le nom dans l'archive ATP (98 % des joueurs) |
| `slam_points.csv.gz` | un point | set, jeu, score, serveur, 1re ou 2e balle, vitesse (km/h), longueur d'échange, zone et profondeur du service, profondeur du retour, type du coup gagnant, et pour chaque joueur : ace, double faute, coup gagnant, faute directe ou provoquée, montée au filet, balle de break, distance parcourue |

`charting_rally.csv` a une ligne par match, longueur d'échange (`row`) et serveur (`server` = `w`, `l` ou `all`), avec les stats des deux joueurs en colonnes `w_` et `l_`.

Seule exception à la règle 5 : `charting_serve_influence.csv` est fourni par la source en pourcentages (part des points gagnés au service selon la longueur de l'échange), gardés en proportions entre 0 et 1.

Des colonnes en partie vides sont normales : la source ne renseigne pas tout. Dans l'archive ATP, `seed` et `entry` ne sont remplis que pour les têtes de série et les entrées particulières (invité, qualifié...). Dans `charting_points`, `second` est vide quand la 1re balle est bonne. Dans `slam_matches`, tour, court et pays ne sont donnés qu'en 2011. Les champs des Grands Chelems ne sont pas tous renseignés chaque année (vitesse 75 % des points, zone du service 42 %, distance parcourue 47 %) : une case vide veut dire « non mesuré ».

Les deux fichiers point par point sont compressés (`.csv.gz`, environ 14 Mo chacun au lieu de 55 et 85). pandas les lit directement ; dans le navigateur, `fetch` puis `DecompressionStream("gzip")`.

## 3. Lancer le site

```bash
cd web
python -m http.server 8000
```

puis ouvrir http://localhost:8000. Toutes les vues sont des onglets de cette page.

**Ajouter une vue** : dans `web/index.html`, un bouton `<button data-tab="xxx">` dans `#tabs` et une `<section class="tab" id="xxx">` ; le code dans `web/js/xxx.js` avec une fonction `initXxx()`, appelée dans `createViz()` (`web/main.js`) ; le style dans `web/css/xxx.css`. Préfixer les `id`, classes et variables globales de la vue (la vue des services utilise `sv`) pour ne pas gêner les autres vues.

## Sources et licence

Données de Jeff Sackmann / Tennis Abstract, licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Les fichiers de `web/data/` en sont dérivés et suivent la même licence. D3.js v7.9.0 (licence ISC).
