# Bulk Archive GitHub Repos

Interactive CLI to bulk archive repositories using **GitHub CLI (`gh`)**.

## Prerequisites

- Node.js 18+
- `gh` installed and authenticated (`gh auth login`)

## Install

```bash
npm install
```

## Usage

Run directly with Node:

```bash
node archive-repos.mjs <owner> [--name-regex <regex>] [--dry-run] [--all]
```

Or via npm script:

```bash
npm run archive -- <owner>
```

Or install the CLI command globally from this repo:

```bash
npm link
archive-repos <owner> [--name-regex <regex>] [--dry-run] [--all]
```

To remove the global link later:

```bash
npm unlink -g github-repo-bulk-archiver
```

## Examples

Interactive picker (multi-select):

```bash
node archive-repos.mjs my-org
```

Filter by regex:

```bash
node archive-repos.mjs my-org --name-regex '^my-org/legacy-'
```

Dry run:

```bash
node archive-repos.mjs my-org --dry-run
```

Skip picker and archive all matches:

```bash
node archive-repos.mjs my-org --all
```

## Notes

- Picker controls: **space** to toggle, **enter** to confirm.
- Script skips repos already archived.
- It tries owner as an **org** first, then as a **user**.
