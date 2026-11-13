"""Prépare les données du site à partir des fichiers bruts.

Entrée  : data/raw/ (téléchargé à la main, voir README)
Sortie  : web/data/atp_matches.csv       un match ATP par ligne, 1991-2026, avec les stats de service
          web/data/charting_matches.csv  un joueur par match noté (Match Charting), vainqueur ou perdant
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

SERVE_STATS = ["ace", "df", "svpt", "1stIn", "1stWon", "2ndWon", "SvGms", "bpSaved", "bpFaced"]


# ---------------------------------------------------------------------------
# 1. Matchs ATP (archive Sackmann)
# ---------------------------------------------------------------------------

def coherent(df: pd.DataFrame, p: str) -> pd.Series:
    """Vrai si les statistiques de service du joueur `p` ('w' ou 'l') sont cohérentes entre elles."""
    return ((df[f"{p}_1stIn"] <= df[f"{p}_svpt"])
            & (df[f"{p}_1stWon"] <= df[f"{p}_1stIn"])
            & (df[f"{p}_2ndWon"] <= df[f"{p}_svpt"] - df[f"{p}_1stIn"] - df[f"{p}_df"])
            & (df[f"{p}_bpSaved"] <= df[f"{p}_bpFaced"]))


def prepare_atp_matches() -> pd.DataFrame:
    files = sorted(f for f in SACKMANN.glob("atp_matches_[0-9][0-9][0-9][0-9].csv")
                   if int(f.stem[-4:]) >= FIRST_YEAR)
    df = pd.concat((pd.read_csv(f, low_memory=False) for f in files), ignore_index=True)

    # Matchs non joués jusqu'au bout sans vainqueur sportif : forfaits (W/O), disqualifications (DEF)
    # et matchs interrompus (« Played and unfinished »). Les abandons (RET) sont gardés et signalés.
    score = df["score"].astype(str)
    df = df[~score.str.contains("W/O|Walkover|DEF|unfinished", case=False)]
    # Matchs sans statistiques (surtout la Coupe Davis avant les années 2010) ou sans surface.
    df = df.dropna(subset=["w_svpt", "l_svpt", "surface"])
    df = df[(df["w_svpt"] > 0) & (df["l_svpt"] > 0)]
    # Quelques lignes ont des statistiques impossibles (plus de premières balles que de points, etc.).
    df = df[coherent(df, "w") & coherent(df, "l")]

    df["date"] = pd.to_datetime(df["tourney_date"].astype(int).astype(str), format="%Y%m%d")
    df["level"] = df["tourney_level"].map(LEVELS)
    df["retired"] = df["score"].str.contains("RET", na=False)

    keep = {
        "tourney_id": "tourney_id", "date": "date", "tourney_name": "tournament", "level": "level",
        "surface": "surface", "round": "round", "best_of": "best_of", "minutes": "minutes",
        "score": "score", "retired": "retired",
    }
    for side, prefix in [("winner", "w"), ("loser", "l")]:
        for col in ["id", "name", "rank", "age", "ht", "hand", "ioc"]:
            keep[f"{side}_{col}"] = f"{prefix}_{col}"
    for prefix in ["w", "l"]:
        for col in SERVE_STATS:
            keep[f"{prefix}_{col}"] = f"{prefix}_{col}"

    df = df[list(keep)].rename(columns=keep).sort_values(["date", "tourney_id"])
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    df["score"] = df["score"].str.strip()
    df["w_age"] = df["w_age"].round(1)
    df["l_age"] = df["l_age"].round(1)
    ints = [f"{p}_{c}" for p in "wl" for c in ["rank", "ht"] + SERVE_STATS] + ["minutes"]
    df[ints] = df[ints].astype("Int64")   # 6 au lieu de 6.0
    return df


# ---------------------------------------------------------------------------
# 2. Match Charting Project (hommes)
# ---------------------------------------------------------------------------

def read_stats(name: str, row: str) -> pd.DataFrame:
    """Une ligne par (match, joueur) pour la ligne `row` d'un fichier charting-m-stats-*."""
    df = pd.read_csv(CHARTING / f"charting-m-stats-{name}.csv")
    key = "set" if name == "Overview" else "row"
    df = df[df[key].astype(str) == row].drop(columns=key)
    return df.drop_duplicates(["match_id", "player"])  # quelques matchs sont saisis deux fois


