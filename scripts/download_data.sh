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
  # fetch <dossier> <url> [sous-dossier à garder]
  local name="$1" url="$2" subdir="${3:-}"
  if [ -d "data/raw/$name/.git" ]; then
    echo "→ $name : mise à jour"
    git -C "data/raw/$name" pull --ff-only
  elif [ -n "$subdir" ] && git clone --depth 1 --filter=blob:none --sparse "$url" "data/raw/$name"; then
    echo "→ $name : téléchargement de $subdir/ seulement"
    git -C "data/raw/$name" sparse-checkout set "$subdir"
  else
    echo "→ $name : téléchargement complet"
    rm -rf "data/raw/$name"
    git clone --depth 1 "$url" "data/raw/$name"
  fi
}

# Source principale : matchs, classements et joueurs ATP de Jeff Sackmann (CC BY-NC-SA 4.0).
# Le dépôt d'origine (github.com/JeffSackmann/tennis_atp) n'est plus en ligne depuis 2026 :
# on utilise sa copie d'archive, qui garde les mêmes fichiers dans atp/ (et wta/, slam_pointbypoint/).
fetch tennis-sackmann-archive https://github.com/Aneeshers/tennis-sackmann-archive.git atp

# Pour ajouter la WTA ou le point par point des Grands Chelems (même archive) :
#   git -C data/raw/tennis-sackmann-archive sparse-checkout add wta slam_pointbypoint
# Match Charting Project (Jeff Sackmann, toujours en ligne, ~530 Mo) : matchs décrits coup par coup
# (direction et profondeur des coups, par zones), ~7 500 matchs masculins.
fetch tennis_MatchChartingProject https://github.com/JeffSackmann/tennis_MatchChartingProject.git

echo "Terminé. Fichiers dans data/raw/"
