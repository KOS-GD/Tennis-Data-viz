"""Chargement des fichiers bruts de la base ATP (Jeff Sackmann).

Toutes les fonctions lisent data/raw/tennis_atp/ par défaut ; lancez
`bash scripts/download_data.sh` avant la première utilisation.
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_ATP = ROOT / "data" / "raw" / "tennis_atp"

# Codes de la colonne tourney_level (à confirmer dans matches_data_dictionary.txt)
LEVELS = {
    "G": "Grand Chelem",
    "M": "Masters 1000",
    "F": "Masters Cup (finale de saison)",
    "A": "Autres tournois ATP",
    "D": "Coupe Davis",
    "O": "Jeux olympiques",
}

# Ordre des tours dans un tournoi, pour trier les matchs chronologiquement
ROUND_ORDER = {
    "Q1": 0, "Q2": 1, "Q3": 2, "Q4": 3,
    "R128": 10, "R64": 11, "R32": 12, "R16": 13,
    "RR": 14, "ER": 14, "QF": 15, "SF": 16, "BR": 17, "F": 18,
}


def _check_dir(raw_dir: Path) -> Path:
    raw_dir = Path(raw_dir)
    if not raw_dir.exists():
        raise FileNotFoundError(
            f"{raw_dir} introuvable : lancez d'abord `bash scripts/download_data.sh`."
        )
    return raw_dir


def _to_date(col: pd.Series) -> pd.Series:
    """Les dates sont stockées en entier AAAAMMJJ."""
    return pd.to_datetime(col.astype("Int64").astype(str), format="%Y%m%d", errors="coerce")


def load_matches(raw_dir: Path = RAW_ATP, years: range | None = None) -> pd.DataFrame:
    """Matchs du circuit principal (un fichier par saison : atp_matches_AAAA.csv).

    Le motif de fichier exclut les qualifications/Challengers, les Futures et le double.
    Ajoute les colonnes `year` et `round_order`.
    """
    raw_dir = _check_dir(raw_dir)
    files = sorted(raw_dir.glob("atp_matches_[0-9][0-9][0-9][0-9].csv"))
    if years is not None:
        files = [f for f in files if int(f.stem[-4:]) in years]
    if not files:
        raise FileNotFoundError(f"Aucun fichier atp_matches_AAAA.csv dans {raw_dir}")

    df = pd.concat((pd.read_csv(f, low_memory=False) for f in files), ignore_index=True)
    df["tourney_date"] = _to_date(df["tourney_date"])
    df["year"] = df["tourney_date"].dt.year
    df["round_order"] = df["round"].map(ROUND_ORDER).fillna(14)
    return df


def load_players(raw_dir: Path = RAW_ATP) -> pd.DataFrame:
    """Fiche joueur : identifiant, nom, main, date de naissance, pays, taille."""
    raw_dir = _check_dir(raw_dir)
    p = pd.read_csv(raw_dir / "atp_players.csv", low_memory=False)
    # Le README et les fichiers n'utilisent pas toujours les mêmes noms de colonnes
    p = p.rename(columns={"first_name": "name_first", "last_name": "name_last",
                          "birth_date": "dob", "country_code": "ioc", "height": "height_cm"})
    p["name"] = (p["name_first"].fillna("") + " " + p["name_last"].fillna("")).str.strip()
    if "dob" in p:
        p["dob"] = _to_date(p["dob"])
    return p


def load_rankings(raw_dir: Path = RAW_ATP) -> pd.DataFrame:
    """Classements hebdomadaires (atp_rankings_*.csv), colonnes normalisées :
    ranking_date, rank, player, points."""
    raw_dir = _check_dir(raw_dir)
    files = sorted(raw_dir.glob("atp_rankings_*.csv"))
    if not files:
        raise FileNotFoundError(f"Aucun fichier atp_rankings_*.csv dans {raw_dir}")
    r = pd.concat((pd.read_csv(f, low_memory=False) for f in files), ignore_index=True)
    r = r.rename(columns={"ranking": "rank", "player_id": "player", "ranking_points": "points"})
    r["ranking_date"] = _to_date(r["ranking_date"])
    return r.drop_duplicates(["ranking_date", "player"]).sort_values(["ranking_date", "rank"])
