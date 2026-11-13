"""Prépare les données du site à partir des fichiers bruts.

Entrée : data/raw/ (téléchargé à la main, voir README)
Sortie : web/data/, trois sources, une même règle (voir README, « Règles communes ») :

  atp_matches.csv              archive ATP : un match par ligne, stats de service du vainqueur (w_) et du perdant (l_)
  charting_matches.csv         Match Charting : un match noté par ligne
  charting_points.csv          Match Charting : un point par ligne, codes de frappe bruts
  charting_<stat>.csv          Match Charting : les 16 tableaux de stats, une ligne par match, joueur et ligne du tableau
  slam_matches.csv             point par point des Grands Chelems : un match par ligne
  slam_points.csv              point par point des Grands Chelems : un point par ligne (vitesse, échange, distance...)

Lancer depuis la racine du dépôt :  python prepare_data.py
"""
import re
from pathlib import Path

import pandas as pd

RAW = Path("data/raw")
SACKMANN = RAW / "tennis-sackmann-archive" / "atp"
SLAM = RAW / "tennis-sackmann-archive" / "slam_pointbypoint"
CHARTING = RAW / "tennis_MatchChartingProject"
OUT = Path("web/data")

FIRST_YEAR = 1991          # pas de statistiques de match ATP avant 1991
SURFACES = ["Hard", "Clay", "Grass", "Carpet"]
SLAM_SURFACE = {"ausopen": "Hard", "frenchopen": "Clay", "wimbledon": "Grass", "usopen": "Hard"}
SLAM_NAME = {"ausopen": "Australian Open", "frenchopen": "Roland Garros",
             "wimbledon": "Wimbledon", "usopen": "US Open"}
LEVELS = {"G": "Grand Chelem", "M": "Masters 1000", "F": "Masters Cup",
          "A": "ATP 250/500", "D": "Coupe Davis", "O": "Jeux olympiques"}

SERVE_STATS = ["ace", "df", "svpt", "1stIn", "1stWon", "2ndWon", "SvGms", "bpSaved", "bpFaced"]

# Les 16 tableaux de stats du Match Charting Project, tous gardés en entier.
CHARTING_STATS = ["Overview", "ServeBasics", "ServeDirection", "ServeInfluence", "SvBreakTotal",
                  "SvBreakSplit", "KeyPointsServe", "KeyPointsReturn", "ReturnOutcomes", "ReturnDepth",
                  "Rally", "ShotTypes", "ShotDirection", "ShotDirOutcomes", "NetPoints", "SnV"]


def snake(name: str) -> str:
    """'ServeDirection' -> 'serve_direction', 'won_1+' -> 'won_1plus'."""
    name = name.replace("+", "plus")
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name).lower()


def side(is_winner: pd.Series) -> pd.Series:
    """'w' pour le vainqueur du match, 'l' pour le perdant."""
    return is_winner.map({True: "w", False: "l"})


def to_int(df: pd.DataFrame, cols) -> pd.DataFrame:
    """Entiers avec valeurs manquantes possibles (6 et non 6.0 dans le CSV)."""
    for c in cols:
        df[c] = pd.to_numeric(df[c], errors="coerce").round().astype("Int64")
    return df


def complete(sets_won_by_last_point_winner: pd.Series, best_of: pd.Series) -> pd.Series:
    """Vrai si le gagnant du dernier point avait déjà tous les sets sauf un : match allé au bout."""
    return sets_won_by_last_point_winner == best_of // 2


# ---------------------------------------------------------------------------
# 1. Archive ATP (Sackmann)
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

    # Règle commune : seulement les matchs joués jusqu'au bout.
    score = df["score"].astype(str)
    df = df[~score.str.contains("W/O|Walkover|DEF|RET|unfinished", case=False)]
    df = df.dropna(subset=["w_svpt", "l_svpt", "surface"])
    df = df[(df["w_svpt"] > 0) & (df["l_svpt"] > 0)]
    df = df[coherent(df, "w") & coherent(df, "l")]   # 8 lignes aux stats impossibles

    df["date"] = pd.to_datetime(df["tourney_date"].astype(int).astype(str), format="%Y%m%d")
    df["level"] = df["tourney_level"].map(LEVELS)
    keep = {"tourney_id": "tourney_id", "date": "date", "tourney_name": "tournament", "level": "level",
            "surface": "surface", "round": "round", "best_of": "best_of", "minutes": "minutes",
            "score": "score"}
    for s, p in [("winner", "w"), ("loser", "l")]:
        for col in ["id", "name", "rank", "rank_points", "seed", "entry", "age", "ht", "hand", "ioc"]:
            keep[f"{s}_{col}"] = f"{p}_{col}"
    for p in "wl":
        for col in SERVE_STATS:
            keep[f"{p}_{col}"] = f"{p}_{snake(col)}"

    df = df[list(keep)].rename(columns=keep).sort_values(["date", "tourney_id"]).reset_index(drop=True)
    df.insert(0, "match_id", df.index + 1)
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    df["score"] = df["score"].str.strip()
    df["w_age"] = df["w_age"].round(1)
    df["l_age"] = df["l_age"].round(1)
    ints = [f"{p}_{c}" for p in "wl" for c in ["rank", "rank_points", "seed", "ht"]] + ["minutes"]
    ints += [c for c in df.columns if c[:2] in ("w_", "l_") and c[2:] in map(snake, SERVE_STATS)]
    return to_int(df, ints)


