#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 1 ]]; then
  echo "Usage : $0 DOSSIER_RESULTATS" >&2
  exit 2
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
trial_dir="$repo_root/experiments/engine-trials"
godot="${GODOT_BIN:-godot4}"
template_version="4.7.2.stable"
editor_version="$template_version.official.ed1daf0bf"
template_sha256="d3ee2f08cef0cf3cf6678a6355a92a8db48ccdd35cbd2e8bfd5f0e8a0b4032a0"
godot_version="$("$godot" --version)"
if [[ "$godot_version" != "$editor_version" ]]; then
  printf 'Éditeur Godot attendu : %s. Version détectée : %s.\n' "$editor_version" "$godot_version" >&2
  exit 1
fi

template_zip="${GODOT_WEB_TEMPLATE_ZIP:-${XDG_DATA_HOME:-$HOME/.local/share}/godot/export_templates/$template_version/web_nothreads_release.zip}"
if [[ ! -r "$template_zip" ]]; then
  printf 'Modèle Godot Web release monothread introuvable : %s\n' "$template_zip" >&2
  printf 'Installer le modèle officiel pour %s ou renseigner GODOT_WEB_TEMPLATE_ZIP.\n' "$template_version" >&2
  exit 1
fi
actual_sha256="$(sha256sum < "$template_zip")"
if [[ "${actual_sha256%% *}" != "$template_sha256" ]]; then
  printf 'Le SHA-256 du modèle Web ne correspond pas à Godot %s : %s\n' "$template_version" "$template_zip" >&2
  exit 1
fi

artifact_root="$(mkdir -p -- "$1" && cd -- "$1" && pwd)"
staging_dir="$(mktemp -d)"
trap 'rm -rf -- "$staging_dir"' EXIT

mkdir -p -- "$staging_dir/project" "$staging_dir/export"
cp -- "$trial_dir/godot/"{project.godot,main.tscn,courtyard.gd,export_presets.cfg} "$staging_dir/project/"
cp -- "$trial_dir/scene.json" "$staging_dir/project/scene.json"
cp -- "$template_zip" "$staging_dir/project/web_nothreads_release.zip"
sed -i 's|^custom_template/release=""|custom_template/release="res://web_nothreads_release.zip"|' \
  "$staging_dir/project/export_presets.cfg"

godot_command=(env "XDG_DATA_HOME=$staging_dir/data" "XDG_CONFIG_HOME=$staging_dir/config"
  "XDG_CACHE_HOME=$staging_dir/cache" "$godot")
"${godot_command[@]}" --headless --path "$staging_dir/project" --quit-after 3
"${godot_command[@]}" --headless --path "$staging_dir/project" --export-release Web "$staging_dir/export/index.html"
for extension in html js pck wasm; do
  test -s "$staging_dir/export/index.$extension"
done

mkdir -p -- "$artifact_root/godot"
cp -- "$staging_dir/export/"* "$artifact_root/godot/"
cp -- "$trial_dir/godot/"GODOT-{LICENSE,COPYRIGHT}.txt "$artifact_root/godot/"
