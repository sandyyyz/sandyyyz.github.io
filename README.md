# sandyyyz.github.io

Personal blog — Linux kernel & systems engineering notes.

Built with [VitePress](https://vitepress.dev/), deployed to GitHub Pages via
GitHub Actions.

## How it works

Blog content lives in the separate public repo
[sandyyyz/Notes](https://github.com/sandyyyz/Notes). Nothing is duplicated
here:

- `npm run sync` (`scripts/sync-notes.mjs`) clones the latest notes from the
  `Notes` repo into `docs/notes/` (git-ignored), hoisting `knowledge/`,
  `reports/` and `labs/` to the top level and generating index pages for
  directories that lack one.
- The sidebar and section nav are generated at build time by
  `docs/.vitepress/config.ts`, which scans `docs/notes/` and uses each note's
  first `#` heading as its title.
- CI runs `npm run build` (which runs the sync first) on every push to `main`
  and on a daily schedule, so the site tracks the notes repo automatically.

Only what is pushed to the `Notes` repo is published; private notes never
leave the local machine.

## Development

```sh
npm install
npm run dev      # sync notes + start dev server
npm run build    # sync notes + build static site
npm run preview  # preview the built site
```
