(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const WELCOME_KEY = "mm.welcome.hidden.v1";


  const THEMES = [
    { id: "system", name: "\u8ddf\u968f\u7cfb\u7edf", dot: "#9aa0a6" },
    { id: "blue", name: "\u7ecf\u5178\u84dd", dot: "#2e6fb0" },
    { id: "green", name: "\u6e05\u65b0\u7eff", dot: "#3a9d5c" },
    { id: "red", name: "\u4e2d\u56fd\u7ea2", dot: "#d64545" },
    { id: "sunset", name: "\u65e5\u843d\u6696\u8272", dot: "#e07b39" },
    { id: "violet", name: "\u68a6\u5e7b\u7d2b", dot: "#7a5bd8" },
    { id: "ocean", name: "\u6d77\u6d0b\u9752", dot: "#17a2a8" },
    { id: "paper", name: "\u6696\u7eb8\u7c73\u9ec4", dot: "#a97c3f" },
    { id: "night", name: "\u6df1\u8272\u591c\u95f4", dot: "#1c2230" },
    { id: "mono", name: "\u7b80\u7ea6\u9ed1\u767d", dot: "#222222" },
    { id: "morandi", name: "\u83ab\u5170\u8fea", dot: "#8f7e6d" }
  ];

  function systemDark() {
    return !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function resolveTheme(themeId) {
    if (themeId === "system") return systemDark() ? "night" : "blue";
    return themeId;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, warn) {
    const box = $("toasts");
    const el = document.createElement("div");
    el.className = "toast" + (warn ? " warn" : "");
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  function modal(opts) {
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    const m = document.createElement("div");
    m.className = "modal";
    m.innerHTML = "<h3></h3><div class='m-body'></div>";
    m.querySelector("h3").textContent = opts.title || "";
    m.querySelector(".m-body").innerHTML = opts.body || "";
    const actions = document.createElement("div");
    actions.className = "m-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = opts.cancel || "\u53d6\u6d88";
    const okBtn = document.createElement("button");
    okBtn.className = "primary";
    okBtn.textContent = opts.ok || "\u786e\u5b9a";
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    m.appendChild(actions);
    mask.appendChild(m);
    document.body.appendChild(mask);

    function close() {
      mask.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    cancelBtn.addEventListener("click", close);
    okBtn.addEventListener("click", () => {
      try {
        const r = opts.onOk && opts.onOk(m);
        if (r !== false) close();
      } catch (err) { /* keep open */ }
    });
    return { el: m, close };
  }

  function showHelp() {
    const rows = [
      ["F2 / \u53cc\u51fb", "\u7f16\u8f91\u8282\u70b9\u6587\u5b57"],
      ["Tab", "\u6dfb\u52a0\u5b50\u8282\u70b9"],
      ["Enter", "\u6dfb\u52a0\u5144\u5f1f\u8282\u70b9"],
      ["Delete / Backspace", "\u5220\u9664\u8282\u70b9\uff08\u542b\u5b50\u6811\uff09"],
      ["\u7a7a\u683c", "\u6536\u8d77 / \u5c55\u5f00\u5f53\u524d\u8282\u70b9"],
      ["[ / ]", "\u6536\u8d77 / \u5c55\u5f00\u5f53\u524d\u8282\u70b9"],
      ["Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y", "\u64a4\u9500 / \u91cd\u505a"],
      ["Ctrl+C / X / V", "\u590d\u5236 / \u526a\u5207 / \u7c98\u8d34\u8282\u70b9\u5b50\u6811"],
      ["Ctrl+A", "\u5168\u9009\u53ef\u89c1\u8282\u70b9"],
      ["Ctrl+F", "\u641c\u7d22\u8282\u70b9"],
      ["Ctrl+S", "\u4fdd\u5b58\u5230 .mind \u6587\u4ef6"],
      ["?", "\u67e5\u770b\u5feb\u6377\u952e\u8bf4\u660e"],
      ["Shift/Ctrl+\u70b9\u51fb\u8282\u70b9", "\u52a0\u9009 / \u51cf\u9009\u8282\u70b9"],
      ["Shift/Ctrl+\u62d6\u52a8\u7a7a\u767d\u533a", "\u6846\u9009\u591a\u4e2a\u8282\u70b9"],
      ["\u62d6\u52a8\u8282\u70b9\u5230\u76ee\u6807", "\u8c03\u6574\u7236\u5b50\u5173\u7cfb\uff08\u6811\u5f62\u6a21\u5f0f\uff09"],
      ["\u6eda\u8f6e / \u53cc\u6307\u7f29\u653e", "\u7f29\u653e\u753b\u5e03"],
      ["\u62d6\u52a8\u7a7a\u767d\u533a\u57df", "\u5e73\u79fb\u753b\u5e03"],
      ["\u53f3\u952e / \u957f\u6309", "\u67e5\u770b\u8282\u70b9\u64cd\u4f5c\u83dc\u5355"],
      ["\u53f3\u952e\u8282\u70b9 \u2192 \u5efa\u7acb\u5173\u8054", "\u70b9\u51fb\u53e6\u4e00\u4e2a\u8282\u70b9\u5b8c\u6210\u8fde\u7ebf"],
      ["\u53f3\u952e\u5173\u8054\u7ebf", "\u7f16\u8f91\u6ce8\u91ca / \u5220\u9664 / \u53cd\u8f6c\u65b9\u5411"],
      ["Esc", "\u53d6\u6d88\u7f16\u8f91 / \u53d6\u6d88\u8fde\u7ebf / \u5173\u95ed\u5bf9\u8bdd\u6846"]
    ];
    const html = "<table class='shortcuts'>" + rows.map((r) => "<tr><td><kbd>" + r[0] + "</kbd></td><td>" + r[1] + "</td></tr>").join("") + "</table>";
    modal({ title: "\u5feb\u6377\u952e\u8bf4\u660e", body: html, ok: "\u5173\u95ed" });
  }

  function tplCard(t) {
    return "<div class='tpl-card' data-tpl='" + t.id + "'><h4>" + t.name + "</h4><p>" + t.desc + "</p></div>";
  }

  function tplBody(extraHint) {
    return (extraHint ? "<div class='m-hint'>" + extraHint + "</div>" : "") +
      "<div class='tpl-grid'>" + M.Model.templates.map(tplCard).join("") +
      "<div class='tpl-card tpl-blank' data-tpl=''><h4>\u7a7a\u767d\u601d\u7eea\u56fe</h4><p>\u4ec5\u6839\u8282\u70b9\uff0c\u4ece\u96f6\u5f00\u59cb\u7ed8\u5236</p></div></div>";
  }

  function wireTpl(dlg) {
    dlg.el.querySelectorAll(".tpl-card").forEach((card) => {
      card.addEventListener("click", () => {
        const tplId = card.getAttribute("data-tpl");
        dlg.close();
        if (!tplId) {
          const root = M.Model.createNode("\u6839\u8282\u70b9");
          M.Model.change(() => M.Model.replaceRoot(root));
        } else {
          M.Model.change(() => M.Model.applyTemplate(tplId));
        }
        syncControls();
        M.Layout.layoutAll();
        M.Render.render();
        M.Render.fit();
      });
    });
  }

  function showNewDialog() {
    const dlg = modal({
      title: "\u65b0\u5efa\u601d\u7eea\u56fe",
      body: tplBody("\u5c06\u66ff\u6362\u5f53\u524d\u601d\u7eea\u56fe\u5185\u5bb9\uff0c\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002"),
      ok: "\u53d6\u6d88"
    });
    wireTpl(dlg);
  }

  function showWelcome() {
    const dlg = modal({
      title: "\u6b22\u8fce\u4f7f\u7528\u601d\u7eea\u56fe\u5de5\u5177",
      body: "<div class='m-hint'>\u9009\u62e9\u4e00\u4e2a\u6a21\u677f\u5f00\u59cb\uff0c\u6216\u76f4\u63a5\u521b\u5efa\u7a7a\u767d\u601d\u7eea\u56fe\u3002\u5411\u4e0a\u62d6\u52a8\u7a7a\u767d\u533a\u57df\u53ef\u5e73\u79fb\u753b\u5e03\uff0c\u6eda\u8f6e\u53ef\u7f29\u653e\u3002\u53f3\u952e\u8282\u70b9\u53ef\u6dfb\u52a0\u5916\u6846\u5206\u7ec4\uff0c\u70b9\u51fb\u5916\u6846\u53ef\u8c03\u6574\u5176\u6837\u5f0f\u3002</div>" +
        tplBody(""),
      ok: "\u6682\u4e0d\uff0c\u5148\u770b\u770b\u793a\u4f8b"
    });
    dlg.el.addEventListener("click", () => localStorage.setItem(WELCOME_KEY, "1"));
    wireTpl(dlg);
  }

  function showImportDialog() {
    const dlg = modal({
      title: "\u5bfc\u5165",
      body: "<div class='m-row'><button class='m-option' id='imp-open'>\u6253\u5f00 .mind / .json \u6587\u4ef6\uff08\u53ef\u56de\u5199\u4fdd\u5b58\uff09</button></div>" +
        "<div class='m-row'><button class='m-option' id='imp-json'>\u4ece JSON \u6587\u4ef6\u5bfc\u5165</button></div>" +
        "<div class='m-row'><button class='m-option' id='imp-md'>\u4ece Markdown \u6587\u672c\u5bfc\u5165</button></div>",
      ok: "\u5173\u95ed"
    });
    dlg.el.querySelector("#imp-open").addEventListener("click", () => {
      dlg.close();
      const r = M.Storage.openFile();
      if (r === null) $("file-input").click();
    });
    dlg.el.querySelector("#imp-json").addEventListener("click", () => {
      dlg.close();
      $("file-input").click();
    });
    dlg.el.querySelector("#imp-md").addEventListener("click", () => {
      dlg.close();
      showMarkdownDialog();
    });
  }

  function showExportDialog() {
    const hasPrimary = !!M.Model.primaryNode();
    const body = "" +
      "<div class='m-row'><label>\u683c\u5f0f</label><select id='ex-fmt'><option>PNG</option><option>JPEG</option><option>SVG</option><option>PDF</option><option value='markdown'>Markdown \u5927\u7eb2</option><option value='json'>JSON \u5907\u4efd</option></select></div>" +
      "<div class='m-row' id='ex-scale-row'><label>\u5206\u8fa8\u7387</label><select id='ex-scale'><option value='1'>1x</option><option value='2' selected>2x\uff08\u63a8\u8350\uff09</option><option value='3'>3x</option></select></div>" +
      "<div class='m-row' id='ex-bg-row'><label>\u80cc\u666f</label><select id='ex-bg'><option value='theme'>\u4e3b\u9898\u80cc\u666f</option><option value='white'>\u767d\u8272</option><option value='transparent'>\u900f\u660e\uff08PNG/SVG\uff09</option></select></div>" +
      "<div class='m-row' id='ex-multi-row' style='display:none'><label><input type='checkbox' id='ex-multi'> A4 \u5206\u9875\u6253\u5370\u7248\uff08\u591a\u9875\uff09</label></div>" +
      "<div class='m-row' id='ex-scope-row'><label>\u8303\u56f4</label><select id='ex-scope'><option value='all'>\u6574\u5f20\u601d\u7eea\u56fe</option><option value='branch'>\u4ec5\u9009\u4e2d\u8282\u70b9\u5206\u652f</option></select></div>" +
      "<div class='m-hint'>\u56fe\u7247/\u6587\u6863\u5bfc\u51fa\u6548\u679c\u8ddf\u968f\u5f53\u524d\u4e3b\u9898\u4e0e\u5c55\u5f00\u72b6\u6001\uff1b\u8fdc\u7a0b\u56fe\u7247\u4e0d\u80fd\u4fdd\u8bc1\u8fdb\u5165\u5bfc\u51fa\u6587\u4ef6\u3002</div>";
    modal({
      title: "\u5bfc\u51fa",
      body,
      ok: "\u5bfc\u51fa",
      onOk: (root) => {
        const fmt = root.querySelector("#ex-fmt").value.toLowerCase();
        const scopeEl = root.querySelector("#ex-scope");
        const scope = scopeEl && scopeEl.value === "branch" ? M.Model.primaryNode() : null;
        if (fmt === "markdown") { exportMarkdown(scope); return true; }
        if (fmt === "json") { M.Storage.exportJSON(); return true; }
        const scale = parseInt(root.querySelector("#ex-scale").value, 10);
        const bg = root.querySelector("#ex-bg").value;
        const multi = root.querySelector("#ex-multi").checked;
        const opts = { scale, bg, multipage: multi, scope };
        if (fmt === "png") M.Exporter.exportPNG(opts);
        else if (fmt === "jpeg") M.Exporter.exportJPEG(opts);
        else if (fmt === "svg") M.Exporter.exportSVG(opts);
        else M.Exporter.exportPDF(opts);
        return true;
      }
    });
    const m = document.querySelector(".modal");
    const fmtSelEl = m.querySelector("#ex-fmt");
    const scaleRow = m.querySelector("#ex-scale-row");
    const bgRow = m.querySelector("#ex-bg-row");
    const multiRow = m.querySelector("#ex-multi-row");
    const scopeRow = m.querySelector("#ex-scope-row");
    const scopeSel = m.querySelector("#ex-scope");
    if (!hasPrimary) scopeSel.disabled = true;
    fmtSelEl.addEventListener("change", () => {
      const v = fmtSelEl.value;
      const isImage = v === "PNG" || v === "JPEG" || v === "SVG" || v === "PDF";
      scaleRow.style.display = isImage ? "flex" : "none";
      bgRow.style.display = isImage ? "flex" : "none";
      multiRow.style.display = v === "PDF" ? "flex" : "none";
      scopeRow.style.display = (isImage || v === "markdown") ? "flex" : "none";
    });
  }

  function showMarkdownDialog() {
    modal({
      title: "\u4ece Markdown \u5bfc\u5165",
      body: "<textarea id='md-input' placeholder='\u4f8b\u5982\uff1a\n- \u4e2d\u5fc3\u4e3b\u9898\n  - \u5206\u652f\u4e00\n    - \u5b50\u8282\u70b9\n  - \u5206\u652f\u4e8c\n\n\u652f\u6301\u7f29\u8fdb\u5217\u8868\uff08- * + \u6570\u5b57\uff09\u3001# \u6807\u9898\u3001[\\u6587\\u5b57](\\u94fe\\u63a5) \u3001![\\u56fe](\\u5730\\u5740)\u3001> \\u5907\u6ce8'></textarea>",
      ok: "\u5bfc\u5165\u5e76\u8986\u76d6\u5f53\u524d\u601d\u7eea\u56fe",
      onOk: (root) => {
        const text = root.querySelector("#md-input").value;
        if (!text.trim()) return false;
        const parsed = M.Markdown.parse(text);
        M.Model.change(() => M.Model.replaceRoot(parsed));
        M.Render.fit();
        M.App.toast("\u5dfc\u5165\u6210\u529f\uff0cCtrl+Z \u53ef\u64a4\u9500");
        return true;
      }
    });
  }

  function exportMarkdown(scope) {
    const text = M.Markdown.serialize(scope || M.Model.root);
    const blob = new Blob([text], { type: "text/markdown" });
    M.Exporter.saveBlob(blob, (scope ? (scope.text.slice(0, 40) || "branch") : "mindmap") + ".md", "text/markdown")
      .then((ok) => { if (ok) toast("\u5df2\u5bfc\u51fa Markdown" + (scope ? "\uff08\u5206\u652f\uff09" : "")); });
  }

  function applyTheme(themeId) {
    document.documentElement.dataset.theme = resolveTheme(themeId);
    M.Model.setSettings({ theme: themeId, bg: "" });
    applyBg();
    $("bg-color").value =
      getComputedStyle(document.documentElement).getPropertyValue("--canvas-bg").trim();
    M.Layout.layoutAll();
    M.Storage.save();
    M.Render.render();
  }

  function applyBg() {
    const bg = M.Model.settings.bg;
    const root = document.documentElement;
    const body = document.body;
    if (bg) {
      root.style.setProperty("--canvas-bg", bg);
      body.style.setProperty("--canvas-bg", bg);
    } else {
      root.style.removeProperty("--canvas-bg");
      body.style.removeProperty("--canvas-bg");
    }
  }

  function wireToolbar() {
    $("btn-new").addEventListener("click", showNewDialog);
    $("btn-undo").addEventListener("click", () => M.Model.undo());
    $("btn-redo").addEventListener("click", () => M.Model.redo());
    $("btn-import").addEventListener("click", showImportDialog);
    $("btn-save").addEventListener("click", () => M.Storage.saveToFile());
    $("file-input").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) M.Storage.importJSON(f);
      e.target.value = "";
    });

    const themeSel = $("theme-select");
    for (const t of THEMES) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      themeSel.appendChild(opt);
    }
    themeSel.addEventListener("change", () => applyTheme(themeSel.value));

    const lineSel = $("line-style-select");
    for (const s of M.Render.LINE_STYLES) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name;
      lineSel.appendChild(opt);
    }
    lineSel.addEventListener("change", () => {
      M.Model.setSettings({ lineStyle: lineSel.value });
      M.Storage.save();
      M.Render.render();
    });

    const layoutSel = $("layout-select");
    layoutSel.addEventListener("change", () => {
      if (layoutSel.value === "free") M.Layout.initFreePositions();
      M.Model.setSettings({ layoutMode: layoutSel.value });
      M.Layout.layoutAll();
      M.Storage.save();
      M.Render.render();
      M.Render.fit();
    });

    const dirSel = $("direction-select");
    dirSel.addEventListener("change", () => {
      M.Model.setSettings({ direction: dirSel.value });
      M.Layout.layoutAll();
      M.Storage.save();
      M.Render.render();
      M.Render.fit();
    });

    const bgInput = $("bg-color");
    bgInput.addEventListener("input", () => {
      M.Model.setSettings({ bg: bgInput.value });
      applyBg();
      M.Storage.save();
      M.Render.render();
    });
    $("btn-bg-reset").addEventListener("click", () => {
      M.Model.setSettings({ bg: "" });
      applyBg();
      bgInput.value = getComputedStyle(document.documentElement).getPropertyValue("--canvas-bg").trim();
      M.Storage.save();
      M.Render.render();
    });

    $("btn-expand-all").addEventListener("click", () => {
      M.Model.change(() => {
        M.Model.allNodes(M.Model.root).forEach((n) => { n.collapsed = false; });
      });
      M.Render.fit();
    });
    $("btn-collapse-all").addEventListener("click", () => {
      M.Model.change(() => {
        M.Model.allNodes(M.Model.root).forEach((n) => { if (n !== M.Model.root) n.collapsed = true; });
      });
      M.Render.fit();
    });

    $("btn-search").addEventListener("click", () => M.Search.open());
    $("btn-outline").addEventListener("click", () => {
      const v = !M.Outline.isOpen();
      M.Outline.setOpen(v);
      $("btn-outline").classList.toggle("primary", v);
    });
    $("btn-notes").addEventListener("click", () => {
      setNotesOpen(!M.Notes.isOpen());
    });
    $("btn-style").addEventListener("click", () => {
      M.Style.setOpen(!M.Style.isOpen());
    });

    $("btn-export").addEventListener("click", showExportDialog);
    $("btn-help").addEventListener("click", showHelp);

    $("btn-zoom-in").addEventListener("click", () => M.Editor.zoomBy(1.25));
    $("btn-zoom-out").addEventListener("click", () => M.Editor.zoomBy(0.8));
    $("btn-zoom-fit").addEventListener("click", () => M.Render.fit());
  }

  function onModelChange() {
    M.Layout.layoutAll();
    M.Render.render();
    M.Outline.refresh();
    M.Notes.refresh();
    M.Style.refresh();
    M.Storage.save();
    updateEmptyHint();
  }

  function updateEmptyHint() {
    const hint = $("empty-hint");
    if (!hint || !M.Model.root) return;
    hint.style.display = M.Model.root.children.length === 0 ? "" : "none";
  }

  function syncControls() {
    const s = M.Model.settings;
    document.documentElement.dataset.theme = resolveTheme(s.theme);
    applyBg();
    $("theme-select").value = s.theme;
    $("line-style-select").value = s.lineStyle || "default";
    $("layout-select").value = s.layoutMode || "tree";
    $("direction-select").value = s.direction || "right";
    $("bg-color").value = s.bg || getComputedStyle(document.documentElement).getPropertyValue("--canvas-bg").trim();
  }

  function setNotesOpen(v) {
    M.Notes.setOpen(v);
    $("btn-notes").classList.toggle("primary", v);
  }

  function start() {
    syncControls();
    M.Layout.layoutAll();
    M.Render.render();
    M.Render.fit();
    updateEmptyHint();
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (M.Model.settings.theme === "system") {
          document.documentElement.dataset.theme = resolveTheme("system");
          M.Layout.layoutAll();
          M.Render.render();
        }
      });
    }
    M.Math.fontsReady()
      .then(() => M.Math.precache())
      .then(() => {
        M.Layout.layoutAll();
        M.Render.render();
      });

    if (!localStorage.getItem(WELCOME_KEY)) showWelcome();

    M.Model.onChange = onModelChange;

    window.addEventListener("pagehide", () => M.Storage.flush());

    if (location.protocol === "http:" || location.protocol === "https:") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      }
    }
  }

  function init() {
    M.Render.init($("canvas"));
    M.Search.init();
    M.Outline.init();
    M.Notes.init();
    M.Style.init();
    M.Editor.init($("canvas-wrap"), $("canvas"));
    M.Minimap.init($("minimap"));
    wireToolbar();

    M.Storage.init().then(start);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  M.App = { init, toast, modal, showHelp, showWelcome, showNewDialog, setNotesOpen };
})();
