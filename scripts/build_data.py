"""Calcule les indicateurs et exporte les JSON lus par le site (web/data/).

Usage, depuis la racine du dépôt :
    python -m scripts.build_data

Le format de web/data/goat.json est le contrat entre l'équipe données et l'équipe
site : si vous le changez, mettez à jour web/data/goat_sample.json et web/js/.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.elo import compute_elo, peak_and_longevity
from src.indicators import head_to_head, serve_return_stats, titles, weeks_at_no1, win_loss
from src.load import ROOT, load_matches, load_players, load_rankings

OUT = ROOT / "web" / "data"

# Critères du classement GOAT : clé dans le JSON -> libellé affiché
CRITERIA = {
    "slams": "Grands Chelems",
    "titles": "Titres (total)",
    "weeks_no1": "Semaines au n°1",
    "peak_elo": "Pic Elo",
    "longevity": "Longévité (années au top Elo)",
    "versatility": "Polyvalence (surfaces)",
    "h2h": "Bilan face aux autres grands",
}

# Sélection des joueurs : à ajuster après exploration (et à justifier dans le rapport)
MIN_SLAMS = 3


def to_records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> liste de dicts JSON (NaN -> null)."""
    return json.loads(df.replace({np.nan: None}).to_json(orient="records", date_format="iso"))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("Chargement…")
    matches = load_matches()
    rankings = load_rankings()
    players = load_players().set_index("player_id")

    print("Indicateurs…")
    t = titles(matches).set_index("player_id")
    w1 = weeks_at_no1(rankings).set_index("player_id")["weeks_no1"]
    elo = peak_and_longevity(compute_elo(matches)).set_index("player_id")

    wl = win_loss(matches, by="surface")
    wl = wl[wl["surface"].isin(["Hard", "Clay", "Grass"]) & (wl["matches"] >= 20)]
    # Polyvalence = % de victoires sur sa PLUS MAUVAISE surface (parmi dur, terre, gazon)
    versatility = wl.groupby("player_id")["win_pct"].min()

    slams = t["G"] if "G" in t else pd.Series(dtype=int)
    selected = sorted(set(slams[slams >= MIN_SLAMS].index) | set(w1[w1 > 0].index))
    print(f"{len(selected)} joueurs sélectionnés")

    h2h = head_to_head(matches, selected)
    h2h_pct = h2h.groupby("player_id")[["wins", "matches"]].sum()
    h2h_pct = h2h_pct["wins"] / h2h_pct["matches"]

    table = pd.DataFrame(index=pd.Index(selected, name="id"))
    table["name"] = players["name"].reindex(table.index)
    table["ioc"] = players["ioc"].reindex(table.index) if "ioc" in players else None
    table["slams"] = slams.reindex(table.index).fillna(0)
    table["titles"] = t["total"].reindex(table.index).fillna(0)
    table["weeks_no1"] = w1.reindex(table.index).fillna(0)
    table["peak_elo"] = elo["peak_elo"].reindex(table.index).round(0)
    table["longevity"] = elo["years_above"].reindex(table.index).fillna(0)
    table["versatility"] = versatility.reindex(table.index).round(3)
    table["h2h"] = h2h_pct.reindex(table.index).round(3)

    goat = {
        "criteria": [{"key": k, "label": v} for k, v in CRITERIA.items()],
        "players": [
            {"id": int(pid), "name": row["name"], "ioc": row["ioc"],
             "values": {k: (None if pd.isna(row[k]) else float(row[k])) for k in CRITERIA}}
            for pid, row in table.iterrows()
        ],
    }
    (OUT / "goat.json").write_text(json.dumps(goat, ensure_ascii=False, indent=1))
    (OUT / "h2h.json").write_text(json.dumps(to_records(h2h), ensure_ascii=False))

    stats = serve_return_stats(matches)
    stats = stats[stats["player_id"].isin(selected)]
    (OUT / "serve_return.json").write_text(json.dumps(to_records(stats), ensure_ascii=False))
    print(f"Fichiers écrits dans {OUT}")


if __name__ == "__main__":
    main()
