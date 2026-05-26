#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Bulk archive GitHub repositories with gh + jq

Usage:
  ./archive-repos.sh <owner> [--name-regex <regex>] [--dry-run]

Examples:
  ./archive-repos.sh my-org
  ./archive-repos.sh my-user --name-regex '^legacy-'
  ./archive-repos.sh my-org --dry-run
EOF
}

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI not found. Install: https://cli.github.com/" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq not found. Install jq first." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

OWNER=""
NAME_REGEX=".*"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name-regex)
      NAME_REGEX="${2:-}"
      if [[ -z "$NAME_REGEX" ]]; then
        echo "Error: --name-regex requires a value" >&2
        exit 1
      fi
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$OWNER" ]]; then
        OWNER="$1"
        shift
      else
        echo "Error: unexpected argument: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$OWNER" ]]; then
  echo "Error: owner is required" >&2
  usage
  exit 1
fi

# Validate auth early.
if ! gh auth status >/dev/null 2>&1; then
  echo "Error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# Try org repos first, then user repos.
fetch_repos() {
  local endpoint="$1"
  gh api --paginate "$endpoint" 2>/dev/null | jq -s 'add'
}

REPOS_JSON=""
if REPOS_JSON="$(fetch_repos "/orgs/$OWNER/repos?per_page=100&type=all")"; then
  :
elif REPOS_JSON="$(fetch_repos "/users/$OWNER/repos?per_page=100&type=owner")"; then
  :
else
  echo "Error: could not fetch repos for '$OWNER' as org or user" >&2
  exit 1
fi

mapfile -t REPOS < <(
  jq -r --arg re "$NAME_REGEX" '
    .[]
    | select(.archived == false)
    | select(.full_name | test($re))
    | .full_name
  ' <<<"$REPOS_JSON"
)

TOTAL="${#REPOS[@]}"
echo "Found $TOTAL non-archived repo(s) for '$OWNER' matching regex '$NAME_REGEX'."

if [[ "$TOTAL" -eq 0 ]]; then
  exit 0
fi

SUCCESS=0
FAILED=0

for full_name in "${REPOS[@]}"; do
  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] would archive: $full_name"
    continue
  fi

  if gh api -X PATCH "/repos/$full_name" -f archived=true >/dev/null; then
    echo "archived: $full_name"
    ((SUCCESS+=1))
  else
    echo "failed:   $full_name" >&2
    ((FAILED+=1))
  fi
done

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run complete."
else
  echo "Done. Archived: $SUCCESS, Failed: $FAILED"
fi
