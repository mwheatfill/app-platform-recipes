#!/usr/bin/env bash
# Installer for app-platform-recipes.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | \
#     bash -s -- +mcp-server
#
# Or, with a local clone:
#   bash /path/to/app-platform-recipes/install.sh +mcp-server
#
# Flags:
#   --force          overwrite existing files (default: warn and skip)
#   --from <path>    use a local checkout instead of cloning (for development)
#   --ref <branch>   clone a specific ref (default: main)

set -euo pipefail

REPO_URL="https://github.com/mwheatfill/app-platform-recipes.git"
REF="main"
FORCE=0
LOCAL_PATH=""

usage() {
  echo "Usage: $0 [--force] [--from <path>] [--ref <branch>] <+recipe-name>" >&2
  exit 1
}

# Parse flags
RECIPE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    --from) LOCAL_PATH="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    -h|--help) usage ;;
    +*) RECIPE="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

[[ -z "$RECIPE" ]] && usage

# Resolve recipe source
if [[ -n "$LOCAL_PATH" ]]; then
  RECIPES_ROOT="$LOCAL_PATH/recipes"
  CLEANUP=""
else
  TMP_DIR=$(mktemp -d)
  CLEANUP="$TMP_DIR"
  trap 'rm -rf "$CLEANUP"' EXIT
  echo "▶ Cloning recipes ($REF)..."
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$TMP_DIR" >/dev/null 2>&1
  RECIPES_ROOT="$TMP_DIR/recipes"
fi

RECIPE_DIR="$RECIPES_ROOT/$RECIPE"
[[ -d "$RECIPE_DIR" ]] || { echo "✗ Recipe not found: $RECIPE" >&2; exit 1; }

# Compatibility check
if [[ -f "$RECIPE_DIR/compatibility.json" ]] && [[ -f ".template-id" ]]; then
  template_id=$(cat .template-id)
  if ! grep -q "\"$template_id\"" "$RECIPE_DIR/compatibility.json"; then
    echo "⚠ Recipe $RECIPE may not support template $template_id" >&2
    echo "  See $RECIPE_DIR/compatibility.json" >&2
    if [[ $FORCE -eq 0 ]]; then
      echo "  Re-run with --force to install anyway" >&2
      exit 1
    fi
  fi
fi

# Copy files/ tree into the consuming app
if [[ -d "$RECIPE_DIR/files" ]]; then
  echo "▶ Copying files for $RECIPE..."
  while IFS= read -r -d '' src; do
    rel="${src#$RECIPE_DIR/files/}"
    dest="$rel"
    if [[ -e "$dest" ]] && [[ $FORCE -eq 0 ]]; then
      echo "  skip (exists): $dest"
      continue
    fi
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "  + $dest"
  done < <(find "$RECIPE_DIR/files" -type f -print0)
fi

# Run recipe-specific install hook if present
if [[ -x "$RECIPE_DIR/install.sh" ]]; then
  echo "▶ Running recipe install hook..."
  bash "$RECIPE_DIR/install.sh"
fi

echo ""
echo "✅ Recipe $RECIPE installed."
echo ""
echo "Read $RECIPE/README.md for next steps:"
echo "  ${RECIPE_DIR}/README.md"
