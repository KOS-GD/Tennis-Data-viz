"""Tests sur de petites données inventées : ils vérifient les calculs
sans avoir besoin de télécharger la base. Lancer avec `pytest` depuis la racine."""
import pandas as pd
import pytest

from src.elo import compute_elo, peak_and_longevity
from src.indicators import head_to_head, serve_return_stats, titles, weeks_at_no1, win_loss


def match(date, tid, rnd, level, surface, w, l, score="6-4 6-4", stats=None):
    row = {
        "tourney_id": tid, "tourney_date": pd.Timestamp(date), "tourney_level": level,
        "surface": surface, "round": rnd, "round_order": {"SF": 16, "F": 18}.get(rnd, 13),
        "match_num": 1, "winner_id": w, "loser_id": l,
        "winner_name": f"P{w}", "loser_name": f"P{l}", "score": score,
    }
    if stats:
        row.update(stats)
    return row


@pytest.fixture
def matches():
    return pd.DataFrame([
        match("2020-01-01", "t1", "SF", "G", "Hard", 1, 3),
        match("2020-01-01", "t1", "F", "G", "Hard", 1, 2),
        match("2020-02-01", "t2", "F", "M", "Clay", 2, 1),
        match("2020-03-01", "t3", "F", "A", "Clay", 1, 2),
        match("2020-04-01", "t4", "F", "D", "Hard", 3, 1),        # Coupe Davis : pas un titre
        match("2020-05-01", "t5", "SF", "A", "Grass", 2, 3, "W/O"),  # forfait : ignoré
    ])


def test_titles(matches):
    t = titles(matches).set_index("player_id")
    assert t.loc[1, "total"] == 2 and t.loc[1, "G"] == 1 and t.loc[1, "A"] == 1
    assert t.loc[2, "total"] == 1 and t.loc[2, "M"] == 1
    assert 3 not in t.index


def test_win_loss(matches):
    wl = win_loss(matches, by=None).set_index("player_id")
    assert (wl.loc[1, "wins"], wl.loc[1, "losses"]) == (3, 2)
    assert (wl.loc[2, "wins"], wl.loc[2, "losses"]) == (1, 2)   # le forfait ne compte pas
    by_surface = win_loss(matches).set_index(["player_id", "surface"])
    assert by_surface.loc[(1, "Clay"), "win_pct"] == 0.5


def test_head_to_head(matches):
    h = head_to_head(matches, [1, 2]).set_index(["player_id", "opponent_id"])
    assert (h.loc[(1, 2), "wins"], h.loc[(1, 2), "losses"]) == (2, 1)
    assert (h.loc[(2, 1), "wins"], h.loc[(2, 1), "losses"]) == (1, 2)


def test_weeks_at_no1():
    r = pd.DataFrame({
        "ranking_date": pd.to_datetime(["2020-01-06", "2020-01-13", "2020-01-27"] * 2),
        "rank": [1, 1, 2, 2, 2, 1],
        "player": [1, 1, 1, 2, 2, 2],
    })
    w = weeks_at_no1(r).set_index("player_id")["weeks_no1"]
    assert w[1] == 3.0   # 7 jours + 14 jours (pas de classement le 20/01)
    assert w[2] == 1.0   # dernier classement : 7 jours


def test_elo_winner_gains():
    df = pd.DataFrame([match("2020-01-01", "t1", "F", "G", "Hard", 1, 2)])
    h = compute_elo(df).set_index("player_id")["elo"]
    assert h[1] > 1500 > h[2]
    assert h[1] - 1500 == pytest.approx(1500 - h[2])


def test_peak_requires_min_matches():
    df = pd.DataFrame([match(f"2020-01-{d:02d}", f"t{d}", "F", "A", "Hard", 1, 2) for d in range(1, 11)])
    h = compute_elo(df)
    assert peak_and_longevity(h, min_matches=30).empty
    p = peak_and_longevity(h, min_matches=5).set_index("player_id")
    assert p.loc[1, "peak_elo"] > 1500


def test_serve_return_stats():
    s = {"w_ace": 5, "w_df": 1, "w_svpt": 60, "w_1stIn": 40, "w_1stWon": 30, "w_2ndWon": 10,
         "w_SvGms": 10, "w_bpSaved": 2, "w_bpFaced": 3,
         "l_ace": 2, "l_df": 3, "l_svpt": 70, "l_1stIn": 35, "l_1stWon": 20, "l_2ndWon": 15,
         "l_SvGms": 10, "l_bpSaved": 4, "l_bpFaced": 8}
    df = pd.DataFrame([match("2020-01-01", "t1", "F", "A", "Hard", 1, 2, stats=s)])
    out = serve_return_stats(df, min_matches=1).set_index("player_id")
    assert out.loc[1, "serve_pts_won"] == pytest.approx(40 / 60)
    assert out.loc[1, "return_pts_won"] == pytest.approx(1 - 35 / 70)
    assert out.loc[2, "bp_saved"] == pytest.approx(4 / 8)
