import { defineConfig } from 'vitepress'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const NOTES_DIR = fileURLToPath(new URL('../notes', import.meta.url))

const DIR_TITLES: Record<string, string> = {
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

// Top-level sidebar sections: [directory, default collapsed]
const SECTIONS: Array<[string, boolean]> = [
  ['linux-kernel', false],
  ['toolchain', true],
  ['hardware', true],
  ['system-tools', true],
  ['ai-tools', true],
  ['lwn-weekly', true],
  ['kernel-digest', true],
  ['compiling-linking', true],
  ['kernel-debugging', true],
]

function readH1(file: string): string | null {
  try {
    const m = readFileSync(file, 'utf8').match(/^#\s+(.+)$/m)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

function toLink(file: string): string {
  const rel = relative(NOTES_DIR, file).replace(/\\/g, '/')
  // README.md / index.md link to the directory itself
  return '/notes/' + rel.replace(/(index|README)\.md$/, '')
}

function titleForDir(dir: string, name: string): string {
  for (const f of ['index.md', 'README.md']) {
    const p = join(dir, f)
    if (existsSync(p)) {
      return readH1(p) || DIR_TITLES[name] || name
    }
  }
  return DIR_TITLES[name] || name
}

function buildItems(dir: string): any[] {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        !e.name.startsWith('.') &&
        e.name !== 'index.md' &&
        e.name !== 'README.md',
    )
    .sort((a, b) =>
      a.isDirectory() === b.isDirectory()
        ? a.name.localeCompare(b.name)
        : a.isDirectory()
          ? -1
          : 1,
    )

  const items: any[] = []
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      items.push({
        text: titleForDir(full, e.name),
        collapsed: true,
        items: buildItems(full),
      })
    } else if (e.name.endsWith('.md')) {
      items.push({
        text: readH1(full) || e.name.replace(/\.md$/, ''),
        link: toLink(full),
      })
    }
  }
  return items
}

function buildSidebar(): any[] {
  if (!existsSync(NOTES_DIR)) return []
  return SECTIONS.map(([dir, collapsed]) => ({
    text: titleForDir(join(NOTES_DIR, dir), dir),
    collapsed,
    items: buildItems(join(NOTES_DIR, dir)),
  })).filter((s) => s.items.length > 0)
}

export default defineConfig({
  lang: 'zh-CN',
  title: "sandyyyz's blog",
  description: 'Linux kernel & systems engineering notes',

  appearance: 'dark',
  lastUpdated: false,
  ignoreDeadLinks: true,

  head: [['link', { rel: 'icon', href: '/favicon.svg' }]],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'Linux 内核', link: '/notes/linux-kernel/' },
      { text: '工具链', link: '/notes/toolchain/' },
      { text: '硬件', link: '/notes/hardware/' },
      {
        text: '周刊',
        items: [
          { text: 'LWN 周刊', link: '/notes/lwn-weekly/' },
          { text: 'Kernel 深读', link: '/notes/kernel-digest/' },
        ],
      },
      {
        text: '实验',
        items: [
          { text: '编译链接实验', link: '/notes/compiling-linking/' },
          { text: '内核调试实验', link: '/notes/kernel-debugging/' },
        ],
      },
    ],

    sidebar: buildSidebar(),

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换' },
          },
        },
      },
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/sandyyyz' }],
  },

  markdown: {
    lineNumbers: true,
    config(md) {
      // Notes contain technical tokens like <leader>, <CR>, <pid> in prose.
      // Disable raw-HTML parsing so they render literally instead of being
      // fed to the Vue template compiler.
      md.set({ html: false })
    },
  },
})
