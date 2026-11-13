"""Classement Elo recalculé match par match.

Méthode (à documenter dans le rapport) :
- tout joueur commence à 1500 ;
- probabilité de victoire attendue : 1 / (1 + 10 ** ((Rb - Ra) / 400)) ;
- facteur K dégressif avec l'expérience, K = 250 / (n + 5) ** 0.4,
  où n est le nombre de matchs déjà joués (formule popularisée par FiveThirtyEight) :
  les nouveaux joueurs convergent vite, les classements établis bougent moins ;
- les Grands Chelems peuvent recevoir un K majoré (`slam_boost`) ;
- version par surface : on recalcule l'Elo en ne gardant que les matchs de la surface.
"""
from __future__ import annotations

import pandas as pd

from .indicators import played

START = 1500.0


def k_factor(n_matches: int) -> float:
    return 250.0 / (n_matches + 5) ** 0.4


def compute_elo(matches: pd.DataFrame, surface: str | None = None,
                slam_boost: float = 1.0) -> pd.DataFrame:
    """Calcule l'Elo après chaque match.

    Renvoie l'historique : une ligne par joueur et par match, colonnes
    date, player_id, elo (après le match), n_matches.
    """
    m = played(matches)
    if surface is not None:
        m = m[m["surface"] == surface]
    sort_cols = ["tourney_date", "tourney_id", "round_order", "match_num"]
    m = m.sort_values([c for c in sort_cols if c in m.columns], kind="stable")

    rating: dict[int, float] = {}
    count: dict[int, int] = {}
    rows = []
    for date, w, l, level in zip(m["tourney_date"], m["winner_id"], m["loser_id"], m["tourney_level"]):
        rw, rl = rating.get(w, START), rating.get(l, START)
        expected_w = 1.0 / (1.0 + 10 ** ((rl - rw) / 400.0))
        boost = slam_boost if level == "G" else 1.0
        kw = k_factor(count.get(w, 0)) * boost
        kl = k_factor(count.get(l, 0)) * boost
        rating[w] = rw + kw * (1.0 - expected_w)
        rating[l] = rl - kl * (1.0 - expected_w)
        count[w] = count.get(w, 0) + 1
        count[l] = count.get(l, 0) + 1
        rows.append((date, w, rating[w], count[w]))
        rows.append((date, l, rating[l], count[l]))

    return pd.DataFrame(rows, columns=["date", "player_id", "elo", "n_matches"])


def peak_and_longevity(history: pd.DataFrame, threshold: float = 2200.0,
                       min_matches: int = 30) -> pd.DataFrame:
    """Résume l'historique Elo par joueur.

    - peak_elo : Elo maximal atteint (après `min_matches` matchs, pour éviter
      les pics artificiels de début de carrière) et sa date ;
    - years_above : nombre d'années civiles où l'Elo de fin d'année dépasse `threshold`.
    Le seuil 2200 est un point de départ, à calibrer sur les données.
    """
    h = history[history["n_matches"] >= min_matches]
    idx = h.groupby("player_id")["elo"].idxmax()
    peak = h.loc[idx, ["player_id", "elo", "date"]].rename(columns={"elo": "peak_elo", "date": "peak_date"})

    year_end = (h.assign(year=h["date"].dt.year)
                .groupby(["player_id", "year"])["elo"].last())
    years_above = (year_end >= threshold).groupby("player_id").sum().rename("years_above")
    return peak.set_index("player_id").join(years_above).reset_index()
