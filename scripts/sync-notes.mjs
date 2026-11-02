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
import { join, relative } from 'node:path'
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

function collectMd(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) collectMd(p, out)
    else if (e.name.endsWith('.md') && e.name !== 'index.md' && e.name !== 'README.md')
      out.push(p)
  }
  return out
}

function hasMd(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    if (e.isFile() && e.name.endsWith('.md')) return true
    if (e.isDirectory() && hasMd(join(dir, e.name))) return true
  }
  return false
}

// Flat, newest-first index for the weekly digest (lwn-weekly/YYYY/MM/DD.md)
function genLwnWeeklyIndex() {
  const dir = join(DEST, 'lwn-weekly')
  if (!existsSync(dir)) return
  const entries = collectMd(dir)
    .map((f) => {
      const rel = relative(dir, f).split(/[\\/]/).join('/')
      const m = rel.match(/^(\d{4})\/(\d{2})\/(\d{2})\.md$/)
      return m && { y: m[1], mo: m[2], d: m[3], rel }
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.y + b.mo + b.d) - Number(a.y + a.mo + a.d))

  const lines = ['# LWN 周刊', '']
  let lastYm = null
  for (const e of entries) {
    const ym = `${e.y}-${e.mo}`
    if (ym !== lastYm) {
      lines.push(`## ${ym}`, '')
      lastYm = ym
    }
    lines.push(`- [${e.mo}-${e.d} LWN 周报](${e.rel})`)
  }
  writeFileSync(join(dir, 'index.md'), lines.join('\n') + '\n')
}

// Flat, newest-first index for the kernel digest:
// dailies (kernel-digest/YYYY/MM/DD.md) + deep patch reports
// (kernel-digest/deep/YYYY/MM/DD-<hash>/report.md, hash hidden)
function genKernelDigestIndex() {
  const dir = join(DEST, 'kernel-digest')
  if (!existsSync(dir)) return
  const daily = []
  const deep = []
  for (const f of collectMd(dir)) {
    const rel = relative(dir, f).split(/[\\/]/).join('/')
    let m = rel.match(/^(\d{4})\/(\d{2})\/(\d{2})\.md$/)
    if (m) {
      daily.push({ key: m[1] + m[2] + m[3], text: `${m[2]}-${m[3]} Kernel 日报`, rel })
      continue
    }
    m = rel.match(/^deep\/(\d{4})\/(\d{2})\/(\d{2})-[0-9a-f]+\/report\.md$/)
    if (m) deep.push({ key: m[1] + m[2] + m[3], text: `${m[2]}-${m[3]} · ${readH1(f) || rel}`, rel })
  }
  const byDateDesc = (a, b) => Number(b.key) - Number(a.key)
  daily.sort(byDateDesc)
  deep.sort(byDateDesc)

  const lines = ['# Kernel 深读', '']
  if (daily.length) {
    lines.push('## 日报', '')
    for (const e of daily) lines.push(`- [${e.text}](${e.rel})`)
    lines.push('')
  }
  if (deep.length) {
    lines.push('## 深度补丁解析', '')
    for (const e of deep) lines.push(`- [${e.text}](${e.rel})`)
  }
  writeFileSync(join(dir, 'index.md'), lines.join('\n') + '\n')
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
      const child = join(dir, e.name)
      if (!hasMd(child)) {
        // source-only directory: list as plain text, no page
        lines.push(`- ${e.name}/`)
        continue
      }
      if (!existsSync(join(child, 'index.md')) && !existsSync(join(child, 'README.md'))) {
        genIndex(child, e.name)
      }
      lines.push(`- [${DIR_TITLES[e.name] || linkTitleForDir(child, e.name)}](${e.name}/)`)
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

// Sections with hand-tuned flat indexes; skip generic generation inside them.
const SPECIAL_SECTIONS = new Set(['lwn-weekly', 'kernel-digest'])

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory() && hasMd(p)) {
      if (!existsSync(join(p, 'index.md')) && !existsSync(join(p, 'README.md'))) {
        genIndex(p, e.name)
      }
      walk(p)
    }
  }
}

genLwnWeeklyIndex()
genKernelDigestIndex()

for (const e of readdirSync(DEST, { withFileTypes: true })) {
  if (!e.name.startsWith('.') && e.isDirectory() && !SPECIAL_SECTIONS.has(e.name)) {
    const p = join(DEST, e.name)
    if (!existsSync(join(p, 'index.md')) && !existsSync(join(p, 'README.md'))) {
      genIndex(p, e.name)
    }
    walk(p)
  }
}

console.log('notes synced into docs/notes')
