#!/usr/bin/env node
/**
 * sync-notes.mjs — pull the public notes repo into docs/notes at build time.
 *
 * Source: https://github.com/sandyyyz/Notes (only what is pushed there; the
 * private local `work/` directory never reaches the remote, so it is excluded
 * by construction). `archive/` and `build/` are skipped as well.
 *
 * - knowledge/* , reports/* , labs/* are hoisted to docs/notes/<child>/
 * - directories without an index.md/README.md get a generated index.md so
 *   section links never 404
 */
import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NOTES_REPO = 'https://github.com/sandyyyz/Notes.git'
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CACHE = join(ROOT, '.notes-cache')
const DEST = join(ROOT, 'docs', 'notes')

// Copy spec: hoist the children of these dirs to docs/notes/ top level.
const COPY = ['knowledge', 'reports', 'labs']

// Friendly titles for generated index pages.
const DIR_TITLES = {
  'linux-kernel': 'Linux 内核',
  toolchain: '工具链',
  hardware: '硬件',
  'system-tools': '系统工具',
  'ai-tools': 'AI 工具',
  'lwn-weekly': 'LWN 周刊',
  'kernel-digest': 'Kernel 深读',
  deep: '深度补丁解析',
  'compiling-linking': '编译链接实验',
  'kernel-debugging': '内核调试实验',
}

// ---------------------------------------------------------------------------
// 1. Fetch the notes repo into a cache dir
// ---------------------------------------------------------------------------
if (existsSync(CACHE)) {
  try {
    execSync(`git -C "${CACHE}" fetch --depth 1 origin main`, { stdio: 'inherit' })
    execSync(`git -C "${CACHE}" reset --hard FETCH_HEAD`, { stdio: 'inherit' })
    execSync(`git -C "${CACHE}" clean -fdx`, { stdio: 'inherit' })
  } catch {
    rmSync(CACHE, { recursive: true, force: true })
  }
}
if (!existsSync(CACHE)) {
  execSync(`git clone --depth 1 --branch main ${NOTES_REPO} "${CACHE}"`, {
    stdio: 'inherit',
  })
}

// ---------------------------------------------------------------------------
// 2. Copy into docs/notes
// ---------------------------------------------------------------------------
rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })

for (const dir of COPY) {
  const src = join(CACHE, dir)
  if (!existsSync(src)) {
    console.warn(`warn: ${dir}/ not found in notes repo, skipping`)
    continue
  }
  for (const child of readdirSync(src)) {
    if (child.startsWith('.')) continue
    const from = join(src, child)
    cpSync(from, join(DEST, child), { recursive: true })
    console.log(`synced: ${dir}/${child} -> notes/${child}/`)
  }
}

// ---------------------------------------------------------------------------
// 3. Generate index.md for directories that lack one
// ---------------------------------------------------------------------------
function readH1(file) {
  try {
    const m = readFileSync(file, 'utf8').match(/^#\s+(.+)$/m)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

function linkTitle(file) {
  return readH1(file) || file.replace(/\.md$/, '')
}

function genIndex(dir, name) {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.') && e.name !== 'index.md' && e.name !== 'README.md')
    .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))

  const lines = [`# ${DIR_TITLES[name] || name}`, '']
  for (const e of entries) {
    if (e.isDirectory()) {
      // ensure the subdir gets an index first (recursive, bottom-up not needed:
      // VitePress resolves links at build time after all files exist)
      genIndex(join(dir, e.name), e.name)
      lines.push(`- [${DIR_TITLES[e.name] || linkTitleForDir(join(dir, e.name), e.name)}](${e.name}/)`)
    } else if (e.name.endsWith('.md')) {
      lines.push(`- [${linkTitle(join(dir, e.name))}](${e.name})`)
    }
  }
  writeFileSync(join(dir, 'index.md'), lines.join('\n') + '\n')
}

function linkTitleForDir(dir, name) {
  // prefer an existing index/README H1, else the mapped/fallback name
  for (const f of ['index.md', 'README.md']) {
    const p = join(dir, f)
    if (existsSync(p)) {
      return readH1(p) || DIR_TITLES[name] || name
    }
  }
  return DIR_TITLES[name] || name
}

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!existsSync(join(p, 'index.md')) && !existsSync(join(p, 'README.md'))) {
        genIndex(p, e.name)
      }
      walk(p)
    }
  }
}

for (const e of readdirSync(DEST, { withFileTypes: true })) {
  if (!e.name.startsWith('.') && e.isDirectory()) {
    const p = join(DEST, e.name)
    if (!existsSync(join(p, 'index.md')) && !existsSync(join(p, 'README.md'))) {
      genIndex(p, e.name)
    }
    walk(p)
  }
}

console.log('notes synced into docs/notes')
