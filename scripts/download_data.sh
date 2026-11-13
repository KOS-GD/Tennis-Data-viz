#!/usr/bin/env bash
# Télécharge les données brutes dans data/raw/.
# Usage (depuis la racine du dépôt) :  bash scripts/download_data.sh
#
# Chaque source a son propre dossier dans data/raw/ : pour ajouter une base,
# ajoutez une ligne "fetch <dossier> <url>" ci-dessous.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p data/raw

fetch () {
  local name="$1" url="$2"
  if [ -d "data/raw/$name/.git" ]; then
    echo "→ $name : mise à jour"
    git -C "data/raw/$name" pull --ff-only
  else
    echo "→ $name : téléchargement"
    git clone --depth 1 "$url" "data/raw/$name"
  fi
}

# Source principale : matchs, classements et joueurs ATP (Jeff Sackmann, CC BY-NC-SA 4.0)
fetch tennis_atp https://github.com/JeffSackmann/tennis_atp.git

# Sources optionnelles, à décommenter si besoin :
# fetch tennis_wta https://github.com/JeffSackmann/tennis_wta.git
# fetch tennis_slam_pointbypoint https://github.com/JeffSackmann/tennis_slam_pointbypoint.git
# fetch tennis_MatchChartingProject https://github.com/JeffSackmann/tennis_MatchChartingProject.git

echo "Terminé. Fichiers dans data/raw/"