# ---------------------------------------------------------------------------
# 2. Match Charting Project (hommes)
# ---------------------------------------------------------------------------

def prepare_charting() -> dict:
    # Points : on lit tout, une fois.
    pts = pd.concat((pd.read_csv(f, encoding_errors="replace", low_memory=False)
                     for f in sorted(CHARTING.glob("charting-m-points-*.csv"))), ignore_index=True)
    pts = pts.drop_duplicates(["match_id", "Pt"]).sort_values(["match_id", "Pt"])
    last = pts.groupby("match_id").last()

    m = pd.read_csv(CHARTING / "charting-m-matches.csv", encoding_errors="replace", low_memory=False)
    m = m.drop_duplicates("match_id").set_index("match_id")
    m = m[m["Surface"].isin(SURFACES)]     # écarte aussi deux lignes décalées
    m["best_of"] = pd.to_numeric(m["Best of"], errors="coerce")
    m = m[m["best_of"].isin([3, 5])].join(last[["Set1", "Set2", "PtWinner"]], how="inner")

    # Vainqueur = gagnant du dernier point, si le match a été noté jusqu'au bout.
    p1_won = m["PtWinner"] == 1               # Player 1 est celui qui sert le premier point
    sets_last = m["Set1"].where(p1_won, m["Set2"])
    m = m[complete(sets_last, m["best_of"])].copy()
    p1_won = p1_won[m.index]
    m["date"] = pd.to_datetime(m["Date"].astype(str), format="%Y%m%d", errors="coerce")
    m = m.dropna(subset=["date"]).sort_values(["date"]).copy()
    m["id"] = range(1, len(m) + 1)
    p1_won = p1_won[m.index]

    def pick(a, b):
        return m[a].where(p1_won, m[b]).values, m[b].where(p1_won, m[a]).values

    w_name, l_name = pick("Player 1", "Player 2")
    w_hand, l_hand = pick("Pl 1 hand", "Pl 2 hand")
    matches = pd.DataFrame({
        "match_id": m["id"].values,
        "date": m["date"].dt.strftime("%Y-%m-%d").values,
        "tournament": m["Tournament"].values, "round": m["Round"].values,
        "surface": m["Surface"].values, "best_of": m["best_of"].astype(int).values,
        "court": m["Court"].values, "umpire": m["Umpire"].values,
        "w_name": w_name, "l_name": l_name, "w_hand": w_hand, "l_hand": l_hand,
        "first_server": side(p1_won).values,
    })
    ids = m["id"]                              # match_id texte -> entier
    p1_is_w = p1_won                           # indexé par match_id texte
    name_side = pd.concat([
        pd.DataFrame({"match_id": m.index, "player": w_name, "side": "w"}),
        pd.DataFrame({"match_id": m.index, "player": l_name, "side": "l"})])

    # Points, du point de vue vainqueur / perdant.
    pts = pts[pts["match_id"].isin(ids.index)].copy()
    w1 = pts["match_id"].map(p1_is_w)
    points = pd.DataFrame({
        "match_id": pts["match_id"].map(ids).values,
        "pt": pts["Pt"].values,
        "w_sets": pts["Set1"].where(w1, pts["Set2"]).values,
        "l_sets": pts["Set2"].where(w1, pts["Set1"]).values,
        "w_games": pts["Gm1"].where(w1, pts["Gm2"]).values,
        "l_games": pts["Gm2"].where(w1, pts["Gm1"]).values,
        "score": pts["Pts"].values,                  # score du jeu, serveur d'abord
        "tiebreak_set": pts["TbSet"].astype(str).str.lower().isin(["true", "1"]).astype(int).values,
        "server": side((pts["Svr"] == 1) == w1).values,
        "first": pts["1st"].values, "second": pts["2nd"].values,
        "point_winner": side((pts["PtWinner"] == 1) == w1).values,
    })
    points = to_int(points, ["w_sets", "l_sets", "w_games", "l_games"])
    out = {"charting_matches": matches, "charting_points": points.sort_values(["match_id", "pt"])}

    # Tableaux de stats : on garde toutes les lignes et toutes les colonnes.
    for name in CHARTING_STATS:
        s = pd.read_csv(CHARTING / f"charting-m-stats-{name}.csv", encoding_errors="replace")
        s = s[s["match_id"].isin(ids.index)].rename(columns={"set": "row"})
        if name == "Rally":
            # Lignes « 1-3 », « 4-6-1 »... : longueur d'échange, puis éventuellement le serveur
            # (-1 / -2). pl1 est le joueur de la colonne `server`, pl2 celui de `returner`.
            s = s.merge(name_side.rename(columns={"player": "server", "side": "pl1_side"}),
                        on=["match_id", "server"])
            parts = s["row"].astype(str).str.extract(r"^(Total|1-3|4-6|7-9|10)(?:-([12]))?$")
            s["row"] = parts[0]
            s["server"] = parts[1].map({"1": "pl1", "2": "pl1"}).fillna("all")
            s.loc[s["server"] == "pl1", "server"] = s["pl1_side"]   # le serveur est pl1 sur ces lignes
            s = s.drop_duplicates(["match_id", "server", "row"])
            pl1_w = s["pl1_side"] == "w"
            for stat in ["won", "winners", "forced", "unforced"]:
                a, b = s[f"pl1_{stat}"], s[f"pl2_{stat}"]
                s[f"w_{stat}"], s[f"l_{stat}"] = a.where(pl1_w, b), b.where(pl1_w, a)
            s = s[["match_id", "server", "row", "pts"] + [f"{p}_{x}" for p in "wl"
                                                       for x in ["won", "winners", "forced", "unforced"]]]
            key = ["match_id", "server", "row"]
        else:
            s = s.merge(name_side, on=["match_id", "player"]).drop(columns="player") \
                 .rename(columns={"side": "player"})
            s = s.drop_duplicates(["match_id", "player", "row"])   # quelques matchs saisis deux fois
            key = ["match_id", "player", "row"]
        s["match_id"] = s["match_id"].map(ids)
        s = s.rename(columns=snake)
        s = s[key + [c for c in s.columns if c not in key]].sort_values(key)
        values = [c for c in s.columns if c not in key]
        # Seul ServeInfluence donne des pourcentages (« 68.8% ») et non des comptes : on les garde en
        # proportion entre 0 et 1, faute de pouvoir retrouver les comptes.
        pct = [c for c in values if s[c].astype(str).str.endswith("%").any()]
        for c in pct:
            s[c] = (pd.to_numeric(s[c].astype(str).str.rstrip("%"), errors="coerce") / 100).round(3)
        out[f"charting_{snake(name)}"] = to_int(s, [c for c in values if c not in pct])
    return out


