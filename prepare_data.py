"""Prépare les données du site à partir des fichiers bruts.

Entrée  : data/raw/ (téléchargé à la main, voir README)
Sortie  : web/data/atp_matches.csv     un match ATP par ligne, 1991-2026, avec les stats de service
          web/data/charting_players.csv  indicateurs de style par joueur et par surface (Match Charting)
          web/data/charting_serve_direction.csv  services par zone, par joueur et par surface
          web/data/charting_net_matches.csv      montées au filet, un joueur dans un match par ligne

Lancer depuis la racine du dépôt :  python prepare_data.py
"""
from pathlib import Path

import pandas as pd

RAW = Path("data/raw")
SACKMANN = RAW / "tennis-sackmann-archive" / "atp"
CHARTING = RAW / "tennis_MatchChartingProject"
OUT = Path("web/data")

FIRST_YEAR = 1991          # pas de statistiques de match avant 1991
SURFACES = ["Hard", "Clay", "Grass"]
MIN_MATCHES = 10           # nombre minimum de matchs notés pour garder un couple joueur x surface

LEVELS = {"G": "Grand Chelem", "M": "Masters 1000", "F": "Masters Cup",
          "A": "ATP 250/500", "D": "Coupe Davis", "O": "Jeux olympiques"}


# ---------------------------------------------------------------------------
# 1. Matchs ATP (archive Sackmann)
# ---------------------------------------------------------------------------

def prepare_atp_matches() -> pd.DataFrame:
    files = sorted(f for f in SACKMANN.glob("atp_matches_[0-9][0-9][0-9][0-9].csv")
                   if int(f.stem[-4:]) >= FIRST_YEAR)
    df = pd.concat((pd.read_csv(f, low_memory=False) for f in files), ignore_index=True)

    # On retire les forfaits (match non joué) et les matchs sans statistiques.
    df = df[~df["score"].astype(str).str.contains("W/O|Walkover|DEF", case=False)]
    df = df.dropna(subset=["w_svpt", "l_svpt"])
    df = df[(df["w_svpt"] > 0) & (df["l_svpt"] > 0)]

    df["date"] = pd.to_datetime(df["tourney_date"].astype(int).astype(str), format="%Y%m%d")
    df["level"] = df["tourney_level"].map(LEVELS)
    df["retired"] = df["score"].str.contains("RET", na=False)

    keep = {
        "date": "date", "tourney_name": "tournament", "level": "level", "surface": "surface",
        "round": "round", "best_of": "best_of", "minutes": "minutes", "score": "score", "retired": "retired",
    }
    for side, prefix in [("winner", "w"), ("loser", "l")]:
        for col in ["name", "rank", "age", "ht", "hand", "ioc"]:
            keep[f"{side}_{col}"] = f"{prefix}_{col}"
    for prefix in ["w", "l"]:
        for col in ["ace", "df", "svpt", "1stIn", "1stWon", "2ndWon", "SvGms", "bpSaved", "bpFaced"]:
            keep[f"{prefix}_{col}"] = f"{prefix}_{col}"

    df = df[list(keep)].rename(columns=keep).sort_values("date")
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    df["w_age"] = df["w_age"].round(1)
    df["l_age"] = df["l_age"].round(1)
    counts = [c for c in df.columns if c[:2] in ("w_", "l_") and df[c].dtype == float and not c.endswith("_age")]
    df[counts + ["minutes"]] = df[counts + ["minutes"]].astype("Int64")   # 6 au lieu de 6.0
    return df


# ---------------------------------------------------------------------------
# 2. Styles de jeu (Match Charting Project, hommes)
# ---------------------------------------------------------------------------

def read_stats(name: str, row: str) -> pd.DataFrame:
    """Une ligne par (match, joueur) pour la ligne `row` d'un fichier charting-m-stats-*."""
    df = pd.read_csv(CHARTING / f"charting-m-stats-{name}.csv")
    key = "set" if name == "Overview" else "row"
    df = df[df[key] == row].drop(columns=key)
    return df.drop_duplicates(["match_id", "player"])  # quelques matchs sont saisis deux fois


