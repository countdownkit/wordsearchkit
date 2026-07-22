/*
 * Shared word-search logic — used by BOTH generate.js (Node, server render) and
 * tool.js (browser, re-render on control change) so server + client output match
 * exactly for a given word list + params + seed.
 * UMD-ish: attaches to module.exports under Node, window.WS in the browser.
 *
 * A SEEDED PRNG (mulberry32) drives placement + filler letters, seeded from the
 * page slug so `node generate.js` emits byte-identical HTML every build (no git
 * churn). The client "New puzzle" button reseeds from a fresh random string.
 * The answer key is built FROM the recorded placements, so it always marks the
 * exact cells each word occupies — never a guess.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WS = factory();
})(typeof self !== "undefined" ? self : this, function () {

  // ---- seeded PRNG -------------------------------------------------------
  // Hash a string to a 32-bit seed, then mulberry32 for a fast, stable stream.
  function hashSeed(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeRng(seedStr) { return mulberry32(hashSeed(String(seedStr))); }

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Direction vectors [dx, dy] (x = column, y = row). Difficulty grows the set.
  //   hv   — across (left→right) and down only
  //   diag — + the two downward diagonals
  //   all  — + every reverse (backwards / up / up-diagonal)
  const DIRSETS = {
    hv:   [[1, 0], [0, 1]],
    diag: [[1, 0], [0, 1], [1, 1], [-1, 1]],
    all:  [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]],
  };

  // Clean the word list: uppercase, letters only, drop dupes, drop anything
  // shorter than 2 or longer than the grid (it could never fit).
  function normalizeWords(list, size) {
    const seen = {}, out = [];
    (list || []).forEach(w => {
      const cleaned = String(w).toUpperCase().replace(/[^A-Z]/g, "");
      if (cleaned.length >= 2 && cleaned.length <= size && !seen[cleaned]) {
        seen[cleaned] = 1;
        out.push(cleaned);
      }
    });
    return out;
  }

  // Pick a valid start coordinate on one axis for a run of `len` cells.
  // Always consumes exactly one rng() call, whatever the direction — this keeps
  // the stream position deterministic so builds stay byte-identical.
  function startCoord(delta, len, size, rng) {
    if (delta > 0) return Math.floor(rng() * (size - len + 1));            // 0 .. size-len
    if (delta < 0) return (len - 1) + Math.floor(rng() * (size - len + 1)); // len-1 .. size-1
    return Math.floor(rng() * size);                                       // any column/row
  }

  // Try to drop one word into the grid. Overlaps are allowed ONLY where the
  // existing letter already matches. Returns {cells, dir} or null after K tries.
  function placeWord(grid, word, dirs, rng, size) {
    const len = word.length, K = 300;
    for (let t = 0; t < K; t++) {
      const d = dirs[Math.floor(rng() * dirs.length)];
      const dx = d[0], dy = d[1];
      const c0 = startCoord(dx, len, size, rng);
      const r0 = startCoord(dy, len, size, rng);
      let ok = true;
      const cells = [];
      for (let i = 0; i < len; i++) {
        const c = c0 + dx * i, r = r0 + dy * i;
        const cur = grid[r][c];
        if (cur !== null && cur !== word[i]) { ok = false; break; }
        cells.push({ r: r, c: c });
      }
      if (ok) {
        for (let i = 0; i < len; i++) grid[cells[i].r][cells[i].c] = word[i];
        return { cells: cells, dir: [dx, dy] };
      }
    }
    return null;
  }

  // Build a complete puzzle. opts: { words, size, difficulty, seed }
  // Returns { grid, size, words (only the ones actually placed), placements }.
  function buildPuzzle(opts) {
    const size = opts.size || 15;
    const rng = makeRng(opts.seed);
    const dirs = DIRSETS[opts.difficulty] || DIRSETS.diag;
    const words = normalizeWords(opts.words, size);

    const grid = [];
    for (let r = 0; r < size; r++) { grid.push(new Array(size).fill(null)); }

    const placements = [], placed = [];
    for (let i = 0; i < words.length; i++) {
      const p = placeWord(grid, words[i], dirs, rng, size);
      if (p) { placements.push({ word: words[i], cells: p.cells, dir: p.dir }); placed.push(words[i]); }
    }

    // fill the leftover cells with random letters (deterministic via rng)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) grid[r][c] = LETTERS[Math.floor(rng() * 26)];
      }
    }
    return { grid: grid, size: size, words: placed, placements: placements };
  }

  // ---- rendering ---------------------------------------------------------
  // The letter grid. With {solution:true}, only the cells covered by a word are
  // filled (from the recorded placements) — that IS the answer key.
  function renderGrid(puzzle, opts) {
    opts = opts || {};
    const solution = !!opts.solution;
    let hit = null;
    if (solution) {
      hit = {};
      puzzle.placements.forEach(p => p.cells.forEach(c => { hit[c.r + "-" + c.c] = 1; }));
    }
    let rows = "";
    for (let r = 0; r < puzzle.size; r++) {
      let tds = "";
      for (let c = 0; c < puzzle.size; c++) {
        const ch = puzzle.grid[r][c];
        if (solution) {
          const on = hit[r + "-" + c];
          tds += `<td class="${on ? "hit" : "off"}">${on ? ch : ""}</td>`;
        } else {
          tds += `<td>${ch}</td>`;
        }
      }
      rows += `<tr>${tds}</tr>`;
    }
    return `<table class="ws-grid s${puzzle.size}${solution ? " ws-key" : ""}"><tbody>${rows}</tbody></table>`;
  }

  function renderWordList(words) {
    return `<ul class="ws-words">` + words.map(w => `<li>${w}</li>`).join("") + `</ul>`;
  }

  return {
    hashSeed, mulberry32, makeRng, DIRSETS,
    normalizeWords, buildPuzzle, placeWord, renderGrid, renderWordList,
  };
});
