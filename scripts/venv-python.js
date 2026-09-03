#!/usr/bin/env node
/**
 * Run a command in the repo's Python virtualenv, whichever platform made it.
 *
 * The dead-code scripts used to hardcode `..\.venv\Scripts\python.exe`, which
 * broke the moment the checkout moved off Windows: a POSIX venv puts the
 * interpreter at `bin/python` and has no `Scripts/` directory at all. Resolving
 * it here means the npm scripts stay identical on every platform.
 *
 * Usage:  node scripts/venv-python.js -m ruff check scripts
 */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const VENV_ROOT = path.join(__dirname, '..', '..', '.venv')

// POSIX layout first, then Windows. Both are checked regardless of the current
// platform: a venv committed or copied from another machine still resolves.
const CANDIDATES = [
  path.join(VENV_ROOT, 'bin', 'python'),
  path.join(VENV_ROOT, 'bin', 'python3'),
  path.join(VENV_ROOT, 'Scripts', 'python.exe'),
]

function resolveInterpreter() {
  const found = CANDIDATES.find((candidate) => fs.existsSync(candidate))

  if (!found) {
    console.error(
      [
        'No Python virtualenv found at .venv (repo root).',
        '',
        'Create one and install the dead-code tools:',
        '  python3 -m venv .venv',
        '  .venv/bin/pip install ruff vulture',
        '',
        'On Windows:',
        '  py -m venv .venv',
        '  .venv\\Scripts\\pip install ruff vulture',
      ].join('\n'),
    )
    process.exit(1)
  }

  return found
}

const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Usage: node scripts/venv-python.js <python args...>')
  process.exit(1)
}

const result = spawnSync(resolveInterpreter(), args, {
  stdio: 'inherit',
  // Run from frontend/, so `scripts` and `pyproject.toml` resolve as before.
  cwd: path.join(__dirname, '..'),
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
