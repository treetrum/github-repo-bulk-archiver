# Bulk Archive GitHub Repos

Simple Bash tool to bulk archive repositories using **GitHub CLI (`gh`)** and **`jq`**.

## Prerequisites

- `gh` installed and authenticated (`gh auth login`)
- `jq` installed

## Usage

```bash
chmod +x archive-repos.sh
./archive-repos.sh <owner> [--name-regex <regex>] [--dry-run]
```

### Examples

Archive all non-archived repos for an org/user:

```bash
./archive-repos.sh my-org
```

Only archive repos whose full name matches a regex:

```bash
./archive-repos.sh my-org --name-regex '^my-org/legacy-'
```

Preview without making changes:

```bash
./archive-repos.sh my-org --dry-run
```

## Notes

- The script skips repos already archived.
- It tries the owner as an **org** first, then as a **user**.
- Uses GitHub API via `gh api` with pagination.
