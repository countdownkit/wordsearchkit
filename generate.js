/*
 * Static generator for the printable word-search site.
 * Run: node generate.js   ->   writes everything into ./public
 *
 * Page families:
 *   /<slug>/   one printable word search per slug (data/wordsearch.json)
 *   /          homepage, grouped (Make your own / Holiday / Themes)
 *
 * The artifact IS the page: each page server-renders a real letter grid, a word
 * bank, and a hidden-by-default answer key. assets/tool.js only re-renders it
 * (grid size, difficulty, word list, key show/hide, new puzzle) and calls
 * window.print(). Print CSS strips everything with .no-print; the answer key
 * prints on its own page. "Save as PDF" is just the print dialog.
 *
 * Reproducible: the grid comes from a SEEDED PRNG (mulberry32 in assets/ws.js)
 * seeded from the page slug, so `node generate.js` emits byte-identical HTML on
 * every run. The client "New puzzle" button reseeds at random.
 */
const fs = require("fs");
const path = require("path");
const WS = require("./assets/ws.js");

// ---- config -------------------------------------------------------------
const DOMAIN = process.env.DOMAIN || "https://wordsearch.elevatedprogress.com";
const BASE = process.env.BASE || "";
const SITE = "Word Search Maker";
const OUT = path.join(__dirname, "public");
const ASSETS = path.join(__dirname, "assets");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "wordsearch.json"), "utf8"));

const GROUPS = [
  { id: "make", label: "Make your own" },
  { id: "holiday", label: "Holiday" },
  { id: "theme", label: "Themes" },
];

