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
| `tennis-sackmann-archive/` | [github.com/Aneeshers/tennis-sackmann-archive](https://github.com/Aneeshers/tennis-sackmann-archive) (copie de l'ancien dépôt `JeffSackmann/tennis_atp`, retiré en 2026) |
| `tennis_MatchChartingProject/` | [github.com/JeffSackmann/tennis_MatchChartingProject](https://github.com/JeffSackmann/tennis_MatchChartingProject) |

## 2. Préparer les données

```bash
pip install -r requirements.txt
python prepare_data.py
```

Le script écrit dans `web/data/` :

- `atp_matches.csv` : un match ATP du circuit principal par ligne, de 1991 à mai 2026 (pas de statistiques avant 1991). Tournoi, surface, tour, les deux joueurs (classement, âge, taille, main, pays) et leurs statistiques de service (préfixe `w_` pour le vainqueur, `l_` pour le perdant). Forfaits, disqualifications, matchs interrompus, matchs sans statistiques et lignes aux statistiques incohérentes retirés. La surface `Carpet` (moquette, disparue du circuit après 2009) est gardée.
- `charting_matches.csv` : un joueur par match noté du Match Charting Project (hommes, dur / terre / gazon), soit deux lignes par match, avec `won` = 1 pour le vainqueur et 0 pour le perdant. Le vainqueur est déduit du dernier point ; les matchs notés en partie ou abandonnés sont retirés. Totaux bruts : service, retour, balles de break, coups gagnants, fautes directes, filet, coups droits / revers / slices, profondeur des retours.
- `charting_players.csv` : indicateurs de style par joueur et par surface (`Hard`, `Clay`, `Grass`, `All`), tirés du Match Charting Project (hommes, au moins 10 matchs notés). Ce sont des proportions : points gagnés au service et au retour, aces, doubles fautes, retours profonds, coups gagnants et fautes directes par point, montées au filet, part de coups droits, part de slices. Les colonnes `matches` et `points` donnent l'effectif.

## 3. Lancer le site

```bash
cd web
python -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Sources et licence

Données de Jeff Sackmann / Tennis Abstract, licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Les fichiers de `web/data/` en sont dérivés et suivent la même licence. D3.js v7.9.0 (licence ISC).
