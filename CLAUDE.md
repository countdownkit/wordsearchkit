# CLAUDE.md — wordsearchkit

Project instructions for Claude Code working in this repo. Inherits the ElevatedProgress
venture playbook from the parent folder's CLAUDE.md.

## What this is

A zero-dependency static-site generator for **free printable word searches**. `generate.js`
reads `data/wordsearch.json` + `assets/` and writes one page per puzzle into `public/`.
Target: https://wordsearch.elevatedprogress.com/. One SEO page per real search (slugs match
searches): `word-search`, `printable-word-search`, plus holiday puzzles (christmas /
halloween / thanksgiving / easter / valentines) and themes (animals / space / summer), plus
the homepage.

## The product rule

**The artifact IS the page.** Each page server-renders a real letter grid, a word bank, and a
hidden-by-default answer key; `assets/tool.js` only re-renders it (grid size, difficulty,
word list, key show/hide, new puzzle) and calls `window.print()`. Print CSS strips everything
with `.no-print`; the answer key prints on its own page; "save as PDF" is just the print
dialog. Never turn this into a download/builder flow — instant-print is the differentiator.

Placement + rendering live in `assets/ws.js`, a UMD module required by BOTH `generate.js`
(server) and `tool.js` (browser) so their output matches exactly for a given word list +
params + seed.

## Reproducible builds (important)

The grid comes from a **seeded PRNG (mulberry32) in `ws.js`, seeded from the page slug**, so
`node generate.js` emits **byte-identical HTML every build** — no needless git churn. Never
use `Math.random` for the server-rendered default. The client-only **"New puzzle"** button
reseeds at random.

The **answer key is built FROM the recorded placements**, not re-derived — every word is
marked at the exact cells it occupies. Placement rule: each word gets a random valid
direction/position (direction set grows with difficulty: across+down → +diagonals →
+backwards); overlaps are allowed **only** where letters already match; retry up to 300 times;
a word too long to fit (or unplaceable) is dropped from BOTH the grid and the word list, so
the list never shows a word that isn't there. Empty cells are filled with random letters.

## Deploy — just push

`git push` to `main` is the deploy — GitHub Actions (`.github/workflows/deploy.yml`).

- **Never manually build and commit output.** `public/` is git-ignored build output.
- **Never hand-edit anything in `public/`.**
- Commit as the neutral identity:
  `git -c user.name="wordsearchkit" -c user.email="wordsearchkit@users.noreply.github.com" commit …`

## Local build / preview

```
node generate.js     # writes ./public
node server.js       # preview at http://localhost:5069 (5060-5062 are Chrome-blocked ports)
```

## Page families

- `/<slug>/` — one word search per entry in `data/wordsearch.json`. Each entry sets its
  `caption`, `size` (10/15/20), `difficulty` (hv/diag/all), curated `words` list, `group`
  (make/holiday/theme), and copy (`title`/`blurb`/`tip`). Add a puzzle by adding an entry —
  no generator changes needed.
- `/` — homepage, grouped Make your own / Holiday / Themes.

## Don't break these (generated, must keep serving)

- `ads.txt` + AdSense loader in `<head>` — publisher `ca-pub-5580575158570188`.
- GA4 `G-TJY4TRRKD6` (shared across all EP sites; hostname splits them).
- `sitemap.xml`, `robots.txt`, `.nojekyll`, `CNAME` (wordsearch.elevatedprogress.com).
- GSC verification file once the property is verified.

## Config knobs

`DOMAIN` and `BASE`, same semantics as the other tools. Production values in the workflow.
Grid-size and difficulty option lists (`SIZES`, `DIFFS`) live near the top of `generate.js`.
