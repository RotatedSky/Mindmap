(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  let panel = null, titleEl = null, ta = null, hintEl = null, open = false;
  let lastId = null, timer = null;

  function init() {
    panel = document.getElementById("notes-panel");
    titleEl = document.getElementById("notes-title");
    ta = panel.querySelector("textarea");
    hintEl = document.getElementById("notes-hint");
    panel.querySelector(".panel-close").addEventListener("click", () => setOpen(false));
    ta.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(save, 400);
    });
  }

  function setOpen(v) {
    open = v;
    panel.style.display = v ? "flex" : "none";
    if (v) refresh();
  }

  function isOpen() {
    return open;
  }

  function refresh() {
    if (!open) return;
    const node = M.Model.primaryNode();
    if (!node) {
      lastId = null;
      ta.value = "";
      titleEl.textContent = "";
      ta.style.display = "none";
      hintEl.style.display = "block";
      return;
    }
    hintEl.style.display = "none";
    ta.style.display = "block";
    if (lastId !== node.id) {
      lastId = node.id;
      ta.value = node.notes || "";
    }
    titleEl.textContent = node.text || "\uff08\u7a7a\uff09";
  }

  function save() {
    if (!lastId) return;
    const node = M.Model.find(M.Model.root, lastId);
    if (!node) return;
    const v = ta.value.trim();
    if ((node.notes || "") !== v) {
      M.Model.change(() => { node.notes = v ? v : null; });
    }
  }

  M.Notes = { init, refresh, setOpen, isOpen };
})();
