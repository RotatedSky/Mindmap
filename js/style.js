(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  let panel = null, hint = null, controls = null, open = false, recording = false;
  let els = {};

  function init() {
    panel = document.getElementById("style-panel");
    hint = document.getElementById("style-hint");
    controls = document.getElementById("style-controls");
    panel.querySelector(".panel-close").addEventListener("click", () => setOpen(false));
    els = {
      bg: panel.querySelector("#st-bg"),
      text: panel.querySelector("#st-text"),
      border: panel.querySelector("#st-border"),
      borderW: panel.querySelector("#st-border-w"),
      borderWV: panel.querySelector("#st-border-w-v"),
      radius: panel.querySelector("#st-radius"),
      radiusV: panel.querySelector("#st-radius-v"),
      fs: panel.querySelector("#st-fs"),
      fsV: panel.querySelector("#st-fs-v"),
      bold: panel.querySelector("#st-bold")
    };
    els.bg.addEventListener("input", () => setStyle("bg", els.bg.value));
    els.text.addEventListener("input", () => setStyle("textColor", els.text.value));
    els.border.addEventListener("input", () => setStyle("borderColor", els.border.value));
    els.borderW.addEventListener("input", () => {
      els.borderWV.textContent = els.borderW.value;
      setStyle("borderWidth", parseFloat(els.borderW.value));
    });
    els.radius.addEventListener("input", () => {
      els.radiusV.textContent = els.radius.value;
      setStyle("radius", parseFloat(els.radius.value));
    });
    els.fs.addEventListener("input", () => {
      els.fsV.textContent = els.fs.value;
      setStyle("fontSize", parseFloat(els.fs.value));
    });
    els.bold.addEventListener("change", () => {
      setStyle("bold", els.bold.checked ? true : null);
      endRecord();
    });
    for (const id of ["st-bg", "st-text", "st-border", "st-border-w", "st-radius", "st-fs"]) {
      panel.querySelector("#" + id).addEventListener("change", endRecord);
    }
    panel.querySelector("#st-reset").addEventListener("click", () => {
      resetAll();
      endRecord();
    });
    panel.querySelectorAll(".st-rst").forEach((btn) => {
      btn.addEventListener("click", () => {
        setStyle(btn.getAttribute("data-reset"), null);
        endRecord();
      });
    });
    panel.addEventListener("focusout", endRecord);
  }

  function setOpen(v) {
    open = v;
    panel.style.display = v ? "flex" : "none";
    const btn = document.getElementById("btn-style");
    if (btn) btn.classList.toggle("primary", v);
    if (v) {
      const notesBtn = document.getElementById("btn-notes");
      if (M.Notes.isOpen()) {
        M.Notes.setOpen(false);
        if (notesBtn) notesBtn.classList.remove("primary");
      }
      refresh();
    }
  }

  function isOpen() {
    return open;
  }

  function setStyle(key, value) {
    const nodes = M.Model.selectedNodes();
    if (!nodes.length) return;
    if (!recording) {
      recording = true;
      M.Model.record();
    }
    for (const n of nodes) {
      if (value == null) {
        if (n.style) {
          delete n.style[key];
          if (!Object.keys(n.style).length) n.style = null;
        }
      } else {
        if (!n.style) n.style = {};
        n.style[key] = value;
      }
    }
    M.Model.touch();
  }

  function endRecord() {
    recording = false;
  }

  function resetAll() {
    const nodes = M.Model.selectedNodes();
    if (!nodes.length) return;
    if (!recording) {
      recording = true;
      M.Model.record();
    }
    for (const n of nodes) n.style = null;
    M.Model.touch();
  }

  function refresh() {
    if (!open) return;
    const node = M.Model.primaryNode();
    if (!node) {
      hint.style.display = "block";
      controls.style.display = "none";
      return;
    }
    hint.style.display = "none";
    controls.style.display = "block";
    const s = node.style || {};
    const theme = M.Theme.get();
    const isRoot = node.depth === 0;
    els.bg.value = s.bg || "#000000";
    els.text.value = s.textColor || "#000000";
    els.border.value = s.borderColor || "#000000";
    const bw = s.borderWidth != null ? s.borderWidth : 1.5;
    els.borderW.value = bw;
    els.borderWV.textContent = bw;
    const r = s.radius != null ? s.radius : (isRoot ? theme.radius + 2 : theme.radius);
    els.radius.value = r;
    els.radiusV.textContent = r;
    const fs = s.fontSize != null ? s.fontSize : (isRoot ? theme.rootFs : theme.nodeFs);
    els.fs.value = fs;
    els.fsV.textContent = fs;
    els.bold.checked = !!s.bold;
  }

  M.Style = { init, refresh, setOpen, isOpen };
})();
