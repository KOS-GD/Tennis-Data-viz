# Qui est le meilleur joueur de tennis de l'histoire ?

Projet de visualisation de données : un site interactif qui montre que « le meilleur joueur de l'histoire » dépend du critère choisi. L'utilisateur règle le poids de chaque critère (Grands Chelems, semaines au n°1, pic Elo, longévité, polyvalence, confrontations directes) et voit le classement changer.

## Démarrage rapide

```bash
# 1. Environnement Python
python -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r requirements.txt

# 2. Données brutes (non versionnées, ~quelques centaines de Mo)
bash scripts/download_data.sh       # Windows : lancer depuis Git Bash

# 3. Calcul des indicateurs -> web/data/*.json
python -m scripts.build_data

# 4. Site en local
cd web && python -m http.server 8000
# puis ouvrir http://localhost:8000
```

Sans l'étape 3, le site s'affiche avec des **données fictives** (`web/data/goat_sample.json`) : l'équipe site peut travailler sans attendre les vraies données.

Tests des calculs (sur de petites données inventées) : `pytest`.

## Organisation du dépôt

```
data/raw/          données brutes téléchargées, une source par dossier (hors git)
data/processed/    fichiers intermédiaires éventuels
notebooks/         exploration et analyses (01_exploration.ipynb pour commencer)
src/               fonctions réutilisables
  load.py          lecture des CSV (matchs, joueurs, classements)
  indicators.py    titres, semaines au n°1, % de victoires, confrontations, stats de service
  elo.py           Elo recalculé match par match, pic et longévité
scripts/
  download_data.sh téléchargement des sources
  build_data.py    calcule tout et exporte les JSON du site
tests/             tests des fonctions de src/
web/               le site (D3.js, sans étape de build)
  data/            JSON lus par le site
report/            notes pour le rapport (choix de design, chiffres sur les données)
```

## Le contrat entre données et site

`web/data/goat.json` est produit par `scripts/build_data.py` et lu par `web/js/goat.js` :

```json
{
  "criteria": [{"key": "slams", "label": "Grands Chelems"}, …],
  "players": [
    {"id": 3, "name": "Joueur C", "ioc": "SRB",
     "values": {"slams": 24, "titles": 98, "weeks_no1": 420, "peak_elo": 2470,
                "longevity": 15, "versatility": 0.81, "h2h": null}}
  ]
}
```

Une valeur inconnue vaut `null` (jamais 0). Si vous changez ce format, mettez à jour les deux côtés et `goat_sample.json`.

## Ajouter une source de données

1. Ajouter une ligne `fetch <dossier> <url>` dans `scripts/download_data.sh` (des exemples WTA, point par point et Match Charting Project y sont déjà, commentés).
2. Écrire sa fonction de lecture dans `src/load.py`.
3. Noter la source et sa licence ci-dessous et dans `report/donnees.md`.

## Prochaines étapes

- [ ] Télécharger les données et dérouler `notebooks/01_exploration.ipynb` ; reporter les chiffres dans `report/donnees.md`
- [ ] Valider les codes de `tourney_level` et de `round` avec `matches_data_dictionary.txt`
- [ ] Arrêter la liste des joueurs (critère dans `scripts/build_data.py`, `MIN_SLAMS`)
- [ ] Calibrer l'Elo (seuil de longévité, majoration des Grands Chelems) et le comparer à un classement Elo publié
- [ ] Vue 2 : course aux titres par âge
- [ ] Vue 3 : règnes Elo 1968–aujourd'hui (avec brush sur la période)
- [ ] Vue 4 : fiche joueur (radar) et comparaison de deux joueurs
- [ ] Vue 5 : matrice des confrontations directes
- [ ] Relier les vues par la sélection de joueurs commune (événement `selectionchange` déjà émis par la vue 1)
- [ ] Publier le site sur GitHub Pages

## Sources et licences

- **Données ATP** : Jeff Sackmann / Tennis Abstract, [github.com/JeffSackmann/tennis_atp](https://github.com/JeffSackmann/tennis_atp), licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Les données ne sont pas redistribuées dans ce dépôt ; les fichiers dérivés de `web/data/` sont publiés sous la même licence.
- **D3.js** v7.9.0, chargé depuis cdnjs.