// ---- html layout --------------------------------------------------------
function layout({ title, desc, urlPath, h1, body }) {
  const canonical = DOMAIN + BASE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${BASE}/styles.css">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5580575158570188" crossorigin="anonymous"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TJY4TRRKD6"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-TJY4TRRKD6');</script>
</head>
<body>
<header class="site-head no-print"><div class="wrap">
  <a class="brand" href="${BASE}/">🔍 ${SITE}</a>
  <nav class="nav"><a href="${BASE}/#make">Make your own</a><a href="${BASE}/#holiday">Holiday</a><a href="${BASE}/#theme">Themes</a></nav>
</div></header>
<main class="wrap">
  <div class="crumbs no-print"><a href="${BASE}/">Home</a> ›&nbsp;${h1}</div>
  <h1 class="no-print">${h1}</h1>
  ${body}
</main>
<footer class="site-foot no-print"><div class="wrap">
  <a href="${BASE}/">Home</a><a href="${BASE}/#make">Make your own</a><a href="${BASE}/#holiday">Holiday puzzles</a><a href="${BASE}/#theme">Themed puzzles</a>
  <span>· ${SITE} — free printable word searches. No downloads, no signups: customize and print. Part of <a href="https://elevatedprogress.com/">Elevated Progress</a>. · <a href="https://elevatedprogress.com/about/">About</a> · <a href="https://elevatedprogress.com/contact/">Contact</a> · <a href="https://elevatedprogress.com/privacy/">Privacy Policy</a></span>
</div></footer>
<script src="${BASE}/ws.js"></script>
<script src="${BASE}/tool.js" defer></script>
</body>
</html>`;
}
function grid(links) {
  return `<div class="grid">` + links.map(l =>
    `<a href="${BASE}${l.href}">${l.emoji ? `<span class="chip-emoji">${l.emoji}</span>` : ""}${l.label}</a>`).join("") + `</div>`;
}

// ---- controls -----------------------------------------------------------
const SIZES = [
  { v: 10, label: "10 × 10 (small)" },
  { v: 15, label: "15 × 15" },
  { v: 20, label: "20 × 20 (big)" },
];
const DIFFS = [
  { v: "hv", label: "Easy — across & down" },
  { v: "diag", label: "Medium — + diagonals" },
  { v: "all", label: "Hard — + backwards" },
];
function controls(page) {
  const wordsText = page.words.join("\n");
  const sizeSel = SIZES.map(s => `<option value="${s.v}"${s.v === page.size ? " selected" : ""}>${s.label}</option>`).join("");
  const diffSel = DIFFS.map(d => `<option value="${d.v}"${d.v === page.difficulty ? " selected" : ""}>${d.label}</option>`).join("");
  return `<div class="controls no-print">
    <div class="row">
      <div><label for="sz">Grid size</label><select id="sz" data-ctl="size">${sizeSel}</select></div>
      <div><label for="df">Difficulty</label><select id="df" data-ctl="difficulty">${diffSel}</select></div>
      <div><label for="ak">Answer key</label><select id="ak" data-ctl="answerkey"><option value="0">Hidden</option><option value="1">Show</option></select></div>
    </div>
    <div class="row">
      <div class="wordcell"><label for="wl">Word list — one per line, edit to make your own</label><textarea id="wl" data-ctl="words" rows="4" spellcheck="false">${wordsText}</textarea></div>
    </div>
    <div class="ctl-foot">
      <button type="button" class="print-btn" data-ctl="print">🖨️ Print this puzzle</button>
      <button type="button" class="ghost-btn" data-ctl="new">🎲 New puzzle</button>
      <span class="hint">Tip: edit the word list and the grid rebuilds instantly. "Save as PDF" is a destination in the print dialog.</span>
    </div>
  </div>`;
}

// ---- write helpers ------------------------------------------------------
const urls = [];
function writePage(urlPath, html) {
  const dir = path.join(OUT, urlPath.replace(/^\/+|\/+$/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  urls.push(urlPath);
}

const pageLink = p => ({ href: `/${p.slug}/`, label: p.caption });

// ---- page builder -------------------------------------------------------
function wsPage(page, related, relatedLabel) {
  const puzzle = WS.buildPuzzle({ words: page.words, size: page.size, difficulty: page.difficulty, seed: page.slug });
  const cap = page.caption;
  const paper = `<div class="ws-wrap" data-seed="${page.slug}" data-size="${page.size}" data-difficulty="${page.difficulty}">
    <div class="paper" data-paper>
      <h2 class="ws-title" contenteditable="true" spellcheck="false" data-caption="${cap}">${cap}</h2>
      <div class="ws-puzzle" data-grid>${WS.renderGrid(puzzle)}</div>
      <div class="ws-wordbank">
        <h3 class="wb-head">Find these words</h3>
        <div data-wordlist>${WS.renderWordList(puzzle.words)}</div>
      </div>
    </div>
    <div class="paper ws-answer" data-answer hidden>
      <h3 class="ak-head">Answer key — ${cap}</h3>
      <div class="ws-puzzle" data-key>${WS.renderGrid(puzzle, { solution: true })}</div>
    </div>
  </div>`;
  const body = `${controls(page)}
  ${paper}
  <div class="ad-slot no-print">Advertisement</div>
  <div class="prose no-print">
    ${page.blurb ? `<p>${page.blurb}</p>` : ""}
    ${page.tip ? `<p>${page.tip}</p>` : ""}
    <p><b>To print:</b> set the grid size and difficulty above, edit the word list if you like, then hit Print. <b>To save a PDF instead:</b> pick "Save as PDF" as the printer in the print dialog — same result, nothing to install. Everything except the puzzle is stripped from the printout, and the answer key only prints when you've set it to Show.</p>
    <p>This is a real, working generator, not a fixed image: type your own spelling words, vocabulary, or names into the list and the grid rebuilds around them, with an answer key that always marks exactly where each word landed.</p>
  </div>
  <h2 class="no-print">${relatedLabel}</h2>
  <div class="no-print">${grid(related)}</div>
  <div class="ad-slot no-print">Advertisement</div>`;
  writePage(`/${page.slug}/`, layout({
    title: `${page.title} — Free Printable (PDF)`,
    desc: `${page.blurb.split(". ")[0]}. Pick a grid size and difficulty, edit the words, then print or save as a PDF. Free, no signup.`,
    urlPath: `/${page.slug}/`,
    h1: page.title,
    body,
  }));
}

// ---- build --------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
for (const entry of fs.readdirSync(OUT)) {
  if (entry === ".git" || entry === "CNAME") continue;
  fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
}
for (const f of fs.readdirSync(ASSETS)) fs.copyFileSync(path.join(ASSETS, f), path.join(OUT, f));

// one page per puzzle
for (const page of DATA.pages) {
  const related = DATA.pages.filter(o => o.slug !== page.slug).map(pageLink);
  wsPage(page, related, "More printable word searches");
}

// -- homepage --
{
  const title = `Free Printable Word Search Maker — Customize and Print (PDF)`;
  const desc = `Free printable word search generator. Type your own words or pick a themed puzzle, choose a grid size and difficulty, then print or save as a PDF — answer key included. No signup.`;
  let sections = "";
  for (const g of GROUPS) {
    const inGroup = DATA.pages.filter(p => p.group === g.id);
    if (!inGroup.length) continue;
    sections += `<h2 id="${g.id}">${g.label}</h2>\n  ${grid(inGroup.map(pageLink))}\n`;
  }
  const body = `<p class="lead">Type any word list and a printable word search builds instantly — or grab a ready-made holiday or themed puzzle. Pick a grid size and difficulty, then print or save as a PDF from the print dialog. No downloads, no account, and every puzzle comes with a show-or-hide answer key.</p>
  ${sections}
  <div class="ad-slot no-print">Advertisement</div>
  <div class="prose"><p>These are working puzzles, not template downloads: the grid you see on each page is the one that prints, and it rebuilds around whatever words you type. Change the grid size, allow diagonals and backwards words for a harder hunt, and the print stylesheet strips everything but the puzzle — with the answer key on its own page when you want it.</p></div>`;
  writePage(`/`, layout({ title, desc, urlPath: `/`, h1: `Free Printable Word Search Maker`, body }));
}

// -- sitemap + robots + meta files --
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${DOMAIN}${BASE}${u}</loc></url>`).join("\n")}
</urlset>`;
fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");
fs.writeFileSync(path.join(OUT, "CNAME"), "wordsearch.elevatedprogress.com\n");
fs.writeFileSync(path.join(OUT, "ads.txt"), "google.com, pub-5580575158570188, DIRECT, f08c47fec0942fa0\n");

console.log(`Generated ${urls.length} pages into ./public`);
