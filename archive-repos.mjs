#!/usr/bin/env node
import { Command } from 'commander';
import { checkbox, confirm } from '@inquirer/prompts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function runGh(args) {
  const { stdout } = await execFileAsync('gh', args, { maxBuffer: 1024 * 1024 * 20 });
  return stdout;
}

async function checkDependencies() {
  try {
    await runGh(['--version']);
  } catch {
    console.error('Error: gh CLI not found. Install: https://cli.github.com/');
    process.exit(1);
  }

  try {
    await runGh(['auth', 'status']);
  } catch {
    console.error('Error: gh is not authenticated. Run: gh auth login');
    process.exit(1);
  }
}

async function fetchRepos(owner) {
  const endpoints = [
    `/orgs/${owner}/repos?per_page=100&type=all`,
    `/users/${owner}/repos?per_page=100&type=owner`
  ];

  for (const endpoint of endpoints) {
    try {
      const out = await runGh(['api', '--paginate', endpoint]);
      const lines = out
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      const repos = lines.flatMap((line) => {
        try {
          const parsed = JSON.parse(line);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      });

      if (repos.length > 0) return repos;
    } catch {
      // try next endpoint
    }
  }

  throw new Error(`Could not fetch repos for '${owner}' as org or user`);
}

function filterRepos(repos, regex) {
  return repos
    .filter((r) => !r.archived)
    .filter((r) => regex.test(r.full_name))
    .sort((a, b) => {
      const aTime = new Date(a.updated_at ?? 0).getTime();
      const bTime = new Date(b.updated_at ?? 0).getTime();
      if (aTime !== bTime) return aTime - bTime; // oldest updated first
      return a.full_name.localeCompare(b.full_name);
    });
}

async function archiveRepo(fullName, repoUrl, dryRun) {
  if (dryRun) {
    const label = repoUrl ? `${fullName} (${repoUrl})` : fullName;
    console.log(`[dry-run] would archive: ${label}`);
    return true;
  }

  try {
    await runGh(['api', '-X', 'PATCH', `/repos/${fullName}`, '-f', 'archived=true']);
    console.log(`archived: ${fullName}`);
    return true;
  } catch {
    console.error(`failed:   ${fullName}`);
    return false;
  }
}

const program = new Command();

program
  .name('archive-repos')
  .description('Bulk archive GitHub repositories via gh CLI')
  .argument('<owner>', 'GitHub org or user')
  .option('--name-regex <regex>', 'Filter by full repo name regex', '.*')
  .option('--dry-run', 'Preview without archiving', false)
  .option('--all', 'Skip interactive picker and select all matches', false)
  .action(async (owner, options) => {
    await checkDependencies();

    let regex;
    try {
      regex = new RegExp(options.nameRegex);
    } catch {
      console.error(`Error: invalid regex: ${options.nameRegex}`);
      process.exit(1);
    }

    let repos;
    try {
      repos = await fetchRepos(owner);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }

    const filtered = filterRepos(repos, regex);
    const repoByFullName = new Map(filtered.map((r) => [r.full_name, r]));

    console.log(
      `Found ${filtered.length} non-archived repo(s) for '${owner}' matching regex '${options.nameRegex}'.`
    );

    if (filtered.length === 0) return;

    let selected;
    if (options.all) {
      selected = filtered.map((r) => r.full_name);
    } else {
      selected = await checkbox({
        message: 'Select repos to archive (space to toggle, enter to confirm)',
        pageSize: 20,
        choices: filtered.map((r) => ({
          name: `${r.full_name} (${r.html_url})`,
          value: r.full_name
        }))
      });

      if (selected.length === 0) {
        console.log('No repositories selected. Exiting.');
        return;
      }
    }

    console.log(`\nSelected ${selected.length} repo(s):`);
    for (const name of selected) {
      const repo = repoByFullName.get(name);
      const url = repo?.html_url ? ` (${repo.html_url})` : '';
      console.log(`  - ${name}${url}`);
    }

    if (!options.dryRun) {
      const ok = await confirm({ message: 'Proceed with archiving?', default: false });
      if (!ok) {
        console.log('Cancelled.');
        return;
      }
    }

    let success = 0;
    let failed = 0;
    const archivedWithLinks = [];

    for (const fullName of selected) {
      const repoUrl = repoByFullName.get(fullName)?.html_url;
      const ok = await archiveRepo(fullName, repoUrl, options.dryRun);
      if (ok) {
        success += 1;
        if (!options.dryRun && repoUrl) {
          archivedWithLinks.push({ fullName, repoUrl });
        }
      } else {
        failed += 1;
      }
    }

    if (options.dryRun) {
      console.log('Dry run complete.');
    } else {
      if (archivedWithLinks.length > 0) {
        console.log('\nArchived repos:');
        for (const repo of archivedWithLinks) {
          console.log(`  - ${repo.fullName}: ${repo.repoUrl}`);
        }
      }
      console.log(`Done. Archived: ${success}, Failed: ${failed}`);
    }
  });

program.parseAsync(process.argv);
