"""Indicateurs « meilleur joueur » calculés à partir des matchs et des classements.

Chaque fonction prend un DataFrame produit par src/load.py et renvoie un
DataFrame avec une ligne par joueur (ou par paire de joueurs).
"""
from __future__ import annotations

import pandas as pd

STAT_COLS = ["ace", "df", "svpt", "1stIn", "1stWon", "2ndWon", "SvGms", "bpSaved", "bpFaced"]


def played(matches: pd.DataFrame) -> pd.DataFrame:
    """Retire les forfaits (score « W/O ») : le match n'a pas été joué.
    Les abandons en cours de match (« RET ») sont conservés."""
    score = matches["score"].fillna("").astype(str)
    return matches[~score.str.contains("W/O", regex=False)]


def titles(matches: pd.DataFrame) -> pd.DataFrame:
    """Nombre de titres par joueur et par niveau de tournoi (vainqueur de la finale).

    Colonnes : player_id, name, une colonne par code de tourney_level, total.
    La Coupe Davis (D) est exclue : ce n'est pas un titre individuel.
    """
    finals = matches[(matches["round"] == "F") & (matches["tourney_level"] != "D")]
    t = (finals.groupby(["winner_id", "tourney_level"]).size()
         .unstack(fill_value=0))
    t["total"] = t.sum(axis=1)
    names = finals.drop_duplicates("winner_id").set_index("winner_id")["winner_name"]
    t.insert(0, "name", names.reindex(t.index))
    t.index.name = "player_id"
    return t.reset_index().sort_values("total", ascending=False)


def weeks_at_no1(rankings: pd.DataFrame) -> pd.DataFrame:
    """Semaines passées au n°1, d'après les classements publiés.

    Chaque classement compte jusqu'à la publication suivante (durée en jours / 7),
    ce qui gère les semaines sans publication. Le dernier classement compte 7 jours.
    Écart attendu avec le chiffre officiel ATP : classements incomplets avant 1985
    et gel des classements en 2020 ; à documenter dans le rapport.
    """
    dates = pd.Series(sorted(rankings["ranking_date"].dropna().unique()))
    next_date = dates.shift(-1).fillna(dates.iloc[-1] + pd.Timedelta(days=7))
    span_days = pd.Series((next_date - dates).dt.days.values, index=dates.values)

    no1 = rankings[rankings["rank"] == 1].copy()
    no1["days"] = no1["ranking_date"].map(span_days)
    out = no1.groupby("player")["days"].sum().div(7).round(1).rename("weeks_no1")
    out.index.name = "player_id"
    return out.reset_index().sort_values("weeks_no1", ascending=False)


def win_loss(matches: pd.DataFrame, by: str | None = "surface") -> pd.DataFrame:
    """Victoires, défaites et % de victoires par joueur (et par `by` si fourni :
    'surface', 'tourney_level', 'year'…). Forfaits exclus."""
    m = played(matches)
    keys_w = ["winner_id"] + ([by] if by else [])
    keys_l = ["loser_id"] + ([by] if by else [])
    w = m.groupby(keys_w).size().rename("wins")
    l = m.groupby(keys_l).size().rename("losses")
    w.index = w.index.set_names(["player_id"] + ([by] if by else []))
    l.index = l.index.set_names(w.index.names)
    df = pd.concat([w, l], axis=1).fillna(0).astype(int)
    df["matches"] = df["wins"] + df["losses"]
    df["win_pct"] = df["wins"] / df["matches"]
    return df.reset_index()


def head_to_head(matches: pd.DataFrame, player_ids: list[int]) -> pd.DataFrame:
    """Bilan des confrontations directes entre les joueurs listés.

    Une ligne par paire ordonnée (player_id, opponent_id) avec wins, losses, win_pct.
    """
    m = played(matches)
    m = m[m["winner_id"].isin(player_ids) & m["loser_id"].isin(player_ids)]
    w = m.groupby(["winner_id", "loser_id"]).size()
    w.index = w.index.set_names(["player_id", "opponent_id"])
    l = w.copy()
    l.index = l.index.set_names(["opponent_id", "player_id"])
    l = l.reorder_levels(["player_id", "opponent_id"])
    df = pd.concat([w.rename("wins"), l.rename("losses")], axis=1).fillna(0).astype(int)
    df["matches"] = df["wins"] + df["losses"]
    df["win_pct"] = df["wins"] / df["matches"]
    return df.reset_index()


def serve_return_stats(matches: pd.DataFrame, min_matches: int = 20) -> pd.DataFrame:
    """Statistiques de service et de retour agrégées par joueur, sur les matchs
    qui en ont (circuit principal, à partir de 1991 environ).

    Pourcentages : 1st_in, 1st_won, 2nd_won, serve_pts_won, return_pts_won,
    bp_saved ; plus aces et doubles fautes par point de service.
    Les joueurs avec moins de `min_matches` matchs renseignés sont exclus.
    """
    m = played(matches).dropna(subset=["w_svpt", "l_svpt"])
    m = m[(m["w_svpt"] > 0) & (m["l_svpt"] > 0)]

    def side(me: str, opp: str, id_col: str) -> pd.DataFrame:
        d = m[[id_col] + [f"{me}_{c}" for c in STAT_COLS] + [f"{opp}_svpt", f"{opp}_1stWon", f"{opp}_2ndWon"]].copy()
        d.columns = ["player_id"] + STAT_COLS + ["opp_svpt", "opp_1stWon", "opp_2ndWon"]
        return d

    d = pd.concat([side("w", "l", "winner_id"), side("l", "w", "loser_id")], ignore_index=True)
    g = d.groupby("player_id")
    s = g.sum()
    s["n_matches"] = g.size()
    s = s[s["n_matches"] >= min_matches]

    out = pd.DataFrame(index=s.index)
    out["n_matches"] = s["n_matches"]
    out["first_in"] = s["1stIn"] / s["svpt"]
    out["first_won"] = s["1stWon"] / s["1stIn"]
    out["second_won"] = s["2ndWon"] / (s["svpt"] - s["1stIn"])
    out["serve_pts_won"] = (s["1stWon"] + s["2ndWon"]) / s["svpt"]
    out["return_pts_won"] = 1 - (s["opp_1stWon"] + s["opp_2ndWon"]) / s["opp_svpt"]
    out["bp_saved"] = s["bpSaved"] / s["bpFaced"]
    out["ace_rate"] = s["ace"] / s["svpt"]
    out["df_rate"] = s["df"] / s["svpt"]
    # Indice de domination : % de points de retour gagnés / % de points de service perdus
    out["dominance"] = out["return_pts_won"] / (1 - out["serve_pts_won"])
    return out.reset_index()