def prepare_charting_players() -> pd.DataFrame:
    matches = pd.read_csv(CHARTING / "charting-m-matches.csv", encoding_errors="replace", low_memory=False)
    matches = matches[matches["Surface"].isin(SURFACES)][["match_id", "Surface"]].drop_duplicates("match_id")

    # Totaux par match et par joueur, dans les fichiers de stats déjà agrégés.
    ov = read_stats("Overview", "Total")
    net = read_stats("NetPoints", "NetPoints")[["match_id", "player", "net_pts", "pts_won"]] \
        .rename(columns={"pts_won": "net_won"})
    shots = read_stats("ShotTypes", "Total")[["match_id", "player", "shots"]]
    fh = read_stats("ShotTypes", "Fside")[["match_id", "player", "shots"]].rename(columns={"shots": "fh"})
    bh = read_stats("ShotTypes", "Bside")[["match_id", "player", "shots"]].rename(columns={"shots": "bh"})
    sl = read_stats("ShotTypes", "Sl")[["match_id", "player", "shots"]].rename(columns={"shots": "slice"})
    srv = read_stats("ServeBasics", "Total")[["match_id", "player", "pts_won_lte_3_shots"]]
    dep = read_stats("ReturnDepth", "Total")[["match_id", "player", "returnable", "deep"]]

    df = ov.merge(matches, on="match_id")
    for other in [net, shots, fh, bh, sl, srv, dep]:
        df = df.merge(other, on=["match_id", "player"], how="left")
    df = df.fillna({"slice": 0})

    g = df.groupby(["player", "Surface"]).sum(numeric_only=True)
    g["matches"] = df.groupby(["player", "Surface"]).size()
    all_ = df.groupby("player").sum(numeric_only=True)
    all_["matches"] = df.groupby("player").size()
    all_["Surface"] = "All"
    g = pd.concat([g.reset_index(), all_.reset_index()], ignore_index=True)
    g = g[g["matches"] >= MIN_MATCHES]

    pts = g["serve_pts"] + g["return_pts"]
    out = pd.DataFrame({
        "player": g["player"],
        "surface": g["Surface"],
        "matches": g["matches"],
        "points": pts,
        # Service et retour
        "serve_won": (g["first_won"] + g["second_won"]) / g["serve_pts"],
        "first_in": g["first_in"] / g["serve_pts"],
        "ace_rate": g["aces"] / g["serve_pts"],
        "df_rate": g["dfs"] / g["serve_pts"],
        "short_serve_won": g["pts_won_lte_3_shots"] / g["serve_pts"],
        "return_won": g["return_pts_won"] / g["return_pts"],
        "deep_return": g["deep"] / g["returnable"],          # « deep » inclut « very_deep »
        # Style
        "winners_per_pt": g["winners"] / pts,
        "unforced_per_pt": g["unforced"] / pts,
        "net_rate": g["net_pts"] / pts,
        "net_won": g["net_won"] / g["net_pts"],
        "forehand_share": g["fh"] / (g["fh"] + g["bh"]),
        "slice_share": g["slice"] / g["shots"],
    })
    return out.round(4).sort_values(["player", "surface"])


# ---------------------------------------------------------------------------
# 3. Direction du service (Match Charting Project, hommes)
# ---------------------------------------------------------------------------

SERVE_ZONES = ["deuce_wide", "deuce_middle", "deuce_t", "ad_wide", "ad_middle", "ad_t"]


def read_charting_matches() -> pd.DataFrame:
    """match_id, surface et année de chaque match noté (surfaces dur / terre / gazon)."""
    m = pd.read_csv(CHARTING / "charting-m-matches.csv", encoding_errors="replace", low_memory=False)
    m = m[m["Surface"].isin(SURFACES)][["match_id", "Surface"]].drop_duplicates("match_id")
    m["year"] = m["match_id"].str[:4].astype(int)   # le match_id commence par la date AAAAMMJJ
    return m.rename(columns={"Surface": "surface"})


def prepare_serve_direction() -> pd.DataFrame:
    """Comptes bruts de services par zone, par joueur et par surface (+ « All »).

    On garde des comptes et non des pourcentages : le site additionne puis divise,
    ce qui reste juste quand on regroupe des surfaces.
    """
    sd = read_stats("ServeDirection", "Total")[["match_id", "player"] + SERVE_ZONES]  # 1re + 2e balle
    sd = sd.merge(read_charting_matches(), on="match_id")

    by_surface = sd.groupby(["player", "surface"])
    g = by_surface[SERVE_ZONES].sum()
    g["matches"] = by_surface.size()
    all_ = sd.groupby("player")[SERVE_ZONES].sum()
    all_["matches"] = sd.groupby("player").size()
    all_["surface"] = "All"
    g = pd.concat([g.reset_index(), all_.reset_index()], ignore_index=True)
    # Seuil plus bas que MIN_MATCHES : le site hachure lui-même les cases sous 20 matchs.
    g = g[g["matches"] >= 5]
    return g[["player", "surface", "matches"] + SERVE_ZONES].sort_values(["player", "surface"])


# ---------------------------------------------------------------------------
# 4. Montées au filet, un joueur dans un match par ligne (Match Charting Project)
# ---------------------------------------------------------------------------

MIN_POINTS = 40            # matchs trop courts (abandons) ou notés en partie seulement


def prepare_net_matches() -> pd.DataFrame:
    net = read_stats("NetPoints", "NetPoints")[["match_id", "player", "net_pts", "pts_won"]] \
        .rename(columns={"pts_won": "net_won"})
    ov = read_stats("Overview", "Total")[["match_id", "player", "serve_pts", "return_pts"]]
    df = net.merge(ov, on=["match_id", "player"]).merge(read_charting_matches(), on="match_id")
    df["points"] = df["serve_pts"] + df["return_pts"]
    df = df[(df["points"] >= MIN_POINTS) & (df["year"] >= 1980)]
    return df[["player", "year", "surface", "points", "net_pts", "net_won"]].sort_values(["year", "player"])


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build in [("atp_matches", prepare_atp_matches),
                        ("charting_players", prepare_charting_players),
                        ("charting_serve_direction", prepare_serve_direction),
                        ("charting_net_matches", prepare_net_matches)]:
        df = build()
        path = OUT / f"{name}.csv"
        df.to_csv(path, index=False)
        print(f"{path} : {len(df):,} lignes, {path.stat().st_size / 1e6:.1f} Mo")
