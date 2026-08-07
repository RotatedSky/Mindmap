(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const st = {
    open: false,
    query: "",
    matches: new Set(),
    order: [],
    index: 0
  };

  let bar = null, input = null, countEl = null;

  function init() {
    bar = document.getElementById("search-bar");
    input = bar.querySelector("input");
    countEl = document.getElementById("search-count");
    input.addEventListener("input", () => {
      st.query = input.value;
      compute();
      jumpTo(st.index);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (st.order.length) {
          st.index = (st.index + 1) % st.order.length;
          jumpTo(st.index);
        }
      } else if (e.key === "Escape") {
        close();
      }
    });
    bar.querySelector("[data-act=prev]").addEventListener("click", () => {
      if (!st.order.length) return;
      st.index = (st.index - 1 + st.order.length) % st.order.length;
      jumpTo(st.index);
    });
    bar.querySelector("[data-act=next]").addEventListener("click", () => {
      if (!st.order.length) return;
      st.index = (st.index + 1) % st.order.length;
      jumpTo(st.index);
    });
    bar.querySelector("[data-act=close]").addEventListener("click", close);
  }

  function compute() {
    st.matches.clear();
    st.order = [];
    const q = st.query.trim().toLowerCase();
    if (!q) return;
    for (const n of M.Model.visibleNodes(M.Model.root)) {
      if ((n.text || "").toLowerCase().includes(q)) {
        st.matches.add(n.id);
        st.order.push(n.id);
      }
    }
    st.index = 0;
    M.Render.applySelectionClasses();
  }

  function refresh() {
    compute();
    updateCount();
  }

  function updateCount() {
    countEl.textContent = st.order.length ? (st.index + 1) + "/" + st.order.length : (st.query ? "0" : "");
  }

  function jumpTo(i) {
    if (!st.order.length) return;
    st.index = i % st.order.length;
    const node = M.Model.find(M.Model.root, st.order[st.index]);
    if (!node) return;
    M.Render.centerOn(node);
    updateCount();
  }

  function open() {
    st.open = true;
    bar.style.display = "flex";
    input.focus();
    input.select();
    if (st.query) refresh();
  }

  function close() {
    st.open = false;
    bar.style.display = "none";
    st.matches.clear();
    st.order = [];
    input.value = "";
    st.query = "";
    M.Render.applySelectionClasses();
  }

  function isOpen() {
    return st.open;
  }

  function currentMatches() {
    return st.matches;
  }

  M.Search = { init, open, close, refresh, isOpen, currentMatches };
})();