def charting_results() -> pd.DataFrame:
    """Vainqueur de chaque match noté, déduit du dernier point du fichier point par point.

    Le fichier des matchs ne donne pas le vainqueur. On garde seulement les matchs notés jusqu'au
    bout : au dernier point, son gagnant avait déjà un set de moins que le nombre de sets à gagner.
    Cela écarte les abandons et les matchs notés en partie (environ 1 %).
    """
    pts = pd.concat((pd.read_csv(f, usecols=["match_id", "Pt", "Set1", "Set2", "PtWinner"])
                     for f in sorted(CHARTING.glob("charting-m-points-*.csv"))), ignore_index=True)
    last = pts.sort_values(["match_id", "Pt"]).groupby("match_id").last()

    m = pd.read_csv(CHARTING / "charting-m-matches.csv", encoding_errors="replace", low_memory=False)
    m = m.drop_duplicates("match_id").set_index("match_id")
    m = m[m["Surface"].isin(SURFACES)]       # retire aussi deux lignes décalées (colonnes mal remplies)
    m["best_of"] = pd.to_numeric(m["Best of"], errors="coerce")
    m = m[m["best_of"].isin([3, 5])].join(last, how="inner")

    to_win = m["best_of"] // 2 + 1
    p1 = m["PtWinner"] == 1
    complete = (p1 & (m["Set1"] == to_win - 1)) | (~p1 & (m["Set2"] == to_win - 1))
    m = m[complete]
    m["winner"] = m["Player 1"].where(p1, m["Player 2"])   # Player 1 est celui qui sert en premier

    return pd.DataFrame({
        "match_id": m.index.values,
        "date": pd.to_datetime(m["Date"].astype(str), format="%Y%m%d", errors="coerce").dt.strftime("%Y-%m-%d").values,
        "tournament": m["Tournament"].values,
        "round": m["Round"].values,
        "surface": m["Surface"].values,
        "best_of": m["best_of"].astype(int).values,
        "winner": m["winner"].values,
    })


def prepare_charting_matches() -> pd.DataFrame:
    """Un joueur par match noté, avec ses totaux et une colonne `won` (1 vainqueur, 0 perdant)."""
    ov = read_stats("Overview", "Total")[["match_id", "player", "serve_pts", "aces", "dfs", "first_in",
                                          "first_won", "second_won", "bk_pts", "bp_saved", "return_pts",
                                          "return_pts_won", "winners", "unforced"]]
    net = read_stats("NetPoints", "NetPoints")[["match_id", "player", "net_pts", "pts_won"]] \
        .rename(columns={"pts_won": "net_won"})
    shots = read_stats("ShotTypes", "Total")[["match_id", "player", "shots"]]
    fh = read_stats("ShotTypes", "Fside")[["match_id", "player", "shots"]].rename(columns={"shots": "fh"})
    bh = read_stats("ShotTypes", "Bside")[["match_id", "player", "shots"]].rename(columns={"shots": "bh"})
    sl = read_stats("ShotTypes", "Sl")[["match_id", "player", "shots"]].rename(columns={"shots": "slice"})
    srv = read_stats("ServeBasics", "Total")[["match_id", "player", "pts_won_lte_3_shots"]] \
        .rename(columns={"pts_won_lte_3_shots": "short_serve_won"})
    dep = read_stats("ReturnDepth", "Total")[["match_id", "player", "returnable", "deep"]]

    res = charting_results()
    df = res.merge(ov, on="match_id")
    for other in [net, shots, fh, bh, sl, srv, dep]:
        df = df.merge(other, on=["match_id", "player"], how="left")
    # Un match n'est utile que si les deux joueurs y sont, et que l'un d'eux est le vainqueur.
    df["won"] = (df["player"] == df["winner"]).astype(int)
    by_match = df.groupby("match_id")["won"]
    df = df[(by_match.transform("size") == 2) & (by_match.transform("sum") == 1)]
    df["opponent"] = df.groupby("match_id")["player"].transform(lambda s: s.iloc[::-1].values)
    df = df.fillna({"net_pts": 0, "net_won": 0, "slice": 0})
    counts = [c for c in df.columns if df[c].dtype.kind == "f"]
    df[counts] = df[counts].astype("Int64")
    first = ["match_id", "date", "tournament", "round", "surface", "best_of", "player", "opponent", "won"]
    return df[first + [c for c in df.columns if c not in first + ["winner"]]] \
        .sort_values(["date", "match_id", "won"], ascending=[True, True, False])


def prepare_charting_players(matches: pd.DataFrame) -> pd.DataFrame:
    df = matches.drop(columns=["won", "best_of"])
    g = df.groupby(["player", "surface"]).sum(numeric_only=True)
    g["matches"] = df.groupby(["player", "surface"]).size()
    all_ = df.groupby("player").sum(numeric_only=True)
    all_["matches"] = df.groupby("player").size()
    all_["surface"] = "All"
    g = pd.concat([g.reset_index(), all_.reset_index()], ignore_index=True)
    g = g[g["matches"] >= MIN_MATCHES].astype({c: float for c in g.columns if c not in ("player", "surface")})

    pts = g["serve_pts"] + g["return_pts"]
    out = pd.DataFrame({
        "player": g["player"],
        "surface": g["surface"],
        "matches": g["matches"].astype(int),
        "points": pts.astype(int),
        # Service et retour
        "serve_won": (g["first_won"] + g["second_won"]) / g["serve_pts"],
        "first_in": g["first_in"] / g["serve_pts"],
        "ace_rate": g["aces"] / g["serve_pts"],
        "df_rate": g["dfs"] / g["serve_pts"],
        "short_serve_won": g["short_serve_won"] / g["serve_pts"],
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


def save(df: pd.DataFrame, name: str) -> None:
    path = OUT / f"{name}.csv"
    df.to_csv(path, index=False)
    print(f"{path} : {len(df):,} lignes, {path.stat().st_size / 1e6:.1f} Mo")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    save(prepare_atp_matches(), "atp_matches")
    charting = prepare_charting_matches()
    save(charting, "charting_matches")
    save(prepare_charting_players(charting), "charting_players")
    save(prepare_serve_direction(), "charting_serve_direction")
    save(prepare_net_matches(), "charting_net_matches")
