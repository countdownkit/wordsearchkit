// Word-search controls: grid size, difficulty, editable word list, answer-key
// show/hide, new puzzle, print. The grid is server-rendered for SEO; this
// re-renders it (via the shared WS module) whenever a control changes, so the
// client output matches the server for the same words + params + seed.
(function () {
  const wrap = document.querySelector(".ws-wrap");
  if (!wrap || !window.WS) return;

  const gridEl = wrap.querySelector("[data-grid]");
  const keyEl = wrap.querySelector("[data-key]");
  const listEl = wrap.querySelector("[data-wordlist]");
  const answerEl = wrap.querySelector("[data-answer]");
  const ctl = name => document.querySelector(`[data-ctl=${name}]`);

  let size = +wrap.dataset.size || 15;
  let difficulty = wrap.dataset.difficulty || "diag";
  let seed = wrap.dataset.seed || "word-search";

  function currentWords() {
    const raw = ctl("words") ? ctl("words").value : "";
    return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  }

  function render() {
    const puzzle = WS.buildPuzzle({ words: currentWords(), size: size, difficulty: difficulty, seed: seed });
    gridEl.innerHTML = WS.renderGrid(puzzle);
    listEl.innerHTML = WS.renderWordList(puzzle.words);
    keyEl.innerHTML = WS.renderGrid(puzzle, { solution: true });
  }

  const sizeCtl = ctl("size");
  if (sizeCtl) sizeCtl.addEventListener("change", e => { size = +e.target.value; render(); });

  const diffCtl = ctl("difficulty");
  if (diffCtl) diffCtl.addEventListener("change", e => { difficulty = e.target.value; render(); });

  const wordsCtl = ctl("words");
  if (wordsCtl) wordsCtl.addEventListener("input", render);

  const keyCtl = ctl("answerkey");
  if (keyCtl) keyCtl.addEventListener("change", e => {
    if (e.target.value === "1") answerEl.removeAttribute("hidden");
    else answerEl.setAttribute("hidden", "");
  });

  const newCtl = ctl("new");
  if (newCtl) newCtl.addEventListener("click", () => {
    seed = "ws-" + Date.now() + "-" + Math.floor(Math.random() * 1e9);
    render();
  });

  const printCtl = ctl("print");
  if (printCtl) printCtl.addEventListener("click", () => window.print());

  // Letter cells default to a portrait-friendly page.
  const pageStyle = document.createElement("style");
  pageStyle.textContent = "@page { size: letter portrait; margin: 0.5in; }";
  document.head.appendChild(pageStyle);
})();