# ---------------------------------------------------------------------------
# 3. Point par point des Grands Chelems (archive Sackmann, 2011-2024)
# ---------------------------------------------------------------------------

SLAM_POINT_COLS = {"ElapsedTime": "elapsed", "SetNo": "set_no", "GameNo": "game_no",
                   "PointNumber": "pt", "ServeNumber": "serve_no", "ServeIndicator": "serve_indicator",
                   "Speed_KMH": "speed_kmh", "RallyCount": "rally_count", "Rally": "rally",
                   "ServeWidth": "serve_width", "ServeDepth": "serve_depth", "ReturnDepth": "return_depth",
                   "WinnerShotType": "winner_shot_type", "WinnerType": "winner_type"}
SLAM_SIDE_COLS = {"Ace": "ace", "DoubleFault": "df", "Winner": "winner", "UnfErr": "unforced",
                  "ForcedError": "forced", "NetPoint": "net", "NetPointWon": "net_won",
                  "BreakPoint": "bp", "BreakPointWon": "bp_won", "DistanceRun": "dist_run",
                  "GamesWon": "games", "Score": "score"}


def prepare_slam() -> dict:
    matches, points = [], []
    for mf in sorted(SLAM.glob("*-matches.csv")):
        if mf.stem.count("-") != 2:          # écarte doubles et mixtes
            continue
        pf = mf.with_name(mf.name.replace("-matches", "-points"))
        m = pd.read_csv(mf, encoding_errors="replace")
        m = m[m["match_num"].astype(str).str.match(r"^1\d{3}$")]   # 1xxx = simple messieurs
        p = pd.read_csv(pf, encoding_errors="replace", low_memory=False)
        p = p[p["match_id"].isin(m["match_id"])]
        p = p[pd.to_numeric(p["PointWinner"], errors="coerce").isin([1, 2])]
        p["PointNumber"] = pd.to_numeric(p["PointNumber"], errors="coerce")
        p = p.dropna(subset=["PointNumber"]).sort_values(["match_id", "PointNumber"])
        m["file"] = mf.stem.replace("-matches", "")
        matches.append(m)
        points.append(p)
    m = pd.concat(matches, ignore_index=True)
    p = pd.concat(points, ignore_index=True)

    # Vainqueur = joueur qui a gagné 3 sets (SetWinner vaut 1 ou 2 au point qui termine un set).
    sets = p[pd.to_numeric(p["SetWinner"], errors="coerce").isin([1, 2])] \
        .groupby(["match_id", "SetWinner"]).size().unstack(fill_value=0)
    sets.columns = [int(c) for c in sets.columns]
    m = m.set_index("match_id").join(sets, how="inner")
    m = m[(m[1] == 3) ^ (m[2] == 3)].copy()      # matchs allés au bout
    p1_won = m[1] == 3
    m["slam_key"] = m["slam"]
    m = m.sort_values(["year", "slam_key", "match_num"])
    m["id"] = range(1, len(m) + 1)
    p1_won = p1_won[m.index]

    def pick(a, b):
        return m[a].where(p1_won, m[b]).values, m[b].where(p1_won, m[a]).values

    w_name, l_name = pick("player1", "player2")
    w_ioc, l_ioc = pick("nation1", "nation2")
    slam_matches = pd.DataFrame({
        "match_id": m["id"].values, "year": m["year"].values,
        "tournament": m["slam"].map(SLAM_NAME).values, "surface": m["slam"].map(SLAM_SURFACE).values,
        "round": m["round"].values, "match_num": m["match_num"].values, "court": m["court_name"].values,
        "w_name": w_name, "l_name": l_name, "w_ioc": w_ioc, "l_ioc": l_ioc,
    })

    p = p[p["match_id"].isin(m.index)].copy()
    w1 = p["match_id"].map(p1_won)
    out = pd.DataFrame({"match_id": p["match_id"].map(m["id"]).values})
    for raw, new in SLAM_POINT_COLS.items():
        out[new] = p[raw].values if raw in p.columns else pd.NA
    out["server"] = side((pd.to_numeric(p["PointServer"]) == 1) == w1).values
    out["point_winner"] = side((pd.to_numeric(p["PointWinner"]) == 1) == w1).values
    for raw, new in SLAM_SIDE_COLS.items():
        a, b = p.get(f"P1{raw}"), p.get(f"P2{raw}")
        if a is None:
            out[f"w_{new}"] = out[f"l_{new}"] = pd.NA
            continue
        out[f"w_{new}"] = a.where(w1, b).values
        out[f"l_{new}"] = b.where(w1, a).values
    # Longueur d'échange : « Rally » dans les premiers fichiers, « RallyCount » ensuite.
    out["rally_count"] = pd.to_numeric(out["rally_count"], errors="coerce") \
        .fillna(pd.to_numeric(out.pop("rally"), errors="coerce"))
    out["serve_no"] = out.pop("serve_indicator")      # 1re ou 2e balle, renseigné partout
    out = out.drop(columns=["winner_type"])            # rempli à 1 % seulement
    out["speed_kmh"] = pd.to_numeric(out["speed_kmh"], errors="coerce").replace(0, pd.NA)  # 0 = non mesuré
    for c in ["serve_width", "serve_depth", "return_depth", "winner_shot_type"]:
        out[c] = out[c].replace({"0": pd.NA, 0: pd.NA})
    for c in ["w_dist_run", "l_dist_run"]:
        out[c] = pd.to_numeric(out[c], errors="coerce").round(1).replace(0, pd.NA)
    out = out.drop(columns=[c for c in out.columns if out[c].isna().all()])
    ints = [c for c in out.columns if c in ("pt", "set_no", "game_no", "serve_no", "speed_kmh", "rally_count")
            or (c[:2] in ("w_", "l_") and c[2:] in ("ace", "df", "winner", "unforced", "forced", "net",
                                                     "net_won", "bp", "bp_won", "games"))]
    out = to_int(out, ints)
    return {"slam_matches": slam_matches, "slam_points": out.sort_values(["match_id", "pt"])}


# ---------------------------------------------------------------------------

GZIP = {"charting_points", "slam_points"}   # fichiers point par point, compressés (voir README)


def save(df: pd.DataFrame, name: str) -> None:
    path = OUT / (f"{name}.csv.gz" if name in GZIP else f"{name}.csv")
    df.to_csv(path, index=False, compression={"method": "gzip", "mtime": 0} if name in GZIP else None)
    print(f"{path} : {len(df):,} lignes, {path.stat().st_size / 1e6:.1f} Mo")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for old in list(OUT.glob("*.csv")) + list(OUT.glob("*.csv.gz")):   # repart de zéro
        old.unlink()
    save(prepare_atp_matches(), "atp_matches")
    for build in (prepare_charting, prepare_slam):
        for name, df in build().items():
            save(df, name)
